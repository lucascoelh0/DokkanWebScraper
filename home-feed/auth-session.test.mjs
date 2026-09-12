import assert from "node:assert/strict";
import test from "node:test";

import { createSession } from "./auth-session.mjs";

const SECRET_BASIC = "Basic dXNlcjpwYXNzd29yZA==";
const SECRET_OLD_BEARER = "Bearer expired-private-token";
const SECRET_NEW_TOKEN = "fresh-private-token";
const SIGNED_IMAGE =
  "https://cf.ishin-global.aktsk.com/banners/en/gashasocool/banner_123.png?Policy=private&Signature=secret";

function config(overrides = {}) {
  return {
    nonceHeaders: { authorization: "Basic bm9uY2U6c2VjcmV0", "x-client-version": "5.1.0" },
    loginHeaders: { authorization: SECRET_BASIC, accept: "application/json" },
    loginBody: { auth_transaction_id: "captured-stale-id", account_id: "private-account" },
    apiHeaders: { authorization: SECRET_OLD_BEARER, "x-client-version": "5.1.0" },
    ...overrides,
  };
}

function json(value, init = {}) {
  return new Response(JSON.stringify(value), {
    ...init,
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

function png(size = 24) {
  const bytes = Buffer.alloc(size);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  return bytes;
}

function imageResponse(bytes = png(), init = {}) {
  return new Response(bytes, {
    ...init,
    status: init.status ?? 200,
    headers: { "content-type": "image/png", ...init.headers },
  });
}

function successfulFetch({ gashaIds = [123] } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const path = new URL(url).pathname;
    if (path === "/auth/nonce") return json({ auth_transaction_id: "fresh-transaction-id" });
    if (path === "/auth/sign_in") return json({ access_token: SECRET_NEW_TOKEN, token_type: "Bearer" });
    if (path === "/gashas") return json({ gashas: gashaIds.map((id) => ({ id })) });
    if (path.endsWith("/featured_cards")) return json({ gasha_items: [{ card_id: 999 }] });
    if (new URL(url).hostname === "cf.ishin-global.aktsk.com") return imageResponse();
    throw new Error(`unexpected ${SECRET_OLD_BEARER}`);
  };
  return { fetchImpl, calls };
}

async function rejectsCleanly(operation) {
  await assert.rejects(operation, (error) => {
    assert.equal(error.message, "auth_session_failed");
    assert.equal(error.cause, undefined);
    assert.doesNotMatch(
      String(error),
      /expired-private|fresh-private|private-account|captured-stale|Signature|secret/i,
    );
    return true;
  });
}

test("logs in once, replaces the nonce lineage, and uses only the fresh bearer for API reads", async () => {
  const io = successfulFetch();
  const session = createSession(config(), { fetchImpl: io.fetchImpl });

  assert.deepEqual(await session.requestApi("/gashas"), { status: 200, body: { gashas: [{ id: 123 }] } });
  assert.deepEqual(await session.requestApi("/gashas/123/featured_cards"), {
    status: 200,
    body: { gasha_items: [{ card_id: 999 }] },
  });

  assert.deepEqual(
    io.calls.slice(0, 4).map(({ url, options }) => [options.method, new URL(url).pathname]),
    [
      ["GET", "/auth/nonce"],
      ["POST", "/auth/sign_in"],
      ["GET", "/gashas"],
      ["GET", "/gashas/123/featured_cards"],
    ],
  );
  assert.equal(io.calls[0].options.headers.authorization, "Basic bm9uY2U6c2VjcmV0");
  assert.equal(io.calls[1].options.headers.authorization, SECRET_BASIC);
  assert.deepEqual(JSON.parse(io.calls[1].options.body), {
    auth_transaction_id: "fresh-transaction-id",
    account_id: "private-account",
  });
  assert.equal(io.calls[2].options.headers.authorization, `Bearer ${SECRET_NEW_TOKEN}`);
  assert.equal(io.calls[3].options.headers.authorization, `Bearer ${SECRET_NEW_TOKEN}`);
  assert.equal(io.calls.every(({ options }) => options.redirect === "error"), true);
  assert.equal(io.calls.every(({ url }) => new URL(url).origin === "https://ishin-global.aktsk.com"), true);
});

test("allows only gashas followed by learned, one-shot featured-card paths", async () => {
  {
    const io = successfulFetch();
    const session = createSession(config(), { fetchImpl: io.fetchImpl });
    await rejectsCleanly(() => session.requestApi("/gashas/123/featured_cards"));
    assert.equal(io.calls.length, 0, "invalid sequences are rejected before authentication");
  }
  {
    const io = successfulFetch();
    const session = createSession(config(), { fetchImpl: io.fetchImpl });
    await session.requestApi("/gashas");
    await rejectsCleanly(() => session.requestApi("/gashas/456/featured_cards"));
    assert.equal(io.calls.length, 3);
  }
  {
    const io = successfulFetch();
    const session = createSession(config(), { fetchImpl: io.fetchImpl });
    await session.requestApi("/gashas");
    await session.requestApi("/gashas/123/featured_cards");
    await rejectsCleanly(() => session.requestApi("/gashas/123/featured_cards"));
    assert.equal(io.calls.length, 4);
  }
  {
    const io = successfulFetch();
    const session = createSession(config(), { fetchImpl: io.fetchImpl });
    await rejectsCleanly(() => session.requestApi("https://evil.test/gashas"));
    assert.equal(io.calls.length, 0);
  }
});

test("fetches only signed, flat PNG URLs on the fixed CDN without authentication headers", async () => {
  const io = successfulFetch();
  const session = createSession(config(), { fetchImpl: io.fetchImpl });
  const bytes = await session.fetchImage(SIGNED_IMAGE);
  assert.deepEqual(bytes, png());
  const call = io.calls[0];
  assert.equal(call.url, SIGNED_IMAGE);
  assert.deepEqual(call.options.headers, { accept: "image/png", "accept-encoding": "identity" });
  assert.equal(Object.keys(call.options.headers).some((name) => name.toLowerCase() === "authorization"), false);

  for (const unsafe of [
    "http://cf.ishin-global.aktsk.com/banners/en/gashasocool/a.png?sig=x",
    "https://example.com/banners/en/gashasocool/a.png?sig=x",
    "https://user:pass@cf.ishin-global.aktsk.com/banners/en/gashasocool/a.png?sig=x",
    "https://@cf.ishin-global.aktsk.com/banners/en/gashasocool/a.png?sig=x",
    "https://cf.ishin-global.aktsk.com/banners/en/gashasocool/a.png",
    "https://cf.ishin-global.aktsk.com/banners/en/gashasocool/nested/a.png?sig=x",
    "https://cf.ishin-global.aktsk.com/banners/en/gashasocool/%2e%2e/a.png?sig=x",
    "https://cf.ishin-global.aktsk.com/banners/en/gashasocool/a.jpg?sig=x",
    "https://cf.ishin-global.aktsk.com/banners/en/gashasocool/a.png?sig=x#fragment",
  ]) {
    const isolated = createSession(config(), { fetchImpl: async () => assert.fail("network access") });
    await rejectsCleanly(() => isolated.fetchImage(unsafe));
  }
});

test("rejects redirects, HTTP failures, response encodings, media types, malformed JSON, and oversized bodies", async () => {
  const failures = [
    () => new Response("", { status: 302, headers: { location: API_ORIGIN } }),
    () => json({ echoed: SECRET_BASIC }, { status: 503 }),
    () => json({}, { headers: { "content-encoding": "gzip" } }),
    () => new Response("{}", { status: 200, headers: { "content-type": "text/plain" } }),
    () => new Response("{", { status: 200, headers: { "content-type": "application/json" } }),
    () =>
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json", "content-length": String(8 * 1024 * 1024 + 1) },
      }),
    () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(Buffer.alloc(8 * 1024 * 1024));
            controller.enqueue(Buffer.alloc(1));
            controller.close();
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  ];
  for (const response of failures) {
    let calls = 0;
    const session = createSession(config(), {
      fetchImpl: async () => {
        calls += 1;
        return response();
      },
    });
    await rejectsCleanly(() => session.requestApi("/gashas"));
    await rejectsCleanly(() => session.requestApi("/gashas"));
    assert.equal(calls, 1, "a failed session must not retry");
  }
});

test("the injected short timeout covers fetch and streamed body reads", async () => {
  const neverCompletes = (signal) =>
    new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error(`${SECRET_BASIC} timed out`)), { once: true });
    });

  {
    const session = createSession(config(), {
      timeoutMs: 2,
      fetchImpl: async (_url, { signal }) => neverCompletes(signal),
    });
    await rejectsCleanly(() => session.requestApi("/gashas"));
  }
  {
    let streamController;
    const stream = new ReadableStream({
      start(controller) {
        streamController = controller;
        controller.enqueue(new TextEncoder().encode("{"));
      },
    });
    const session = createSession(config(), {
      timeoutMs: 2,
      fetchImpl: async (_url, { signal }) => {
        signal.addEventListener("abort", () => streamController.error(new Error(SECRET_NEW_TOKEN)), { once: true });
        return new Response(stream, { headers: { "content-type": "application/json" } });
      },
    });
    await rejectsCleanly(() => session.requestApi("/gashas"));
  }
});

test("enforces the forty-three API request and forty image request ceilings", async () => {
  const ids = Array.from({ length: 41 }, (_, index) => index + 1);
  const apiIo = successfulFetch({ gashaIds: ids });
  const apiSession = createSession(config(), { fetchImpl: apiIo.fetchImpl });
  await apiSession.requestApi("/gashas");
  for (const id of ids.slice(0, 40)) await apiSession.requestApi(`/gashas/${id}/featured_cards`);
  await rejectsCleanly(() => apiSession.requestApi("/gashas/41/featured_cards"));
  assert.equal(apiIo.calls.length, 43, "nonce + login + gashas + forty details");

  const imageIo = successfulFetch();
  const imageSession = createSession(config(), { fetchImpl: imageIo.fetchImpl });
  for (let index = 0; index < 40; index += 1) {
    await imageSession.fetchImage(
      `https://cf.ishin-global.aktsk.com/banners/en/gashasocool/${index}.png?sig=private-${index}`,
    );
  }
  await rejectsCleanly(() => imageSession.fetchImage(SIGNED_IMAGE));
  assert.equal(imageIo.calls.length, 40);
});

test("bounds PNG bytes and validates PNG framing", async () => {
  for (const response of [
    imageResponse(Buffer.from("not-png")),
    imageResponse(png(), { headers: { "content-length": String(2 * 1024 * 1024 + 1) } }),
    new Response(Buffer.from('<html>error</html>'), { headers: { "content-type": "text/html" } }),
  ]) {
    const session = createSession(config(), { fetchImpl: async () => response });
    await rejectsCleanly(() => session.fetchImage(SIGNED_IMAGE));
  }
});

test("accepts observed octet-stream CDN PNG without trusting MIME alone", async () => {
  const session=createSession(config(),{fetchImpl:async()=>new Response(png(),{
    headers:{"content-type":"application/octet-stream"}})});
  assert.deepEqual(await session.fetchImage(SIGNED_IMAGE),png());
});

test("validates bounded secret configuration and rejects cookies and non-Basic login auth", () => {
  for (const invalid of [
    config({ loginHeaders: { authorization: SECRET_OLD_BEARER } }),
    config({ apiHeaders: { cookie: "private-cookie" } }),
    config({ nonceHeaders: { host: "evil.test" } }),
    config({ loginBody: [] }),
    config({ loginBody: { padding: "x".repeat(33 * 1024) } }),
    { ...config(), unexpected: SECRET_BASIC },
  ]) {
    assert.throws(() => createSession(invalid, { fetchImpl: async () => assert.fail("network access") }), (error) => {
      assert.equal(error.message, "auth_session_failed");
      assert.doesNotMatch(String(error), /private|password|cookie|Basic/i);
      return true;
    });
  }
});

test("close is idempotent, aborts active work, and disables all future operations", async () => {
  let observedSignal;
  const session = createSession(config(), {
    fetchImpl: async (_url, { signal }) => {
      observedSignal = signal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error(SECRET_NEW_TOKEN)), { once: true });
      });
    },
  });
  const pending = session.requestApi("/gashas");
  await Promise.resolve();
  session.close();
  session.close();
  assert.equal(observedSignal.aborted, true);
  await rejectsCleanly(() => pending);
  await rejectsCleanly(() => session.requestApi("/gashas"));
  await rejectsCleanly(() => session.fetchImage(SIGNED_IMAGE));
});
