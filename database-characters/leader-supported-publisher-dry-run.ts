import { createHash } from "crypto";
import { constants, Stats } from "fs";
import { lstat, open, realpath } from "fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "path";
import { gunzipSync, gzipSync } from "zlib";
import {
    CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_GZIP_LIMIT_BYTES,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES,
    CharacterLeaderSupportedProjectionArtifactSet,
} from "./leader-supported-projection-contract";
import type { CharacterLeaderSupportedProjectionSourceOptions } from "./leader-supported-projection-source";
import { validateCharacterLeaderSupportedProjectionArtifact } from "./leader-supported-projection-source";
import {
    assertExactCharacterLeaderSupportedShadowK56Identity,
    characterLeaderSupportedShadowArtifactFingerprint,
    characterLeaderSupportedShadowLineageFingerprint,
} from "./leader-supported-shadow";
import {
    CHARACTER_LEADER_SUPPORTED_PUBLISHER_DRY_RUN_CONTRACT_VERSION,
    CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES,
    CHARACTER_LEADER_SUPPORTED_PUBLISHER_IMMUTABLE_CACHE_CONTROL,
    CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY,
    CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE,
    CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE_BUDGET_BYTES,
    CHARACTER_LEADER_SUPPORTED_PUBLISHER_REPORT_LIMIT_BYTES,
    CHARACTER_LEADER_SUPPORTED_PUBLISHER_RSS_LIMIT_BYTES,
    CharacterLeaderSupportedPublisherCandidateManifest,
    CharacterLeaderSupportedPublisherDryRunArtifactSet,
    CharacterLeaderSupportedPublisherDryRunPlan,
    CharacterLeaderSupportedPublisherDryRunReceipt,
    CharacterLeaderSupportedPublisherDryRunResult,
    CharacterLeaderSupportedPublisherImmutableObject,
} from "./leader-supported-publisher-dry-run-contract";

export interface CharacterLeaderSupportedPublisherDryRunOptions extends CharacterLeaderSupportedProjectionSourceOptions {
    optIn: true;
    k56Root: string;
    outputRoot: string;
}

const hash = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
const jsonBytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const json = (value: unknown): string => JSON.stringify(value);
const samePath = (left: string, right: string): boolean => process.platform === "win32"
    ? resolve(left).toLowerCase() === resolve(right).toLowerCase() : resolve(left) === resolve(right);
const containsPath = (parent: string, child: string): boolean => {
    const value = relative(parent, child);
    return value === "" || (value !== ".." && !value.startsWith(`..${sep}`) && !isAbsolute(value));
};

function assertParsed(bytes: Buffer, value: unknown, label: string): void {
    let parsed: unknown;
    try { parsed = JSON.parse(bytes.toString("utf8")); } catch { throw new Error(`K58 ${label} JSON rejected`); }
    if (json(parsed) !== json(value)) throw new Error(`K58 ${label} bytes/object mismatch`);
}

function assertStructuralK56(artifacts: CharacterLeaderSupportedProjectionArtifactSet): void {
    if (artifacts.raw.length >= CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES
        || artifacts.gzip.length >= CHARACTER_LEADER_SUPPORTED_PROJECTION_GZIP_LIMIT_BYTES
        || artifacts.coverageBytes.length + artifacts.validationBytes.length + artifacts.manifestBytes.length
            >= CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES) throw new Error("K58 K56 byte budget rejected");
    if (!gunzipSync(artifacts.gzip, { maxOutputLength: CHARACTER_LEADER_SUPPORTED_PROJECTION_RAW_LIMIT_BYTES }).equals(artifacts.raw)
        || !gzipSync(artifacts.raw, { level: 9 }).equals(artifacts.gzip)) throw new Error("K58 K56 raw/payload identity rejected");
    assertParsed(artifacts.raw, artifacts.dataset, "raw");
    assertParsed(artifacts.coverageBytes, artifacts.coverage, "coverage");
    assertParsed(artifacts.validationBytes, artifacts.validation, "validation");
    assertParsed(artifacts.manifestBytes, artifacts.manifest, "manifest");
    const manifest = artifacts.manifest;
    if (!/^database-characters-k56-leader-supported-projection\.[a-f0-9]{64}\.json\.gz$/.test(manifest.fileName)
        || manifest.sha256 !== hash(artifacts.gzip) || manifest.sizeBytes !== artifacts.gzip.length
        || manifest.uncompressedSha256 !== hash(artifacts.raw) || manifest.uncompressedSizeBytes !== artifacts.raw.length
        || manifest.coverageFile !== CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage
        || manifest.coverageSha256 !== hash(artifacts.coverageBytes) || manifest.coverageSizeBytes !== artifacts.coverageBytes.length
        || manifest.validationFile !== CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.validation
        || manifest.validationSha256 !== hash(artifacts.validationBytes) || manifest.validationSizeBytes !== artifacts.validationBytes.length
        || json(manifest.source) !== json(artifacts.dataset.source)
        || json(manifest.counts) !== json(artifacts.coverage.counts)) throw new Error("K58 K56 manifest lineage rejected");
    const counts = artifacts.coverage.counts;
    if (json(counts) !== json({
        totalEffects: 3853, totalReferences: 12310, projectedEffects: 3836,
        projectedReferences: 12265, excludedEffects: 17, excludedReferences: 45,
    }) || json(artifacts.coverage.excluded.map(item => item.effectRowId))
        !== json(CHARACTER_LEADER_SUPPORTED_PROJECTION_PIN.conditionalEffectRowIds)
        || artifacts.coverage.excluded.reduce((sum, item) => sum + item.affectedReferences.length, 0) !== 45
        || artifacts.dataset.policy.supportedOnly !== true || artifacts.dataset.policy.conditionalEffectsIncluded !== false
        || artifacts.dataset.policy.authoritySelected !== false || artifacts.dataset.policy.productionModified !== false
        || artifacts.dataset.policy.publisherImplemented !== false || artifacts.dataset.policy.networkEnabled !== false
        || artifacts.dataset.policy.r2Enabled !== false || artifacts.validation.valid !== true
        || artifacts.validation.failures.length !== 0 || artifacts.validation.readiness.sourceBoundValidation !== "NOT_EXECUTED") {
        throw new Error("K58 exact supported/excluded policy boundary rejected");
    }
}

function immutableObjects(artifacts: CharacterLeaderSupportedProjectionArtifactSet): CharacterLeaderSupportedPublisherImmutableObject[] {
    const sources = [
        { kind: "payload", name: artifacts.manifest.fileName, bytes: artifacts.gzip, contentType: "application/gzip" },
        { kind: "coverage", name: artifacts.manifest.coverageFile, bytes: artifacts.coverageBytes, contentType: "application/json" },
        { kind: "validation", name: artifacts.manifest.validationFile, bytes: artifacts.validationBytes, contentType: "application/json" },
        { kind: "manifest", name: CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.manifest, bytes: artifacts.manifestBytes, contentType: "application/json" },
    ] as const;
    return sources.map((source, index) => {
        const sha256 = hash(source.bytes);
        return {
            order: (index + 1) as 1 | 2 | 3 | 4,
            kind: source.kind,
            sourceFileName: source.name,
            objectKey: `${CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE}/objects/sha256/${sha256}/${source.name}`,
            sha256, sizeBytes: source.bytes.length, contentType: source.contentType,
            cacheControl: CHARACTER_LEADER_SUPPORTED_PUBLISHER_IMMUTABLE_CACHE_CONTROL,
            remotePreflight: "NOT_EXECUTED", action: "NOT_EXECUTED",
            futureProtocol: {
                missing: "create_if_absent_with_If-None-Match:*", matching: "verified_reuse_only", different: "FAIL_CLOSED",
                verifiedReuseRequiresSha256SizeContentTypeAndCacheControl: true,
                postCreateByteAndMetadataVerificationRequired: true, overwrite: "FORBIDDEN", delete: "FORBIDDEN",
            },
        };
    });
}

function materialize(
    artifacts: CharacterLeaderSupportedProjectionArtifactSet,
    dryRun: "GO" | "NOT_EXECUTED",
): CharacterLeaderSupportedPublisherDryRunArtifactSet {
    assertStructuralK56(artifacts);
    const objects = immutableObjects(artifacts);
    const source = {
        fullArtifactFingerprintSha256: characterLeaderSupportedShadowArtifactFingerprint(artifacts),
        lineageFingerprintSha256: characterLeaderSupportedShadowLineageFingerprint(artifacts),
        rawIdentity: {
            sha256: artifacts.manifest.uncompressedSha256,
            sizeBytes: artifacts.manifest.uncompressedSizeBytes,
            persistedOrRemoteObject: false as const,
        },
        lineage: artifacts.manifest.source,
    };
    const counts = artifacts.coverage.counts;
    const candidateManifest: CharacterLeaderSupportedPublisherCandidateManifest = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-publisher-candidate-manifest",
        contractVersion: CHARACTER_LEADER_SUPPORTED_PUBLISHER_DRY_RUN_CONTRACT_VERSION,
        namespace: CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE, source, counts,
        immutableObjects: objects,
        policy: {
            candidateOnly: true, manifestObjectKey: CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY,
            manifestAlwaysLast: true, remotePreflightRequired: true, remotePreflight: "NOT_EXECUTED",
            futureMissingManifestCreate: "If-None-Match: *", futureReplacement: "If-Match: FRESH_ETAG_REQUIRED",
            unconditionalWrite: "FORBIDDEN", delete: "FORBIDDEN", mutationExecuted: false,
        },
    };
    const candidateManifestBytes = jsonBytes(candidateManifest);
    const immutableBytes = objects.reduce((sum, object) => sum + object.sizeBytes, 0);
    const projectedRemoteBytes = immutableBytes + candidateManifestBytes.length;
    if (projectedRemoteBytes >= CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE_BUDGET_BYTES) {
        throw new Error("K58 conservative namespace budget reached");
    }
    const plan: CharacterLeaderSupportedPublisherDryRunPlan = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-publisher-dry-run-plan",
        contractVersion: CHARACTER_LEADER_SUPPORTED_PUBLISHER_DRY_RUN_CONTRACT_VERSION,
        mode: "explicit_opt_in_offline_local_dry_run_only_timestamp_free",
        namespace: CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE, source, counts, immutableObjects: objects,
        mutableManifest: {
            order: "LAST_AFTER_ALL_IMMUTABLE_OBJECTS", objectKey: CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY,
            candidateSha256: hash(candidateManifestBytes), candidateSizeBytes: candidateManifestBytes.length,
            contentType: "application/json", cacheControl: "no-store", remotePreflight: "NOT_EXECUTED", action: "NOT_EXECUTED",
            futureProtocol: {
                preflightRequired: true, missing: "If-None-Match: *", replacement: "If-Match: FRESH_ETAG_REQUIRED",
                freshEtagRequired: true, unconditionalWrite: "FORBIDDEN", delete: "FORBIDDEN",
            },
        },
        projection: {
            immutableObjectCount: 4, mutableCandidateManifestCount: 1, projectedRemoteObjectCount: 5,
            immutableBytes, candidateManifestBytes: candidateManifestBytes.length, projectedRemoteBytes,
        },
        budget: {
            conservativeNamespaceBudgetBytes: CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE_BUDGET_BYTES,
            projectedRemoteBytes,
            conservativeNamespaceHeadroomBytes: CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE_BUDGET_BYTES - projectedRemoteBytes,
            withinConservativeNamespaceBudget: true, bucketBytes: "UNKNOWN", bucketHeadroomBytes: "UNKNOWN",
        },
        safety: {
            localOnly: true, noClientConstructed: true, environmentCredentialsRead: false, networkRequestCount: 0,
            remoteMutationCount: 0, overwriteCount: 0, deleteCount: 0,
            outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
            concurrentSameUserAncestorReplacementProtected: false, localCreateOnly: true, localMarkerLast: true,
            automaticCleanupAttempted: false,
        },
        readiness: {
            dryRun, sourceBoundValidation: dryRun, remotePreflight: "NOT_EXECUTED", publication: "NO-GO",
            r2Mutation: "NO-GO", authority: "NO-GO", production: "NO-GO", android: "NO-GO", ui: "NO-GO",
            concurrentOutputAncestorReplacement: "NO-GO",
        },
    };
    const planBytes = jsonBytes(plan);
    const receipt: CharacterLeaderSupportedPublisherDryRunReceipt = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-publisher-dry-run-receipt",
        contractVersion: CHARACTER_LEADER_SUPPORTED_PUBLISHER_DRY_RUN_CONTRACT_VERSION,
        planSha256: hash(planBytes), planSizeBytes: planBytes.length,
        candidateManifestSha256: hash(candidateManifestBytes), candidateManifestSizeBytes: candidateManifestBytes.length,
        immutableObjectCount: 4, remotePreflight: "NOT_EXECUTED", remoteMutationCount: 0, dryRun,
    };
    const receiptBytes = jsonBytes(receipt);
    const marker = {
        schemaVersion: 1 as const, contract: "dokkan-database-character-leader-supported-publisher-dry-run-marker" as const,
        contractVersion: CHARACTER_LEADER_SUPPORTED_PUBLISHER_DRY_RUN_CONTRACT_VERSION,
        planSha256: hash(planBytes), receiptSha256: hash(receiptBytes), candidateManifestSha256: hash(candidateManifestBytes),
        localArtifactSetComplete: true as const, markerWrittenLast: true as const,
        remotePreflight: "NOT_EXECUTED" as const, remoteMutationCount: 0 as const,
    };
    const markerBytes = jsonBytes(marker);
    const result = { candidateManifest, plan, receipt, marker, candidateManifestBytes, planBytes, receiptBytes, markerBytes };
    assertCharacterLeaderSupportedPublisherDryRunArtifacts(result);
    return result;
}

export function buildCharacterLeaderSupportedPublisherDryRun(
    artifacts: CharacterLeaderSupportedProjectionArtifactSet,
): CharacterLeaderSupportedPublisherDryRunArtifactSet {
    return materialize(artifacts, "NOT_EXECUTED");
}

export function assertCharacterLeaderSupportedPublisherDryRunArtifacts(
    artifacts: CharacterLeaderSupportedPublisherDryRunArtifactSet,
): void {
    for (const [label, value, bytes] of [
        ["candidate manifest", artifacts.candidateManifest, artifacts.candidateManifestBytes],
        ["plan", artifacts.plan, artifacts.planBytes], ["receipt", artifacts.receipt, artifacts.receiptBytes],
        ["marker", artifacts.marker, artifacts.markerBytes],
    ] as const) {
        if (!jsonBytes(value).equals(bytes) || bytes.length >= CHARACTER_LEADER_SUPPORTED_PUBLISHER_REPORT_LIMIT_BYTES) {
            throw new Error(`K58 ${label} identity or byte budget rejected`);
        }
        if (/"(?:checkedAt|timestamp|peakRssBytes|processPeakRssBytes|maximumIndividualProcessPeakRssBytes)"/.test(bytes.toString("utf8"))) {
            throw new Error(`K58 ${label} contains nondeterministic/RSS fields`);
        }
    }
    const objects = artifacts.plan.immutableObjects;
    const immutableBytes = objects.reduce((sum, object) => sum + object.sizeBytes, 0);
    const projectedRemoteBytes = immutableBytes + artifacts.candidateManifestBytes.length;
    const expectedNames = [
        objects[0]?.sourceFileName,
        CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage,
        CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.validation,
        CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.manifest,
    ];
    if (artifacts.candidateManifest.schemaVersion !== 1
        || artifacts.candidateManifest.contract !== "dokkan-database-character-leader-supported-publisher-candidate-manifest"
        || artifacts.candidateManifest.contractVersion !== CHARACTER_LEADER_SUPPORTED_PUBLISHER_DRY_RUN_CONTRACT_VERSION
        || artifacts.candidateManifest.namespace !== CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE
        || artifacts.plan.schemaVersion !== 1
        || artifacts.plan.contract !== "dokkan-database-character-leader-supported-publisher-dry-run-plan"
        || artifacts.plan.contractVersion !== CHARACTER_LEADER_SUPPORTED_PUBLISHER_DRY_RUN_CONTRACT_VERSION
        || artifacts.plan.mode !== "explicit_opt_in_offline_local_dry_run_only_timestamp_free"
        || artifacts.plan.namespace !== CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE
        || json(objects.map(object => object.kind)) !== json(["payload", "coverage", "validation", "manifest"])
        || objects.length !== 4 || objects.some((object, index) => object.order !== index + 1
            || object.sourceFileName !== expectedNames[index]
            || index === 0 && !/^database-characters-k56-leader-supported-projection\.[a-f0-9]{64}\.json\.gz$/.test(object.sourceFileName)
            || !/^[a-f0-9]{64}$/.test(object.sha256) || !Number.isSafeInteger(object.sizeBytes) || object.sizeBytes <= 0
            || object.objectKey !== `${CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE}/objects/sha256/${object.sha256}/${object.sourceFileName}`
            || object.contentType !== (object.kind === "payload" ? "application/gzip" : "application/json")
            || object.cacheControl !== CHARACTER_LEADER_SUPPORTED_PUBLISHER_IMMUTABLE_CACHE_CONTROL
            || object.remotePreflight !== "NOT_EXECUTED" || object.action !== "NOT_EXECUTED"
            || object.futureProtocol.missing !== "create_if_absent_with_If-None-Match:*"
            || object.futureProtocol.matching !== "verified_reuse_only"
            || object.futureProtocol.verifiedReuseRequiresSha256SizeContentTypeAndCacheControl !== true
            || object.futureProtocol.different !== "FAIL_CLOSED"
            || object.futureProtocol.postCreateByteAndMetadataVerificationRequired !== true
            || object.futureProtocol.overwrite !== "FORBIDDEN" || object.futureProtocol.delete !== "FORBIDDEN")
        || json(artifacts.candidateManifest.immutableObjects) !== json(objects)
        || json(artifacts.candidateManifest.counts) !== json(artifacts.plan.counts)
        || json(artifacts.candidateManifest.source) !== json(artifacts.plan.source)
        || artifacts.candidateManifest.policy.candidateOnly !== true
        || artifacts.candidateManifest.policy.manifestAlwaysLast !== true
        || artifacts.candidateManifest.policy.remotePreflight !== "NOT_EXECUTED"
        || artifacts.candidateManifest.policy.futureMissingManifestCreate !== "If-None-Match: *"
        || artifacts.candidateManifest.policy.futureReplacement !== "If-Match: FRESH_ETAG_REQUIRED"
        || artifacts.candidateManifest.policy.unconditionalWrite !== "FORBIDDEN"
        || artifacts.candidateManifest.policy.delete !== "FORBIDDEN"
        || artifacts.candidateManifest.policy.mutationExecuted !== false
        || artifacts.plan.source.rawIdentity.persistedOrRemoteObject !== false
        || artifacts.plan.mutableManifest.order !== "LAST_AFTER_ALL_IMMUTABLE_OBJECTS"
        || artifacts.plan.mutableManifest.objectKey !== CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY
        || artifacts.plan.mutableManifest.remotePreflight !== "NOT_EXECUTED"
        || artifacts.plan.mutableManifest.action !== "NOT_EXECUTED"
        || artifacts.plan.mutableManifest.candidateSha256 !== hash(artifacts.candidateManifestBytes)
        || artifacts.plan.mutableManifest.candidateSizeBytes !== artifacts.candidateManifestBytes.length
        || artifacts.plan.mutableManifest.futureProtocol.preflightRequired !== true
        || artifacts.plan.mutableManifest.futureProtocol.missing !== "If-None-Match: *"
        || artifacts.plan.mutableManifest.futureProtocol.replacement !== "If-Match: FRESH_ETAG_REQUIRED"
        || artifacts.plan.mutableManifest.futureProtocol.freshEtagRequired !== true
        || artifacts.plan.mutableManifest.futureProtocol.unconditionalWrite !== "FORBIDDEN"
        || artifacts.plan.mutableManifest.futureProtocol.delete !== "FORBIDDEN"
        || artifacts.plan.projection.immutableObjectCount !== 4
        || artifacts.plan.projection.mutableCandidateManifestCount !== 1
        || artifacts.plan.projection.projectedRemoteObjectCount !== 5
        || artifacts.plan.projection.immutableBytes !== immutableBytes
        || artifacts.plan.projection.candidateManifestBytes !== artifacts.candidateManifestBytes.length
        || artifacts.plan.projection.projectedRemoteBytes !== projectedRemoteBytes
        || artifacts.plan.budget.projectedRemoteBytes !== projectedRemoteBytes
        || artifacts.plan.budget.conservativeNamespaceBudgetBytes !== CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE_BUDGET_BYTES
        || artifacts.plan.budget.conservativeNamespaceHeadroomBytes
            !== CHARACTER_LEADER_SUPPORTED_PUBLISHER_NAMESPACE_BUDGET_BYTES - projectedRemoteBytes
        || artifacts.plan.budget.withinConservativeNamespaceBudget !== true
        || artifacts.plan.budget.bucketBytes !== "UNKNOWN" || artifacts.plan.budget.bucketHeadroomBytes !== "UNKNOWN"
        || artifacts.plan.safety.localOnly !== true || artifacts.plan.safety.noClientConstructed !== true
        || artifacts.plan.safety.environmentCredentialsRead !== false || artifacts.plan.safety.networkRequestCount !== 0
        || artifacts.plan.safety.remoteMutationCount !== 0 || artifacts.plan.safety.overwriteCount !== 0
        || artifacts.plan.safety.deleteCount !== 0 || artifacts.plan.safety.localCreateOnly !== true
        || artifacts.plan.safety.localMarkerLast !== true || artifacts.plan.safety.automaticCleanupAttempted !== false
        || artifacts.plan.safety.outputNamespaceThreatModel !== "caller_controlled_stable_during_operation"
        || artifacts.plan.safety.concurrentSameUserAncestorReplacementProtected !== false
        || artifacts.plan.readiness.sourceBoundValidation !== artifacts.plan.readiness.dryRun
        || artifacts.plan.readiness.remotePreflight !== "NOT_EXECUTED" || artifacts.plan.readiness.publication !== "NO-GO"
        || artifacts.plan.readiness.r2Mutation !== "NO-GO" || artifacts.plan.readiness.authority !== "NO-GO"
        || artifacts.plan.readiness.production !== "NO-GO" || artifacts.plan.readiness.android !== "NO-GO"
        || artifacts.plan.readiness.ui !== "NO-GO"
        || artifacts.plan.readiness.concurrentOutputAncestorReplacement !== "NO-GO") {
        throw new Error("K58 ordered local-only plan boundary rejected");
    }
    if (artifacts.receipt.contract !== "dokkan-database-character-leader-supported-publisher-dry-run-receipt"
        || artifacts.receipt.contractVersion !== CHARACTER_LEADER_SUPPORTED_PUBLISHER_DRY_RUN_CONTRACT_VERSION
        || artifacts.marker.contract !== "dokkan-database-character-leader-supported-publisher-dry-run-marker"
        || artifacts.marker.contractVersion !== CHARACTER_LEADER_SUPPORTED_PUBLISHER_DRY_RUN_CONTRACT_VERSION
        || artifacts.receipt.planSha256 !== hash(artifacts.planBytes) || artifacts.receipt.planSizeBytes !== artifacts.planBytes.length
        || artifacts.receipt.candidateManifestSha256 !== hash(artifacts.candidateManifestBytes)
        || artifacts.receipt.candidateManifestSizeBytes !== artifacts.candidateManifestBytes.length
        || artifacts.receipt.immutableObjectCount !== 4 || artifacts.receipt.remotePreflight !== "NOT_EXECUTED"
        || artifacts.receipt.remoteMutationCount !== 0 || artifacts.receipt.dryRun !== artifacts.plan.readiness.dryRun
        || artifacts.marker.planSha256 !== hash(artifacts.planBytes) || artifacts.marker.receiptSha256 !== hash(artifacts.receiptBytes)
        || artifacts.marker.candidateManifestSha256 !== hash(artifacts.candidateManifestBytes)
        || artifacts.marker.localArtifactSetComplete !== true || artifacts.marker.markerWrittenLast !== true
        || artifacts.marker.remotePreflight !== "NOT_EXECUTED" || artifacts.marker.remoteMutationCount !== 0) {
        throw new Error("K58 receipt or marker lineage rejected");
    }
}

interface RootIdentity { path: string; realPath: string; dev: number; ino: number }
const sameFile = (left: Stats, right: Stats): boolean => left.dev === right.dev && left.ino === right.ino;

async function inspectRoot(value: string, label: string): Promise<RootIdentity> {
    const path = resolve(value), metadata = await lstat(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(`K58 ${label} must be an existing regular non-link directory`);
    const canonical = await realpath(path);
    if (!samePath(path, canonical)) throw new Error(`K58 ${label} symlink or junction rejected`);
    return { path, realPath: canonical, dev: metadata.dev, ino: metadata.ino };
}
async function checkpoint(root: RootIdentity): Promise<void> {
    const actual = await inspectRoot(root.path, "output root");
    if (actual.dev !== root.dev || actual.ino !== root.ino || !samePath(actual.realPath, root.realPath)) {
        throw new Error("K58 output root identity changed within caller-controlled stable threat model");
    }
}
async function writeCreateOnly(root: RootIdentity, name: string, bytes: Buffer): Promise<void> {
    await checkpoint(root);
    const path = join(root.path, name);
    if (!samePath(path, resolve(root.path, name))) throw new Error("K58 local member escaped output root");
    const handle = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | (constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await handle.writeFile(bytes); await handle.sync();
        const opened = await handle.stat(), visible = await lstat(path);
        if (!opened.isFile() || opened.nlink !== 1 || opened.size !== bytes.length || !sameFile(opened, visible)
            || visible.isSymbolicLink() || visible.nlink !== 1) throw new Error("K58 create-only member identity rejected");
    } finally { await handle.close(); }
    await checkpoint(root);
}

export async function writeCharacterLeaderSupportedPublisherDryRunArtifacts(
    outputRoot: string,
    artifacts: CharacterLeaderSupportedPublisherDryRunArtifactSet,
): Promise<ReadonlyArray<string>> {
    assertCharacterLeaderSupportedPublisherDryRunArtifacts(artifacts);
    const root = await inspectRoot(outputRoot, "output root");
    const files = [
        [CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES.candidateManifest, artifacts.candidateManifestBytes],
        [CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES.plan, artifacts.planBytes],
        [CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES.receipt, artifacts.receiptBytes],
        [CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES.marker, artifacts.markerBytes],
    ] as const;
    for (const [name] of files) {
        try { await lstat(join(root.path, name)); throw new Error(`K58 local output already exists: ${name}`); }
        catch (error: any) { if (error?.code !== "ENOENT") throw error; }
    }
    const written: string[] = [];
    for (const [name, bytes] of files) { await writeCreateOnly(root, name, bytes); written.push(name); }
    return Object.freeze([...written]);
}

async function validateOutputSeparation(options: CharacterLeaderSupportedPublisherDryRunOptions): Promise<void> {
    const output = await inspectRoot(options.outputRoot, "output root");
    for (const [label, value] of [
        ["sidecar root", options.sidecarRoot], ["production root", options.productionRoot], ["FYI root", options.fyiRoot],
        ["K43 root", options.k43Root], ["K46 root", options.k46Root], ["K48 root", options.k48Root], ["K56 root", options.k56Root],
    ] as const) {
        const source = await inspectRoot(value, label);
        if (containsPath(source.realPath, output.realPath) || containsPath(output.realPath, source.realPath)) {
            throw new Error(`K58 output root must be separated from ${label}`);
        }
    }
    for (const [label, value] of [["native runtime", options.nativeRuntime], ["database", options.database]] as const) {
        const metadata = await lstat(resolve(value));
        const canonical = await realpath(resolve(value));
        if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || containsPath(output.realPath, canonical)) {
            throw new Error(`K58 output root must be separated from regular single-link ${label}`);
        }
    }
}

class ParentRssGuard {
    private peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    private exceeded = false;
    private readonly timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    private observe(): void {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= CHARACTER_LEADER_SUPPORTED_PUBLISHER_RSS_LIMIT_BYTES;
    }
    sample(): void { this.observe(); if (this.exceeded) throw new Error(`K58 parent per-process RSS limit reached: ${this.peak}`); }
    stop(): number { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose(): void { clearInterval(this.timer); }
}

export function maximumIndividualCharacterLeaderSupportedPublisherProcessPeakRss(...peaks: number[]): number {
    if (peaks.length !== 3 || peaks.some(peak => !Number.isSafeInteger(peak) || peak <= 0
        || peak >= CHARACTER_LEADER_SUPPORTED_PUBLISHER_RSS_LIMIT_BYTES)) throw new Error("K58 per-process RSS peak rejected");
    return Math.max(...peaks);
}

export function assertCharacterLeaderSupportedPublisherSourceStable(
    beforeFingerprint: string,
    beforeLineageFingerprint: string,
    after: CharacterLeaderSupportedProjectionArtifactSet,
): void {
    if (beforeFingerprint !== characterLeaderSupportedShadowArtifactFingerprint(after)
        || beforeLineageFingerprint !== characterLeaderSupportedShadowLineageFingerprint(after)) {
        throw new Error("K58 K56 source fingerprint or lineage drifted across dry-run");
    }
}

const validateCharacterLeaderSupportedProjectionFromSources = validateCharacterLeaderSupportedProjectionArtifact;

export async function runCharacterLeaderSupportedPublisherDryRun(
    options: CharacterLeaderSupportedPublisherDryRunOptions,
): Promise<CharacterLeaderSupportedPublisherDryRunResult> {
    if (options?.optIn !== true) throw new Error("K58 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root || !options.k46Root
        || !options.k48Root || !options.k56Root || !options.outputRoot || !options.nativeRuntime || !options.database) {
        throw new Error("K58 requires every explicit source/K56/output root, native runtime and database");
    }
    if (typeof (global as any).gc !== "function") throw new Error("K58 requires Node --expose-gc");
    const rss = new ParentRssGuard();
    try {
        await validateOutputSeparation(options);
        let before = await validateCharacterLeaderSupportedProjectionFromSources({
            artifactRoot: options.k56Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot,
            fyiRoot: options.fyiRoot, k43Root: options.k43Root, k46Root: options.k46Root, k48Root: options.k48Root,
            nativeRuntime: options.nativeRuntime, database: options.database,
        });
        if (before.sourceBoundValidation !== "GO") throw new Error("K58 before source-bound K56 validation did not return GO");
        assertExactCharacterLeaderSupportedShadowK56Identity(before.artifacts);
        const beforeFingerprint = characterLeaderSupportedShadowArtifactFingerprint(before.artifacts);
        const beforeLineage = characterLeaderSupportedShadowLineageFingerprint(before.artifacts);
        const beforePeak = before.k55ValidationProcessPeakRssBytes;
        const direct = buildCharacterLeaderSupportedPublisherDryRun(before.artifacts);
        if (direct.plan.readiness.dryRun !== "NOT_EXECUTED") throw new Error("K58 direct builder auto-authorized dry-run");
        before = undefined as any;
        (global as any).gc(); rss.sample();

        let after = await validateCharacterLeaderSupportedProjectionFromSources({
            artifactRoot: options.k56Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot,
            fyiRoot: options.fyiRoot, k43Root: options.k43Root, k46Root: options.k46Root, k48Root: options.k48Root,
            nativeRuntime: options.nativeRuntime, database: options.database,
        });
        if (after.sourceBoundValidation !== "GO") throw new Error("K58 after source-bound K56 validation did not return GO");
        assertExactCharacterLeaderSupportedShadowK56Identity(after.artifacts);
        assertCharacterLeaderSupportedPublisherSourceStable(beforeFingerprint, beforeLineage, after.artifacts);
        const afterPeak = after.k55ValidationProcessPeakRssBytes;
        const authorized = materialize(after.artifacts, "GO");
        const authorizedAgain = materialize(after.artifacts, "GO");
        if (!authorized.candidateManifestBytes.equals(authorizedAgain.candidateManifestBytes)
            || !authorized.planBytes.equals(authorizedAgain.planBytes) || !authorized.receiptBytes.equals(authorizedAgain.receiptBytes)
            || !authorized.markerBytes.equals(authorizedAgain.markerBytes)
            || !direct.candidateManifestBytes.equals(authorized.candidateManifestBytes)) throw new Error("K58 materialization is not deterministic");
        after = undefined as any;
        (global as any).gc(); rss.sample();
        const written = await writeCharacterLeaderSupportedPublisherDryRunArtifacts(options.outputRoot, authorized);
        if (written[written.length - 1] !== CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES.marker) throw new Error("K58 marker was not written last");
        const parentPeak = rss.stop();
        const maximumIndividualProcessPeakRssBytes = maximumIndividualCharacterLeaderSupportedPublisherProcessPeakRss(
            beforePeak, afterPeak, parentPeak,
        );
        return {
            outputRoot: resolve(options.outputRoot), planSha256: hash(authorized.planBytes),
            candidateManifestSha256: hash(authorized.candidateManifestBytes), receiptSha256: hash(authorized.receiptBytes),
            markerSha256: hash(authorized.markerBytes), sourceFullArtifactFingerprintSha256: beforeFingerprint,
            sourceLineageFingerprintSha256: beforeLineage, sourceStableAcrossDryRun: true,
            rssAccountingScope: "per_process_not_process_tree", k55BeforeProcessPeakRssBytes: beforePeak,
            k55AfterProcessPeakRssBytes: afterPeak, k58ParentProcessPeakRssBytes: parentPeak,
            maximumIndividualProcessPeakRssBytes,
            readiness: {
                dryRun: "GO", perProcessRssUnder1GiB: "GO", processTreeRssUnder1GiB: "NO-GO",
                remotePreflight: "NOT_EXECUTED", publication: "NO-GO", r2Mutation: "NO-GO",
                authority: "NO-GO", production: "NO-GO", network: "NO-GO", android: "NO-GO",
                concurrentOutputAncestorReplacement: "NO-GO",
            },
        };
    } finally { rss.dispose(); }
}
