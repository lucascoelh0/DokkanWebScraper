"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const path_1 = require("path");
const leader_supported_public_shadow_contract_1 = require("./leader-supported-public-shadow-contract");
const leader_supported_public_shadow_1 = require("./leader-supported-public-shadow");
const leader_supported_public_shadow_run_1 = require("./leader-supported-public-shadow-run");
const cli = [
    "--opt-in-k61", "--remote-read-only", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f",
    "--k43-root", "43", "--k46-root", "46", "--k48-root", "48", "--k56-root", "56", "--k58-root", "58",
    "--native-runtime", "elf", "--database", "db", "--checked-at", "2026-08-16T16:00:00.000Z",
];
function source(fileName) {
    const sibling = (0, path_1.resolve)(__dirname, fileName);
    return (0, fs_1.readFileSync)((0, fs_1.existsSync)(sibling) ? sibling : (0, path_1.resolve)(__dirname, "..", "..", "database-characters", fileName), "utf8");
}
describe("K61 supported leader public candidate shadow", () => {
    it("parses exact opt-ins and all eleven explicit values", () => {
        const parsed = (0, leader_supported_public_shadow_run_1.parseCharacterLeaderSupportedPublicShadowCli)(cli);
        (0, assert_1.equal)(parsed.k58Root, "58");
        (0, assert_1.equal)(parsed.remoteReadOnly, true);
        (0, assert_1.throws)(() => (0, leader_supported_public_shadow_run_1.parseCharacterLeaderSupportedPublicShadowCli)(cli.slice(1)), /exactly one/);
        (0, assert_1.throws)(() => (0, leader_supported_public_shadow_run_1.parseCharacterLeaderSupportedPublicShadowCli)([...cli, "loose"]), /unsupported/);
        (0, assert_1.throws)(() => (0, leader_supported_public_shadow_run_1.parseCharacterLeaderSupportedPublicShadowCli)([...cli, "--database", "again"]), /duplicate/);
    });
    it("pins the exact public candidate manifest and closed namespace", () => {
        (0, assert_1.equal)(leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SIZE_BYTES, 11561);
        (0, assert_1.equal)(leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SHA256, "370dc7026c4523d509a403a2fbfa91009d1bb9452f7ab277f9c6aaebb8a1441e");
        (0, leader_supported_public_shadow_1.assertCharacterLeaderSupportedPublicShadowObjectKey)(leader_supported_public_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_KEY, true);
        (0, leader_supported_public_shadow_1.assertCharacterLeaderSupportedPublicShadowObjectKey)("database-characters/leader-supported/v1/objects/sha256/" + "a".repeat(64) + "/x.json");
        (0, assert_1.throws)(() => (0, leader_supported_public_shadow_1.assertCharacterLeaderSupportedPublicShadowObjectKey)("https://example.com/x"), /rejected/);
        (0, assert_1.throws)(() => (0, leader_supported_public_shadow_1.assertCharacterLeaderSupportedPublicShadowObjectKey)("database-characters/leader-supported/v1/../x"), /rejected/);
    });
    it("requires exact public bytes and metadata", () => {
        const bytes = Buffer.from("ok");
        const sha = require("crypto").createHash("sha256").update(bytes).digest("hex");
        const response = { bytes, contentType: "application/json", cacheControl: "no-store" };
        (0, leader_supported_public_shadow_1.verifyCharacterLeaderSupportedPublicShadowResponse)(response, { sha256: sha, sizeBytes: 2, contentType: "application/json", cacheControl: "no-store" });
        (0, assert_1.throws)(() => (0, leader_supported_public_shadow_1.verifyCharacterLeaderSupportedPublicShadowResponse)({ ...response, cacheControl: "public" }, { sha256: sha, sizeBytes: 2, contentType: "application/json", cacheControl: "no-store" }), /rejected/);
    });
    it("detects every K58 member drift", () => {
        const member = (value) => Buffer.from(value);
        const before = { candidateManifestBytes: member("candidate"), planBytes: member("plan"), receiptBytes: member("receipt"), markerBytes: member("marker") };
        (0, leader_supported_public_shadow_1.assertCharacterLeaderSupportedPublicShadowK58Stable)(before, { ...before });
        for (const field of ["candidateManifestBytes", "planBytes", "receiptBytes", "markerBytes"]) {
            (0, assert_1.throws)(() => (0, leader_supported_public_shadow_1.assertCharacterLeaderSupportedPublicShadowK58Stable)(before, { ...before, [field]: member("drift") }), /drifted/);
        }
    });
    it("keeps the report bounded and rejects record or credential leakage", () => {
        const safe = { contract: "x", readiness: { authority: "NO-GO" } };
        (0, leader_supported_public_shadow_1.assertCharacterLeaderSupportedPublicShadowReportBound)(safe);
        (0, assert_1.throws)(() => (0, leader_supported_public_shadow_1.assertCharacterLeaderSupportedPublicShadowReportBound)({ ...safe, records: [] }), /exposed/);
        (0, assert_1.throws)(() => (0, leader_supported_public_shadow_1.assertCharacterLeaderSupportedPublicShadowReportBound)({ ...safe, secret: "x" }), /exposed/);
    });
    it("uses fixed productive transport, two source validators, and no mutation or hook surface", () => {
        const core = source("leader-supported-public-shadow.ts");
        (0, assert_1.equal)((core.match(/await validateK58FromSources\(/g) ?? []).length, 2);
        (0, assert_1.equal)((core.match(/await read\(/g) ?? []).length, 3);
        (0, assert_1.equal)(core.includes("for (const object of before.artifacts.candidateManifest.immutableObjects)"), true);
        (0, assert_1.equal)(core.includes("httpsRequest(target"), true);
        (0, assert_1.equal)(/globalThis|Symbol\.for|__test|process\.env|S3Client|PutObject|DeleteObject|writeFile|mkdir|open\(/.test(core), false);
        (0, assert_1.equal)(core.includes('candidateOnlyPublicManifest: true'), true);
        (0, assert_1.equal)(core.includes('authority: "NO-GO"'), true);
        (0, assert_1.equal)(core.includes('android: "NO-GO"'), true);
    });
    it("keeps the request order and all product boundaries explicit", () => {
        const contract = source("leader-supported-public-shadow-contract.ts");
        (0, assert_1.deepStrictEqual)([
            "manifest_before", "payload", "coverage", "validation", "source_manifest", "manifest_after",
        ].every(value => contract.includes(`\"${value}\"`)), true);
        for (const value of ["candidateOnlyBoundary", "processTreeRssUnder1GiB", "conditional17", "authority", "production", "android"]) {
            (0, assert_1.equal)(contract.includes(value), true);
        }
    });
});
//# sourceMappingURL=leader-supported-public-shadow.spec.js.map