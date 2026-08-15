import { constants, Stats } from "fs";
import { createHash } from "crypto";
import { lstat, open, realpath } from "fs/promises";
import { join, resolve } from "path";
import { gunzipSync, gzipSync } from "zlib";
import {
    CHARACTER_LEADER_ASSOCIATION_SCOPE_PIN,
    CharacterLeaderAssociationK3Source,
    CharacterLeaderAssociationK46Source,
    CharacterLeaderAssociationScopeReport,
} from "./leader-association-scope-contract";
import {
    assertLeaderAssociationK3Stable,
    assertLeaderAssociationK46Stable,
    compactK46LeaderAssociationSource,
    loadPinnedK3LeaderAssociationSource,
} from "./leader-association-scope-source";
import { assertPinnedCharacterLeaderAssociationScope, evaluateCharacterLeaderAssociationScope } from "./leader-association-scope";
import { runCharacterLeaderAssociationScopeAudit } from "./leader-association-scope-run";
import type { CharacterLeaderProjectionArtifactSet } from "./leader-projection-contract";
import { validateCharacterLeaderProjectionArtifact } from "./leader-projection";
import { CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS, CHARACTER_LEADER_SCOPE_PIN } from "./leader-scope-contract";
import {
    CHARACTER_LEADER_ASSOCIATION_PROJECTION_CONTRACT_VERSION,
    CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES,
    CHARACTER_LEADER_ASSOCIATION_PROJECTION_GZIP_LIMIT_BYTES,
    CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES,
    CHARACTER_LEADER_ASSOCIATION_PROJECTION_RAW_LIMIT_BYTES,
    CHARACTER_LEADER_ASSOCIATION_PROJECTION_SAMPLE_LIMIT,
    CharacterLeaderAssociationProjectionArtifactSet,
    CharacterLeaderAssociationProjectionCoverage,
    CharacterLeaderAssociationProjectionDataset,
    CharacterLeaderAssociationProjectionEffect,
    CharacterLeaderAssociationProjectionManifest,
    CharacterLeaderAssociationProjectionState,
    CharacterLeaderAssociationProjectionValidation,
} from "./leader-association-projection-contract";

const hash = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
const jsonBytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
const structuralOrder = (left: string, right: string): number => left.localeCompare(right, undefined, { numeric: true });
const exactKeys = (value: object, keys: readonly string[]): boolean => JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const refKey = (ref: { table: string; rowId: string }): string => JSON.stringify([ref.table, ref.rowId]);
function duplicates(values: string[]): number { return values.length - new Set(values).size; }

function assertK47(
    report: CharacterLeaderAssociationScopeReport,
    k46: CharacterLeaderAssociationK46Source,
    k3: CharacterLeaderAssociationK3Source,
): void {
    if (!report || report.contract !== "dokkan-database-character-leader-effect-target-association-scope-audit" || report.contractVersion !== "1.0.0"
        || report.readiness.structuralAssociationScope !== "GO" || report.readiness.nextStructuralIdAssociationProjection !== "GO"
        || report.inputIntegrity.k46SourceBoundBefore !== "GO" || report.inputIntegrity.k46SourceBoundAfter !== "GO"
        || !report.inputIntegrity.k46IdentityAndFingerprintStable || !report.inputIntegrity.k3ExactPinnedBeforeAndAfter
        || !report.inputIntegrity.k3AssociationFingerprintStable || !report.inputIntegrity.k3DecodeBoundedToPinnedRawSize) {
        throw new Error("K48 requires K47 real GO");
    }
    assertPinnedCharacterLeaderAssociationScope(report.scope);
    if (JSON.stringify(report.sources.k46) !== JSON.stringify(k46.identity)
        || JSON.stringify(report.sources.k3) !== JSON.stringify(k3.identity)) throw new Error("K48 K47/source identity mismatch");
}

export function projectCharacterLeaderAssociationRecords(
    k46Artifacts: CharacterLeaderProjectionArtifactSet,
    k3: CharacterLeaderAssociationK3Source,
): { states: CharacterLeaderAssociationProjectionState[]; proof: ReturnType<typeof evaluateCharacterLeaderAssociationScope> } {
    const k46 = compactK46LeaderAssociationSource(k46Artifacts);
    const proof = evaluateCharacterLeaderAssociationScope(k46, k3);
    const effectRows = new Map(k3.effects.map(row => [row.rowId, row]));
    const targetsBySet = new Map<string, Array<{ table: "sub_target_types"; rowId: string }>>();
    for (const target of k3.targets) targetsBySet.set(target.targetSetId, [
        ...(targetsBySet.get(target.targetSetId) ?? []), { table: "sub_target_types", rowId: target.rowId },
    ]);
    const states = k46Artifacts.dataset.states.map(state => ({
        stateId: state.stateId, sourceStateKey: state.sourceStateKey, cardId: state.cardId, releaseState: state.releaseState,
        leader: {
            set: { table: state.leader.set.table, rowId: state.leader.set.rowId },
            effects: state.leader.effects.map(effect => {
                const raw = effectRows.get(effect.rowId);
                if (!raw) throw new Error(`K48 missing leader effect row ${effect.rowId}`);
                const association: CharacterLeaderAssociationProjectionEffect = {
                    effect: { table: "leader_skills", rowId: effect.rowId },
                    targetSetId: raw.targetSetId,
                    targets: raw.targetSetId === null ? [] : (targetsBySet.get(raw.targetSetId) ?? []).map(target => ({ ...target })),
                };
                return association;
            }),
        },
    }));
    return { states, proof };
}

export function buildCharacterLeaderAssociationProjectionCoverage(
    states: CharacterLeaderAssociationProjectionState[],
): CharacterLeaderAssociationProjectionCoverage {
    let effectAssociations = 0, targetReferences = 0, uniqueTargetReferencesWithinState = 0;
    let repeatedTargetReferences = 0, repetitionsFromRepeatedTargetSetExpansion = 0;
    const uniqueSets = new Set<string>();
    for (const state of states) {
        uniqueSets.add(refKey(state.leader.set));
        const flattened: string[] = [], seenSets = new Set<string>();
        for (const association of state.leader.effects) {
            effectAssociations++;
            const targets = association.targets.map(target => target.rowId);
            flattened.push(...targets);
            if (association.targetSetId !== null) {
                if (seenSets.has(association.targetSetId)) repetitionsFromRepeatedTargetSetExpansion += targets.length;
                seenSets.add(association.targetSetId);
            }
        }
        targetReferences += flattened.length;
        const unique = new Set(flattened).size;
        uniqueTargetReferencesWithinState += unique;
        repeatedTargetReferences += flattened.length - unique;
    }
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-association-structural-projection-coverage",
        contractVersion: CHARACTER_LEADER_ASSOCIATION_PROJECTION_CONTRACT_VERSION,
        states: { included: states.length, excluded: CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS.length },
        uniqueLeaderSetRows: uniqueSets.size, effectAssociations, targetReferences, uniqueTargetReferencesWithinState,
        repeatedTargetReferences, repetitionsFromRepeatedTargetSetExpansion,
        missingEffectRows: 0, missingTargetRows: 0, flattenedTargetMismatchStates: 0,
        excludedStateIds: [...CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS], excludedStateIdLimit: CHARACTER_LEADER_ASSOCIATION_PROJECTION_SAMPLE_LIMIT,
    };
}

function assertCoveragePins(coverage: CharacterLeaderAssociationProjectionCoverage): void {
    const association = CHARACTER_LEADER_ASSOCIATION_SCOPE_PIN;
    if (coverage.states.included !== association.states || coverage.states.excluded !== 3
        || coverage.uniqueLeaderSetRows !== CHARACTER_LEADER_SCOPE_PIN.uniqueLeaderSetRows
        || coverage.effectAssociations !== association.effectAssociations || coverage.targetReferences !== association.flattenedTargetReferences
        || coverage.uniqueTargetReferencesWithinState !== association.uniqueTargetReferencesWithinState
        || coverage.repeatedTargetReferences !== association.repeatedFlattenedTargetReferences
        || coverage.repetitionsFromRepeatedTargetSetExpansion !== association.repetitionsFromRepeatedTargetSetExpansion
        || coverage.missingEffectRows !== 0 || coverage.missingTargetRows !== 0 || coverage.flattenedTargetMismatchStates !== 0
        || JSON.stringify(coverage.excludedStateIds) !== JSON.stringify([...CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS])) {
        throw new Error("K48 association projection pins changed");
    }
}

export function buildCharacterLeaderAssociationProjection(
    k46Artifacts: CharacterLeaderProjectionArtifactSet,
    k3: CharacterLeaderAssociationK3Source,
    k47: CharacterLeaderAssociationScopeReport,
): { dataset: CharacterLeaderAssociationProjectionDataset; coverage: CharacterLeaderAssociationProjectionCoverage } {
    const k46 = compactK46LeaderAssociationSource(k46Artifacts);
    assertK47(k47, k46, k3);
    const projected = projectCharacterLeaderAssociationRecords(k46Artifacts, k3);
    assertPinnedCharacterLeaderAssociationScope(projected.proof);
    if (JSON.stringify(projected.proof) !== JSON.stringify(k47.scope)) throw new Error("K48 K47 proof drift");
    const coverage = buildCharacterLeaderAssociationProjectionCoverage(projected.states);
    assertCoveragePins(coverage);
    const dataset: CharacterLeaderAssociationProjectionDataset = {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-association-structural-projection",
        contractVersion: CHARACTER_LEADER_ASSOCIATION_PROJECTION_CONTRACT_VERSION,
        mode: "explicit_opt_in_offline_local_structural_ids_only",
        source: {
            k47: { contractVersion: "1.0.0", structuralAssociationScope: "GO", nextStructuralIdAssociationProjection: "GO" },
            k46: k46.identity, k3: k3.identity,
        },
        policy: {
            structuralIdsOnly: true, sourceOrderAndMultiplicityPreserved: true, redundantFlatTargetsIncluded: false,
            percentTextRawOrValueIncluded: false, semanticAssociationSelected: false, characterArrayIncluded: false,
            consumerImplemented: false, applyOrOverlayImplemented: false, authoritySelected: false, productionModified: false,
            publisherImplemented: false, networkEnabled: false, r2Enabled: false, androidImplemented: false,
        },
        states: projected.states,
    };
    return { dataset, coverage };
}

function unstable(values: string[]): number {
    const sorted = [...values].sort(structuralOrder);
    return values.reduce((count, value, index) => count + (value === sorted[index] ? 0 : 1), 0);
}
function validRef(ref: any, table?: string): boolean {
    return !!ref && exactKeys(ref, ["table", "rowId"]) && typeof ref.table === "string" && !!ref.table
        && typeof ref.rowId === "string" && !!ref.rowId && (!table || ref.table === table);
}
function validHash(value: unknown): boolean { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value); }
function validPinnedFile(value: any, artifact = false): boolean {
    const keys = artifact ? ["sha256", "sizeBytes", "uncompressedSizeBytes", "uncompressedSha256"] : ["sha256", "sizeBytes"];
    return !!value && exactKeys(value, keys) && validHash(value.sha256) && Number.isSafeInteger(value.sizeBytes) && value.sizeBytes >= 0
        && (!artifact || (Number.isSafeInteger(value.uncompressedSizeBytes) && value.uncompressedSizeBytes >= 0 && validHash(value.uncompressedSha256)));
}
function validK3AssociationIdentity(value: any): boolean {
    return !!value && exactKeys(value, ["profileId", "snapshotVersion", "manifest", "artifact", "coverage", "validation", "associationInputFingerprintSha256"])
        && typeof value.profileId === "string" && !!value.profileId && typeof value.snapshotVersion === "string" && !!value.snapshotVersion
        && validPinnedFile(value.manifest) && validPinnedFile(value.artifact, true) && validPinnedFile(value.coverage)
        && validPinnedFile(value.validation) && validHash(value.associationInputFingerprintSha256);
}
function validK46Identity(value: any): boolean {
    if (!value || !exactKeys(value, ["manifestSha256", "payloadSha256", "rawSha256", "stateFingerprintSha256", "k43", "k3"])
        || !validHash(value.manifestSha256) || !validHash(value.payloadSha256) || !validHash(value.rawSha256) || !validHash(value.stateFingerprintSha256)
        || !value.k43 || !exactKeys(value.k43, ["manifestSha256", "payloadSha256", "rawSha256", "k42SourceFingerprintSha256", "stateFingerprintSha256"])
        || !Object.values(value.k43).every(validHash) || !value.k3
        || !exactKeys(value.k3, ["profileId", "snapshotVersion", "manifest", "artifact", "coverage", "validation", "compactFingerprintSha256"])) return false;
    return typeof value.k3.profileId === "string" && !!value.k3.profileId && typeof value.k3.snapshotVersion === "string" && !!value.k3.snapshotVersion
        && validPinnedFile(value.k3.manifest) && validPinnedFile(value.k3.artifact, true) && validPinnedFile(value.k3.coverage)
        && validPinnedFile(value.k3.validation) && validHash(value.k3.compactFingerprintSha256);
}

export function validateCharacterLeaderAssociationProjection(
    dataset: CharacterLeaderAssociationProjectionDataset,
    coverage: CharacterLeaderAssociationProjectionCoverage,
    sizes: { rawSizeBytes: number; gzipSizeBytes: number; metadataSizeBytes: number },
): CharacterLeaderAssociationProjectionValidation {
    const failures: string[] = [];
    if (!dataset || !exactKeys(dataset, ["schemaVersion", "contract", "contractVersion", "mode", "source", "policy", "states"])
        || dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-database-character-leader-association-structural-projection"
        || dataset.contractVersion !== CHARACTER_LEADER_ASSOCIATION_PROJECTION_CONTRACT_VERSION
        || dataset.mode !== "explicit_opt_in_offline_local_structural_ids_only") failures.push("dataset contract rejected");
    const source: any = dataset?.source;
    if (!source || !exactKeys(source, ["k47", "k46", "k3"]) || !source.k47
        || !exactKeys(source.k47, ["contractVersion", "structuralAssociationScope", "nextStructuralIdAssociationProjection"])
        || source.k47.contractVersion !== "1.0.0" || source.k47.structuralAssociationScope !== "GO"
        || source.k47.nextStructuralIdAssociationProjection !== "GO" || !validK46Identity(source.k46)
        || !validK3AssociationIdentity(source.k3)) failures.push("source lineage rejected");
    else {
        const { compactFingerprintSha256: _scopeFingerprint, ...k46K3 } = source.k46.k3;
        const { associationInputFingerprintSha256: _associationFingerprint, ...associationK3 } = source.k3;
        if (JSON.stringify(k46K3) !== JSON.stringify(associationK3)) failures.push("source lineage rejected");
    }
    const policy: any = dataset?.policy;
    const policyKeys = ["structuralIdsOnly", "sourceOrderAndMultiplicityPreserved", "redundantFlatTargetsIncluded", "percentTextRawOrValueIncluded", "semanticAssociationSelected", "characterArrayIncluded", "consumerImplemented", "applyOrOverlayImplemented", "authoritySelected", "productionModified", "publisherImplemented", "networkEnabled", "r2Enabled", "androidImplemented"];
    if (!policy || !exactKeys(policy, policyKeys) || !policy.structuralIdsOnly || !policy.sourceOrderAndMultiplicityPreserved
        || Object.entries(policy).some(([key, value]) => !["structuralIdsOnly", "sourceOrderAndMultiplicityPreserved"].includes(key) && value !== false)) failures.push("dataset policy rejected");
    const stateIds = Array.isArray(dataset?.states) ? dataset.states.map(state => state?.stateId) : [];
    const duplicateStateIdCount = duplicates(stateIds), unstableStateOrderCount = unstable(stateIds);
    let repeatedEffectReferenceCount = 0, extraOrPresentationFieldCount = 0, redundantFlatTargetFieldCount = 0;
    let nullTargetSetWithTargetsCount = 0, percentTextRawOrValueFieldCount = 0;
    if (!Array.isArray(dataset?.states)) failures.push("states rejected");
    else for (const state of dataset.states as any[]) {
        if (!state || !exactKeys(state, ["stateId", "sourceStateKey", "cardId", "releaseState", "leader"])
            || typeof state.stateId !== "string" || !state.stateId || typeof state.sourceStateKey !== "string" || !state.sourceStateKey
            || typeof state.cardId !== "string" || !state.cardId || !["initial", "eza", "seza"].includes(state.releaseState)) extraOrPresentationFieldCount++;
        if (!state?.leader) { extraOrPresentationFieldCount++; continue; }
        if (Object.prototype.hasOwnProperty.call(state.leader, "targets")) redundantFlatTargetFieldCount++;
        if (!exactKeys(state.leader, ["set", "effects"]) || !validRef(state.leader.set) || !Array.isArray(state.leader.effects)) {
            extraOrPresentationFieldCount++;
            if (!Array.isArray(state.leader.effects)) continue;
        }
        const effectIds: string[] = [];
        for (const association of state.leader.effects) {
            if (!association) { extraOrPresentationFieldCount++; continue; }
            if (!exactKeys(association, ["effect", "targetSetId", "targets"])) extraOrPresentationFieldCount++;
            if (!validRef(association.effect, "leader_skills")
                || !(association.targetSetId === null || (typeof association.targetSetId === "string" && !!association.targetSetId))
                || !Array.isArray(association.targets) || !association.targets.every((target: any) => validRef(target, "sub_target_types"))) {
                extraOrPresentationFieldCount++; continue;
            }
            if (association.targetSetId === null && association.targets.length !== 0) nullTargetSetWithTargetsCount++;
            effectIds.push(association.effect.rowId);
            for (const forbidden of ["structuredPercentValues", "rawRows", "target_value", "name", "text", "value"]) {
                if (Object.prototype.hasOwnProperty.call(association, forbidden)) percentTextRawOrValueFieldCount++;
            }
        }
        repeatedEffectReferenceCount += duplicates(effectIds);
    }
    if (duplicateStateIdCount) failures.push("duplicate state identity");
    if (repeatedEffectReferenceCount) failures.push("repeated effect reference");
    if (unstableStateOrderCount) failures.push("unstable state order");
    if (extraOrPresentationFieldCount) failures.push("extra or presentation field included");
    if (redundantFlatTargetFieldCount) failures.push("redundant flat target field included");
    if (nullTargetSetWithTargetsCount) failures.push("null target set with targets");
    if (percentTextRawOrValueFieldCount) failures.push("percent text raw or value field included");
    const expectedCoverage = buildCharacterLeaderAssociationProjectionCoverage(Array.isArray(dataset?.states) ? dataset.states : []);
    if (JSON.stringify(coverage) !== JSON.stringify(expectedCoverage)) failures.push("coverage mismatch");
    try { assertCoveragePins(coverage); } catch { failures.push("production pins changed"); }
    if (sizes.rawSizeBytes >= CHARACTER_LEADER_ASSOCIATION_PROJECTION_RAW_LIMIT_BYTES) failures.push("raw byte budget reached");
    if (sizes.gzipSizeBytes >= CHARACTER_LEADER_ASSOCIATION_PROJECTION_GZIP_LIMIT_BYTES) failures.push("gzip byte budget reached");
    if (sizes.metadataSizeBytes >= CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES) failures.push("metadata byte budget reached");
    const uniqueFailures = [...new Set(failures)].sort();
    return {
        schemaVersion: 1, contract: "dokkan-database-character-leader-association-structural-projection-validation",
        contractVersion: CHARACTER_LEADER_ASSOCIATION_PROJECTION_CONTRACT_VERSION, valid: uniqueFailures.length === 0,
        failures: uniqueFailures.slice(0, CHARACTER_LEADER_ASSOCIATION_PROJECTION_SAMPLE_LIMIT),
        failuresTruncated: uniqueFailures.length > CHARACTER_LEADER_ASSOCIATION_PROJECTION_SAMPLE_LIMIT,
        sizes: {
            rawMaximumBytesExclusive: CHARACTER_LEADER_ASSOCIATION_PROJECTION_RAW_LIMIT_BYTES,
            gzipMaximumBytesExclusive: CHARACTER_LEADER_ASSOCIATION_PROJECTION_GZIP_LIMIT_BYTES,
            metadataMaximumBytesExclusive: CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES, ...sizes,
        },
        safety: {
            duplicateStateIdCount, repeatedEffectReferenceCount, unstableStateOrderCount, extraOrPresentationFieldCount,
            redundantFlatTargetFieldCount, nullTargetSetWithTargetsCount, percentTextRawOrValueFieldCount,
            characterArrayRecordCount: 0, networkRequestCount: 0,
            automaticCleanupAttempted: false, outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
        },
        readiness: {
            offlineGeneration: "GO", sourceBoundValidation: "NOT_EXECUTED", semanticAssociation: "NO-GO",
            leaderClauseSemantics: "NO-GO", presentation: "NO-GO", productReplacement: "NO-GO",
            consumer: "NO-GO", applyOrOverlay: "NO-GO", authority: "NO-GO", production: "NO-GO", publisher: "NO-GO",
            network: "NO-GO", r2: "NO-GO", android: "NO-GO",
        },
    };
}

export function materializeCharacterLeaderAssociationProjection(
    dataset: CharacterLeaderAssociationProjectionDataset,
    coverage: CharacterLeaderAssociationProjectionCoverage,
): CharacterLeaderAssociationProjectionArtifactSet {
    const raw = jsonBytes(dataset), gzip = gzipSync(raw, { level: 9 }), coverageBytes = jsonBytes(coverage), payloadSha256 = hash(gzip);
    let metadataSizeBytes = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
        const validation = validateCharacterLeaderAssociationProjection(dataset, coverage, { rawSizeBytes: raw.length, gzipSizeBytes: gzip.length, metadataSizeBytes });
        if (!validation.valid) throw new Error(`K48 projection validation failed: ${validation.failures.join("; ")}`);
        const validationBytes = jsonBytes(validation);
        const manifest: CharacterLeaderAssociationProjectionManifest = {
            schemaVersion: 1, contract: "dokkan-database-character-leader-association-structural-projection-manifest",
            contractVersion: CHARACTER_LEADER_ASSOCIATION_PROJECTION_CONTRACT_VERSION,
            fileName: `database-characters-k48-leader-association-projection.${payloadSha256}.json.gz`, compression: "gzip",
            sha256: payloadSha256, sizeBytes: gzip.length, uncompressedSha256: hash(raw), uncompressedSizeBytes: raw.length,
            counts: {
                states: coverage.states.included, effectAssociations: coverage.effectAssociations,
                targetReferences: coverage.targetReferences, repeatedTargetReferences: coverage.repeatedTargetReferences,
            },
            source: dataset.source, coverageFile: CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.coverage,
            coverageSha256: hash(coverageBytes), coverageSizeBytes: coverageBytes.length,
            validationFile: CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.validation,
            validationSha256: hash(validationBytes), validationSizeBytes: validationBytes.length,
        };
        const manifestBytes = jsonBytes(manifest), actualMetadataSizeBytes = coverageBytes.length + validationBytes.length + manifestBytes.length;
        if (actualMetadataSizeBytes >= CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES) throw new Error(`K48 metadata byte budget reached: ${actualMetadataSizeBytes}`);
        if (actualMetadataSizeBytes === metadataSizeBytes) return { dataset, coverage, validation, manifest, raw, gzip, coverageBytes, validationBytes, manifestBytes };
        metadataSizeBytes = actualMetadataSizeBytes;
    }
    throw new Error("K48 metadata size did not converge");
}

function samePath(left: string, right: string): boolean {
    return process.platform === "win32" ? resolve(left).toLowerCase() === resolve(right).toLowerCase() : resolve(left) === resolve(right);
}
function sameFile(left: Stats, right: Stats): boolean { return left.dev === right.dev && left.ino === right.ino; }
async function regularRoot(value: string): Promise<string> {
    const root = resolve(value), before = await lstat(root);
    if (!before.isDirectory() || before.isSymbolicLink()) throw new Error("K48 artifact root must be an existing regular non-link directory");
    const canonical = await realpath(root);
    if (!samePath(root, canonical)) throw new Error("K48 artifact root symlink or junction rejected");
    return canonical;
}
export async function readBoundedCharacterLeaderAssociationProjectionMember(
    rootValue: string, fileName: string, maximumBytesExclusive: number, expectedSizeBytes?: number,
): Promise<Buffer> {
    const root = await regularRoot(rootValue);
    if (!/^[a-z0-9][a-z0-9.-]+$/.test(fileName) || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) throw new Error("K48 artifact member name rejected");
    const path = join(root, fileName);
    if (!samePath(path, resolve(root, fileName))) throw new Error("K48 artifact member escaped root");
    const before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || !Number.isSafeInteger(maximumBytesExclusive)
        || maximumBytesExclusive <= 0 || !Number.isSafeInteger(before.size) || before.size < 0 || before.size >= maximumBytesExclusive
        || (expectedSizeBytes !== undefined && before.size !== expectedSizeBytes)) throw new Error("K48 artifact member byte budget or identity rejected");
    const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (!sameFile(before, opened) || !opened.isFile() || opened.nlink !== 1 || opened.size !== before.size) throw new Error("K48 artifact member identity changed while opening");
        const bytes = Buffer.alloc(opened.size);
        let offset = 0;
        while (offset < bytes.length) {
            const read = await handle.read(bytes, offset, bytes.length - offset, offset);
            if (read.bytesRead <= 0) throw new Error("K48 artifact member ended before exact size");
            offset += read.bytesRead;
        }
        if ((await handle.read(Buffer.allocUnsafe(1), 0, 1, offset)).bytesRead !== 0) throw new Error("K48 artifact member exceeded exact size");
        const after = await handle.stat(), visible = await lstat(path);
        if (!sameFile(opened, after) || !sameFile(opened, visible) || after.nlink !== 1 || visible.nlink !== 1
            || visible.isSymbolicLink() || after.size !== opened.size || visible.size !== opened.size) throw new Error("K48 artifact member changed while reading");
        return bytes;
    } finally { await handle.close(); }
}

async function readArtifactSet(root: string): Promise<CharacterLeaderAssociationProjectionArtifactSet> {
    const manifestBytes = await readBoundedCharacterLeaderAssociationProjectionMember(root, CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.manifest, CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES);
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as CharacterLeaderAssociationProjectionManifest;
    if (!/^database-characters-k48-leader-association-projection\.[a-f0-9]{64}\.json\.gz$/.test(manifest.fileName)
        || manifest.fileName.split(".")[1] !== manifest.sha256 || manifest.coverageFile !== CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.coverage
        || manifest.validationFile !== CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.validation
        || !Number.isSafeInteger(manifest.sizeBytes) || manifest.sizeBytes < 0 || manifest.sizeBytes >= CHARACTER_LEADER_ASSOCIATION_PROJECTION_GZIP_LIMIT_BYTES
        || !Number.isSafeInteger(manifest.coverageSizeBytes) || manifest.coverageSizeBytes < 0 || manifest.coverageSizeBytes >= CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES
        || !Number.isSafeInteger(manifest.validationSizeBytes) || manifest.validationSizeBytes < 0 || manifest.validationSizeBytes >= CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES
        || manifestBytes.length + manifest.coverageSizeBytes + manifest.validationSizeBytes >= CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES) throw new Error("K48 manifest identity or budget rejected");
    const [gzip, coverageBytes, validationBytes] = await Promise.all([
        readBoundedCharacterLeaderAssociationProjectionMember(root, manifest.fileName, CHARACTER_LEADER_ASSOCIATION_PROJECTION_GZIP_LIMIT_BYTES, manifest.sizeBytes),
        readBoundedCharacterLeaderAssociationProjectionMember(root, manifest.coverageFile, CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES, manifest.coverageSizeBytes),
        readBoundedCharacterLeaderAssociationProjectionMember(root, manifest.validationFile, CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES, manifest.validationSizeBytes),
    ]);
    if (hash(gzip) !== manifest.sha256 || hash(coverageBytes) !== manifest.coverageSha256 || hash(validationBytes) !== manifest.validationSha256) throw new Error("K48 artifact hash rejected");
    const raw = gunzipSync(gzip, { maxOutputLength: CHARACTER_LEADER_ASSOCIATION_PROJECTION_RAW_LIMIT_BYTES });
    if (raw.length !== manifest.uncompressedSizeBytes || raw.length >= CHARACTER_LEADER_ASSOCIATION_PROJECTION_RAW_LIMIT_BYTES
        || hash(raw) !== manifest.uncompressedSha256) throw new Error("K48 raw artifact identity rejected");
    const dataset = JSON.parse(raw.toString("utf8")) as CharacterLeaderAssociationProjectionDataset;
    const coverage = JSON.parse(coverageBytes.toString("utf8")) as CharacterLeaderAssociationProjectionCoverage;
    const validation = JSON.parse(validationBytes.toString("utf8")) as CharacterLeaderAssociationProjectionValidation;
    if (!raw.equals(jsonBytes(dataset)) || !gzip.equals(gzipSync(raw, { level: 9 }))) throw new Error("K48 canonical payload rejected");
    const rebuilt = materializeCharacterLeaderAssociationProjection(dataset, coverage);
    if (!rebuilt.raw.equals(raw) || !rebuilt.gzip.equals(gzip) || !rebuilt.coverageBytes.equals(coverageBytes)
        || !rebuilt.validationBytes.equals(validationBytes) || !rebuilt.manifestBytes.equals(manifestBytes)
        || JSON.stringify(validation) !== JSON.stringify(rebuilt.validation)) throw new Error("K48 artifact reconstruction rejected");
    return rebuilt;
}

export interface CharacterLeaderAssociationProjectionSourceOptions { sidecarRoot: string; productionRoot: string; fyiRoot: string; k43Root: string; k46Root: string }
export async function validateCharacterLeaderAssociationProjectionArtifact(
    options: CharacterLeaderAssociationProjectionSourceOptions & { artifactRoot: string },
): Promise<{ artifacts: CharacterLeaderAssociationProjectionArtifactSet; sourceBoundValidation: "GO" }> {
    const runOptions = { optIn: true as const, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot, k43Root: options.k43Root, k46Root: options.k46Root };
    const k47 = await runCharacterLeaderAssociationScopeAudit(runOptions);
    if (global.gc) global.gc();
    let validatedK46 = await validateCharacterLeaderProjectionArtifact({ artifactRoot: options.k46Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot, k43Root: options.k43Root });
    const k46Identity = compactK46LeaderAssociationSource(validatedK46.artifacts).identity;
    let k3 = await loadPinnedK3LeaderAssociationSource(options.sidecarRoot);
    const k3Identity = k3.identity;
    const built = buildCharacterLeaderAssociationProjection(validatedK46.artifacts, k3, k47);
    let expected: CharacterLeaderAssociationProjectionArtifactSet | undefined = materializeCharacterLeaderAssociationProjection(built.dataset, built.coverage);
    validatedK46 = undefined as any; k3 = undefined as any; if (global.gc) global.gc();
    let actual: CharacterLeaderAssociationProjectionArtifactSet | undefined = await readArtifactSet(options.artifactRoot);
    for (const [label, actualBytes, expectedBytes] of [
        ["payload", actual.gzip, expected.gzip], ["coverage", actual.coverageBytes, expected.coverageBytes],
        ["validation", actual.validationBytes, expected.validationBytes], ["manifest", actual.manifestBytes, expected.manifestBytes],
    ] as Array<[string, Buffer, Buffer]>) if (!actualBytes.equals(expectedBytes)) throw new Error(`K48 source-bound artifact mismatch: ${label}`);
    const reread = await readArtifactSet(options.artifactRoot);
    if (!actual.gzip.equals(reread.gzip) || !actual.coverageBytes.equals(reread.coverageBytes)
        || !actual.validationBytes.equals(reread.validationBytes) || !actual.manifestBytes.equals(reread.manifestBytes)) throw new Error("K48 artifact changed during source-bound validation");
    actual = undefined; expected = undefined; if (global.gc) global.gc();

    let finalK46 = await validateCharacterLeaderProjectionArtifact({ artifactRoot: options.k46Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot, k43Root: options.k43Root });
    assertLeaderAssociationK46Stable(k46Identity, compactK46LeaderAssociationSource(finalK46.artifacts).identity);
    finalK46 = undefined as any;
    let finalK3 = await loadPinnedK3LeaderAssociationSource(options.sidecarRoot);
    assertLeaderAssociationK3Stable(k3Identity, finalK3.identity);
    finalK3 = undefined as any; if (global.gc) global.gc();
    const finalK47 = await runCharacterLeaderAssociationScopeAudit(runOptions);
    if (JSON.stringify(k47) !== JSON.stringify(finalK47)) throw new Error("K48 K47 proof or source fingerprint changed after artifact reread");
    return { artifacts: reread, sourceBoundValidation: "GO" };
}
