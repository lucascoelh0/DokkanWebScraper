import assert from "node:assert/strict";
import { timingSafeEqual } from "node:crypto";
import { describe, test } from "node:test";
import worker from "../src/worker.ts";

const fetch = worker.fetch;

if (typeof crypto.subtle.timingSafeEqual !== "function") {
  Object.defineProperty(crypto.subtle, "timingSafeEqual", {
    configurable: true,
    value: (left, right) => timingSafeEqual(new Uint8Array(left), new Uint8Array(right)),
  });
}

const TOKEN = "0123456789abcdef0123456789abcdef";
const PREFIX = "staging/v2/home/";
const auth = { Authorization: `Bearer ${TOKEN}` };

function object(bytes, etag = "etag-1") {
  const value = Uint8Array.from(bytes);
  return {
    size: value.byteLength,
    etag,
    httpEtag: `"${etag}"`,
    body: new Blob([value]).stream(),
  };
}

function stubBucket(initial = new Map()) {
  const calls = [];
  const data = new Map(initial);
  return {
    calls,
    data,
    async get(key) {
      calls.push(["get", key]);
      const row = data.get(key);
      return row ? object(row.bytes, row.etag) : null;
    },
    async put(key, bytes, options) {
      calls.push(["put", key, options]);
      const current = data.get(key);
      const none = options.onlyIf.get("If-None-Match");
      const match = options.onlyIf.get("If-Match");
      if ((none === "*" && current) || (match !== null && `"${current?.etag}"` !== match)) return null;
      const etag = `etag-${data.size + 1}`;
      data.set(key, { bytes: Uint8Array.from(bytes), etag, metadata: options.httpMetadata });
      return object([], etag);
    },
    async list(options) {
      calls.push(["list", options]);
      return { objects: [...data.entries()].map(([key, row]) => ({ key, size: row.bytes.byteLength })), truncated: false };
    },
  };
}

function env(bucket = stubBucket(), token = TOKEN) {
  return { BUCKET: bucket, GATEWAY_TOKEN: token };
}

function request(path, options = {}) {
  return new Request(`https://gateway.invalid${path}`, options);
}

describe("authentication and routing", () => {
  test("rejects missing authorization before touching R2", async () => {
    const bucket = stubBucket();
    const response = await fetch(request("/inventory"), env(bucket));
    assert.equal(response.status, 401);
    assert.deepEqual(bucket.calls, []);
  });

  test("refuses a missing or short configured secret before touching R2", async () => {
    for (const token of [undefined, "too-short"]) {
      const bucket = stubBucket();
      const response = await fetch(request("/inventory", { headers: auth }), { BUCKET: bucket, GATEWAY_TOKEN: token });
      assert.equal(response.status, 503);
      assert.deepEqual(bucket.calls, []);
    }
  });

  test("rejects traversal, encoded traversal, duplicate keys, and DELETE", async () => {
    const bucket = stubBucket();
    for (const path of [
      "/object?key=staging/v2/home/../secret.json",
      "/object?key=staging%2Fv2%2Fhome%2F%2E%2E%2Fsecret.json",
      `/object?key=${PREFIX}manifest.json&key=${PREFIX}manifest.json`,
    ]) {
      const response = await fetch(request(path, { headers: auth }), env(bucket));
      assert.equal(response.status, 400);
    }
    const deleted = await fetch(request(`/object?key=${PREFIX}manifest.json`, { method: "DELETE", headers: auth }), env(bucket));
    assert.equal(deleted.status, 405);
    assert.equal(deleted.headers.get("Allow"), "GET, PUT");
    assert.deepEqual(bucket.calls, []);
  });
});

describe("object writes", () => {
  test("rejects oversized run and JSON requests without touching R2", async () => {
    const bucket = stubBucket();
    const cases = [
      [`${PREFIX}runs/1.json`, 4097],
      [`${PREFIX}manifest.json`, 65537],
    ];
    for (const [key, size] of cases) {
      const response = await fetch(request(`/object?key=${key}`, {
        method: "PUT",
        headers: { ...auth, "If-None-Match": "*", "Content-Length": String(size) },
        body: "x",
      }), env(bucket));
      assert.equal(response.status, 413);
    }
    const streamed = await fetch(request(`/object?key=${PREFIX}runs/2.json`, {
      method: "PUT",
      headers: { ...auth, "If-None-Match": "*" },
      body: "x".repeat(4097),
    }), env(bucket));
    assert.equal(streamed.status, 413);
    assert.deepEqual(bucket.calls, []);
  });

  test("requires conditional create for immutable keys and verifies content hashes", async () => {
    const bytes = new TextEncoder().encode("immutable");
    const digest = Buffer.from(await crypto.subtle.digest("SHA-256", bytes)).toString("hex");
    const key = `${PREFIX}${digest}.json`;
    const bucket = stubBucket();

    const noCondition = await fetch(request(`/object?key=${key}`, { method: "PUT", headers: auth, body: bytes }), env(bucket));
    assert.equal(noCondition.status, 428);
    const cas = await fetch(request(`/object?key=${key}`, {
      method: "PUT", headers: { ...auth, "If-Match": '"etag-1"' }, body: bytes,
    }), env(bucket));
    assert.equal(cas.status, 428);
    const wrongHash = await fetch(request(`/object?key=${PREFIX}${"0".repeat(64)}.json`, {
      method: "PUT", headers: { ...auth, "If-None-Match": "*" }, body: bytes,
    }), env(bucket));
    assert.equal(wrongHash.status, 422);

    const created = await fetch(request(`/object?key=${key}`, {
      method: "PUT", headers: { ...auth, "If-None-Match": "*" }, body: bytes,
    }), env(bucket));
    assert.equal(created.status, 200);
    assert.equal(created.headers.get("ETag"), '"etag-1"');
    assert.deepEqual(bucket.data.get(key).metadata, {
      cacheControl: "public,max-age=31536000,immutable",
      contentType: "application/json",
    });

    const overwrite = await fetch(request(`/object?key=${key}`, {
      method: "PUT", headers: { ...auth, "If-None-Match": "*" }, body: bytes,
    }), env(bucket));
    assert.equal(overwrite.status, 412);
  });

  test("rejects a hash-matching non-PNG payload", async () => {
    const bytes = new TextEncoder().encode("not-png");
    const digest = Buffer.from(await crypto.subtle.digest("SHA-256", bytes)).toString("hex");
    const bucket = stubBucket();
    const response = await fetch(request(`/object?key=${PREFIX}images/${digest}.png`, {
      method: "PUT", headers: { ...auth, "If-None-Match": "*" }, body: bytes,
    }), env(bucket));
    assert.equal(response.status, 422);
    assert.deepEqual(bucket.calls, []);
  });

  test("accepts a hash-matching PNG signature and forces image metadata", async () => {
    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
    const digest = Buffer.from(await crypto.subtle.digest("SHA-256", bytes)).toString("hex");
    const key = `${PREFIX}images/${digest}.png`;
    const bucket = stubBucket();
    const response = await fetch(request(`/object?key=${key}`, {
      method: "PUT", headers: { ...auth, "If-None-Match": "*" }, body: bytes,
    }), env(bucket));
    assert.equal(response.status, 200);
    assert.deepEqual(bucket.data.get(key).metadata, {
      cacheControl: "public,max-age=31536000,immutable",
      contentType: "image/png",
    });
  });

  test("supports manifest create then ETag CAS and forces mutable metadata", async () => {
    const key = `${PREFIX}manifest.json`;
    const bucket = stubBucket();
    const created = await fetch(request(`/object?key=${key}`, {
      method: "PUT", headers: { ...auth, "If-None-Match": "*" }, body: "first",
    }), env(bucket));
    assert.equal(created.status, 200);
    const conflict = await fetch(request(`/object?key=${key}`, {
      method: "PUT", headers: { ...auth, "If-Match": '"wrong"' }, body: "second",
    }), env(bucket));
    assert.equal(conflict.status, 412);
    const updated = await fetch(request(`/object?key=${key}`, {
      method: "PUT", headers: { ...auth, "If-Match": created.headers.get("ETag") }, body: "second",
    }), env(bucket));
    assert.equal(updated.status, 200);
    assert.deepEqual(bucket.data.get(key).metadata, { cacheControl: "no-cache", contentType: "application/json" });
  });
});

describe("reads and inventory", () => {
  test("returns bounded object bytes and the ETag with forced response metadata", async () => {
    const key = `${PREFIX}runs/123.json`;
    const bucket = stubBucket(new Map([[key, { bytes: new TextEncoder().encode("{}"), etag: "run" }]]));
    const response = await fetch(request(`/object?key=${key}`, { headers: auth }), env(bucket));
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "{}");
    assert.equal(response.headers.get("ETag"), '"run"');
    assert.equal(response.headers.get("Content-Type"), "application/json");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  });

  test("returns 404 for a missing object and rejects oversized stored metadata", async () => {
    const key = `${PREFIX}runs/123.json`;
    const bucket = stubBucket();
    assert.equal((await fetch(request(`/object?key=${key}`, { headers: auth }), env(bucket))).status, 404);
    bucket.get = async () => ({ ...object([]), size: 4097 });
    assert.equal((await fetch(request(`/object?key=${key}`, { headers: auth }), env(bucket))).status, 502);
  });

  test("returns only page byte totals and an opaque continuation cursor", async () => {
    const bucket = stubBucket();
    bucket.list = async options => {
      bucket.calls.push(["list", options]);
      return { objects: [{ key: "private/name", size: 7 }, { key: "another/name", size: 11 }], truncated: true, cursor: "next-page" };
    };
    const response = await fetch(request("/inventory?cursor=current-page", { headers: auth }), env(bucket));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { bytes: 18, truncated: true, cursor: "next-page" });
    assert.deepEqual(bucket.calls, [["list", { limit: 1000, include: [], cursor: "current-page" }]]);
  });

  test("redacts R2 failures from responses", async () => {
    const bucket = stubBucket();
    bucket.get = async () => { throw new Error("secret endpoint and credentials"); };
    const response = await fetch(request(`/object?key=${PREFIX}manifest.json`, { headers: auth }), env(bucket));
    assert.equal(response.status, 500);
    const body = await response.text();
    assert.deepEqual(JSON.parse(body), { error: "internal_error" });
    assert.doesNotMatch(body, /secret|credential/i);
  });
});
