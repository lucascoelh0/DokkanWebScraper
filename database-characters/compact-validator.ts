import { constants, Stats } from "fs";
import { createHash } from "crypto";
import { lstat, open } from "fs/promises";
import { join, resolve } from "path";
import { Readable } from "stream";
import { createGunzip } from "zlib";
import { Rarities, Types } from "../character";
import { isDirectArtifactName } from "../artifact-path";
import { resolveCharacterInputFile } from "./artifact-path";
import {
    CHARACTER_COMPACT_CONTRACT_VERSION,
    CHARACTER_COMPACT_EXPECTATIONS,
    CHARACTER_COMPACT_GZIP_BUDGET_BYTES,
    CHARACTER_COMPACT_POLICY_ID,
    CHARACTER_COMPACT_POLICY_VERSION,
    CHARACTER_COMPACT_PINNED_RELEASE,
    CHARACTER_COMPACT_RAW_BUDGET_BYTES,
    CharacterCompactCoverage,
    CharacterCompactManifest,
    CharacterCompactProjection,
    CharacterCompactReadiness,
    CharacterCompactSourceLineage,
    CharacterCompactValidation,
} from "./compact-contract";
import { CHARACTER_REFRESH_PROFILE } from "./refresh-contract";
import { CHARACTER_SHADOW_PINNED_RELEASE } from "./shadow-release";

const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const keysEqual = (value: unknown, keys: string[]) => !!value && typeof value === "object" && !Array.isArray(value)
    && JSON.stringify(Object.keys(value as object).sort()) === JSON.stringify(keys.slice().sort());
const numeric = (left: string, right: string) => Number(left) - Number(right) || left.localeCompare(right);
const rarities = new Set<string>(Object.values(Rarities));
const types = new Set<string>(Object.values(Types));
const TEST_HOOK = Symbol.for("dokkan.k15.compact-validator.test-hook");

interface ArtifactSnapshot {
    path: string;
    bytes: Buffer;
    metadata: Stats;
}

type TestHook = (point: string) => void | Promise<void>;

async function invokeTestHook(point: string): Promise<void> {
    if (process.env.NODE_ENV !== "test") return;
    const hook = (global as any)[TEST_HOOK] as TestHook | undefined;
    if (hook) await hook(point);
}

function sameFileIdentity(left: Stats, right: Stats): boolean {
    return left.dev === right.dev && left.ino === right.ino;
}

export function pinnedCharacterCompactLineage(): CharacterCompactSourceLineage {
    const gate = (name: "k0" | "k1" | "k2") => {
        const profile = CHARACTER_REFRESH_PROFILE.sidecars.find(item => item.gate === name)!;
        return { contractVersion: profile.contractVersion, sha256: profile.artifact.sha256, sizeBytes: profile.artifact.sizeBytes };
    };
    return {
        profileId: CHARACTER_REFRESH_PROFILE.profileId,
        snapshotVersion: CHARACTER_REFRESH_PROFILE.snapshotVersion,
        database: { ...CHARACTER_REFRESH_PROFILE.sqlite },
        db1: { ...CHARACTER_REFRESH_PROFILE.db1 },
        k0: gate("k0"),
        k1: gate("k1"),
        k2: gate("k2"),
        k11: {
            contractVersion: "1.0.0",
            sha256: CHARACTER_SHADOW_PINNED_RELEASE.artifactSha256,
            sizeBytes: CHARACTER_SHADOW_PINNED_RELEASE.artifactSizeBytes,
            uncompressedSha256: CHARACTER_SHADOW_PINNED_RELEASE.uncompressedSha256,
            uncompressedSizeBytes: CHARACTER_SHADOW_PINNED_RELEASE.uncompressedSizeBytes,
        },
        k12: { contractVersion: "1.0.0", sha256: CHARACTER_SHADOW_PINNED_RELEASE.coverageSha256, sizeBytes: CHARACTER_SHADOW_PINNED_RELEASE.coverageSizeBytes },
        k13: { contractVersion: "1.0.0", sha256: "f6db1919c3caac43c54508e3e4022ea70f6e318ddab86c6b2efc1ce9316f2319", sizeBytes: 365 },
        k14: { contractVersion: "1.0.1", sha256: "4773a9f3ae7019b4b5d9b133329aebe15db92ca2b9db242dc226890156344b2f", sizeBytes: 54_486 },
        productionCharacters: { sha256: "421c8fec6f7ba22e270af19b2278da4fbba19b6299205a54cc3d1ed570319dbc", sizeBytes: 121_390_313, characterCount: 4_090 },
    };
}

export function assertPinnedCharacterCompactReleaseManifest(manifest: CharacterCompactManifest, manifestBytes: Buffer): void {
    const release = CHARACTER_COMPACT_PINNED_RELEASE;
    if (manifestBytes.length !== release.manifestSizeBytes || hash(manifestBytes) !== release.manifestSha256) {
        throw new Error("K15 pinned release manifest identity rejected");
    }
    if (manifest.fileName !== release.payloadFile || manifest.sha256 !== release.payloadSha256
        || manifest.sizeBytes !== release.payloadSizeBytes || manifest.uncompressedSha256 !== release.rawSha256
        || manifest.uncompressedSizeBytes !== release.rawSizeBytes || manifest.recordCount !== release.recordCount
        || manifest.coverageFile !== release.coverageFile || manifest.coverageSha256 !== release.coverageSha256
        || manifest.coverageSizeBytes !== release.coverageSizeBytes || manifest.validationFile !== release.validationFile
        || manifest.validationSha256 !== release.validationSha256 || manifest.validationSizeBytes !== release.validationSizeBytes
        || manifest.readinessFile !== release.readinessFile || manifest.readinessSha256 !== release.readinessSha256
        || manifest.readinessSizeBytes !== release.readinessSizeBytes) {
        throw new Error("K15 pinned release manifest fields rejected");
    }
}

export function validateCharacterCompactProjection(
    projection: CharacterCompactProjection,
    coverage?: CharacterCompactCoverage,
    sizes: { gzipSizeBytes: number; rawSizeBytes: number } = { gzipSizeBytes: 0, rawSizeBytes: 0 },
    enforcePinnedSnapshot = false,
): CharacterCompactValidation {
    const failures: string[] = [];
    let duplicateCardIdCount = 0;
    let unstableOrderCount = 0;
    let invalidEnumCount = 0;
    let extraFieldCount = 0;
    let missingBindingCount = 0;
    try {
        if (!keysEqual(projection, ["schemaVersion", "contract", "contractVersion", "generatedAt", "datasetVersion", "source", "policy", "records"])) failures.push("projection fields");
        if (projection?.schemaVersion !== 1 || projection.contract !== "dokkan-database-character-compact-shadow" || projection.contractVersion !== CHARACTER_COMPACT_CONTRACT_VERSION) failures.push("projection schema");
        if (projection.generatedAt !== CHARACTER_REFRESH_PROFILE.generatedAt || projection.datasetVersion !== `${CHARACTER_REFRESH_PROFILE.snapshotVersion}-k15-v1`) failures.push("deterministic version");
        if (JSON.stringify(projection.source) !== JSON.stringify(pinnedCharacterCompactLineage())) failures.push("lineage mismatch");
        const canonicalPolicy = {
            id: CHARACTER_COMPACT_POLICY_ID,
            version: CHARACTER_COMPACT_POLICY_VERSION,
            approvedBy: { contract: "dokkan-database-character-field-shadow-readiness", contractVersion: "1.0.1" },
            records: "supported_only",
            fields: ["id", "rarity", "type"],
            allowedComparisons: ["agreement", "representation_gain"],
            structuralJoinOnly: true,
            externalFallbackIncluded: false,
            auditFieldsIncluded: false,
            productionModified: false,
            consumerImplemented: false,
            publisherEnabled: false,
            androidEnabled: false,
        };
        if (JSON.stringify(projection.policy) !== JSON.stringify(canonicalPolicy)) failures.push("policy mismatch");
        if (!Array.isArray(projection.records)) throw new Error("records missing");
        const seen = new Set<string>();
        projection.records.forEach((record, index) => {
            if (!keysEqual(record, ["cardId", "stateId", "rarity", "type"])) extraFieldCount++;
            if (typeof record?.cardId !== "string" || !record.cardId || typeof record.stateId !== "string" || !record.stateId) missingBindingCount++;
            if (!rarities.has(record?.rarity) || !types.has(record?.type)) invalidEnumCount++;
            if (seen.has(record?.cardId)) duplicateCardIdCount++;
            seen.add(record?.cardId);
            if (index > 0 && numeric(projection.records[index - 1].cardId, record.cardId) >= 0) unstableOrderCount++;
        });
        if (duplicateCardIdCount) failures.push("duplicate cardId");
        if (unstableOrderCount) failures.push("unstable record order");
        if (invalidEnumCount) failures.push("unknown enum");
        if (extraFieldCount) failures.push("extra or audit-only record field");
        if (missingBindingCount) failures.push("record without binding");
        if (projection.records.length > CHARACTER_COMPACT_EXPECTATIONS.recordCount) failures.push("record count exceeds K14 approval");
        if (coverage) validateCoverage(projection, coverage, failures, enforcePinnedSnapshot);
        if (enforcePinnedSnapshot && projection.records.length !== CHARACTER_COMPACT_EXPECTATIONS.recordCount) failures.push("pinned record count");
    } catch {
        failures.push("projection shape");
    }
    if (sizes.rawSizeBytes > CHARACTER_COMPACT_RAW_BUDGET_BYTES) failures.push("raw budget exceeded");
    if (sizes.gzipSizeBytes > CHARACTER_COMPACT_GZIP_BUDGET_BYTES) failures.push("gzip budget exceeded");
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-compact-shadow-validation",
        contractVersion: CHARACTER_COMPACT_CONTRACT_VERSION,
        valid: failures.length === 0,
        failures: [...new Set(failures)].sort(),
        budgets: {
            gzipMaximumBytes: CHARACTER_COMPACT_GZIP_BUDGET_BYTES,
            rawMaximumBytes: CHARACTER_COMPACT_RAW_BUDGET_BYTES,
            gzipSizeBytes: sizes.gzipSizeBytes,
            rawSizeBytes: sizes.rawSizeBytes,
        },
        safety: {
            duplicateCardIdCount, unstableOrderCount, invalidEnumCount, extraFieldCount, missingBindingCount,
            externalFallbackCount: 0,
            productionFilesWritten: false,
            characterMergeApiImplemented: false,
            runtimeK11ReadImplemented: false,
        },
    };
}

function validateCoverage(projection: CharacterCompactProjection, coverage: CharacterCompactCoverage, failures: string[], pinned: boolean): void {
    if (!keysEqual(coverage, ["schemaVersion", "contract", "contractVersion", "databaseCardCount", "recordCount", "excludedCardCount", "exclusions", "comparisons", "catalogImpact"])) failures.push("coverage fields");
    if (coverage.schemaVersion !== 1 || coverage.contract !== "dokkan-database-character-compact-shadow-coverage" || coverage.contractVersion !== "1.0.0") failures.push("coverage schema");
    if (coverage.recordCount !== projection.records.length || coverage.excludedCardCount !== coverage.databaseCardCount - coverage.recordCount) failures.push("coverage cardinality");
    if (!keysEqual(coverage.exclusions, ["unjoinable", "partial", "unknown", "mismatch", "conflict", "invalidEnum", "ambiguousBinding", "incomplete"])) failures.push("coverage exclusion fields");
    if (Object.values(coverage.exclusions).some(value => !Number.isInteger(value) || value < 0)) failures.push("coverage exclusion values");
    if (coverage.catalogImpact.charactersCreated !== 0 || coverage.catalogImpact.charactersRemoved !== 0 || coverage.catalogImpact.productionModified) failures.push("catalog mutation");
    if (pinned) {
        const expected = CHARACTER_COMPACT_EXPECTATIONS;
        if (coverage.databaseCardCount !== expected.databaseCardCount || coverage.recordCount !== expected.recordCount || coverage.exclusions.unjoinable !== expected.productionUnjoinableCount) failures.push("pinned coverage counts");
        if (Object.entries(coverage.exclusions).some(([key, value]) => key !== "unjoinable" && value !== 0)) failures.push("unsafe pinned exclusions");
        if (coverage.comparisons.id.agreements !== expected.idAgreements || coverage.comparisons.id.representationGains !== 0
            || coverage.comparisons.rarity.agreements !== expected.rarityAgreements || coverage.comparisons.rarity.representationGains !== expected.rarityRepresentationGains
            || coverage.comparisons.type.agreements !== expected.typeAgreements || coverage.comparisons.type.representationGains !== 0) failures.push("pinned comparison counts");
    }
}

export function buildCharacterCompactReadiness(generatedAt: string): CharacterCompactReadiness {
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-compact-shadow-readiness",
        contractVersion: "1.0.0",
        generatedAt,
        status: "offline_artifact_ready_consumers_disabled",
        gates: {
            offlineGeneration: "GO", artifactValidation: "GO", inMemoryConsumer: "NO-GO", characterMutation: "NO-GO",
            android: "NO-GO", r2Publication: "NO-GO", production: "NO-GO", authorityPromotion: "NO-GO",
            fyiRemoval: "NO-GO", dokkanInfoRemoval: "NO-GO",
        },
        nextGate: {
            gate: "K16", action: "opt_in_k15_shadow_consumer", constraint: "compare_only_without_changing_effective_character_values",
            k11ConsumerInput: false, k15ConsumerInput: true,
        },
    };
}

async function exactRegularFile(root: string, fileName: unknown, exactName?: string): Promise<string> {
    if (typeof fileName !== "string" || !isDirectArtifactName(fileName)) throw new Error("manifest path rejected");
    if (exactName !== undefined && fileName !== exactName) throw new Error("manifest file name changed");
    const rootPath = resolve(root);
    const rootMetadata = await lstat(rootPath);
    if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) throw new Error("manifest root symlink or junction rejected");
    const candidate = join(rootPath, fileName);
    const metadata = await lstat(candidate);
    if (metadata.isSymbolicLink() || !metadata.isFile() || metadata.nlink !== 1) throw new Error("manifest symlink or junction rejected");
    return resolveCharacterInputFile(rootPath, fileName, fileName);
}

async function readArtifactSnapshot(root: string, fileName: unknown, exactName?: string): Promise<ArtifactSnapshot> {
    const path = await exactRegularFile(root, fileName, exactName);
    const before = await lstat(path);
    const noFollow = constants.O_NOFOLLOW ?? 0;
    const handle = await open(path, constants.O_RDONLY | noFollow);
    try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.nlink !== 1 || !sameFileIdentity(before, opened)) {
            throw new Error("K15 artifact identity changed while opening");
        }
        const bytes = await handle.readFile();
        const afterRead = await handle.stat();
        const afterPath = await lstat(path);
        if (!sameFileIdentity(opened, afterRead) || !sameFileIdentity(opened, afterPath)
            || afterRead.size !== bytes.length || afterPath.size !== bytes.length
            || afterRead.mtimeMs !== opened.mtimeMs || afterRead.ctimeMs !== opened.ctimeMs) {
            throw new Error("K15 artifact identity or bytes changed while reading");
        }
        return { path, bytes, metadata: afterRead };
    } finally {
        await handle.close();
    }
}

function assertSnapshotUnchanged(before: ArtifactSnapshot, after: ArtifactSnapshot, label: string): void {
    if (before.path !== after.path || !sameFileIdentity(before.metadata, after.metadata)
        || before.metadata.size !== after.metadata.size
        || before.metadata.mtimeMs !== after.metadata.mtimeMs
        || before.metadata.ctimeMs !== after.metadata.ctimeMs
        || !before.bytes.equals(after.bytes)) {
        throw new Error(`K15 ${label} mutated during validation`);
    }
}

async function gunzipBounded(bytes: Buffer): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let size = 0;
    const stream = Readable.from(bytes).pipe(createGunzip());
    for await (const chunk of stream) {
        const value = chunk as Buffer;
        size += value.length;
        if (size > CHARACTER_COMPACT_RAW_BUDGET_BYTES) {
            stream.destroy();
            throw new Error("raw budget exceeded during decompression");
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks, size);
}

export async function validateCharacterCompactArtifact(root: string): Promise<{
    manifest: CharacterCompactManifest;
    projection: CharacterCompactProjection;
    coverage: CharacterCompactCoverage;
    validation: CharacterCompactValidation;
    readiness: CharacterCompactReadiness;
}> {
    const release = CHARACTER_COMPACT_PINNED_RELEASE;
    const manifestSnapshot = await readArtifactSnapshot(root, release.manifestFile, release.manifestFile);
    const manifestBytes = manifestSnapshot.bytes;
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as CharacterCompactManifest;
    const manifestKeys = ["schemaVersion", "contract", "contractVersion", "generatedAt", "datasetVersion", "fileName", "compression", "sha256", "sizeBytes", "uncompressedSha256", "uncompressedSizeBytes", "recordCount", "lineage", "coverageFile", "coverageSha256", "coverageSizeBytes", "validationFile", "validationSha256", "validationSizeBytes", "readinessFile", "readinessSha256", "readinessSizeBytes"];
    if (!keysEqual(manifest, manifestKeys) || manifest.schemaVersion !== 1 || manifest.contract !== "dokkan-database-character-compact-shadow-manifest" || manifest.contractVersion !== "1.0.0" || manifest.compression !== "gzip") throw new Error("K15 manifest contract rejected");
    if (manifest.generatedAt !== CHARACTER_REFRESH_PROFILE.generatedAt || manifest.datasetVersion !== `${CHARACTER_REFRESH_PROFILE.snapshotVersion}-k15-v1` || JSON.stringify(manifest.lineage) !== JSON.stringify(pinnedCharacterCompactLineage())) throw new Error("K15 manifest lineage rejected");
    assertPinnedCharacterCompactReleaseManifest(manifest, manifestBytes);
    if (manifest.fileName !== `database-characters-k15-compact-supported.${manifest.sha256}.json.gz`) throw new Error("K15 content-addressed file name rejected");
    const [payloadSnapshot, coverageSnapshot, validationSnapshot, readinessSnapshot] = await Promise.all([
        readArtifactSnapshot(root, manifest.fileName),
        readArtifactSnapshot(root, manifest.coverageFile, "database-characters-k15-coverage.json"),
        readArtifactSnapshot(root, manifest.validationFile, "database-characters-k15-validation.json"),
        readArtifactSnapshot(root, manifest.readinessFile, "database-characters-k15-readiness.json"),
    ]);
    const { bytes: payloadBytes } = payloadSnapshot;
    const { bytes: coverageBytes } = coverageSnapshot;
    const { bytes: validationBytes } = validationSnapshot;
    const { bytes: readinessBytes } = readinessSnapshot;
    if (payloadBytes.length !== manifest.sizeBytes || hash(payloadBytes) !== manifest.sha256
        || payloadBytes.length !== release.payloadSizeBytes || hash(payloadBytes) !== release.payloadSha256
        || payloadBytes.length > CHARACTER_COMPACT_GZIP_BUDGET_BYTES) throw new Error("K15 payload identity or gzip budget rejected");
    for (const [bytes, sha256, size, label] of [
        [coverageBytes, manifest.coverageSha256, manifest.coverageSizeBytes, "coverage"],
        [validationBytes, manifest.validationSha256, manifest.validationSizeBytes, "validation"],
        [readinessBytes, manifest.readinessSha256, manifest.readinessSizeBytes, "readiness"],
    ] as const) if (bytes.length !== size || hash(bytes) !== sha256) throw new Error(`K15 ${label} identity rejected`);
    const raw = await gunzipBounded(payloadBytes);
    if (raw.length !== manifest.uncompressedSizeBytes || hash(raw) !== manifest.uncompressedSha256
        || raw.length !== release.rawSizeBytes || hash(raw) !== release.rawSha256) throw new Error("K15 raw identity rejected");
    const projection = JSON.parse(raw.toString("utf8")) as CharacterCompactProjection;
    const coverage = JSON.parse(coverageBytes.toString("utf8")) as CharacterCompactCoverage;
    const validation = JSON.parse(validationBytes.toString("utf8")) as CharacterCompactValidation;
    const readiness = JSON.parse(readinessBytes.toString("utf8")) as CharacterCompactReadiness;
    const expectedValidation = validateCharacterCompactProjection(projection, coverage, { gzipSizeBytes: payloadBytes.length, rawSizeBytes: raw.length }, true);
    if (!expectedValidation.valid || JSON.stringify(validation) !== JSON.stringify(expectedValidation)) throw new Error(`K15 validation rejected: ${expectedValidation.failures.join("; ")}`);
    if (manifest.recordCount !== projection.records.length || JSON.stringify(readiness) !== JSON.stringify(buildCharacterCompactReadiness(manifest.generatedAt))) throw new Error("K15 manifest/readiness cardinality rejected");
    await invokeTestHook("before-final-artifact-revalidation");
    const [manifestAfter, payloadAfter, coverageAfter, validationAfter, readinessAfter] = await Promise.all([
        readArtifactSnapshot(root, release.manifestFile, release.manifestFile),
        readArtifactSnapshot(root, manifest.fileName),
        readArtifactSnapshot(root, manifest.coverageFile, "database-characters-k15-coverage.json"),
        readArtifactSnapshot(root, manifest.validationFile, "database-characters-k15-validation.json"),
        readArtifactSnapshot(root, manifest.readinessFile, "database-characters-k15-readiness.json"),
    ]);
    assertSnapshotUnchanged(manifestSnapshot, manifestAfter, "manifest");
    assertSnapshotUnchanged(payloadSnapshot, payloadAfter, "payload");
    assertSnapshotUnchanged(coverageSnapshot, coverageAfter, "coverage");
    assertSnapshotUnchanged(validationSnapshot, validationAfter, "validation");
    assertSnapshotUnchanged(readinessSnapshot, readinessAfter, "readiness");
    const finalManifest = JSON.parse(manifestAfter.bytes.toString("utf8")) as CharacterCompactManifest;
    assertPinnedCharacterCompactReleaseManifest(finalManifest, manifestAfter.bytes);
    if (payloadAfter.bytes.length !== finalManifest.sizeBytes || hash(payloadAfter.bytes) !== finalManifest.sha256
        || payloadAfter.bytes.length !== release.payloadSizeBytes || hash(payloadAfter.bytes) !== release.payloadSha256) {
        throw new Error("K15 payload final identity rejected");
    }
    for (const [snapshot, sha256, size, label] of [
        [coverageAfter, finalManifest.coverageSha256, finalManifest.coverageSizeBytes, "coverage"],
        [validationAfter, finalManifest.validationSha256, finalManifest.validationSizeBytes, "validation"],
        [readinessAfter, finalManifest.readinessSha256, finalManifest.readinessSizeBytes, "readiness"],
    ] as const) if (snapshot.bytes.length !== size || hash(snapshot.bytes) !== sha256) {
        throw new Error(`K15 ${label} final identity rejected`);
    }
    return { manifest, projection, coverage, validation, readiness };
}
