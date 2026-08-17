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

function har(overrides?: { requestBody?: unknown; responseBody?: unknown; authorization?: string }): string {
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
        assert.deepEqual(Object.keys(catalog.categoryValueCounts).sort(), ["cookies", "headers", "query", "request_body", "response_body", "url_credentials"]);
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
