const KEY_ALLOWED = /^staging\/v2\/home\/(?:manifest\.json|[a-f0-9]{64}\.json|images\/[a-f0-9]{64}\.png|runs\/[0-9]+\.json)$/;
const HASHED_JSON = /^staging\/v2\/home\/([a-f0-9]{64})\.json$/;
const HASHED_PNG = /^staging\/v2\/home\/images\/([a-f0-9]{64})\.png$/;
const RUN = /^staging\/v2\/home\/runs\/[0-9]+\.json$/;
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MIN_TOKEN_BYTES = 32;
const MAX_TOKEN_BYTES = 4096;
const MAX_CURSOR_BYTES = 4096;
const encoder = new TextEncoder();

type ObjectPolicy = Readonly<{
  cacheControl: string;
  contentType: "application/json" | "image/png";
  immutableHash: string | null;
  limit: number;
}>;

type GatewayEnv = Env & Readonly<{ GATEWAY_TOKEN?: string }>;

function json(body: Readonly<Record<string, unknown>>, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");
  return Response.json(body, { status, headers });
}

function error(code: string, status: number, extraHeaders?: HeadersInit): Response {
  return json({ error: code }, status, extraHeaders);
}

function policyFor(key: string): ObjectPolicy | null {
  if (!KEY_ALLOWED.test(key)) return null;
  const png = HASHED_PNG.exec(key);
  if (png) return {
    cacheControl: "public,max-age=31536000,immutable",
    contentType: "image/png",
    immutableHash: png[1],
    limit: 2 * 1024 * 1024,
  };
  const hashedJson = HASHED_JSON.exec(key);
  if (hashedJson) return {
    cacheControl: "public,max-age=31536000,immutable",
    contentType: "application/json",
    immutableHash: hashedJson[1],
    limit: 64 * 1024,
  };
  if (RUN.test(key)) return {
    cacheControl: "no-store",
    contentType: "application/json",
    immutableHash: null,
    limit: 4 * 1024,
  };
  return {
    cacheControl: "no-cache",
    contentType: "application/json",
    immutableHash: null,
    limit: 64 * 1024,
  };
}

function oneQueryValue(url: URL, name: string, allowedNames: ReadonlySet<string>): string | null {
  for (const key of url.searchParams.keys()) if (!allowedNames.has(key)) return null;
  const values = url.searchParams.getAll(name);
  return values.length === 1 ? values[0] : null;
}

async function sha256(bytes: Uint8Array): Promise<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return crypto.subtle.digest("SHA-256", copy.buffer);
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function authorize(request: Request, token: string | undefined): Promise<"ok" | "misconfigured" | "unauthorized"> {
  if (typeof token !== "string") return "misconfigured";
  const expected = encoder.encode(token);
  if (expected.byteLength < MIN_TOKEN_BYTES || expected.byteLength > MAX_TOKEN_BYTES) return "misconfigured";

  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get("Authorization") ?? "");
  const suppliedText = match && encoder.encode(match[1]).byteLength <= MAX_TOKEN_BYTES ? match[1] : "";
  const [suppliedHash, expectedHash] = await Promise.all([
    sha256(encoder.encode(suppliedText)),
    sha256(expected),
  ]);
  return crypto.subtle.timingSafeEqual(suppliedHash, expectedHash) ? "ok" : "unauthorized";
}

async function readBounded(stream: ReadableStream<Uint8Array> | null, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  if (stream === null) return new Uint8Array();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new RangeError("body_limit");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function validPngMagic(bytes: Uint8Array): boolean {
  return bytes.byteLength >= PNG_MAGIC.byteLength
    && PNG_MAGIC.every((byte, index) => bytes[index] === byte);
}

function putCondition(request: Request, immutable: boolean): Headers | null {
  const ifMatch = request.headers.get("If-Match");
  const ifNoneMatch = request.headers.get("If-None-Match");
  if ((ifMatch === null) === (ifNoneMatch === null)) return null;

  const condition = new Headers();
  if (ifNoneMatch !== null) {
    if (ifNoneMatch.trim() !== "*") return null;
    condition.set("If-None-Match", "*");
    return condition;
  }
  if (immutable || ifMatch === null || ifMatch.length > 256
      || !/^"[^"\u0000-\u001f\u007f,]+"$/.test(ifMatch)) return null;
  condition.set("If-Match", ifMatch);
  return condition;
}

async function getObject(key: string, policy: ObjectPolicy, env: GatewayEnv): Promise<Response> {
  const object = await env.BUCKET.get(key);
  if (object === null) return error("not_found", 404);
  if (!Number.isSafeInteger(object.size) || object.size < 0 || object.size > policy.limit) {
    return error("upstream_invalid", 502);
  }
  const bytes = await readBounded(object.body, policy.limit);
  if (bytes.byteLength !== object.size) return error("upstream_invalid", 502);
  return new Response(bytes.buffer, {
    headers: {
      "Cache-Control": policy.cacheControl,
      "Content-Length": String(bytes.byteLength),
      "Content-Type": policy.contentType,
      "ETag": object.httpEtag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function putObject(request: Request, key: string, policy: ObjectPolicy, env: GatewayEnv): Promise<Response> {
  const condition = putCondition(request, policy.immutableHash !== null);
  if (condition === null) return error("precondition_required", 428);

  const declared = request.headers.get("Content-Length");
  if (declared !== null) {
    if (!/^(?:0|[1-9][0-9]*)$/.test(declared)) return error("invalid_request", 400);
    const length = Number(declared);
    if (!Number.isSafeInteger(length)) return error("invalid_request", 400);
    if (length > policy.limit) return error("payload_too_large", 413);
  }

  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = await readBounded(request.body, policy.limit);
  } catch (caught) {
    if (caught instanceof RangeError) return error("payload_too_large", 413);
    throw caught;
  }
  if (declared !== null && bytes.byteLength !== Number(declared)) return error("invalid_request", 400);
  if (policy.contentType === "image/png" && !validPngMagic(bytes)) return error("invalid_content", 422);

  let checksum: ArrayBuffer | undefined;
  if (policy.immutableHash !== null) {
    checksum = await sha256(bytes);
    if (hex(checksum) !== policy.immutableHash) return error("content_hash_mismatch", 422);
  }

  const stored = await env.BUCKET.put(key, bytes, {
    onlyIf: condition,
    httpMetadata: {
      cacheControl: policy.cacheControl,
      contentType: policy.contentType,
    },
    ...(checksum === undefined ? {} : { sha256: checksum }),
  });
  if (stored === null) return error("precondition_failed", 412);
  return json({ stored: true }, 200, { ETag: stored.httpEtag });
}

async function inventory(url: URL, env: GatewayEnv): Promise<Response> {
  for (const key of url.searchParams.keys()) if (key !== "cursor") return error("invalid_request", 400);
  const cursors = url.searchParams.getAll("cursor");
  if (cursors.length > 1) return error("invalid_request", 400);
  const cursor = cursors[0];
  if (cursor !== undefined) {
    const size = encoder.encode(cursor).byteLength;
    if (size === 0 || size > MAX_CURSOR_BYTES) return error("invalid_request", 400);
  }
  const page = await env.BUCKET.list({
    limit: 1000,
    include: [],
    ...(cursor === undefined ? {} : { cursor }),
  });
  let bytes = 0;
  for (const object of page.objects) {
    if (!Number.isSafeInteger(object.size) || object.size < 0) return error("upstream_invalid", 502);
    bytes += object.size;
    if (!Number.isSafeInteger(bytes)) return error("upstream_invalid", 502);
  }
  if (page.truncated && page.cursor.length === 0) return error("upstream_invalid", 502);
  return json({ bytes, truncated: page.truncated, cursor: page.truncated ? page.cursor : null });
}

async function route(request: Request, env: GatewayEnv): Promise<Response> {
  const auth = await authorize(request, env.GATEWAY_TOKEN);
  if (auth === "misconfigured") return error("service_unavailable", 503);
  if (auth === "unauthorized") {
    return error("unauthorized", 401, { "WWW-Authenticate": "Bearer" });
  }

  const url = new URL(request.url);
  if (url.pathname === "/inventory") {
    if (request.method !== "GET") return error("method_not_allowed", 405, { Allow: "GET" });
    return inventory(url, env);
  }
  if (url.pathname !== "/object") return error("not_found", 404);
  if (request.method !== "GET" && request.method !== "PUT") {
    return error("method_not_allowed", 405, { Allow: "GET, PUT" });
  }
  const key = oneQueryValue(url, "key", new Set(["key"]));
  const policy = key === null ? null : policyFor(key);
  if (key === null || policy === null) return error("invalid_key", 400);
  return request.method === "GET"
    ? getObject(key, policy, env)
    : putObject(request, key, policy, env);
}

async function fetch(request: Request, env: GatewayEnv): Promise<Response> {
  try {
    return await route(request, env);
  } catch {
    return error("internal_error", 500);
  }
}

export default { fetch } satisfies ExportedHandler<GatewayEnv>;
