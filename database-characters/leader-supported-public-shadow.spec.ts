import { deepStrictEqual, equal, throws } from "assert";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import {
    CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_KEY,
    CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SHA256,
    CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SIZE_BYTES,
} from "./leader-supported-public-shadow-contract";
import {
    assertCharacterLeaderSupportedPublicShadowK58Stable,
    assertCharacterLeaderSupportedPublicShadowObjectKey,
    assertCharacterLeaderSupportedPublicShadowReportBound,
    verifyCharacterLeaderSupportedPublicShadowResponse,
} from "./leader-supported-public-shadow";
import { parseCharacterLeaderSupportedPublicShadowCli } from "./leader-supported-public-shadow-run";

const cli = [
    "--opt-in-k61", "--remote-read-only", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f",
    "--k43-root", "43", "--k46-root", "46", "--k48-root", "48", "--k56-root", "56", "--k58-root", "58",
    "--native-runtime", "elf", "--database", "db", "--checked-at", "2026-08-16T16:00:00.000Z",
];

function source(fileName: string): string {
    const sibling = resolve(__dirname, fileName);
    return readFileSync(existsSync(sibling) ? sibling : resolve(__dirname, "..", "..", "database-characters", fileName), "utf8");
}

describe("K61 supported leader public candidate shadow", () => {
    it("parses exact opt-ins and all eleven explicit values", () => {
        const parsed = parseCharacterLeaderSupportedPublicShadowCli(cli);
        equal(parsed.k58Root, "58"); equal(parsed.remoteReadOnly, true);
        throws(() => parseCharacterLeaderSupportedPublicShadowCli(cli.slice(1)), /exactly one/);
        throws(() => parseCharacterLeaderSupportedPublicShadowCli([...cli, "loose"]), /unsupported/);
        throws(() => parseCharacterLeaderSupportedPublicShadowCli([...cli, "--database", "again"]), /duplicate/);
    });

    it("pins the exact public candidate manifest and closed namespace", () => {
        equal(CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SIZE_BYTES, 11_561);
        equal(CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_SHA256, "370dc7026c4523d509a403a2fbfa91009d1bb9452f7ab277f9c6aaebb8a1441e");
        assertCharacterLeaderSupportedPublicShadowObjectKey(CHARACTER_LEADER_SUPPORTED_PUBLIC_SHADOW_MANIFEST_KEY, true);
        assertCharacterLeaderSupportedPublicShadowObjectKey("database-characters/leader-supported/v1/objects/sha256/" + "a".repeat(64) + "/x.json");
        throws(() => assertCharacterLeaderSupportedPublicShadowObjectKey("https://example.com/x"), /rejected/);
        throws(() => assertCharacterLeaderSupportedPublicShadowObjectKey("database-characters/leader-supported/v1/../x"), /rejected/);
    });

    it("requires exact public bytes and metadata", () => {
        const bytes = Buffer.from("ok"); const sha = require("crypto").createHash("sha256").update(bytes).digest("hex");
        const response = { bytes, contentType: "application/json", cacheControl: "no-store" };
        verifyCharacterLeaderSupportedPublicShadowResponse(response, { sha256: sha, sizeBytes: 2, contentType: "application/json", cacheControl: "no-store" });
        throws(() => verifyCharacterLeaderSupportedPublicShadowResponse({ ...response, cacheControl: "public" }, { sha256: sha, sizeBytes: 2, contentType: "application/json", cacheControl: "no-store" }), /rejected/);
    });

    it("detects every K58 member drift", () => {
        const member = (value: string) => Buffer.from(value);
        const before: any = { candidateManifestBytes: member("candidate"), planBytes: member("plan"), receiptBytes: member("receipt"), markerBytes: member("marker") };
        assertCharacterLeaderSupportedPublicShadowK58Stable(before, { ...before });
        for (const field of ["candidateManifestBytes", "planBytes", "receiptBytes", "markerBytes"]) {
            throws(() => assertCharacterLeaderSupportedPublicShadowK58Stable(before, { ...before, [field]: member("drift") }), /drifted/);
        }
    });

    it("keeps the report bounded and rejects record or credential leakage", () => {
        const safe: any = { contract: "x", readiness: { authority: "NO-GO" } };
        assertCharacterLeaderSupportedPublicShadowReportBound(safe);
        throws(() => assertCharacterLeaderSupportedPublicShadowReportBound({ ...safe, records: [] }), /exposed/);
        throws(() => assertCharacterLeaderSupportedPublicShadowReportBound({ ...safe, secret: "x" }), /exposed/);
    });

    it("uses fixed productive transport, two source validators, and no mutation or hook surface", () => {
        const core = source("leader-supported-public-shadow.ts");
        equal((core.match(/await validateK58FromSources\(/g) ?? []).length, 2);
        equal((core.match(/await read\(/g) ?? []).length, 3);
        equal(core.includes("for (const object of before.artifacts.candidateManifest.immutableObjects)"), true);
        equal(core.includes("httpsRequest(target"), true);
        equal(/globalThis|Symbol\.for|__test|process\.env|S3Client|PutObject|DeleteObject|writeFile|mkdir|open\(/.test(core), false);
        equal(core.includes('candidateOnlyPublicManifest: true'), true);
        equal(core.includes('authority: "NO-GO"'), true);
        equal(core.includes('android: "NO-GO"'), true);
    });

    it("keeps the request order and all product boundaries explicit", () => {
        const contract = source("leader-supported-public-shadow-contract.ts");
        deepStrictEqual([
            "manifest_before", "payload", "coverage", "validation", "source_manifest", "manifest_after",
        ].every(value => contract.includes(`\"${value}\"`)), true);
        for (const value of ["candidateOnlyBoundary", "processTreeRssUnder1GiB", "conditional17", "authority", "production", "android"]) {
            equal(contract.includes(value), true);
        }
    });
});
