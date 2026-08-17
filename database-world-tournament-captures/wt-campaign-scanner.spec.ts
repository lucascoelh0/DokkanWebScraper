import * as assert from "assert";
import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { buildWtSensitiveCatalog, collectWtGitAuditTargets, scanWtAuditTargets, WtAuditTargetInput } from "./wt-campaign-scanner";

const values = {
    array: "synthetic-array-private-8f4d",
    primitive: "synthetic-primitive-private-2a7c",
    header: "q7Zx",
    cookie: "synthetic-cookie-private-5d1e",
    query: "synthetic-query-private-3b9a",
    username: "synthetic-user-private-6c2f",
    password: "synthetic-password-private-4e8b",
    historical: "synthetic-historical-private-1f6a",
};

interface FocusedHarOptions {
    method?: string;
    url?: string;
    requestHeaders?: Array<{ name: string; value: string }>;
    responseHeaders?: Array<{ name: string; value: string }>;
    requestCookies?: Array<{ name: string; value: string }>;
    responseCookies?: Array<{ name: string; value: string }>;
    requestBody?: unknown;
    responseBody?: unknown;
    requestText?: string;
    responseText?: string;
    requestMimeType?: string;
    responseMimeType?: string;
}

function focusedHar(options: FocusedHarOptions): string {
    const request: Record<string, unknown> = {
        method: options.method ?? "GET",
        url: options.url ?? "https://example.invalid/",
        headers: options.requestHeaders ?? [],
        cookies: options.requestCookies ?? [],
        queryString: [],
    };
    const response: Record<string, unknown> = { status: 200, headers: options.responseHeaders ?? [], cookies: options.responseCookies ?? [] };
    if (Object.prototype.hasOwnProperty.call(options, "requestBody") || options.requestText !== undefined) request.postData = { mimeType: options.requestMimeType ?? (Object.prototype.hasOwnProperty.call(options, "requestBody") ? "application/json" : "text/plain"), text: options.requestText ?? JSON.stringify(options.requestBody) };
    if (Object.prototype.hasOwnProperty.call(options, "responseBody") || options.responseText !== undefined) response.content = { mimeType: options.responseMimeType ?? (Object.prototype.hasOwnProperty.call(options, "responseBody") ? "application/json" : "text/plain"), text: options.responseText ?? JSON.stringify(options.responseBody) };
    return JSON.stringify({ log: { entries: [{ request, response }] } });
}

function har(overrides?: { requestBody?: unknown; responseBody?: unknown; authorization?: string }): string {
    const requestBody = overrides && "requestBody" in overrides ? overrides.requestBody : { secret_values: [values.array] };
    const responseBody = overrides && "responseBody" in overrides ? overrides.responseBody : values.primitive;
    return JSON.stringify({ log: { entries: [{
        request: {
            method: "POST",
            url: `https://${encodeURIComponent(values.username)}:${encodeURIComponent(values.password)}@example.invalid/audit/q7?cursor=${encodeURIComponent(values.query)}`,
            headers: [{ name: "Authorization", value: overrides?.authorization ?? values.header }, { name: "Cookie", value: `session=${values.cookie}` }],
            cookies: [{ name: "session", value: values.cookie }],
            queryString: [{ name: "cursor", value: values.query }],
            postData: { mimeType: "application/json", text: JSON.stringify(requestBody) },
        },
        response: {
            status: 200,
            headers: [],
            cookies: [],
            content: { mimeType: "application/json", text: JSON.stringify(responseBody) },
        },
    }] } });
}

function target(targetId: string, category: WtAuditTargetInput["category"], content: string): WtAuditTargetInput {
    return { targetId, category, content: Buffer.from(content) };
}

function git(root: string, args: string[]): string {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function commit(root: string, message: string): string {
    git(root, ["add", "-A"]); git(root, ["commit", "-m", message]); return git(root, ["rev-parse", "HEAD"]);
}

describe("World Tournament campaign scanner", () => {
    it("builds an opaque complete catalog without returning sensitive values", () => {
        const catalog = buildWtSensitiveCatalog(har());
        assert.deepEqual(Object.keys(catalog.categoryValueCounts).sort(), ["cookies", "headers", "query", "request_body", "response_body", "url_credentials", "url_path"]);
        assert.equal(catalog.entryCount, 1);
        assert.equal(catalog.sensitiveValueCount > 0, true);
        const serialized = JSON.stringify(catalog);
        for (const value of Object.values(values)) assert.equal(serialized.includes(value), false);
    });

    it("detects a sensitive scalar nested in a primitive array", () => {
        const result = scanWtAuditTargets(buildWtSensitiveCatalog(har()), [target("array-fixture", "fixture", JSON.stringify({ secret_values: [values.array] }))]);
        assert.equal(result.valid, false);
        assert.equal(result.sensitiveMatchCategoryCounts.request_body > 0, true);
    });

    it("detects every short JSON leaf in root arrays, nested arrays, and neutral keys", () => {
        for (const body of [["q7"], { x: [["q7"]] }, { x: "q7" }]) {
            const result = scanWtAuditTargets(buildWtSensitiveCatalog(focusedHar({ requestBody: body })), [target("json-leaf", "fixture", JSON.stringify(body))]);
            assert.equal(result.valid, false);
            assert.equal(result.sensitiveMatchCategoryCounts.request_body > 0, true);
        }
    });

    it("detects string, number, boolean, and null JSON leaves with canonical typing", () => {
        for (const value of ["q7", 17, false, null]) {
            const body = { x: value }, result = scanWtAuditTargets(buildWtSensitiveCatalog(focusedHar({ requestBody: body })), [target("typed-json-leaf", "fixture", JSON.stringify(body))]);
            assert.equal(result.valid, false, `missed ${JSON.stringify(value)}`);
        }
    });

    it("detects JSON primitive roots in both request and response bodies", () => {
        const catalog = buildWtSensitiveCatalog(focusedHar({ requestBody: "q7", responseBody: 17 }));
        assert.equal(scanWtAuditTargets(catalog, [target("request-root", "fixture", JSON.stringify("q7"))]).sensitiveMatchCategoryCounts.request_body > 0, true);
        assert.equal(scanWtAuditTargets(catalog, [target("response-root", "fixture", "17")]).sensitiveMatchCategoryCounts.response_body > 0, true);
    });

    it("keeps request and response body observations independently detectable", () => {
        const catalog = buildWtSensitiveCatalog(focusedHar({ requestBody: { x: "q7" }, responseBody: { y: "r8" } }));
        assert.equal(scanWtAuditTargets(catalog, [target("request", "fixture", JSON.stringify({ x: "q7" }))]).sensitiveMatchCategoryCounts.request_body > 0, true);
        assert.equal(scanWtAuditTargets(catalog, [target("response", "fixture", JSON.stringify({ y: "r8" }))]).sensitiveMatchCategoryCounts.response_body > 0, true);
    });

    it("detects short headers by normalized name and value, including ETag", () => {
        const catalog = buildWtSensitiveCatalog(focusedHar({ responseHeaders: [{ name: "ETag", value: "q7" }] }));
        const result = scanWtAuditTargets(catalog, [target("etag", "fixture", "etag: q7")]);
        assert.equal(result.valid, false);
        assert.equal(result.sensitiveMatchCategoryCounts.headers > 0, true);
    });

    it("detects short cookies only by cookie name and value", () => {
        const catalog = buildWtSensitiveCatalog(focusedHar({ requestCookies: [{ name: "sid", value: "q7" }] }));
        const result = scanWtAuditTargets(catalog, [target("cookie", "fixture", "Cookie: sid=q7")]);
        assert.equal(result.valid, false);
        assert.equal(result.sensitiveMatchCategoryCounts.cookies > 0, true);
    });

    it("detects short and long query values by query name and component", () => {
        const long = "synthetic-long-query-8fd2", catalog = buildWtSensitiveCatalog(focusedHar({ url: `https://example.invalid/?short=q7&long=${long}` }));
        assert.equal(scanWtAuditTargets(catalog, [target("short-query", "fixture", "https://example.invalid/?short=q7")]).sensitiveMatchCategoryCounts.query > 0, true);
        assert.equal(scanWtAuditTargets(catalog, [target("long-query", "fixture", `https://example.invalid/?long=${long}`)]).sensitiveMatchCategoryCounts.query > 0, true);
    });

    it("detects a captured URL path segment structurally", () => {
        const catalog = buildWtSensitiveCatalog(focusedHar({ url: "https://example.invalid/audit/q7" }));
        const result = scanWtAuditTargets(catalog, [target("url-path", "fixture", "https://example.invalid/audit/q7")]);
        assert.equal(result.valid, false);
        assert.equal(result.sensitiveMatchCategoryCounts.url_path > 0, true);
    });

    it("catalogs public alphabetic route segments without treating them as captured-value matches", () => {
        const publicEntry = (JSON.parse(focusedHar({ url: "https://example.invalid/bonus_schedules" })) as any).log.entries[0];
        const valueEntry = (JSON.parse(focusedHar({ url: "https://example.invalid/audit/q7" })) as any).log.entries[0];
        const catalog = buildWtSensitiveCatalog(JSON.stringify({ log: { entries: [publicEntry, valueEntry] } }));
        assert.equal(catalog.categoryValueCounts.url_path, 3);
        assert.equal(scanWtAuditTargets(catalog, [target("public-route", "fixture", "https://example.invalid/bonus_schedules")]).valid, true);
        assert.equal(scanWtAuditTargets(catalog, [target("value-bearing-route", "fixture", "https://example.invalid/audit/q7")]).sensitiveMatchCategoryCounts.url_path > 0, true);
    });

    it("detects a short non-JSON textual body only as a conservative text token", () => {
        const catalog = buildWtSensitiveCatalog(focusedHar({ requestText: "q7", requestMimeType: "text/plain" }));
        assert.equal(scanWtAuditTargets(catalog, [target("text-body", "fixture", "q7")]).sensitiveMatchCategoryCounts.request_body > 0, true);
    });

    it("does not cross-match the same short value across structural contexts", () => {
        const catalog = buildWtSensitiveCatalog(focusedHar({ url: "https://example.invalid/", responseHeaders: [{ name: "ETag", value: "q7" }] }));
        for (const content of [JSON.stringify({ x: "q7" }), "Cookie: sid=q7", "https://example.invalid/other?etag=q7", "q7"]) assert.equal(scanWtAuditTargets(catalog, [target("different-context", "fixture", content)]).valid, true);
        assert.equal(scanWtAuditTargets(catalog, [target("wrong-header", "fixture", "X-Other: q7")]).valid, true);
    });

    it("does not cross-match short JSON paths, cookie names, or query names", () => {
        assert.equal(scanWtAuditTargets(buildWtSensitiveCatalog(focusedHar({ url: "https://example.invalid/", requestBody: { x: "q7" } })), [target("wrong-json-path", "fixture", JSON.stringify({ y: "q7" }))]).valid, true);
        assert.equal(scanWtAuditTargets(buildWtSensitiveCatalog(focusedHar({ url: "https://example.invalid/", requestCookies: [{ name: "sid", value: "q7" }] })), [target("wrong-cookie", "fixture", "Cookie: other=q7")]).valid, true);
        assert.equal(scanWtAuditTargets(buildWtSensitiveCatalog(focusedHar({ url: "https://example.invalid/?short=q7" })), [target("wrong-query", "fixture", "https://example.invalid/?other=q7")]).valid, true);
    });

    it("extracts short JSON, header, and cookie observations from static TypeScript literals", () => {
        const catalog = buildWtSensitiveCatalog(focusedHar({
            requestBody: { x: "j7" },
            responseHeaders: [{ name: "ETag", value: "h7" }],
            requestCookies: [{ name: "sid", value: "c7" }],
        }));
        const source = [
            "const neutral = { x: \"j7\" };",
            "const header = { name: \"ETag\", value: \"h7\" };",
            "const cookies = [{ name: \"sid\", value: \"c7\" }];",
        ].join("\n");
        const result = scanWtAuditTargets(catalog, [target("static.ts", "spec", source)]);
        assert.equal(result.valid, false);
        for (const category of ["request_body", "headers", "cookies"] as const) assert.equal(result.sensitiveMatchCategoryCounts[category] > 0, true, `missed ${category}`);
    });

    it("extracts typed primitive JSON roots from explicitly JSON-like static TypeScript contexts", () => {
        for (const value of ["q7", 17, false, null]) {
            const catalog = buildWtSensitiveCatalog(focusedHar({ requestBody: value }));
            const declaration = `const leakedBody = ${JSON.stringify(value)};`;
            assert.equal(scanWtAuditTargets(catalog, [target("primitive.ts", "spec", declaration)]).valid, false, `missed ${JSON.stringify(value)}`);
        }
        const catalog = buildWtSensitiveCatalog(focusedHar({ responseBody: "q7" }));
        assert.equal(scanWtAuditTargets(catalog, [target("return.ts", "spec", "function leakedBody() { return \"q7\"; }")]).valid, false);
        assert.equal(scanWtAuditTargets(catalog, [target("unrelated.ts", "spec", "const retryCount = 17; const enabled = false;")]).valid, true);
    });

    it("uses capture origin, method, and sanitized endpoint when target body context is explicit", () => {
        const catalog = buildWtSensitiveCatalog(focusedHar({ method: "POST", url: "https://example.invalid/budokais/63/tournaments", requestBody: { x: "q7" } }));
        const envelope = (origin: "request" | "response", method: string, url: string): string => JSON.stringify({ origin, method, url, body: { x: "q7" } });
        assert.equal(scanWtAuditTargets(catalog, [target("same-context", "fixture", envelope("request", "POST", "https://example.invalid/budokais/99/tournaments"))]).valid, false);
        assert.equal(scanWtAuditTargets(catalog, [target("wrong-origin", "fixture", envelope("response", "POST", "https://example.invalid/budokais/99/tournaments"))]).valid, true);
        assert.equal(scanWtAuditTargets(catalog, [target("wrong-method", "fixture", envelope("request", "GET", "https://example.invalid/budokais/99/tournaments"))]).valid, true);
        assert.equal(scanWtAuditTargets(catalog, [target("wrong-endpoint", "fixture", envelope("request", "POST", "https://example.invalid/other"))]).valid, true);
        assert.equal(scanWtAuditTargets(catalog, [target("unscoped-body", "fixture", JSON.stringify({ x: "q7" }))]).valid, false);
    });

    it("propagates explicit capture context to short headers, cookies, and URL/query observations", () => {
        const catalog = buildWtSensitiveCatalog(focusedHar({
            method: "POST",
            url: "https://example.invalid/budokais/63/tournaments?cursor=q7",
            responseHeaders: [{ name: "ETag", value: "h7" }],
            requestCookies: [{ name: "sid", value: "c7" }],
        }));
        const envelope = (origin: "request" | "response", method: string, url: string, extra: Record<string, unknown>): string => JSON.stringify({ origin, method, url, ...extra });
        const endpoint = "https://example.invalid/budokais/99/tournaments", queryEndpoint = "https://example.invalid/budokais/63/tournaments?cursor=q7";
        assert.equal(scanWtAuditTargets(catalog, [target("header-same", "fixture", envelope("response", "POST", endpoint, { headers: [{ name: "ETag", value: "h7" }] }))]).valid, false);
        assert.equal(scanWtAuditTargets(catalog, [target("header-wrong-origin", "fixture", envelope("request", "POST", endpoint, { headers: [{ name: "ETag", value: "h7" }] }))]).sensitiveMatchCategoryCounts.headers, 0);
        assert.equal(scanWtAuditTargets(catalog, [target("cookie-same", "fixture", envelope("request", "POST", endpoint, { cookies: [{ name: "sid", value: "c7" }] }))]).valid, false);
        assert.equal(scanWtAuditTargets(catalog, [target("cookie-wrong-method", "fixture", envelope("request", "GET", endpoint, { cookies: [{ name: "sid", value: "c7" }] }))]).sensitiveMatchCategoryCounts.cookies, 0);
        assert.equal(scanWtAuditTargets(catalog, [target("query-same", "fixture", envelope("request", "POST", queryEndpoint, {}))]).valid, false);
        assert.equal(scanWtAuditTargets(catalog, [target("query-wrong-origin", "fixture", envelope("response", "POST", queryEndpoint, {}))]).sensitiveMatchCategoryCounts.query, 0);
    });

    it("uses literal matching for a long distinctive neutral body leaf", () => {
        const secret = "synthetic-neutral-long-6e2f", catalog = buildWtSensitiveCatalog(focusedHar({ requestBody: { x: secret } }));
        const result = scanWtAuditTargets(catalog, [target("literal", "spec", `export const leaked = ${JSON.stringify(secret)};`)]);
        assert.equal(result.valid, false);
        assert.equal(result.matchedTargets[0].matches.some(value => value.structuralCategory === "literal"), true);
    });

    it("fails closed for an expected malformed JSON body and an empty catalog", () => {
        assert.throws(() => buildWtSensitiveCatalog(focusedHar({ url: "https://example.invalid/", requestText: "{broken", requestMimeType: "application/json" })), /JSON body is malformed/);
        assert.throws(() => buildWtSensitiveCatalog(focusedHar({ url: "https://example.invalid/" })), /catalog is empty/);
        const catalog = buildWtSensitiveCatalog(focusedHar({ url: "https://example.invalid/", requestBody: { x: "q7" } }));
        assert.throws(() => scanWtAuditTargets(catalog, [target("invalid-url", "fixture", JSON.stringify({ url: "https://[" }))]), /invalid URL structure/);
        assert.throws(() => scanWtAuditTargets(catalog, [target("invalid-json-body", "fixture", JSON.stringify({ postData: { mimeType: "application/json", text: "{broken" } }))]), /JSON body is malformed/);
    });

    it("detects a top-level primitive JSON body", () => {
        const result = scanWtAuditTargets(buildWtSensitiveCatalog(har()), [target("primitive-fixture", "fixture", JSON.stringify(values.primitive))]);
        assert.equal(result.valid, false);
        assert.equal(result.sensitiveMatchCategoryCounts.response_body > 0, true);
    });

    it("detects a four-character authorization value as a header token", () => {
        const result = scanWtAuditTargets(buildWtSensitiveCatalog(har({ authorization: values.header })), [target("header-fixture", "fixture", `Authorization: ${values.header}`)]);
        assert.equal(result.valid, false);
        assert.equal(result.sensitiveMatchCategoryCounts.headers > 0, true);
    });

    it("does not use zero or one as an unbounded substring match", () => {
        const catalog = buildWtSensitiveCatalog(har({ responseBody: 0 }));
        assert.equal(scanWtAuditTargets(catalog, [target("text", "other", "const synthetic1001 = true;")]).valid, true);
        assert.equal(scanWtAuditTargets(catalog, [target("structured", "fixture", "0")]).valid, false);
    });

    it("rejects HAR content by structure under arbitrary names", () => {
        const source = har(), catalog = buildWtSensitiveCatalog(source);
        const result = scanWtAuditTargets(catalog, [target("renamed-json", "other", source), target("renamed-text", "other", source), target("renamed-extensionless", "other", source)]);
        assert.equal(result.valid, false);
        assert.equal(result.rawHarTargetCount, 3);
        assert.equal(result.matchedTargets.length, 3);
    });

    it("scans specs and fixtures without path or type exclusions", () => {
        const catalog = buildWtSensitiveCatalog(har());
        const result = scanWtAuditTargets(catalog, [target("synthetic.spec.ts", "spec", `export const value = ${JSON.stringify(values.array)};`), target("fixtures/synthetic.bin", "fixture", values.primitive)]);
        assert.equal(result.valid, false);
        assert.equal(result.categoryTargetCounts.spec, 1);
        assert.equal(result.categoryTargetCounts.fixture, 1);
        assert.equal(result.matchedTargets.length, 2);
    });

    it("keeps public match records sanitized", () => {
        const result = scanWtAuditTargets(buildWtSensitiveCatalog(har()), [target("private/logical/path", "other", values.array)]);
        const serialized = JSON.stringify(result);
        assert.equal(serialized.includes(values.array), false);
        assert.equal(serialized.includes("private/logical/path"), false);
        assert.match(result.matchedTargets[0].targetId, /^[a-f0-9]{64}$/);
    });

    it("fails closed when no audit targets are supplied", () => {
        assert.throws(() => scanWtAuditTargets(buildWtSensitiveCatalog(har()), []), /collection is empty/);
    });

    it("scans a sensitive blob that exists only in historical Git state", () => {
        const root = mkdtempSync(join(tmpdir(), "wt-git-audit-"));
        try {
            git(root, ["init", "-q"]); git(root, ["config", "user.name", "Synthetic Audit"]); git(root, ["config", "user.email", "audit@example.invalid"]);
            writeFileSync(join(root, "baseline.txt"), "synthetic baseline\n");
            const base = commit(root, "baseline");
            writeFileSync(join(root, "historical.bin"), values.historical);
            commit(root, "historical value");
            rmSync(join(root, "historical.bin"));
            writeFileSync(join(root, "tip.txt"), "synthetic clean tip\n");
            const tip = commit(root, "clean tip");
            const collection = collectWtGitAuditTargets(root, base, tip);
            assert.equal(collection.commitCount, 2);
            assert.equal(collection.categoryTargetCounts.tip, 2);
            assert.equal(collection.categoryTargetCounts.history_old > 0, true);
            assert.equal(collection.categoryTargetCounts.history_new > 0, true);
            const result = scanWtAuditTargets(buildWtSensitiveCatalog(har({ requestBody: { secret_historical: values.historical } })), collection);
            assert.equal(result.valid, false);
            assert.equal(result.categoryTargetCounts.history_old > 0, true);
            assert.equal(result.matchedTargets.some(value => value.categories.includes("request_body")), true);
            const serialized = JSON.stringify({ collection, result });
            assert.equal(serialized.includes(values.historical), false);
            assert.equal(serialized.includes(root), false);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("detects short contextual variants present only in historical Git blobs", () => {
        const root = mkdtempSync(join(tmpdir(), "wt-git-context-audit-"));
        try {
            git(root, ["init", "-q"]); git(root, ["config", "user.name", "Synthetic Audit"]); git(root, ["config", "user.email", "audit@example.invalid"]);
            writeFileSync(join(root, "baseline.txt"), "synthetic baseline\n");
            const base = commit(root, "baseline");
            const historical: Record<string, string> = {
                "body.json": JSON.stringify({ x: "j7" }),
                "header.txt": "ETag: h7",
                "cookie.txt": "Cookie: sid=c7",
                "url.txt": "https://example.invalid/p7?cursor=q7",
                "text.txt": "t7",
            };
            for (const [name, content] of Object.entries(historical)) writeFileSync(join(root, name), content);
            commit(root, "historical contextual values");
            for (const name of Object.keys(historical)) rmSync(join(root, name));
            writeFileSync(join(root, "tip.txt"), "synthetic clean tip\n");
            const tip = commit(root, "clean tip"), catalog = buildWtSensitiveCatalog(focusedHar({ url: "https://example.invalid/p7?cursor=q7", responseHeaders: [{ name: "ETag", value: "h7" }], requestCookies: [{ name: "sid", value: "c7" }], requestBody: { x: "j7" }, responseText: "t7" }));
            const result = scanWtAuditTargets(catalog, collectWtGitAuditTargets(root, base, tip));
            assert.equal(result.valid, false);
            for (const category of ["headers", "cookies", "url_path", "query", "request_body", "response_body"] as const) assert.equal(result.sensitiveMatchCategoryCounts[category] > 0, true, `missed ${category}`);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("fails closed when a collected Git blob becomes unreadable", () => {
        const root = mkdtempSync(join(tmpdir(), "wt-git-unreadable-"));
        try {
            git(root, ["init", "-q"]); git(root, ["config", "user.name", "Synthetic Audit"]); git(root, ["config", "user.email", "audit@example.invalid"]);
            writeFileSync(join(root, "baseline.txt"), "synthetic baseline\n");
            const base = commit(root, "baseline");
            writeFileSync(join(root, "unreadable.bin"), "synthetic-unreadable-private-4a8f");
            const tip = commit(root, "unreadable target"), blob = git(root, ["rev-parse", "HEAD:unreadable.bin"]), collection = collectWtGitAuditTargets(root, base, tip);
            rmSync(join(root, ".git", "objects", blob.slice(0, 2), blob.slice(2)));
            assert.throws(() => scanWtAuditTargets(buildWtSensitiveCatalog(har()), collection), /blob (?:inventory is malformed|batch is unreadable)/);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("allows only the exact historical HAR fingerprints and rejects missing, extra, or tip HAR structure", () => {
        const root = mkdtempSync(join(tmpdir(), "wt-git-har-policy-"));
        try {
            git(root, ["init", "-q"]); git(root, ["config", "user.name", "Synthetic Audit"]); git(root, ["config", "user.email", "audit@example.invalid"]);
            writeFileSync(join(root, "baseline.txt"), "synthetic baseline\n");
            const base = commit(root, "baseline");
            const syntheticHar = JSON.stringify({ log: { entries: [] } });
            writeFileSync(join(root, "renamed.bin"), syntheticHar);
            commit(root, "historical synthetic HAR");
            rmSync(join(root, "renamed.bin"));
            writeFileSync(join(root, "tip.txt"), "synthetic clean tip\n");
            const cleanTip = commit(root, "clean tip");
            const catalog = buildWtSensitiveCatalog(har()), cleanCollection = collectWtGitAuditTargets(root, base, cleanTip);
            const denied = scanWtAuditTargets(catalog, cleanCollection);
            assert.equal(denied.valid, false); assert.equal(denied.rawHarTargetCount, 2); assert.equal(denied.tipHarStructureTargetCount, 0);
            const fingerprints = denied.harStructureTargets.map(value => value.fingerprint);
            const allowed = scanWtAuditTargets(catalog, cleanCollection, { allowedHistoricalHarTargetFingerprints: fingerprints });
            assert.equal(allowed.valid, true); assert.equal(allowed.harStructureTargetCount, 2); assert.equal(allowed.historicalHarAllowlistSatisfied, true);
            assert.equal(scanWtAuditTargets(catalog, cleanCollection, { allowedHistoricalHarTargetFingerprints: fingerprints.slice(0, 1) }).valid, false);
            assert.equal(scanWtAuditTargets(catalog, cleanCollection, { allowedHistoricalHarTargetFingerprints: [...fingerprints, "f".repeat(64)] }).valid, false);
            writeFileSync(join(root, "tip-har.txt"), syntheticHar);
            const harTip = commit(root, "tip HAR");
            const tipResult = scanWtAuditTargets(catalog, collectWtGitAuditTargets(root, base, harTip), { allowedHistoricalHarTargetFingerprints: fingerprints });
            assert.equal(tipResult.valid, false); assert.equal(tipResult.tipHarStructureTargetCount, 1);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });

    it("rejects invalid and empty Git ranges", () => {
        const root = mkdtempSync(join(tmpdir(), "wt-git-range-"));
        try {
            git(root, ["init", "-q"]); git(root, ["config", "user.name", "Synthetic Audit"]); git(root, ["config", "user.email", "audit@example.invalid"]);
            writeFileSync(join(root, "baseline.txt"), "synthetic baseline\n");
            const tip = commit(root, "baseline");
            assert.throws(() => collectWtGitAuditTargets(root, tip, tip), /range is empty/);
            assert.throws(() => collectWtGitAuditTargets(root, "not-a-revision", tip), /command failed/);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });
});
