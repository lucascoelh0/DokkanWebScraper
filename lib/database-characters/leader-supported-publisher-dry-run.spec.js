"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const zlib_1 = require("zlib");
const leader_supported_projection_contract_1 = require("./leader-supported-projection-contract");
const leader_supported_shadow_contract_1 = require("./leader-supported-shadow-contract");
const leader_supported_publisher_dry_run_contract_1 = require("./leader-supported-publisher-dry-run-contract");
const leader_supported_publisher_dry_run_1 = require("./leader-supported-publisher-dry-run");
const leader_supported_publisher_dry_run_run_1 = require("./leader-supported-publisher-dry-run-run");
const leader_supported_shadow_1 = require("./leader-supported-shadow");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const cli = [
    "--opt-in-k58", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "43",
    "--k46-root", "46", "--k48-root", "48", "--k56-root", "56", "--output-root", "o",
    "--native-runtime", "elf", "--database", "db",
];
function implementationSource(fileName) {
    const sibling = (0, path_1.resolve)(__dirname, fileName);
    const path = (0, fs_1.existsSync)(sibling) ? sibling : (0, path_1.resolve)(__dirname, "..", "..", "database-characters", fileName);
    return (0, fs_1.readFileSync)(path, "utf8");
}
function fixture() {
    const lineage = {};
    const dataset = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-only-projection", contractVersion: "1.0.0",
        mode: "explicit_opt_in_offline_local_supported_only_default_off", source: lineage,
        policy: {
            supportedOnly: true, structuralIdsOnly: true, sourceOrderAndMultiplicityPreserved: true,
            outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
            concurrentSameUserAncestorReplacementProtected: false, conditionalEffectsIncluded: false,
            unknownValuesMaterialized: false, execTimingTypeIncluded: false, causalityIncluded: false,
            ignoredPosition2Included: false, textOrDescriptionIncluded: false, aggregateOrFinalValueIncluded: false,
            primarySecondaryOrHybridInvented: false, characterArrayIncluded: false, patchOrApplyImplemented: false,
            authoritySelected: false, productionModified: false, publisherImplemented: false, networkEnabled: false,
            r2Enabled: false, androidImplemented: false,
        },
        records: [],
    };
    const excluded = leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.conditionalEffectRowIds.map((effectRowId, index) => ({
        effectRowId,
        affectedReferences: Array.from({ length: index < 11 ? 3 : 2 }, (_, occurrence) => ({
            stateId: `${index + 1}`, sourceEffectOccurrenceIndex: occurrence,
        })),
        expression: 196, reason: "runtime_deck_index_unresolved", provenance: {},
        corroborativeRule: {
            ruleId: "k56-conditional-domain-rule-v1", provenance: "user_confirmed_domain_rule",
            usedToAuthorizeSupportedProjection: false,
        },
    }));
    const coverage = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-only-projection-coverage", contractVersion: "1.0.0",
        counts: { totalEffects: 3853, totalReferences: 12310, projectedEffects: 3836, projectedReferences: 12265, excludedEffects: 17, excludedReferences: 45 },
        projected: { effects: 3836, references: 12265, classification: "supported" }, excluded,
        corroborativeDomainRules: [], partial: {}, unknown: {}, unjoinable: {}, shadowParity: {}, provenance: {},
    };
    const validation = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-only-projection-validation", contractVersion: "1.0.0",
        valid: true, failures: [], sizes: {}, safety: {}, readiness: {
            offlineSupportedOnlyProjection: "GO", sourceBoundValidation: "NOT_EXECUTED", localShadowAuditDefaultOff: "NOT_EXECUTED",
        },
    };
    const raw = jsonBytes(dataset), gzip = (0, zlib_1.gzipSync)(raw, { level: 9 }), coverageBytes = jsonBytes(coverage), validationBytes = jsonBytes(validation);
    const manifest = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-only-projection-manifest", contractVersion: "1.0.0",
        fileName: `database-characters-k56-leader-supported-projection.${hash(gzip)}.json.gz`, compression: "gzip",
        sha256: hash(gzip), sizeBytes: gzip.length, uncompressedSha256: hash(raw), uncompressedSizeBytes: raw.length,
        counts: coverage.counts, source: lineage,
        outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
        concurrentSameUserAncestorReplacementProtected: false,
        coverageFile: leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage,
        coverageSha256: hash(coverageBytes), coverageSizeBytes: coverageBytes.length,
        validationFile: leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.validation,
        validationSha256: hash(validationBytes), validationSizeBytes: validationBytes.length,
    };
    const manifestBytes = jsonBytes(manifest);
    return { dataset, coverage, validation, manifest, raw, gzip, coverageBytes, validationBytes, manifestBytes };
}
describe("K58 supported leader publisher local dry-run", function () {
    this.timeout(30000);
    let source;
    let artifacts;
    before(() => {
        source = fixture();
        artifacts = (0, leader_supported_publisher_dry_run_1.buildCharacterLeaderSupportedPublisherDryRun)(source);
    });
    it("parses one opt-in and every explicit root/file without defaults", () => {
        const parsed = (0, leader_supported_publisher_dry_run_run_1.parseCharacterLeaderSupportedPublisherDryRunCli)(cli);
        (0, assert_1.equal)(parsed.k56Root, "56");
        (0, assert_1.equal)(parsed.outputRoot, "o");
        (0, assert_1.throws)(() => (0, leader_supported_publisher_dry_run_run_1.parseCharacterLeaderSupportedPublisherDryRunCli)(cli.slice(1)), /exactly one/);
        (0, assert_1.throws)(() => (0, leader_supported_publisher_dry_run_run_1.parseCharacterLeaderSupportedPublisherDryRunCli)([...cli, "loose"]), /unsupported argument/);
        (0, assert_1.throws)(() => (0, leader_supported_publisher_dry_run_run_1.parseCharacterLeaderSupportedPublisherDryRunCli)([...cli, "--database", "again"]), /duplicate --database/);
        (0, assert_1.throws)(() => (0, leader_supported_publisher_dry_run_run_1.parseCharacterLeaderSupportedPublisherDryRunCli)(cli.slice(0, -1)), /missing value/);
    });
    it("materializes byte-identical timestamp-free artifacts while direct readiness stays NOT_EXECUTED", () => {
        const second = (0, leader_supported_publisher_dry_run_1.buildCharacterLeaderSupportedPublisherDryRun)(source);
        (0, assert_1.equal)(artifacts.candidateManifestBytes.equals(second.candidateManifestBytes), true);
        (0, assert_1.equal)(artifacts.planBytes.equals(second.planBytes), true);
        (0, assert_1.equal)(artifacts.receiptBytes.equals(second.receiptBytes), true);
        (0, assert_1.equal)(artifacts.markerBytes.equals(second.markerBytes), true);
        (0, assert_1.equal)(artifacts.plan.readiness.dryRun, "NOT_EXECUTED");
        (0, assert_1.equal)(artifacts.plan.readiness.sourceBoundValidation, "NOT_EXECUTED");
        (0, assert_1.equal)(/"(?:timestamp|checkedAt|[^\"]*RssBytes)"/.test(Buffer.concat([
            artifacts.candidateManifestBytes, artifacts.planBytes, artifacts.receiptBytes, artifacts.markerBytes,
        ]).toString("utf8")), false);
    });
    it("plans exactly four persisted K56 members and keeps raw identity lineage-only", () => {
        const objects = artifacts.plan.immutableObjects;
        (0, assert_1.deepStrictEqual)(objects.map(object => object.kind), ["payload", "coverage", "validation", "manifest"]);
        (0, assert_1.deepStrictEqual)(objects.map(object => object.order), [1, 2, 3, 4]);
        (0, assert_1.equal)(objects.length, 4);
        (0, assert_1.equal)(objects.some(object => object.kind === "raw"), false);
        (0, assert_1.equal)(artifacts.plan.source.rawIdentity.persistedOrRemoteObject, false);
        (0, assert_1.equal)(artifacts.candidateManifest.source.rawIdentity.sha256, source.manifest.uncompressedSha256);
        (0, assert_1.deepStrictEqual)(objects.map(object => object.contentType), ["application/gzip", "application/json", "application/json", "application/json"]);
        (0, assert_1.equal)(objects.every(object => object.cacheControl === leader_supported_publisher_dry_run_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_IMMUTABLE_CACHE_CONTROL), true);
        for (const object of objects) {
            (0, assert_1.equal)(object.objectKey, `${leader_supported_publisher_dry_run_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE}/objects/sha256/${object.sha256}/${object.sourceFileName}`);
            (0, assert_1.equal)(object.remotePreflight, "NOT_EXECUTED");
            (0, assert_1.equal)(object.action, "NOT_EXECUTED");
            (0, assert_1.equal)(object.futureProtocol.missing, "create_if_absent_with_If-None-Match:*");
            (0, assert_1.equal)(object.futureProtocol.matching, "verified_reuse_only");
            (0, assert_1.equal)(object.futureProtocol.verifiedReuseRequiresSha256SizeContentTypeAndCacheControl, true);
            (0, assert_1.equal)(object.futureProtocol.different, "FAIL_CLOSED");
            (0, assert_1.equal)(object.futureProtocol.overwrite, "FORBIDDEN");
            (0, assert_1.equal)(object.futureProtocol.delete, "FORBIDDEN");
        }
    });
    it("models the candidate manifest last with mandatory fresh preflight/CAS and no unconditional write", () => {
        const manifest = artifacts.plan.mutableManifest;
        (0, assert_1.equal)(manifest.order, "LAST_AFTER_ALL_IMMUTABLE_OBJECTS");
        (0, assert_1.equal)(manifest.objectKey, leader_supported_publisher_dry_run_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY);
        (0, assert_1.equal)(manifest.remotePreflight, "NOT_EXECUTED");
        (0, assert_1.equal)(manifest.action, "NOT_EXECUTED");
        (0, assert_1.equal)(manifest.futureProtocol.preflightRequired, true);
        (0, assert_1.equal)(manifest.futureProtocol.missing, "If-None-Match: *");
        (0, assert_1.equal)(manifest.futureProtocol.replacement, "If-Match: FRESH_ETAG_REQUIRED");
        (0, assert_1.equal)(manifest.futureProtocol.unconditionalWrite, "FORBIDDEN");
        (0, assert_1.equal)(manifest.futureProtocol.delete, "FORBIDDEN");
        (0, assert_1.equal)(artifacts.candidateManifest.policy.candidateOnly, true);
    });
    it("pins counts, projected bytes and conservative/unknown budget boundaries", () => {
        (0, assert_1.deepStrictEqual)(artifacts.plan.counts, {
            totalEffects: 3853, totalReferences: 12310, projectedEffects: 3836,
            projectedReferences: 12265, excludedEffects: 17, excludedReferences: 45,
        });
        (0, assert_1.equal)(leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.payload.sizeBytes, 185908);
        (0, assert_1.equal)(leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.payload.sha256, "5579ed50704453cae29e97d770c05b02492c4f5130d2e4075da1e961817f2473");
        (0, assert_1.equal)(leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.coverage.sizeBytes, 21196);
        (0, assert_1.equal)(leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.coverage.sha256, "e8e7a372d87ee3fc0b7393a15e83a191290cee61f88c303c25178504dffd6a8f");
        (0, assert_1.equal)(leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.validation.sizeBytes, 1498);
        (0, assert_1.equal)(leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.validation.sha256, "c24b898cbbd4da324ac4cf83068f2d9ec9603b3276993f48736a40fa99eddf4e");
        (0, assert_1.equal)(leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.manifest.sizeBytes, 7146);
        (0, assert_1.equal)(leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.manifest.sha256, "e5213cc11b141e585eff1cffdfd3043e790cff718569367e26c5dd581bdd1546");
        (0, assert_1.equal)(leader_supported_shadow_contract_1.CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.raw.sizeBytes, 12847768);
        (0, assert_1.equal)(185908 + 21196 + 1498 + 7146, 215748);
        (0, assert_1.equal)(artifacts.plan.projection.immutableObjectCount, 4);
        (0, assert_1.equal)(artifacts.plan.projection.projectedRemoteObjectCount, 5);
        (0, assert_1.equal)(artifacts.plan.projection.projectedRemoteBytes, artifacts.plan.projection.immutableBytes + artifacts.plan.projection.candidateManifestBytes);
        (0, assert_1.equal)(artifacts.plan.budget.conservativeNamespaceBudgetBytes, leader_supported_publisher_dry_run_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE_BUDGET_BYTES);
        (0, assert_1.equal)(artifacts.plan.budget.bucketBytes, "UNKNOWN");
        (0, assert_1.equal)(artifacts.plan.budget.bucketHeadroomBytes, "UNKNOWN");
        (0, assert_1.throws)(() => (0, leader_supported_shadow_1.assertExactCharacterLeaderSupportedShadowK56Identity)(source), /exact real K56 artifact identity rejected/);
    });
    it("detects final source fingerprint and lineage drift", () => {
        const fingerprint = (0, leader_supported_shadow_1.characterLeaderSupportedShadowArtifactFingerprint)(source);
        const lineage = (0, leader_supported_shadow_1.characterLeaderSupportedShadowLineageFingerprint)(source);
        const drifted = { ...source, gzip: Buffer.from(source.gzip) };
        drifted.gzip[0] ^= 1;
        (0, assert_1.throws)(() => (0, leader_supported_publisher_dry_run_1.assertCharacterLeaderSupportedPublisherSourceStable)(fingerprint, lineage, drifted), /fingerprint or lineage drifted/);
        const lineageDrifted = {
            ...source, dataset: { ...source.dataset, source: { changed: true } },
        };
        (0, assert_1.throws)(() => (0, leader_supported_publisher_dry_run_1.assertCharacterLeaderSupportedPublisherSourceStable)(fingerprint, lineage, lineageDrifted), /fingerprint or lineage drifted/);
    });
    it("writes create-only with marker last and rejects reuse, linked roots and hardlink collisions", async () => {
        const base = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "k58-dry-run-"));
        try {
            const output = (0, path_1.join)(base, "output");
            await (0, promises_1.mkdir)(output);
            const written = await (0, leader_supported_publisher_dry_run_1.writeCharacterLeaderSupportedPublisherDryRunArtifacts)(output, artifacts);
            (0, assert_1.deepStrictEqual)(written, [
                leader_supported_publisher_dry_run_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES.candidateManifest,
                leader_supported_publisher_dry_run_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES.plan,
                leader_supported_publisher_dry_run_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES.receipt,
                leader_supported_publisher_dry_run_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES.marker,
            ]);
            (0, assert_1.equal)((await (0, promises_1.readFile)((0, path_1.join)(output, leader_supported_publisher_dry_run_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES.marker))).equals(artifacts.markerBytes), true);
            await (0, assert_1.rejects)(() => (0, leader_supported_publisher_dry_run_1.writeCharacterLeaderSupportedPublisherDryRunArtifacts)(output, artifacts), /already exists/);
            const linkedRoot = (0, path_1.join)(base, "linked-root");
            await (0, promises_1.symlink)(output, linkedRoot, process.platform === "win32" ? "junction" : "dir");
            await (0, assert_1.rejects)(() => (0, leader_supported_publisher_dry_run_1.writeCharacterLeaderSupportedPublisherDryRunArtifacts)(linkedRoot, artifacts), /symlink or junction|non-link/);
            const hardlinkRoot = (0, path_1.join)(base, "hardlink-output");
            await (0, promises_1.mkdir)(hardlinkRoot);
            const external = (0, path_1.join)(base, "external.json");
            await (0, promises_1.writeFile)(external, "preserve");
            await (0, promises_1.link)(external, (0, path_1.join)(hardlinkRoot, leader_supported_publisher_dry_run_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES.candidateManifest));
            await (0, assert_1.rejects)(() => (0, leader_supported_publisher_dry_run_1.writeCharacterLeaderSupportedPublisherDryRunArtifacts)(hardlinkRoot, artifacts), /already exists/);
            (0, assert_1.equal)((await (0, promises_1.readFile)(external, "utf8")), "preserve");
        }
        finally {
            await (0, promises_1.rm)(base, { recursive: true, force: true });
        }
    });
    it("contains no remote client, credential environment, transport or mutation construction", () => {
        const core = implementationSource("leader-supported-publisher-dry-run.ts");
        (0, assert_1.equal)(/process\.env|S3Client|AwsClient|fetch\s*\(|https?:\/\/|wrangler|child_process|execFile|spawn\s*\(/i.test(core), false);
        (0, assert_1.equal)((core.match(/await validateCharacterLeaderSupportedProjectionFromSources/g) ?? []).length, 2);
        (0, assert_1.equal)(core.includes("automaticCleanupAttempted: false"), true);
        (0, assert_1.equal)(core.includes("concurrentSameUserAncestorReplacementProtected: false"), true);
        (0, assert_1.equal)(core.includes("await checkpoint(root)"), true);
    });
    it("exposes only a real source-bound K58 validator with no supplied-report authority", () => {
        const implementation = implementationSource("leader-supported-publisher-dry-run.ts");
        (0, assert_1.equal)(typeof leader_supported_publisher_dry_run_1.validateCharacterLeaderSupportedPublisherDryRunArtifact, "function");
        (0, assert_1.equal)(implementation.includes("await validateCharacterLeaderSupportedProjectionArtifact({"), true);
        (0, assert_1.equal)(implementation.includes("const expected = materialize(k56.artifacts, \"GO\")"), true);
        (0, assert_1.equal)((implementation.match(/readCharacterLeaderSupportedPublisherDryRunArtifactSet\(options\.artifactRoot\)/g) ?? []).length, 2);
        (0, assert_1.equal)(/validateCharacterLeaderSupportedPublisherDryRunArtifact[\s\S]{0,500}upstream|suppliedReport/.test(implementation), false);
    });
    it("keeps RSS only in RunResult with explicit per-process scope", () => {
        (0, assert_1.equal)((0, leader_supported_publisher_dry_run_1.maximumIndividualCharacterLeaderSupportedPublisherProcessPeakRss)(100, 300, 200), 300);
        (0, assert_1.throws)(() => (0, leader_supported_publisher_dry_run_1.maximumIndividualCharacterLeaderSupportedPublisherProcessPeakRss)(100, 1024 * 1024 * 1024, 200), /per-process RSS peak rejected/);
        const artifactsText = Buffer.concat([
            artifacts.candidateManifestBytes, artifacts.planBytes, artifacts.receiptBytes, artifacts.markerBytes,
        ]).toString("utf8");
        (0, assert_1.equal)(/rss|peak/i.test(artifactsText), false);
    });
});
//# sourceMappingURL=leader-supported-publisher-dry-run.spec.js.map