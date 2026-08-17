"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const wt_campaign_scanner_1 = require("./wt-campaign-scanner");
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
function har(overrides) {
    const requestBody = overrides && "requestBody" in overrides ? overrides.requestBody : { secret_values: [values.array] };
    const responseBody = overrides && "responseBody" in overrides ? overrides.responseBody : values.primitive;
    return JSON.stringify({ log: { entries: [{
                    request: {
                        method: "POST",
                        url: `https://${encodeURIComponent(values.username)}:${encodeURIComponent(values.password)}@example.invalid/audit?cursor=${encodeURIComponent(values.query)}`,
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
function target(targetId, category, content) {
    return { targetId, category, content: Buffer.from(content) };
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
        assert.deepEqual(Object.keys(catalog.categoryValueCounts).sort(), ["cookies", "headers", "query", "request_body", "response_body", "url_credentials"]);
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
});
//# sourceMappingURL=wt-campaign-scanner.spec.js.map