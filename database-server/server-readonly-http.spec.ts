import { deepEqual, equal, rejects } from "assert";
import { ServerReadonlyHttpClient } from "./server-readonly-http";

function response(body: string, status = 200, headers: Record<string, string> = { "content-type": "application/json" }): Response {
    return new Response(body, { status, headers });
}

describe("read-only server HTTP client", () => {
    it("uses only GET, omits credentials and serializes requests", async () => {
        const calls: Array<{ url: string; init?: RequestInit }> = [];
        let active = 0, maximumActive = 0;
        const client = new ServerReadonlyHttpClient({
            allowedHosts: ["example.test"], minimumIntervalMs: 0,
            fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
                active += 1; maximumActive = Math.max(maximumActive, active);
                calls.push({ url: String(url), init });
                await Promise.resolve(); active -= 1;
                return response("{}");
            }) as typeof fetch,
        });
        await Promise.all([client.get("https://example.test/a"), client.get("https://example.test/b")]);
        equal(maximumActive, 1);
        deepEqual(calls.map(value => value.init?.method), ["GET", "GET"]);
        deepEqual(calls.map(value => value.init?.credentials), ["omit", "omit"]);
        deepEqual(calls.map(value => value.init?.redirect), ["manual", "manual"]);
    });

    it("rejects disallowed hosts, credentials, sensitive queries and redirects", async () => {
        const client = new ServerReadonlyHttpClient({ allowedHosts: ["example.test"], minimumIntervalMs: 0, fetchImpl: (async () => response("", 302, { location: "https://other.test" })) as typeof fetch });
        await rejects(client.get("http://example.test/a"), /allowlist/);
        await rejects(client.get("https://user:pass@example.test/a"), /allowlist/);
        await rejects(client.get("https://example.test/a?token=value"), /Sensitive query/);
        await rejects(client.get("https://example.test/a"), /Redirects are prohibited/);
    });

    it("enforces response and aggregate byte ceilings", async () => {
        const client = new ServerReadonlyHttpClient({ allowedHosts: ["example.test"], minimumIntervalMs: 0, maximumResponseBytes: 4, maximumAggregateBytes: 8, fetchImpl: (async () => response("12345")) as typeof fetch });
        await rejects(client.get("https://example.test/a"), /per-request limit/);
        const projected = new ServerReadonlyHttpClient({ allowedHosts: ["example.test"], minimumIntervalMs: 0, maximumResponseBytes: 5, maximumAggregateBytes: 4, fetchImpl: (async () => response("1")) as typeof fetch });
        await rejects(projected.get("https://example.test/a"), /projected response ceiling/);
    });

    it("retries only bounded 429 or server failures", async () => {
        let calls = 0;
        const sleeps: number[] = [];
        const client = new ServerReadonlyHttpClient({
            allowedHosts: ["example.test"], minimumIntervalMs: 0,
            sleep: async milliseconds => { sleeps.push(milliseconds); },
            random: () => 0,
            fetchImpl: (async () => { calls += 1; return calls < 3 ? response("", 503) : response("ok"); }) as typeof fetch,
        });
        const value = await client.get("https://example.test/a");
        equal(value.body.toString(), "ok");
        equal(value.receipt.attemptCount, 3);
        equal(calls, 3);
        equal(sleeps.length, 2);
    });

    it("honors Retry-After HTTP dates and stops instead of retrying early", async () => {
        const now = Date.parse("2026-08-07T12:00:00Z"), sleeps: number[] = [];
        let calls = 0;
        const client = new ServerReadonlyHttpClient({ allowedHosts: ["example.test"], minimumIntervalMs: 0, now: () => now, random: () => 0, sleep: async value => { sleeps.push(value); }, fetchImpl: (async () => { calls += 1; return calls === 1 ? response("", 429, { "retry-after": "Fri, 07 Aug 2026 12:00:10 GMT" }) : response("ok"); }) as typeof fetch });
        equal((await client.get("https://example.test/a")).body.toString(), "ok");
        deepEqual(sleeps, [10000]);
        let stoppedCalls = 0;
        const stopped = new ServerReadonlyHttpClient({ allowedHosts: ["example.test"], minimumIntervalMs: 0, now: () => now, random: () => 0, sleep: async () => undefined, fetchImpl: (async () => { stoppedCalls += 1; return response("", 429, { "retry-after": "Fri, 07 Aug 2026 12:01:00 GMT" }); }) as typeof fetch });
        await rejects(stopped.get("https://example.test/a"), /endpoint family stopped/);
        await rejects(stopped.get("https://example.test/b"), /remains blocked/);
        equal(stoppedCalls, 1);
        let finalCalls = 0;
        const finalAttempt = new ServerReadonlyHttpClient({ allowedHosts: ["example.test"], minimumIntervalMs: 0, now: () => now, random: () => 0, sleep: async () => undefined, fetchImpl: (async () => { finalCalls += 1; return finalCalls < 3 ? response("", 503) : response("", 429, { "retry-after": "Fri, 07 Aug 2026 12:01:00 GMT" }); }) as typeof fetch });
        await rejects(finalAttempt.get("https://example.test/a"), /endpoint family stopped/);
        await rejects(finalAttempt.get("https://example.test/b"), /remains blocked/);
        equal(finalCalls, 3);
    });
});
