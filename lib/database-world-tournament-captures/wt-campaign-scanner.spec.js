"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const wt_campaign_scanner_1 = require("./wt-campaign-scanner");
const wt_first_party_app_identity_1 = require("./wt-first-party-app-identity");
const crypto_1 = require("crypto");
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
function focusedHar(options) {
    const request = {
        method: options.method ?? "GET",
        url: options.url ?? "https://example.invalid/",
        headers: options.requestHeaders ?? [],
        cookies: options.requestCookies ?? [],
        queryString: [],
    };
    const response = { status: 200, headers: options.responseHeaders ?? [], cookies: options.responseCookies ?? [] };
    if (Object.prototype.hasOwnProperty.call(options, "requestBody") || options.requestText !== undefined)
        request.postData = { mimeType: options.requestMimeType ?? (Object.prototype.hasOwnProperty.call(options, "requestBody") ? "application/wt-synthetic+json" : "text/plain"), text: options.requestText ?? JSON.stringify(options.requestBody) };
    if (Object.prototype.hasOwnProperty.call(options, "responseBody") || options.responseText !== undefined)
        response.content = { mimeType: options.responseMimeType ?? (Object.prototype.hasOwnProperty.call(options, "responseBody") ? "application/wt-synthetic+json" : "text/plain"), text: options.responseText ?? JSON.stringify(options.responseBody) };
    return JSON.stringify({ log: { entries: [{ request, response }] } });
}
function har(overrides) {
    const requestBody = overrides && "requestBody" in overrides ? overrides.requestBody : { secret_values: [values.array] };
    const responseBody = overrides && "responseBody" in overrides ? overrides.responseBody : values.primitive;
    return JSON.stringify({ log: { entries: [{
                    request: {
                        method: "POST",
                        url: `https://${encodeURIComponent(values.username)}:${encodeURIComponent(values.password)}@example.invalid/audit/q7?cursor=${encodeURIComponent(values.query)}`,
                        headers: [{ name: "Authorization", value: overrides?.authorization ?? values.header }, { name: "Cookie", value: `session=${values.cookie}` }],
                        cookies: [{ name: "session", value: values.cookie }],
                        queryString: [{ name: "cursor", value: values.query }],
                        postData: { mimeType: "application/wt-synthetic+json", text: JSON.stringify(requestBody) },
                    },
                    response: {
                        status: 200,
                        headers: [],
                        cookies: [],
                        content: { mimeType: "application/wt-synthetic+json", text: JSON.stringify(responseBody) },
                    },
                }] } });
}
function target(targetId, category, content) {
    return { targetId, category, content: Buffer.from(content) };
}
function pinnedAppIdentityFromReviewedBase() {
    const text = (0, fs_1.readFileSync)((0, path_1.join)(process.cwd(), "game-db/game-db-pull-emulator-database-artifact.ts"), "utf8"), candidates = text.match(/[A-Za-z0-9_.-]{16,}/g) ?? [];
    const identity = candidates.find(value => Buffer.byteLength(value) === wt_first_party_app_identity_1.WT_FIRST_PARTY_APP_IDENTITY_SIZE_BYTES && (0, crypto_1.createHash)("sha256").update(value).digest("hex") === wt_first_party_app_identity_1.WT_FIRST_PARTY_APP_IDENTITY_SHA256);
    if (!identity)
        throw new Error("WT synthetic test could not materialize the independently pinned public identity");
    return identity;
}
const syntheticAppIdentity = pinnedAppIdentityFromReviewedBase();
function appIdentityProof(identity = syntheticAppIdentity) {
    return {
        packageIdentity: identity,
        evidence: {
            schemaVersion: 2,
            contract: "dokkan-wt-first-party-app-identity",
            rule: wt_first_party_app_identity_1.WT_FIRST_PARTY_APP_IDENTITY_RULE,
            apk: { sizeBytes: wt_first_party_app_identity_1.WT_FIRST_PARTY_APK_SIZE_BYTES, sha256: wt_first_party_app_identity_1.WT_FIRST_PARTY_APK_SHA256 },
            tool: { name: "aapt", sizeBytes: wt_first_party_app_identity_1.WT_FIRST_PARTY_AAPT_SIZE_BYTES, executableSha256: wt_first_party_app_identity_1.WT_FIRST_PARTY_AAPT_SHA256, version: wt_first_party_app_identity_1.WT_FIRST_PARTY_AAPT_VERSION, command: "privateSnapshot/aapt.exe dump badging privateSnapshot/source.apk" },
            snapshot: {
                contract: wt_first_party_app_identity_1.WT_FIRST_PARTY_SNAPSHOT_CONTRACT,
                apk: { relativePath: "source.apk", sizeBytes: wt_first_party_app_identity_1.WT_FIRST_PARTY_APK_SIZE_BYTES, sha256: wt_first_party_app_identity_1.WT_FIRST_PARTY_APK_SHA256 },
                tool: { relativePath: "aapt.exe", sizeBytes: wt_first_party_app_identity_1.WT_FIRST_PARTY_AAPT_SIZE_BYTES, sha256: wt_first_party_app_identity_1.WT_FIRST_PARTY_AAPT_SHA256 },
                sourceOpenCount: { apk: 1, tool: 1 }, copy: "single_open_filehandle_stream_incremental_sha256", execution: "private_snapshots_only_no_shell", validation: "identity_size_stable_timestamps_type_sha256_before_after", cleanup: "owned_identity_only_or_quarantine", materialLineageSha256: wt_first_party_app_identity_1.WT_FIRST_PARTY_SNAPSHOT_LINEAGE_SHA256,
            },
            identity: { jsonType: "string", sizeBytes: wt_first_party_app_identity_1.WT_FIRST_PARTY_APP_IDENTITY_SIZE_BYTES, sha256: wt_first_party_app_identity_1.WT_FIRST_PARTY_APP_IDENTITY_SHA256 },
        },
    };
}
function authCatalog(body, method = "POST", route = "/auth/sign_in") {
    const authEntry = JSON.parse(focusedHar({ method, url: `https://example.invalid${route}`, requestBody: body })).log.entries[0];
    const matcherCoverageEntry = JSON.parse(focusedHar({ url: "https://example.invalid/audit/q7" })).log.entries[0];
    return (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(JSON.stringify({ log: { entries: [authEntry, matcherCoverageEntry] } }));
}
function git(root, args) {
    return (0, child_process_1.execFileSync)("git", args, { cwd: root, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function commit(root, message) {
    git(root, ["add", "-A"]);
    git(root, ["commit", "-m", message]);
    return git(root, ["rev-parse", "HEAD"]);
}
describe("World Tournament campaign scanner", () => {
    it("builds an opaque complete catalog without returning sensitive values", () => {
        const catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(har());
        assert.deepEqual(Object.keys(catalog.categoryValueCounts).sort(), ["cookies", "headers", "query", "request_body", "response_body", "url_credentials", "url_path"]);
        assert.equal(catalog.entryCount, 1);
        assert.equal(catalog.sensitiveValueCount > 0, true);
        const serialized = JSON.stringify(catalog);
        for (const value of Object.values(values))
            assert.equal(serialized.includes(value), false);
    });
    it("detects a sensitive scalar nested in a primitive array", () => {
        const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)((0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(har()), [target("array-fixture", "fixture", JSON.stringify({ secret_values: [values.array] }))]);
        assert.equal(result.valid, false);
        assert.equal(result.sensitiveMatchCategoryCounts.request_body > 0, true);
    });
    it("detects every short JSON leaf in root arrays, nested arrays, and neutral keys", () => {
        for (const body of [["q7"], { x: [["q7"]] }, { x: "q7" }]) {
            const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)((0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ requestBody: body })), [target("json-leaf", "fixture", JSON.stringify(body))]);
            assert.equal(result.valid, false);
            assert.equal(result.sensitiveMatchCategoryCounts.request_body > 0, true);
        }
    });
    it("detects string, number, boolean, and null JSON leaves with canonical typing", () => {
        for (const value of ["q7", 17, false, null]) {
            const body = { x: value }, result = (0, wt_campaign_scanner_1.scanWtAuditTargets)((0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ requestBody: body })), [target("typed-json-leaf", "fixture", JSON.stringify(body))]);
            assert.equal(result.valid, false, `missed ${JSON.stringify(value)}`);
        }
    });
    it("detects JSON primitive roots in both request and response bodies", () => {
        const catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ requestBody: "q7", responseBody: 17 }));
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("request-root", "fixture", JSON.stringify("q7"))]).sensitiveMatchCategoryCounts.request_body > 0, true);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("response-root", "fixture", "17")]).sensitiveMatchCategoryCounts.response_body > 0, true);
    });
    it("keeps request and response body observations independently detectable", () => {
        const catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ requestBody: { x: "q7" }, responseBody: { y: "r8" } }));
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("request", "fixture", JSON.stringify({ x: "q7" }))]).sensitiveMatchCategoryCounts.request_body > 0, true);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("response", "fixture", JSON.stringify({ y: "r8" }))]).sensitiveMatchCategoryCounts.response_body > 0, true);
    });
    it("detects short headers by normalized name and value, including ETag", () => {
        const catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ responseHeaders: [{ name: "ETag", value: "q7" }] }));
        const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("etag", "fixture", "etag: q7")]);
        assert.equal(result.valid, false);
        assert.equal(result.sensitiveMatchCategoryCounts.headers > 0, true);
    });
    it("detects short cookies only by cookie name and value", () => {
        const catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ requestCookies: [{ name: "sid", value: "q7" }] }));
        const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("cookie", "fixture", "Cookie: sid=q7")]);
        assert.equal(result.valid, false);
        assert.equal(result.sensitiveMatchCategoryCounts.cookies > 0, true);
    });
    it("detects short and long query values by query name and component", () => {
        const long = "synthetic-long-query-8fd2", catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ url: `https://example.invalid/?short=q7&long=${long}` }));
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("short-query", "fixture", "https://example.invalid/?short=q7")]).sensitiveMatchCategoryCounts.query > 0, true);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("long-query", "fixture", `https://example.invalid/?long=${long}`)]).sensitiveMatchCategoryCounts.query > 0, true);
    });
    it("detects a captured URL path segment structurally", () => {
        const catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ url: "https://example.invalid/audit/q7" }));
        const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("url-path", "fixture", "https://example.invalid/audit/q7")]);
        assert.equal(result.valid, true);
        assert.equal(result.sensitiveMatchCategoryCounts.url_path > 0, true);
        assert.equal(result.matchClassCounts.permitted_protocol_structure > 0, true);
    });
    it("catalogs public alphabetic route segments without treating them as captured-value matches", () => {
        const publicEntry = JSON.parse(focusedHar({ url: "https://example.invalid/bonus_schedules" })).log.entries[0];
        const valueEntry = JSON.parse(focusedHar({ url: "https://example.invalid/audit/q7" })).log.entries[0];
        const catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(JSON.stringify({ log: { entries: [publicEntry, valueEntry] } }));
        assert.equal(catalog.categoryValueCounts.url_path, 3);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("public-route", "fixture", "https://example.invalid/bonus_schedules")]).valid, true);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("value-bearing-route", "fixture", "https://example.invalid/audit/q7")]).sensitiveMatchCategoryCounts.url_path > 0, true);
    });
    it("detects a short non-JSON textual body only as a conservative text token", () => {
        const catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ requestText: "q7", requestMimeType: "text/plain" }));
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("text-body", "fixture", "q7")]).sensitiveMatchCategoryCounts.request_body > 0, true);
    });
    it("detects every threshold-length literal without format or character-class heuristics", () => {
        const cases = [
            { label: "hex", value: "abcdef0123456789abcdef0123456789", source: { requestHeaders: [{ name: "X-Capture", value: "abcdef0123456789abcdef0123456789" }] }, kind: "string" },
            { label: "numeric-hex", value: "01234567890123456789012345678901", source: { requestCookies: [{ name: "sid", value: "01234567890123456789012345678901" }] }, kind: "string" },
            { label: "uuid-hyphen", value: "123e4567-e89b-12d3-a456-426614174000", source: { url: "https://example.invalid/?cursor=123e4567-e89b-12d3-a456-426614174000" }, kind: "string" },
            { label: "uuid-compact", value: "123e4567e89b12d3a456426614174000", source: { url: "https://example.invalid/123e4567e89b12d3a456426614174000" }, kind: "string" },
            { label: "base32", value: "JBSWY3DPEBLW64TMMQ======", source: { requestBody: { token: "JBSWY3DPEBLW64TMMQ======" } }, kind: "string" },
            { label: "base64", value: "YWJjZGVmZ2hpamtsbW5vcA==", source: { responseBody: { token: "YWJjZGVmZ2hpamtsbW5vcA==" } }, kind: "string" },
            { label: "base64url", value: "YWJjZGVmZ2hpamtsbW5vcA_-", source: { requestText: "YWJjZGVmZ2hpamtsbW5vcA_-", requestMimeType: "text/plain" }, kind: "string" },
            { label: "decimal-string", value: "123456789012345678901234567890", source: { responseText: "123456789012345678901234567890", responseMimeType: "text/plain" }, kind: "string" },
            { label: "decimal-number", value: 1234567890123, source: { requestBody: { id: 1234567890123 } }, kind: "number" },
            { label: "alphabetic", value: "abcdefghijklmnop", source: { url: "https://example.invalid/?cursor=abcdefghijklmnop" }, kind: "string" },
            { label: "lower-base64url", value: "abcdefghijklmnop-_", source: { url: "https://example.invalid/?cursor=abcdefghijklmnop-_" }, kind: "string" },
            { label: "compact-dotted", value: "token.compacto.pontuado", source: { requestBody: { x: "token.compacto.pontuado" } }, kind: "string" },
            { label: "multi-dotted", value: "abc.def.ghi.jklmnop", source: { responseBody: { x: "abc.def.ghi.jklmnop" } }, kind: "string" },
            { label: "hyphen-underscore", value: "--------________", source: { requestHeaders: [{ name: "X-Capture", value: "--------________" }] }, kind: "string" },
            { label: "dots", value: "................", source: { requestCookies: [{ name: "sid", value: "................" }] }, kind: "string" },
            { label: "tilde-plus-slash-equals", value: "~~~~++++////====", source: { responseText: "~~~~++++////====", responseMimeType: "text/plain" }, kind: "string" },
        ];
        for (const row of cases) {
            const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)((0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar(row.source)), [target(`${row.label}.ts`, "spec", `export const renamedValue = ${JSON.stringify(row.value)};`)]);
            assert.equal(result.valid, false, `missed ${row.label}`);
            const literal = result.matchedTargets.flatMap(value => value.matches).find(value => value.matchMode === "literal");
            assert.ok(literal, `missing literal report for ${row.label}`);
            assert.equal(literal.jsonType, row.kind);
            assert.match(literal.endpointHash, /^[a-f0-9]{64}$/);
            assert.match(literal.sourcePathHash, /^[a-f0-9]{64}$/);
            assert.match(literal.method, /^[A-Z]+$/);
        }
        assert.equal(wt_campaign_scanner_1.WT_LITERAL_MATCHER_CONTRACT_VERSION, "length-boundary-v1");
        assert.equal(wt_campaign_scanner_1.WT_LITERAL_STRING_MIN_BYTES, 16);
        assert.equal(wt_campaign_scanner_1.WT_LITERAL_CANONICAL_MIN_BYTES, 8);
    });
    it("uses one generic boundary rule at file positions and around delimiters", () => {
        const value = "abcdefghijklmnop-_", catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ responseBody: { token: value } }));
        const delimited = [value, `${value}\ntrailer`, `prefix ${value} suffix`, `prefix\n${value}`, `"${value}"`, `(${value}),`, `[${value}]`, `{ ${value}; }`];
        for (const [index, content] of delimited.entries())
            assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target(`delimited-${index}`, "spec", content)]).valid, false, `missed delimited position ${index}`);
        for (const edge of ["a", "Z", "7", "-", "_", ".", "~", "+", "/", "=", "%"]) {
            for (const content of [`${edge}${value}`, `${value}${edge}`, `${edge}${value}${edge}`])
                assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target(`larger-${edge}`, "spec", content)]).valid, true, `matched internal token at ${JSON.stringify(edge)}`);
        }
        const numeric = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ requestBody: { id: 1234567890123 } }));
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(numeric, [target("larger-number.ts", "spec", "const unrelated = 912345678901234;")]).valid, true);
    });
    it("enforces the length invariant across a matrix of character alphabets", () => {
        const alphabets = ["a", "Z", "7", "-", "_", ".", "~", "+", "/", "=", "-_", ".~", "+/=", "aZ7-_.~+/="];
        const toThreshold = (alphabet) => alphabet.repeat(Math.ceil(wt_campaign_scanner_1.WT_LITERAL_STRING_MIN_BYTES / Buffer.byteLength(alphabet))).slice(0, wt_campaign_scanner_1.WT_LITERAL_STRING_MIN_BYTES);
        for (const alphabet of alphabets) {
            const value = toThreshold(alphabet), catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ requestBody: { x: value } }));
            const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target(`alphabet-${Buffer.from(alphabet).toString("hex")}`, "spec", `const unrelated = ${JSON.stringify(value)};`)]);
            assert.equal(Buffer.byteLength(value), wt_campaign_scanner_1.WT_LITERAL_STRING_MIN_BYTES);
            assert.equal(result.valid, false, `composition escaped: ${JSON.stringify(alphabet)}`);
            assert.equal(result.matchedTargets.flatMap(row => row.matches).some(match => match.matchMode === "literal"), true);
        }
        const below = "a".repeat(wt_campaign_scanner_1.WT_LITERAL_STRING_MIN_BYTES - 1), belowCatalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ requestBody: { x: below } }));
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(belowCatalog, [target("below-threshold", "fixture", JSON.stringify({ y: below }))]).valid, true);
    });
    it("classifies explicit TypeScript and raw textual bodies separately from JSON", () => {
        const requestCatalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ requestText: "q7", requestMimeType: "text/plain" }));
        const responseCatalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ responseText: "q7", responseMimeType: "text/plain" }));
        const requestTargets = [
            target("raw.txt", "fixture", "q7"),
            target("raw-structure.json", "fixture", JSON.stringify({ postData: { mimeType: "text/plain", text: "q7" } })),
            target("direct.ts", "spec", "const leakedTextBody = \"q7\";"),
            target("intermediate.ts", "spec", "const intermediate = \"q7\"; const leakedTextBody = intermediate;"),
            target("template.ts", "spec", "const leakedTextBody = `q7`;"),
            target("interpolated-template.ts", "spec", "const intermediate = \"q7\"; const leakedTextBody = `${intermediate}`;"),
        ];
        for (const candidate of requestTargets) {
            const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)(requestCatalog, [candidate]);
            assert.equal(result.valid, false, `missed ${candidate.targetId}`);
            assert.equal(result.sensitiveMatchCategoryCounts.request_body > 0, true);
            assert.equal(result.matchedTargets[0].matches.every(value => value.sourceStructuralCategory === "text_body" && (value.foundStructuralCategory === "text_body" || value.foundStructuralCategory === "text_exact")), true);
        }
        const response = (0, wt_campaign_scanner_1.scanWtAuditTargets)(responseCatalog, [target("response.ts", "spec", "const leakedTextBody = \"q7\";")]);
        assert.equal(response.valid, false);
        assert.equal(response.sensitiveMatchCategoryCounts.response_body > 0, true);
        const jsonCatalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ requestBody: { x: "q7" } }));
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(jsonCatalog, [target("text-context.ts", "spec", "const leakedTextBody = \"q7\";")]).valid, true);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(requestCatalog, [target("json-context.json", "fixture", JSON.stringify({ x: "q7" }))]).valid, true);
        const jsonShapedCatalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ requestText: JSON.stringify({ x: "q7" }), requestMimeType: "text/plain" }));
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(jsonShapedCatalog, [target("json-shaped-raw.txt", "fixture", JSON.stringify({ x: "q7" }))]).valid, false);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(jsonShapedCatalog, [target("json-structure.json", "fixture", JSON.stringify({ body: { x: "q7" } }))]).valid, true);
        for (const [label, raw] of [["whitespace", "  q7  "], ["multiline", "line one\nq7\nline three"], ["over-4k", "q7 ".repeat(1500)]]) {
            const exactCatalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ requestText: raw, requestMimeType: "text/plain" }));
            assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(exactCatalog, [target(`${label}.txt`, "fixture", raw)]).valid, false, `missed exact ${label}`);
            assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(exactCatalog, [target(`${label}-changed.txt`, "fixture", `${raw}x`)]).valid, true, `accepted inexact ${label}`);
        }
        const emptyCatalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ requestHeaders: [{ name: "ETag", value: "q7" }], requestText: "", requestMimeType: "text/plain" }));
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(emptyCatalog, [{ targetId: "empty.txt", category: "fixture", content: Buffer.alloc(0) }]).valid, true);
    });
    it("does not cross-match the same short value across structural contexts", () => {
        const catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ url: "https://example.invalid/", responseHeaders: [{ name: "ETag", value: "q7" }] }));
        for (const content of [JSON.stringify({ x: "q7" }), "Cookie: sid=q7", "https://example.invalid/other?etag=q7", "q7"])
            assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("different-context", "fixture", content)]).valid, true);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("wrong-header", "fixture", "X-Other: q7")]).valid, true);
    });
    it("does not cross-match short JSON paths, cookie names, or query names", () => {
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)((0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ url: "https://example.invalid/", requestBody: { x: "q7" } })), [target("wrong-json-path", "fixture", JSON.stringify({ y: "q7" }))]).valid, true);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)((0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ url: "https://example.invalid/", requestCookies: [{ name: "sid", value: "q7" }] })), [target("wrong-cookie", "fixture", "Cookie: other=q7")]).valid, true);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)((0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ url: "https://example.invalid/?short=q7" })), [target("wrong-query", "fixture", "https://example.invalid/?other=q7")]).valid, true);
    });
    it("extracts short JSON, header, and cookie observations from static TypeScript literals", () => {
        const catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({
            requestBody: { x: "j7" },
            responseHeaders: [{ name: "ETag", value: "h7" }],
            requestCookies: [{ name: "sid", value: "c7" }],
        }));
        const source = [
            "const neutral = { x: \"j7\" };",
            "const header = { name: \"ETag\", value: \"h7\" };",
            "const cookies = [{ name: \"sid\", value: \"c7\" }];",
        ].join("\n");
        const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("static.ts", "spec", source)]);
        assert.equal(result.valid, false);
        for (const category of ["request_body", "headers", "cookies"])
            assert.equal(result.sensitiveMatchCategoryCounts[category] > 0, true, `missed ${category}`);
    });
    it("extracts typed primitive JSON roots from explicitly JSON-like static TypeScript contexts", () => {
        for (const value of ["q7", 17, false, null]) {
            const catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ requestBody: value }));
            const declaration = `const leakedJsonBody = ${JSON.stringify(value)};`;
            assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("primitive.ts", "spec", declaration)]).valid, false, `missed ${JSON.stringify(value)}`);
        }
        const catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ responseBody: "q7" }));
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("return.ts", "spec", "function leakedJsonBody() { return \"q7\"; }")]).valid, false);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("unrelated.ts", "spec", "const retryCount = 17; const enabled = false;")]).valid, true);
    });
    it("uses capture origin, method, and sanitized endpoint when target body context is explicit", () => {
        const catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ method: "POST", url: "https://example.invalid/budokais/63/tournaments", requestBody: { x: "q7" } }));
        const envelope = (origin, method, url) => JSON.stringify({ origin, method, url, body: { x: "q7" } });
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("same-context", "fixture", envelope("request", "POST", "https://example.invalid/budokais/99/tournaments"))]).valid, false);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("wrong-origin", "fixture", envelope("response", "POST", "https://example.invalid/budokais/99/tournaments"))]).valid, true);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("wrong-method", "fixture", envelope("request", "GET", "https://example.invalid/budokais/99/tournaments"))]).valid, true);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("wrong-endpoint", "fixture", envelope("request", "POST", "https://example.invalid/other"))]).valid, true);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("unscoped-body", "fixture", JSON.stringify({ x: "q7" }))]).valid, false);
    });
    it("propagates explicit capture context to short headers, cookies, and URL/query observations", () => {
        const catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({
            method: "POST",
            url: "https://example.invalid/budokais/63/tournaments?cursor=q7",
            responseHeaders: [{ name: "ETag", value: "h7" }],
            requestCookies: [{ name: "sid", value: "c7" }],
        }));
        const envelope = (origin, method, url, extra) => JSON.stringify({ origin, method, url, ...extra });
        const endpoint = "https://example.invalid/budokais/99/tournaments", queryEndpoint = "https://example.invalid/budokais/63/tournaments?cursor=q7";
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("header-same", "fixture", envelope("response", "POST", endpoint, { headers: [{ name: "ETag", value: "h7" }] }))]).valid, false);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("header-wrong-origin", "fixture", envelope("request", "POST", endpoint, { headers: [{ name: "ETag", value: "h7" }] }))]).sensitiveMatchCategoryCounts.headers, 0);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("cookie-same", "fixture", envelope("request", "POST", endpoint, { cookies: [{ name: "sid", value: "c7" }] }))]).valid, false);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("cookie-wrong-method", "fixture", envelope("request", "GET", endpoint, { cookies: [{ name: "sid", value: "c7" }] }))]).sensitiveMatchCategoryCounts.cookies, 0);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("query-same", "fixture", envelope("request", "POST", queryEndpoint, {}))]).valid, false);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("query-wrong-origin", "fixture", envelope("response", "POST", queryEndpoint, {}))]).sensitiveMatchCategoryCounts.query, 0);
    });
    it("uses literal matching for a long distinctive neutral body leaf", () => {
        const secret = "synthetic-neutral-long-6e2f", catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ requestBody: { x: secret } }));
        const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("literal", "spec", `export const leaked = ${JSON.stringify(secret)};`)]);
        assert.equal(result.valid, false);
        assert.equal(result.matchedTargets[0].matches.some(value => value.matchMode === "literal" && value.foundStructuralCategory === "code_literal"), true);
    });
    it("fails closed for an expected malformed JSON body and an empty catalog", () => {
        assert.throws(() => (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ url: "https://example.invalid/", requestText: "{broken", requestMimeType: "application/wt-synthetic+json" })), /JSON body is malformed/);
        assert.throws(() => (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ url: "https://example.invalid/", requestText: "", requestMimeType: "application/wt-synthetic+json" })), /JSON body is malformed/);
        assert.throws(() => (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ url: "https://example.invalid/" })), /catalog is empty/);
        const catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ url: "https://example.invalid/", requestBody: { x: "q7" } }));
        assert.throws(() => (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("invalid-url", "fixture", JSON.stringify({ url: "https://[" }))]), /invalid URL structure/);
        assert.throws(() => (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("invalid-json-body", "fixture", JSON.stringify({ postData: { mimeType: "application/wt-synthetic+json", text: "{broken" } }))]), /JSON body is malformed/);
        assert.throws(() => (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("invalid-mime", "fixture", JSON.stringify({ postData: { mimeType: 17, text: "q7" } }))]), /MIME type is malformed/);
        assert.throws(() => (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [{ targetId: "oversized", category: "fixture", content: Buffer.alloc(16 * 1024 * 1024 + 1) }]), /exceeds the bounded scanner size/);
    });
    it("detects a top-level primitive JSON body", () => {
        const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)((0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(har()), [target("primitive-fixture", "fixture", JSON.stringify(values.primitive))]);
        assert.equal(result.valid, false);
        assert.equal(result.sensitiveMatchCategoryCounts.response_body > 0, true);
    });
    it("detects a four-character authorization value as a header token", () => {
        const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)((0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(har({ authorization: values.header })), [target("header-fixture", "fixture", `Authorization: ${values.header}`)]);
        assert.equal(result.valid, false);
        assert.equal(result.sensitiveMatchCategoryCounts.headers > 0, true);
    });
    it("does not use zero or one as an unbounded substring match", () => {
        const catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(har({ responseBody: 0 }));
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("text", "other", "const synthetic1001 = true;")]).valid, true);
        assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("structured", "fixture", "0")]).valid, false);
    });
    it("rejects HAR content by structure under arbitrary names", () => {
        const source = har(), catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(source);
        const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("renamed-json", "other", source), target("renamed-text", "other", source), target("renamed-extensionless", "other", source)]);
        assert.equal(result.valid, false);
        assert.equal(result.rawHarTargetCount, 3);
        assert.equal(result.matchedTargets.length, 3);
    });
    it("scans specs and fixtures without path or type exclusions", () => {
        const catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(har());
        const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("synthetic.spec.ts", "spec", `export const value = ${JSON.stringify(values.array)};`), target("fixtures/synthetic.bin", "fixture", values.primitive)]);
        assert.equal(result.valid, false);
        assert.equal(result.categoryTargetCounts.spec, 1);
        assert.equal(result.categoryTargetCounts.fixture, 1);
        assert.equal(result.matchedTargets.length, 2);
    });
    it("keeps public match records sanitized", () => {
        const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)((0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(har()), [target("private/logical/path", "other", values.array)]);
        const serialized = JSON.stringify(result);
        assert.equal(serialized.includes(values.array), false);
        assert.equal(serialized.includes("private/logical/path"), false);
        assert.match(result.matchedTargets[0].targetId, /^[a-f0-9]{64}$/);
        const match = result.matchedTargets[0].matches[0];
        assert.equal(match.matchMode, "literal");
        assert.equal(match.jsonType, "string");
        assert.equal(match.origin, "request");
        assert.equal(match.method, "POST");
        assert.match(match.endpointHash, /^[a-f0-9]{64}$/);
        assert.match(match.sourcePathHash, /^[a-f0-9]{64}$/);
    });
    it("fails closed when no audit targets are supplied", () => {
        assert.throws(() => (0, wt_campaign_scanner_1.scanWtAuditTargets)((0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(har()), []), /collection is empty/);
    });
    it("scans a sensitive blob that exists only in historical Git state", () => {
        const root = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "wt-git-audit-"));
        try {
            git(root, ["init", "-q"]);
            git(root, ["config", "user.name", "Synthetic Audit"]);
            git(root, ["config", "user.email", "audit@example.invalid"]);
            (0, fs_1.writeFileSync)((0, path_1.join)(root, "baseline.txt"), "synthetic baseline\n");
            const base = commit(root, "baseline");
            (0, fs_1.writeFileSync)((0, path_1.join)(root, "historical.bin"), values.historical);
            commit(root, "historical value");
            (0, fs_1.rmSync)((0, path_1.join)(root, "historical.bin"));
            (0, fs_1.writeFileSync)((0, path_1.join)(root, "tip.txt"), "synthetic clean tip\n");
            const tip = commit(root, "clean tip");
            const collection = (0, wt_campaign_scanner_1.collectWtGitAuditTargets)(root, base, tip);
            assert.equal(collection.commitCount, 2);
            assert.equal(collection.categoryTargetCounts.tip, 2);
            assert.equal(collection.categoryTargetCounts.history_old > 0, true);
            assert.equal(collection.categoryTargetCounts.history_new > 0, true);
            const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)((0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(har({ requestBody: { secret_historical: values.historical } })), collection);
            assert.equal(result.valid, false);
            assert.equal(result.categoryTargetCounts.history_old > 0, true);
            assert.equal(result.matchedTargets.some(value => value.categories.includes("request_body")), true);
            const serialized = JSON.stringify({ collection, result });
            assert.equal(serialized.includes(values.historical), false);
            assert.equal(serialized.includes(root), false);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("detects short contextual variants present only in historical Git blobs", () => {
        const root = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "wt-git-context-audit-"));
        try {
            git(root, ["init", "-q"]);
            git(root, ["config", "user.name", "Synthetic Audit"]);
            git(root, ["config", "user.email", "audit@example.invalid"]);
            (0, fs_1.writeFileSync)((0, path_1.join)(root, "baseline.txt"), "synthetic baseline\n");
            const base = commit(root, "baseline");
            const historical = {
                "body.json": JSON.stringify({ x: "j7" }),
                "header.txt": "ETag: h7",
                "cookie.txt": "Cookie: sid=c7",
                "url.txt": "https://example.invalid/p7?cursor=q7",
                "text.txt": "t7",
            };
            for (const [name, content] of Object.entries(historical))
                (0, fs_1.writeFileSync)((0, path_1.join)(root, name), content);
            commit(root, "historical contextual values");
            for (const name of Object.keys(historical))
                (0, fs_1.rmSync)((0, path_1.join)(root, name));
            (0, fs_1.writeFileSync)((0, path_1.join)(root, "tip.txt"), "synthetic clean tip\n");
            const tip = commit(root, "clean tip"), catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(focusedHar({ url: "https://example.invalid/p7?cursor=q7", responseHeaders: [{ name: "ETag", value: "h7" }], requestCookies: [{ name: "sid", value: "c7" }], requestBody: { x: "j7" }, responseText: "t7" }));
            const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, (0, wt_campaign_scanner_1.collectWtGitAuditTargets)(root, base, tip));
            assert.equal(result.valid, false);
            for (const category of ["headers", "cookies", "url_path", "query", "request_body", "response_body"])
                assert.equal(result.sensitiveMatchCategoryCounts[category] > 0, true, `missed ${category}`);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("fails closed when a collected Git blob becomes unreadable", () => {
        const root = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "wt-git-unreadable-"));
        try {
            git(root, ["init", "-q"]);
            git(root, ["config", "user.name", "Synthetic Audit"]);
            git(root, ["config", "user.email", "audit@example.invalid"]);
            (0, fs_1.writeFileSync)((0, path_1.join)(root, "baseline.txt"), "synthetic baseline\n");
            const base = commit(root, "baseline");
            (0, fs_1.writeFileSync)((0, path_1.join)(root, "unreadable.bin"), "synthetic-unreadable-private-4a8f");
            const tip = commit(root, "unreadable target"), blob = git(root, ["rev-parse", "HEAD:unreadable.bin"]), collection = (0, wt_campaign_scanner_1.collectWtGitAuditTargets)(root, base, tip);
            (0, fs_1.rmSync)((0, path_1.join)(root, ".git", "objects", blob.slice(0, 2), blob.slice(2)));
            assert.throws(() => (0, wt_campaign_scanner_1.scanWtAuditTargets)((0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(har()), collection), /blob (?:inventory is malformed|batch is unreadable)/);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("allows only the exact historical HAR fingerprints and rejects missing, extra, or tip HAR structure", () => {
        const root = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "wt-git-har-policy-"));
        try {
            git(root, ["init", "-q"]);
            git(root, ["config", "user.name", "Synthetic Audit"]);
            git(root, ["config", "user.email", "audit@example.invalid"]);
            (0, fs_1.writeFileSync)((0, path_1.join)(root, "baseline.txt"), "synthetic baseline\n");
            const base = commit(root, "baseline");
            const syntheticHar = JSON.stringify({ log: { entries: [] } });
            (0, fs_1.writeFileSync)((0, path_1.join)(root, "renamed.bin"), syntheticHar);
            commit(root, "historical synthetic HAR");
            (0, fs_1.rmSync)((0, path_1.join)(root, "renamed.bin"));
            (0, fs_1.writeFileSync)((0, path_1.join)(root, "tip.txt"), "synthetic clean tip\n");
            const cleanTip = commit(root, "clean tip");
            const catalog = (0, wt_campaign_scanner_1.buildWtSensitiveCatalog)(har()), cleanCollection = (0, wt_campaign_scanner_1.collectWtGitAuditTargets)(root, base, cleanTip);
            const denied = (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, cleanCollection);
            assert.equal(denied.valid, false);
            assert.equal(denied.rawHarTargetCount, 2);
            assert.equal(denied.tipHarStructureTargetCount, 0);
            const fingerprints = denied.harStructureTargets.map(value => value.fingerprint);
            const allowed = (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, cleanCollection, { allowedHistoricalHarTargetFingerprints: fingerprints });
            assert.equal(allowed.valid, true);
            assert.equal(allowed.harStructureTargetCount, 2);
            assert.equal(allowed.historicalHarAllowlistSatisfied, true);
            assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, cleanCollection, { allowedHistoricalHarTargetFingerprints: fingerprints.slice(0, 1) }).valid, false);
            assert.equal((0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, cleanCollection, { allowedHistoricalHarTargetFingerprints: [...fingerprints, "f".repeat(64)] }).valid, false);
            (0, fs_1.writeFileSync)((0, path_1.join)(root, "tip-har.txt"), syntheticHar);
            const harTip = commit(root, "tip HAR");
            const tipResult = (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, (0, wt_campaign_scanner_1.collectWtGitAuditTargets)(root, base, harTip), { allowedHistoricalHarTargetFingerprints: fingerprints });
            assert.equal(tipResult.valid, false);
            assert.equal(tipResult.tipHarStructureTargetCount, 1);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("rejects invalid and empty Git ranges", () => {
        const root = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "wt-git-range-"));
        try {
            git(root, ["init", "-q"]);
            git(root, ["config", "user.name", "Synthetic Audit"]);
            git(root, ["config", "user.email", "audit@example.invalid"]);
            (0, fs_1.writeFileSync)((0, path_1.join)(root, "baseline.txt"), "synthetic baseline\n");
            const tip = commit(root, "baseline");
            assert.throws(() => (0, wt_campaign_scanner_1.collectWtGitAuditTargets)(root, tip, tip), /range is empty/);
            assert.throws(() => (0, wt_campaign_scanner_1.collectWtGitAuditTargets)(root, "not-a-revision", tip), /command failed/);
        }
        finally {
            (0, fs_1.rmSync)(root, { recursive: true, force: true });
        }
    });
    it("permits only the exact first-party bundle identity with pinned APK provenance", () => {
        const proof = appIdentityProof(), result = (0, wt_campaign_scanner_1.scanWtAuditTargets)(authCatalog({ bundle_id: syntheticAppIdentity }), [target("bundle", "fixture", `const bundle_id = "${syntheticAppIdentity}";`)], { allowedHistoricalHarTargetFingerprints: [], firstPartyAppIdentity: proof });
        assert.equal(result.valid, true);
        assert.equal(result.publicFirstPartyIdentityMatchCount, 1);
        assert.equal(result.matchClassCounts.permitted_public_game_structure, 1);
        assert.equal(result.matchRuleCounts[wt_first_party_app_identity_1.WT_FIRST_PARTY_APP_IDENTITY_RULE], 1);
        assert.deepEqual(result.firstPartyAppIdentityEvidence, proof.evidence);
        assert.equal(JSON.stringify(result).includes(syntheticAppIdentity), false);
    });
    it("fails closed for divergent identity, missing APK evidence, or a divergent APK hash", () => {
        const targetValue = target("bundle", "fixture", `"${syntheticAppIdentity}"`);
        const divergent = (0, wt_campaign_scanner_1.scanWtAuditTargets)(authCatalog({ bundle_id: syntheticAppIdentity }), [targetValue], { allowedHistoricalHarTargetFingerprints: [], firstPartyAppIdentity: appIdentityProof("another.public.identity") });
        assert.equal(divergent.valid, false);
        assert.equal(divergent.prohibitedSensitiveMatchCount + divergent.unresolvedMatchCount > 0, true);
        const missing = (0, wt_campaign_scanner_1.scanWtAuditTargets)(authCatalog({ bundle_id: syntheticAppIdentity }), [targetValue]);
        assert.equal(missing.valid, false);
        assert.equal(missing.unresolvedMatchCount > 0, true);
        const badHash = appIdentityProof();
        badHash.evidence.apk.sha256 = "f".repeat(64);
        const invalid = (0, wt_campaign_scanner_1.scanWtAuditTargets)(authCatalog({ bundle_id: syntheticAppIdentity }), [targetValue], { allowedHistoricalHarTargetFingerprints: [], firstPartyAppIdentity: badHash });
        assert.equal(invalid.valid, false);
        assert.equal(invalid.unresolvedMatchCount > 0, true);
        assert.equal(invalid.firstPartyAppIdentityEvidence, undefined);
    });
    it("keeps token, sign, cookies, and authentication headers prohibited ahead of the public field rule", () => {
        const proof = appIdentityProof(), catalog = authCatalog({ bundle_id: syntheticAppIdentity }), policy = { allowedHistoricalHarTargetFingerprints: [], firstPartyAppIdentity: proof };
        for (const [name, content] of [
            ["token", JSON.stringify({ token: syntheticAppIdentity })],
            ["sign", JSON.stringify({ sign: syntheticAppIdentity })],
            ["other-json-path", JSON.stringify({ other: syntheticAppIdentity })],
            ["cookie", `Cookie: sid=${syntheticAppIdentity}`],
            ["authorization", `Authorization: ${syntheticAppIdentity}`],
            ["typescript-token", `const token = "${syntheticAppIdentity}";`],
            ["typescript-sign", `const sign = "${syntheticAppIdentity}";`],
            ["typescript-account", `const accountId = "${syntheticAppIdentity}";`],
            ["typescript-unknown", `const other = "${syntheticAppIdentity}";`],
        ]) {
            const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target(name, "fixture", content)], policy);
            assert.equal(result.valid, false, name);
            assert.equal(result.prohibitedSensitiveMatchCount > 0, true, name);
            assert.equal(result.publicFirstPartyIdentityMatchCount, 0, name);
        }
    });
    it("rejects neighboring auth fields and every mutation of method, route, path, or provenance", () => {
        const proof = appIdentityProof(), literalTarget = [target("identity", "fixture", `"${syntheticAppIdentity}"`)], policy = { allowedHistoricalHarTargetFingerprints: [], firstPartyAppIdentity: proof };
        const cases = [
            authCatalog({ neighboring_field: syntheticAppIdentity }),
            authCatalog({ bundle_id: syntheticAppIdentity }, "PUT"),
            authCatalog({ bundle_id: syntheticAppIdentity }, "POST", "/auth/refresh"),
            authCatalog({ nested: { bundle_id: syntheticAppIdentity } }),
        ];
        for (const catalog of cases) {
            const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, literalTarget, policy);
            assert.equal(result.valid, false);
            assert.equal(result.publicFirstPartyIdentityMatchCount, 0);
        }
        const mutated = appIdentityProof();
        mutated.evidence.rule = "mutated";
        const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)(authCatalog({ bundle_id: syntheticAppIdentity }), literalTarget, { allowedHistoricalHarTargetFingerprints: [], firstPartyAppIdentity: mutated });
        assert.equal(result.valid, false);
        assert.equal(result.unresolvedMatchCount > 0, true);
    });
    it("rejects fabricated identity and aapt provenance even when their shapes are valid", () => {
        const fabricated = appIdentityProof("another.public.identity.value");
        fabricated.evidence.tool.executableSha256 = "c".repeat(64);
        fabricated.evidence.tool.version = "synthetic aapt";
        const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)(authCatalog({ bundle_id: "another.public.identity.value" }), [target("fabricated", "fixture", "const bundle_id = \"another.public.identity.value\";")], { allowedHistoricalHarTargetFingerprints: [], firstPartyAppIdentity: fabricated });
        assert.equal(result.valid, false);
        assert.equal(result.unresolvedMatchCount > 0, true);
        assert.equal(result.firstPartyAppIdentityEvidence, undefined);
    });
    it("classifies the same exact public identity in three base targets as three permitted matches", () => {
        const targets = ["one", "two", "three"].map(name => target(name, "fixture", `const bundle_id = "${syntheticAppIdentity}";`));
        const result = (0, wt_campaign_scanner_1.scanWtAuditTargets)(authCatalog({ bundle_id: syntheticAppIdentity }), targets, { allowedHistoricalHarTargetFingerprints: [], firstPartyAppIdentity: appIdentityProof() });
        assert.equal(result.valid, true);
        assert.equal(result.sensitiveMatchCount, 3);
        assert.equal(result.publicFirstPartyIdentityMatchCount, 3);
        assert.equal(result.prohibitedSensitiveMatchCount, 0);
        assert.equal(result.unresolvedMatchCount, 0);
    });
    it("requires an explicit public identity coordinate for raw text", () => {
        const catalog = authCatalog({ bundle_id: syntheticAppIdentity }), policy = { allowedHistoricalHarTargetFingerprints: [], firstPartyAppIdentity: appIdentityProof() };
        const publicText = (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("public-doc", "fixture", `package confirmed: ${syntheticAppIdentity}`)], policy);
        const tokenText = (0, wt_campaign_scanner_1.scanWtAuditTargets)(catalog, [target("raw-token", "fixture", `token = ${syntheticAppIdentity}`)], policy);
        assert.equal(publicText.valid, true);
        assert.equal(publicText.publicFirstPartyIdentityMatchCount, 1);
        assert.equal(tokenText.valid, false);
        assert.equal(tokenText.prohibitedSensitiveMatchCount, 1);
    });
});
//# sourceMappingURL=wt-campaign-scanner.spec.js.map