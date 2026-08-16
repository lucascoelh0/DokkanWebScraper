import { deepStrictEqual, equal, rejects, throws } from "assert";
import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { gzipSync } from "zlib";
import {
    CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN,
    CharacterLeaderSupportedProjectionArtifactSet,
} from "./leader-supported-projection-contract";
import { CHARACTER_LEADER_SUPPORTED_SHADOW_PIN } from "./leader-supported-shadow-contract";
import {
    CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES,
    CHARACTER_LEADER_SUPPORTED_PUBLISHER_IMMUTABLE_CACHE_CONTROL,
    CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY,
    CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE,
    CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE_BUDGET_BYTES,
} from "./leader-supported-publisher-dry-run-contract";
import {
    assertCharacterLeaderSupportedPublisherSourceStable,
    buildCharacterLeaderSupportedPublisherDryRun,
    maximumIndividualCharacterLeaderSupportedPublisherProcessPeakRss,
    validateCharacterLeaderSupportedPublisherDryRunArtifact,
    writeCharacterLeaderSupportedPublisherDryRunArtifacts,
} from "./leader-supported-publisher-dry-run";
import { parseCharacterLeaderSupportedPublisherDryRunCli } from "./leader-supported-publisher-dry-run-run";
import {
    assertExactCharacterLeaderSupportedShadowK56Identity,
    characterLeaderSupportedShadowArtifactFingerprint,
    characterLeaderSupportedShadowLineageFingerprint,
} from "./leader-supported-shadow";

const hash = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const jsonBytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const cli = [
    "--opt-in-k58", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "43",
    "--k46-root", "46", "--k48-root", "48", "--k56-root", "56", "--output-root", "o",
    "--native-runtime", "elf", "--database", "db",
];

function implementationSource(fileName: string): string {
    const sibling = resolve(__dirname, fileName);
    const path = existsSync(sibling) ? sibling : resolve(__dirname, "..", "..", "database-characters", fileName);
    return readFileSync(path, "utf8");
}

function fixture(): CharacterLeaderSupportedProjectionArtifactSet {
    const lineage = {} as any;
    const dataset: any = {
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
    const excluded = CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.conditionalEffectRowIds.map((effectRowId, index) => ({
        effectRowId,
        affectedReferences: Array.from({ length: index < 11 ? 3 : 2 }, (_, occurrence) => ({
            stateId: `${index + 1}`, sourceEffectOccurrenceIndex: occurrence,
        })),
        expression: 196, reason: "runtime_deck_index_unresolved", provenance: {} as any,
        corroborativeRule: {
            ruleId: "k56-conditional-domain-rule-v1", provenance: "user_confirmed_domain_rule",
            usedToAuthorizeSupportedProjection: false,
        },
    }));
    const coverage: any = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-only-projection-coverage", contractVersion: "1.0.0",
        counts: { totalEffects: 3853, totalReferences: 12310, projectedEffects: 3836, projectedReferences: 12265, excludedEffects: 17, excludedReferences: 45 },
        projected: { effects: 3836, references: 12265, classification: "supported" }, excluded,
        corroborativeDomainRules: [], partial: {}, unknown: {}, unjoinable: {}, shadowParity: {}, provenance: {},
    };
    const validation: any = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-only-projection-validation", contractVersion: "1.0.0",
        valid: true, failures: [], sizes: {}, safety: {}, readiness: {
            offlineSupportedOnlyProjection: "GO", sourceBoundValidation: "NOT_EXECUTED", localShadowAuditDefaultOff: "NOT_EXECUTED",
        },
    };
    const raw = jsonBytes(dataset), gzip = gzipSync(raw, { level: 9 }), coverageBytes = jsonBytes(coverage), validationBytes = jsonBytes(validation);
    const manifest: any = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-only-projection-manifest", contractVersion: "1.0.0",
        fileName: `database-characters-k56-leader-supported-projection.${hash(gzip)}.json.gz`, compression: "gzip",
        sha256: hash(gzip), sizeBytes: gzip.length, uncompressedSha256: hash(raw), uncompressedSizeBytes: raw.length,
        counts: coverage.counts, source: lineage,
        outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
        concurrentSameUserAncestorReplacementProtected: false,
        coverageFile: CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage,
        coverageSha256: hash(coverageBytes), coverageSizeBytes: coverageBytes.length,
        validationFile: CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.validation,
        validationSha256: hash(validationBytes), validationSizeBytes: validationBytes.length,
    };
    const manifestBytes = jsonBytes(manifest);
    return { dataset, coverage, validation, manifest, raw, gzip, coverageBytes, validationBytes, manifestBytes };
}

describe("K58 supported leader publisher local dry-run", function () {
    this.timeout(30_000);
    let source: CharacterLeaderSupportedProjectionArtifactSet;
    let artifacts: ReturnType<typeof buildCharacterLeaderSupportedPublisherDryRun>;

    before(() => {
        source = fixture();
        artifacts = buildCharacterLeaderSupportedPublisherDryRun(source);
    });

    it("parses one opt-in and every explicit root/file without defaults", () => {
        const parsed = parseCharacterLeaderSupportedPublisherDryRunCli(cli);
        equal(parsed.k56Root, "56"); equal(parsed.outputRoot, "o");
        throws(() => parseCharacterLeaderSupportedPublisherDryRunCli(cli.slice(1)), /exactly one/);
        throws(() => parseCharacterLeaderSupportedPublisherDryRunCli([...cli, "loose"]), /unsupported argument/);
        throws(() => parseCharacterLeaderSupportedPublisherDryRunCli([...cli, "--database", "again"]), /duplicate --database/);
        throws(() => parseCharacterLeaderSupportedPublisherDryRunCli(cli.slice(0, -1)), /missing value/);
    });

    it("materializes byte-identical timestamp-free artifacts while direct readiness stays NOT_EXECUTED", () => {
        const second = buildCharacterLeaderSupportedPublisherDryRun(source);
        equal(artifacts.candidateManifestBytes.equals(second.candidateManifestBytes), true);
        equal(artifacts.planBytes.equals(second.planBytes), true);
        equal(artifacts.receiptBytes.equals(second.receiptBytes), true);
        equal(artifacts.markerBytes.equals(second.markerBytes), true);
        equal(artifacts.plan.readiness.dryRun, "NOT_EXECUTED");
        equal(artifacts.plan.readiness.sourceBoundValidation, "NOT_EXECUTED");
        equal(/"(?:timestamp|checkedAt|[^\"]*RssBytes)"/.test(Buffer.concat([
            artifacts.candidateManifestBytes, artifacts.planBytes, artifacts.receiptBytes, artifacts.markerBytes,
        ]).toString("utf8")), false);
    });

    it("plans exactly four persisted K56 members and keeps raw identity lineage-only", () => {
        const objects = artifacts.plan.immutableObjects;
        deepStrictEqual(objects.map(object => object.kind), ["payload", "coverage", "validation", "manifest"]);
        deepStrictEqual(objects.map(object => object.order), [1, 2, 3, 4]);
        equal(objects.length, 4);
        equal(objects.some(object => object.kind === ("raw" as any)), false);
        equal(artifacts.plan.source.rawIdentity.persistedOrRemoteObject, false);
        equal(artifacts.candidateManifest.source.rawIdentity.sha256, source.manifest.uncompressedSha256);
        deepStrictEqual(objects.map(object => object.contentType), ["application/gzip", "application/json", "application/json", "application/json"]);
        equal(objects.every(object => object.cacheControl === CHARACTER_LEADER_SUPPORTED_PUBLISHER_IMMUTABLE_CACHE_CONTROL), true);
        for (const object of objects) {
            equal(object.objectKey, `${CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE}/objects/sha256/${object.sha256}/${object.sourceFileName}`);
            equal(object.remotePreflight, "NOT_EXECUTED"); equal(object.action, "NOT_EXECUTED");
            equal(object.futureProtocol.missing, "create_if_absent_with_If-None-Match:*");
            equal(object.futureProtocol.matching, "verified_reuse_only");
            equal(object.futureProtocol.verifiedReuseRequiresSha256SizeContentTypeAndCacheControl, true);
            equal(object.futureProtocol.different, "FAIL_CLOSED");
            equal(object.futureProtocol.overwrite, "FORBIDDEN"); equal(object.futureProtocol.delete, "FORBIDDEN");
        }
    });

    it("models the candidate manifest last with mandatory fresh preflight/CAS and no unconditional write", () => {
        const manifest = artifacts.plan.mutableManifest;
        equal(manifest.order, "LAST_AFTER_ALL_IMMUTABLE_OBJECTS");
        equal(manifest.objectKey, CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY);
        equal(manifest.remotePreflight, "NOT_EXECUTED"); equal(manifest.action, "NOT_EXECUTED");
        equal(manifest.futureProtocol.preflightRequired, true);
        equal(manifest.futureProtocol.missing, "If-None-Match: *");
        equal(manifest.futureProtocol.replacement, "If-Match: FRESH_ETAG_REQUIRED");
        equal(manifest.futureProtocol.unconditionalWrite, "FORBIDDEN");
        equal(manifest.futureProtocol.delete, "FORBIDDEN");
        equal(artifacts.candidateManifest.policy.candidateOnly, true);
    });

    it("pins counts, projected bytes and conservative/unknown budget boundaries", () => {
        deepStrictEqual(artifacts.plan.counts, {
            totalEffects: 3853, totalReferences: 12310, projectedEffects: 3836,
            projectedReferences: 12265, excludedEffects: 17, excludedReferences: 45,
        });
        equal(CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.payload.sizeBytes, 185_908);
        equal(CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.payload.sha256, "5579ed50704453cae29e97d770c05b02492c4f5130d2e4075da1e961817f2473");
        equal(CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.coverage.sizeBytes, 21_196);
        equal(CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.coverage.sha256, "e8e7a372d87ee3fc0b7393a15e83a191290cee61f88c303c25178504dffd6a8f");
        equal(CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.validation.sizeBytes, 1_498);
        equal(CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.validation.sha256, "c24b898cbbd4da324ac4cf83068f2d9ec9603b3276993f48736a40fa99eddf4e");
        equal(CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.manifest.sizeBytes, 7_146);
        equal(CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.manifest.sha256, "e5213cc11b141e585eff1cffdfd3043e790cff718569367e26c5dd581bdd1546");
        equal(CHARACTER_LEADER_SUPPORTED_SHADOW_PIN.raw.sizeBytes, 12_847_768);
        equal(185_908 + 21_196 + 1_498 + 7_146, 215_748);
        equal(artifacts.plan.projection.immutableObjectCount, 4);
        equal(artifacts.plan.projection.projectedRemoteObjectCount, 5);
        equal(artifacts.plan.projection.projectedRemoteBytes,
            artifacts.plan.projection.immutableBytes + artifacts.plan.projection.candidateManifestBytes);
        equal(artifacts.plan.budget.conservativeNamespaceBudgetBytes, CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE_BUDGET_BYTES);
        equal(artifacts.plan.budget.bucketBytes, "UNKNOWN"); equal(artifacts.plan.budget.bucketHeadroomBytes, "UNKNOWN");
        throws(() => assertExactCharacterLeaderSupportedShadowK56Identity(source), /exact real K56 artifact identity rejected/);
    });

    it("detects final source fingerprint and lineage drift", () => {
        const fingerprint = characterLeaderSupportedShadowArtifactFingerprint(source);
        const lineage = characterLeaderSupportedShadowLineageFingerprint(source);
        const drifted = { ...source, gzip: Buffer.from(source.gzip) };
        drifted.gzip[0] ^= 1;
        throws(() => assertCharacterLeaderSupportedPublisherSourceStable(fingerprint, lineage, drifted), /fingerprint or lineage drifted/);
        const lineageDrifted = {
            ...source, dataset: { ...source.dataset, source: { changed: true } as any },
        } as CharacterLeaderSupportedProjectionArtifactSet;
        throws(() => assertCharacterLeaderSupportedPublisherSourceStable(fingerprint, lineage, lineageDrifted), /fingerprint or lineage drifted/);
    });

    it("writes create-only with marker last and rejects reuse, linked roots and hardlink collisions", async () => {
        const base = await mkdtemp(join(tmpdir(), "k58-dry-run-"));
        try {
            const output = join(base, "output"); await mkdir(output);
            const written = await writeCharacterLeaderSupportedPublisherDryRunArtifacts(output, artifacts);
            deepStrictEqual(written, [
                CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES.candidateManifest,
                CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES.plan,
                CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES.receipt,
                CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES.marker,
            ]);
            equal((await readFile(join(output, CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES.marker))).equals(artifacts.markerBytes), true);
            await rejects(() => writeCharacterLeaderSupportedPublisherDryRunArtifacts(output, artifacts), /already exists/);

            const linkedRoot = join(base, "linked-root");
            await symlink(output, linkedRoot, process.platform === "win32" ? "junction" : "dir");
            await rejects(() => writeCharacterLeaderSupportedPublisherDryRunArtifacts(linkedRoot, artifacts), /symlink or junction|non-link/);

            const hardlinkRoot = join(base, "hardlink-output"); await mkdir(hardlinkRoot);
            const external = join(base, "external.json"); await writeFile(external, "preserve");
            await link(external, join(hardlinkRoot, CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES.candidateManifest));
            await rejects(() => writeCharacterLeaderSupportedPublisherDryRunArtifacts(hardlinkRoot, artifacts), /already exists/);
            equal((await readFile(external, "utf8")), "preserve");
        } finally { await rm(base, { recursive: true, force: true }); }
    });

    it("contains no remote client, credential environment, transport or mutation construction", () => {
        const core = implementationSource("leader-supported-publisher-dry-run.ts");
        equal(/process\.env|S3Client|AwsClient|fetch\s*\(|https?:\/\/|wrangler|child_process|execFile|spawn\s*\(/i.test(core), false);
        equal((core.match(/await validateCharacterLeaderSupportedProjectionFromSources/g) ?? []).length, 2);
        equal(core.includes("automaticCleanupAttempted: false"), true);
        equal(core.includes("concurrentSameUserAncestorReplacementProtected: false"), true);
        equal(core.includes("await checkpoint(root)"), true);
    });

    it("exposes only a real source-bound K58 validator with no supplied-report authority", () => {
        const implementation = implementationSource("leader-supported-publisher-dry-run.ts");
        equal(typeof validateCharacterLeaderSupportedPublisherDryRunArtifact, "function");
        equal(implementation.includes("await validateCharacterLeaderSupportedProjectionArtifact({"), true);
        equal(implementation.includes("const expected = materialize(k56.artifacts, \"GO\")"), true);
        equal((implementation.match(/readCharacterLeaderSupportedPublisherDryRunArtifactSet\(options\.artifactRoot\)/g) ?? []).length, 2);
        equal(/validateCharacterLeaderSupportedPublisherDryRunArtifact[\s\S]{0,500}upstream|suppliedReport/.test(implementation), false);
    });

    it("keeps RSS only in RunResult with explicit per-process scope", () => {
        equal(maximumIndividualCharacterLeaderSupportedPublisherProcessPeakRss(100, 300, 200), 300);
        throws(() => maximumIndividualCharacterLeaderSupportedPublisherProcessPeakRss(100, 1024 * 1024 * 1024, 200), /per-process RSS peak rejected/);
        const artifactsText = Buffer.concat([
            artifacts.candidateManifestBytes, artifacts.planBytes, artifacts.receiptBytes, artifacts.markerBytes,
        ]).toString("utf8");
        equal(/rss|peak/i.test(artifactsText), false);
    });
});
