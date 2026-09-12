const API_ORIGIN = "https://ishin-global.aktsk.com";
const CDN_HOST = "cf.ishin-global.aktsk.com";
const CDN_PATH = /^\/banners\/en\/gashasocool\/[A-Za-z0-9_-]+\.png$/u;
const API_LIMIT = 43;
const IMAGE_LIMIT = 40;
const API_BYTES = 8 * 1024 * 1024;
const IMAGE_BYTES = 2 * 1024 * 1024;
const CONFIG_BYTES = 32 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;
const ALLOWED_HEADER = /^(?:authorization|content-type|accept|user-agent|x-[a-z0-9!#$%&'*+.^_`|~-]+)$/u;
const HEADER_NAME = /^[a-z0-9!#$%&'*+.^_`|~-]{1,128}$/u;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fail() {
  throw new Error("auth_session_failed");
}

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeHeaders(value) {
  if (!isRecord(value)) fail();
  const normalized = Object.create(null);
  for (const [rawName, rawValue] of Object.entries(value)) {
    const name = rawName.toLowerCase();
    if (
      rawName !== rawName.trim() ||
      !HEADER_NAME.test(name) ||
      !ALLOWED_HEADER.test(name) ||
      Object.prototype.hasOwnProperty.call(normalized, name) ||
      typeof rawValue !== "string" ||
      rawValue.length < 1 ||
      rawValue.length > 8_192 ||
      /[^\u0020-\u007e]/u.test(rawValue)
    ) {
      fail();
    }
    normalized[name] = rawValue;
  }
  return normalized;
}

function normalizeConfig(config) {
  if (!isRecord(config)) fail();
  const expected = new Set(["nonceHeaders", "loginHeaders", "loginBody", "apiHeaders"]);
  if (Object.keys(config).some((key) => !expected.has(key))) fail();

  let serialized;
  try {
    serialized = JSON.stringify(config);
  } catch {
    fail();
  }
  if (typeof serialized !== "string" || Buffer.byteLength(serialized, "utf8") > CONFIG_BYTES) fail();

  const nonceHeaders = normalizeHeaders(config.nonceHeaders);
  const loginHeaders = normalizeHeaders(config.loginHeaders);
  const apiHeaders = normalizeHeaders(config.apiHeaders);
  if (!/^Basic [A-Za-z0-9+/]+={0,2}$/u.test(loginHeaders.authorization ?? "")) fail();
  if (!isRecord(config.loginBody)) fail();

  let loginBody;
  try {
    loginBody = JSON.parse(JSON.stringify(config.loginBody));
  } catch {
    fail();
  }
  if (!isRecord(loginBody)) fail();

  // API captures contain an expired bearer. It is never allowed to survive.
  delete apiHeaders.authorization;
  nonceHeaders["accept-encoding"] = "identity";
  loginHeaders["accept-encoding"] = "identity";
  apiHeaders["accept-encoding"] = "identity";
  loginHeaders["content-type"] = "application/json";
  return { nonceHeaders, loginHeaders, loginBody, apiHeaders };
}

function responseHeader(response, name) {
  if (!response?.headers || typeof response.headers.get !== "function") fail();
  const value = response.headers.get(name);
  return typeof value === "string" ? value : null;
}

async function readBounded(response, maximum) {
  const contentLength = responseHeader(response, "content-length");
  if (contentLength !== null) {
    if (!/^(?:0|[1-9][0-9]*)$/u.test(contentLength)) fail();
    const length = Number(contentLength);
    if (!Number.isSafeInteger(length) || length > maximum) fail();
  }
  if (!response.body || typeof response.body.getReader !== "function") fail();

  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array) || value.byteLength === 0) fail();
      length += value.byteLength;
      if (length > maximum) fail();
      chunks.push(Buffer.from(value));
    }
  } catch {
    try {
      await reader.cancel();
    } catch {
      // Ignore cancellation errors; callers receive only the sanitized failure.
    }
    fail();
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // A failed reader may already have released its lock.
    }
  }
  return Buffer.concat(chunks, length);
}

function parseJson(bytes) {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const value = JSON.parse(text);
    if (!isRecord(value)) fail();
    return value;
  } catch {
    fail();
  }
}

function validateResponse(response, contentType) {
  if (!response || response.status !== 200 || response.redirected === true) fail();
  const encoding = responseHeader(response, "content-encoding");
  if (encoding !== null && encoding.trim().toLowerCase() !== "identity") fail();
  const actualType = responseHeader(response, "content-type")?.split(";", 1)[0].trim().toLowerCase();
  // CDN MIME is advisory: published images must pass PNG signature and full decode.
  // API responses still require JSON; HTML/error bytes can never pass PNG validation.
  if (contentType !== null && actualType !== contentType) fail();
}

function validateImageUrl(value) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 8_192 ||
    /[\u0000-\u0020\\#]/u.test(value)
  ) {
    fail();
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    fail();
  }
  const authority = value.slice("https://".length).split("/", 1)[0];
  if (
    !value.startsWith("https://") ||
    authority.includes("@") ||
    url.protocol !== "https:" ||
    url.hostname !== CDN_HOST ||
    (url.port !== "" && url.port !== "443") ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== "" ||
    url.search.length < 2 ||
    url.pathname.includes("%") ||
    !CDN_PATH.test(url.pathname)
  ) {
    fail();
  }
  return value;
}

function learnGashaIds(value) {
  if (!Array.isArray(value.gashas) || value.gashas.length > 200) fail();
  const ids = new Set();
  for (const row of value.gashas) {
    if (!isRecord(row) || !Number.isSafeInteger(row.id) || row.id < 1 || row.id > 999_999_999) fail();
    ids.add(String(row.id));
  }
  return ids;
}

/**
 * Creates a one-shot, server-side authenticated session around caller-supplied
 * fetch. Secrets stay in closure memory and all outward failures are sanitized.
 */
export function createSession(config, { fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  try {
    if (typeof fetchImpl !== "function") fail();
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > DEFAULT_TIMEOUT_MS) fail();
    let secrets = normalizeConfig(config);
    let token = null;
    let learnedIds = null;
    let gashasRequested = false;
    const requestedIds = new Set();
    const controllers = new Set();
    let apiRequests = 0;
    let imageRequests = 0;
    let closed = false;
    let poisoned = false;
    let authenticating = null;

    function usable() {
      if (closed || poisoned || secrets === null) fail();
    }

    async function perform(url, options, maximum, contentType, isApi) {
      usable();
      if (isApi) {
        if (apiRequests >= API_LIMIT) fail();
        apiRequests += 1;
      } else {
        if (imageRequests >= IMAGE_LIMIT) fail();
        imageRequests += 1;
      }
      const controller = new AbortController();
      controllers.add(controller);
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, {
          ...options,
          credentials: "omit",
          redirect: "error",
          signal: controller.signal,
        });
        validateResponse(response, contentType);
        return await readBounded(response, maximum);
      } catch {
        controller.abort();
        fail();
      } finally {
        clearTimeout(timer);
        controllers.delete(controller);
      }
    }

    async function jsonRequest(path, method, headers, body) {
      const bytes = await perform(
        `${API_ORIGIN}${path}`,
        {
          method,
          headers,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
        API_BYTES,
        "application/json",
        true,
      );
      return parseJson(bytes);
    }

    async function authenticate() {
      const nonce = await jsonRequest("/auth/nonce", "GET", secrets.nonceHeaders);
      const transactionId = nonce.auth_transaction_id;
      if (
        typeof transactionId !== "string" ||
        transactionId.length < 1 ||
        transactionId.length > 4_096 ||
        /[\u0000-\u001f\u007f]/u.test(transactionId)
      ) {
        fail();
      }
      const body = { ...secrets.loginBody, auth_transaction_id: transactionId };
      const login = await jsonRequest("/auth/sign_in", "POST", secrets.loginHeaders, body);
      if (
        typeof login.access_token !== "string" ||
        login.access_token.length < 1 ||
        login.access_token.length > 16_384 ||
        /[\u0000-\u0020\u007f]/u.test(login.access_token) ||
        typeof login.token_type !== "string" ||
        login.token_type.toLowerCase() !== "bearer"
      ) {
        fail();
      }
      token = login.access_token;
      // Login-only material is no longer needed after a fresh bearer is issued.
      secrets.loginBody = null;
      secrets.loginHeaders = null;
      secrets.nonceHeaders = null;
    }

    async function ensureAuthenticated() {
      if (token !== null) return;
      authenticating ??= authenticate();
      await authenticating;
    }

    async function guarded(operation) {
      try {
        usable();
        return await operation();
      } catch {
        poisoned = true;
        token = null;
        learnedIds?.clear();
        throw new Error("auth_session_failed");
      }
    }

    async function requestApi(path) {
      return guarded(async () => {
        let id = null;
        if (path === "/gashas") {
          if (gashasRequested) fail();
          gashasRequested = true;
        } else {
          const match = typeof path === "string" ? /^\/gashas\/([1-9][0-9]*)\/featured_cards$/u.exec(path) : null;
          if (!match || learnedIds === null || !learnedIds.has(match[1]) || requestedIds.has(match[1])) fail();
          id = match[1];
          requestedIds.add(id);
        }
        await ensureAuthenticated();
        const headers = { ...secrets.apiHeaders, authorization: `Bearer ${token}` };
        const body = await jsonRequest(path, "GET", headers);
        if (id === null) learnedIds = learnGashaIds(body);
        return { status: 200, body };
      });
    }

    async function fetchImage(value) {
      return guarded(async () => {
        const url = validateImageUrl(value);
        const bytes = await perform(
          url,
          { method: "GET", headers: { accept: "image/png", "accept-encoding": "identity" } },
          IMAGE_BYTES,
          null,
          false,
        );
        if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) fail();
        return bytes;
      });
    }

    function close() {
      if (closed) return;
      closed = true;
      poisoned = true;
      for (const controller of controllers) controller.abort();
      controllers.clear();
      token = null;
      learnedIds?.clear();
      requestedIds.clear();
      secrets = null;
      authenticating = null;
    }

    return Object.freeze({ requestApi, fetchImage, close });
  } catch {
    throw new Error("auth_session_failed");
  }
}
