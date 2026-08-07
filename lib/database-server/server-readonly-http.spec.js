"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const server_readonly_http_1 = require("./server-readonly-http");
function response(body, status = 200, headers = { "content-type": "application/json" }) {
    return new Response(body, { status, headers });
}
describe("read-only server HTTP client", () => {
    it("uses only GET, omits credentials and serializes requests", async () => {
        const calls = [];
        let active = 0, maximumActive = 0;
        const client = new server_readonly_http_1.ServerReadonlyHttpClient({
            allowedHosts: ["example.test"], minimumIntervalMs: 0,
            fetchImpl: (async (url, init) => {
                active += 1;
                maximumActive = Math.max(maximumActive, active);
                calls.push({ url: String(url), init });
                await Promise.resolve();
                active -= 1;
                return response("{}");
            }),
        });
        await Promise.all([client.get("https://example.test/a"), client.get("https://example.test/b")]);
        (0, assert_1.equal)(maximumActive, 1);
        (0, assert_1.deepEqual)(calls.map(value => value.init?.method), ["GET", "GET"]);
        (0, assert_1.deepEqual)(calls.map(value => value.init?.credentials), ["omit", "omit"]);
        (0, assert_1.deepEqual)(calls.map(value => value.init?.redirect), ["manual", "manual"]);
    });
    it("rejects disallowed hosts, credentials, sensitive queries and redirects", async () => {
        const client = new server_readonly_http_1.ServerReadonlyHttpClient({ allowedHosts: ["example.test"], minimumIntervalMs: 0, fetchImpl: (async () => response("", 302, { location: "https://other.test" })) });
        await (0, assert_1.rejects)(client.get("http://example.test/a"), /allowlist/);
        await (0, assert_1.rejects)(client.get("https://user:pass@example.test/a"), /allowlist/);
        await (0, assert_1.rejects)(client.get("https://example.test/a?token=value"), /Sensitive query/);
        await (0, assert_1.rejects)(client.get("https://example.test/a"), /Redirects are prohibited/);
    });
    it("enforces response and aggregate byte ceilings", async () => {
        const client = new server_readonly_http_1.ServerReadonlyHttpClient({ allowedHosts: ["example.test"], minimumIntervalMs: 0, maximumResponseBytes: 4, maximumAggregateBytes: 8, fetchImpl: (async () => response("12345")) });
        await (0, assert_1.rejects)(client.get("https://example.test/a"), /per-request limit/);
        const projected = new server_readonly_http_1.ServerReadonlyHttpClient({ allowedHosts: ["example.test"], minimumIntervalMs: 0, maximumResponseBytes: 5, maximumAggregateBytes: 4, fetchImpl: (async () => response("1")) });
        await (0, assert_1.rejects)(projected.get("https://example.test/a"), /projected response ceiling/);
    });
    it("retries only bounded 429 or server failures", async () => {
        let calls = 0;
        const sleeps = [];
        const client = new server_readonly_http_1.ServerReadonlyHttpClient({
            allowedHosts: ["example.test"], minimumIntervalMs: 0,
            sleep: async (milliseconds) => { sleeps.push(milliseconds); },
            random: () => 0,
            fetchImpl: (async () => { calls += 1; return calls < 3 ? response("", 503) : response("ok"); }),
        });
        const value = await client.get("https://example.test/a");
        (0, assert_1.equal)(value.body.toString(), "ok");
        (0, assert_1.equal)(value.receipt.attemptCount, 3);
        (0, assert_1.equal)(calls, 3);
        (0, assert_1.equal)(sleeps.length, 2);
    });
    it("honors Retry-After HTTP dates and stops instead of retrying early", async () => {
        const now = Date.parse("2026-08-07T12:00:00Z"), sleeps = [];
        let calls = 0;
        const client = new server_readonly_http_1.ServerReadonlyHttpClient({ allowedHosts: ["example.test"], minimumIntervalMs: 0, now: () => now, random: () => 0, sleep: async (value) => { sleeps.push(value); }, fetchImpl: (async () => { calls += 1; return calls === 1 ? response("", 429, { "retry-after": "Fri, 07 Aug 2026 12:00:10 GMT" }) : response("ok"); }) });
        (0, assert_1.equal)((await client.get("https://example.test/a")).body.toString(), "ok");
        (0, assert_1.deepEqual)(sleeps, [10000]);
        let stoppedCalls = 0;
        const stopped = new server_readonly_http_1.ServerReadonlyHttpClient({ allowedHosts: ["example.test"], minimumIntervalMs: 0, now: () => now, random: () => 0, sleep: async () => undefined, fetchImpl: (async () => { stoppedCalls += 1; return response("", 429, { "retry-after": "Fri, 07 Aug 2026 12:01:00 GMT" }); }) });
        await (0, assert_1.rejects)(stopped.get("https://example.test/a"), /endpoint family stopped/);
        await (0, assert_1.rejects)(stopped.get("https://example.test/b"), /remains blocked/);
        (0, assert_1.equal)(stoppedCalls, 1);
        let finalCalls = 0;
        const finalAttempt = new server_readonly_http_1.ServerReadonlyHttpClient({ allowedHosts: ["example.test"], minimumIntervalMs: 0, now: () => now, random: () => 0, sleep: async () => undefined, fetchImpl: (async () => { finalCalls += 1; return finalCalls < 3 ? response("", 503) : response("", 429, { "retry-after": "Fri, 07 Aug 2026 12:01:00 GMT" }); }) });
        await (0, assert_1.rejects)(finalAttempt.get("https://example.test/a"), /endpoint family stopped/);
        await (0, assert_1.rejects)(finalAttempt.get("https://example.test/b"), /remains blocked/);
        (0, assert_1.equal)(finalCalls, 3);
    });
});
//# sourceMappingURL=server-readonly-http.spec.js.map