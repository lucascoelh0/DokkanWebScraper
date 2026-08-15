import { createHash } from "crypto";
import { resolve } from "path";
import { Readable } from "stream";
import { createGunzip } from "zlib";
import type { SourcedRow, SqliteScalar } from "../database-experiment/contract";
import type { DatabaseCharacterSkillsDataset } from "./skills-contract";
import { resolveCharacterInputDirectory, resolveCharacterInputFile } from "./artifact-path";
import { CHARACTER_REFRESH_PROFILE } from "./refresh-contract";
import { readPinnedLeaderScopeMember } from "./leader-scope-source";
import type { CharacterLeaderProjectionArtifactSet } from "./leader-projection-contract";
import { CHARACTER_LEADER_PROJECTION_REPEAT_PIN } from "./leader-projection-contract";
import { CHARACTER_LEADER_SCOPE_PIN } from "./leader-scope-contract";
import type {
    CharacterLeaderAssociationK3Identity,
    CharacterLeaderAssociationK3Source,
    CharacterLeaderAssociationK3State,
    CharacterLeaderAssociationK46Identity,
    CharacterLeaderAssociationK46Source,
    CharacterLeaderAssociationRawEffect,
    CharacterLeaderAssociationRawTarget,
} from "./leader-association-scope-contract";

const hash = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
const structuralOrder = (left: string, right: string): number => left.localeCompare(right, undefined, { numeric: true });
const K3_PROFILE = CHARACTER_REFRESH_PROFILE.sidecars.find(item => item.gate === "k3")!;
const C1 = CHARACTER_REFRESH_PROFILE.semanticFiles.find(item => item.fileName === "team-analysis-database-first-sidecar-c1.json.gz")!;
const C2 = CHARACTER_REFRESH_PROFILE.semanticFiles.find(item => item.fileName === "team-analysis-database-first-supported-c2.json.gz")!;

async function gunzipPinned(bytes: Buffer): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let size = 0;
    const stream = Readable.from(bytes).pipe(createGunzip());
    for await (const chunk of stream) {
        const value = chunk as Buffer;
        size += value.length;
        if (size > K3_PROFILE.artifact.uncompressedSizeBytes) {
            stream.destroy();
            throw new Error("K47 K3 decompression exceeded pinned raw size");
        }
        chunks.push(value);
    }
    if (size !== K3_PROFILE.artifact.uncompressedSizeBytes) throw new Error("K47 K3 decompressed size changed");
    return Buffer.concat(chunks, size);
}

function id(value: SqliteScalar | undefined, label: string, nullable: boolean): string | null {
    if (value === null || value === undefined || value === "") {
        if (nullable) return null;
        throw new Error(`K47 missing ${label}`);
    }
    if ((typeof value !== "string" && typeof value !== "number") || (typeof value === "number" && !Number.isFinite(value))) {
        throw new Error(`K47 malformed ${label}`);
    }
    return String(value);
}

export function compactLeaderAssociationRawRows(rawRows: SourcedRow[]): {
    effects: CharacterLeaderAssociationRawEffect[];
    targets: CharacterLeaderAssociationRawTarget[];
} {
    if (!Array.isArray(rawRows)) throw new Error("K47 malformed K3 rawRows");
    const effects: CharacterLeaderAssociationRawEffect[] = [];
    const targets: CharacterLeaderAssociationRawTarget[] = [];
    for (const row of rawRows) {
        const table = row?.provenance?.table;
        if (table !== "leader_skills" && table !== "sub_target_types") continue;
        if (typeof row.provenance.rowId !== "string" || !row.provenance.rowId || !row.values || typeof row.values !== "object") {
            throw new Error("K47 malformed structural raw row");
        }
        if (table === "leader_skills") effects.push({
            rowId: row.provenance.rowId,
            targetSetId: id(row.values.sub_target_type_set_id, "leader target set ID", true),
        });
        else targets.push({
            rowId: row.provenance.rowId,
            targetSetId: id(row.values.sub_target_type_set_id, "target row set ID", false)!,
        });
    }
    if (new Set(effects.map(row => row.rowId)).size !== effects.length) throw new Error("K47 duplicate leader_skills row ID");
    if (new Set(targets.map(row => row.rowId)).size !== targets.length) throw new Error("K47 duplicate sub_target_types row ID");
    return { effects, targets };
}

function compactStates(dataset: DatabaseCharacterSkillsDataset): CharacterLeaderAssociationK3State[] {
    const states = dataset.stateSkills.map((state, index) => {
        if (!state?.leaderSkill || typeof state.stateId !== "string" || typeof state.sourceStateKey !== "string" || typeof state.cardId !== "string"
            || !["initial", "eza", "seza", "unknown"].includes(state.releaseState)) throw new Error(`K47 malformed K3 leader state ${index}`);
        const effectRowIds = state.leaderSkill.effects.map(ref => {
            if (ref.table !== "leader_skills" || typeof ref.rowId !== "string" || !ref.rowId) throw new Error("K47 non-leader effect reference");
            return ref.rowId;
        });
        const flattenedTargetRowIds = state.leaderSkill.targetRows.map(ref => {
            if (ref.table !== "sub_target_types" || typeof ref.rowId !== "string" || !ref.rowId) throw new Error("K47 non-target reference");
            return ref.rowId;
        });
        return {
            stateId: state.stateId, sourceStateKey: state.sourceStateKey, cardId: state.cardId, releaseState: state.releaseState,
            effectRowIds, flattenedTargetRowIds,
        } as CharacterLeaderAssociationK3State;
    }).sort((left, right) => structuralOrder(left.stateId, right.stateId));
    if (new Set(states.map(state => state.stateId)).size !== states.length) throw new Error("K47 duplicate K3 state ID");
    return states;
}

export async function loadPinnedK3LeaderAssociationSource(sidecarRoot: string): Promise<CharacterLeaderAssociationK3Source> {
    if (!sidecarRoot) throw new Error("K47 requires explicit sidecar root");
    const directory = await resolveCharacterInputDirectory(resolve(sidecarRoot), "k3", "k3");
    const [manifestPath, artifactPath, coveragePath, validationPath] = await Promise.all([
        resolveCharacterInputFile(directory, K3_PROFILE.manifest.fileName, K3_PROFILE.manifest.fileName),
        resolveCharacterInputFile(directory, K3_PROFILE.artifact.fileName, K3_PROFILE.artifact.fileName),
        resolveCharacterInputFile(directory, K3_PROFILE.coverage.fileName, K3_PROFILE.coverage.fileName),
        resolveCharacterInputFile(directory, K3_PROFILE.validation.fileName, K3_PROFILE.validation.fileName),
    ]);
    const [manifestBytes, artifactBytes, coverageBytes, validationBytes] = await Promise.all([
        readPinnedLeaderScopeMember(manifestPath, K3_PROFILE.manifest, "K47 manifest"),
        readPinnedLeaderScopeMember(artifactPath, K3_PROFILE.artifact, "K47 artifact"),
        readPinnedLeaderScopeMember(coveragePath, K3_PROFILE.coverage, "K47 coverage"),
        readPinnedLeaderScopeMember(validationPath, K3_PROFILE.validation, "K47 validation"),
    ]);
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
    const coverage = JSON.parse(coverageBytes.toString("utf8"));
    const validation = JSON.parse(validationBytes.toString("utf8"));
    if (manifest.schemaVersion !== 1 || manifest.contractVersion !== K3_PROFILE.contractVersion || manifest.generatedAt !== CHARACTER_REFRESH_PROFILE.generatedAt
        || manifest.fileName !== K3_PROFILE.artifact.fileName || manifest.compression !== "gzip" || manifest.sha256 !== K3_PROFILE.artifact.sha256
        || manifest.sizeBytes !== K3_PROFILE.artifact.sizeBytes || manifest.uncompressedSizeBytes !== K3_PROFILE.artifact.uncompressedSizeBytes
        || manifest.sourceSnapshotVersion !== CHARACTER_REFRESH_PROFILE.snapshotVersion || manifest.sourceDatabaseSha256 !== CHARACTER_REFRESH_PROFILE.sqlite.sha256
        || manifest.sourceDb1ArtifactSha256 !== CHARACTER_REFRESH_PROFILE.db1.sha256 || manifest.sourceC1AuditSha256 !== C1.sha256
        || manifest.sourceC2SupportedSha256 !== C2.sha256 || manifest.coverageFile !== K3_PROFILE.coverage.fileName
        || manifest.coverageSha256 !== K3_PROFILE.coverage.sha256 || manifest.coverageSizeBytes !== K3_PROFILE.coverage.sizeBytes
        || manifest.validationFile !== K3_PROFILE.validation.fileName || manifest.validationSha256 !== K3_PROFILE.validation.sha256
        || manifest.validationSizeBytes !== K3_PROFILE.validation.sizeBytes || coverage.schemaVersion !== 1
        || coverage.stateCount !== 10_654 || coverage.leaderSkillStateCount !== 10_654 || coverage.duplicateStateIdentityCount !== 0
        || validation.schemaVersion !== 1 || validation.valid !== true || !Array.isArray(validation.failures) || validation.failures.length !== 0) {
        throw new Error("K47 K3 pinned contract changed");
    }
    let raw: Buffer | undefined = await gunzipPinned(artifactBytes);
    const uncompressedSha256 = hash(raw);
    const parsed = JSON.parse(raw.toString("utf8")) as DatabaseCharacterSkillsDataset;
    raw = undefined;
    if (parsed.schemaVersion !== 1 || parsed.contract !== "dokkan-database-characters-skills" || parsed.contractVersion !== K3_PROFILE.contractVersion
        || parsed.generatedAt !== CHARACTER_REFRESH_PROFILE.generatedAt || parsed.source?.snapshotVersion !== CHARACTER_REFRESH_PROFILE.snapshotVersion
        || parsed.source.databaseSha256 !== CHARACTER_REFRESH_PROFILE.sqlite.sha256 || parsed.source.db1ArtifactSha256 !== CHARACTER_REFRESH_PROFILE.db1.sha256
        || parsed.source.c1AuditArtifact.sha256 !== C1.sha256 || parsed.source.c2SupportedArtifact.sha256 !== C2.sha256
        || !parsed.policy.rawSkillRowsAreAuditOnly || !parsed.policy.rawRowsNormalizedByTableAndRowId || parsed.policy.textUsedAsIdentity) {
        throw new Error("K47 K3 dataset contract changed");
    }
    const states = compactStates(parsed);
    const rows = compactLeaderAssociationRawRows(parsed.rawRows);
    parsed.rawRows.length = 0; parsed.stateSkills.length = 0; parsed.actionSkills.length = 0; parsed.supportedMechanics.length = 0;
    const baseIdentity = {
        profileId: CHARACTER_REFRESH_PROFILE.profileId,
        snapshotVersion: CHARACTER_REFRESH_PROFILE.snapshotVersion,
        manifest: { sha256: K3_PROFILE.manifest.sha256, sizeBytes: K3_PROFILE.manifest.sizeBytes },
        artifact: {
            sha256: K3_PROFILE.artifact.sha256, sizeBytes: K3_PROFILE.artifact.sizeBytes,
            uncompressedSizeBytes: K3_PROFILE.artifact.uncompressedSizeBytes, uncompressedSha256,
        },
        coverage: { sha256: K3_PROFILE.coverage.sha256, sizeBytes: K3_PROFILE.coverage.sizeBytes },
        validation: { sha256: K3_PROFILE.validation.sha256, sizeBytes: K3_PROFILE.validation.sizeBytes },
    };
    const identity: CharacterLeaderAssociationK3Identity = {
        ...baseIdentity,
        associationInputFingerprintSha256: hash(JSON.stringify({ states, effects: rows.effects, targets: rows.targets })),
    };
    return { identity, states, ...rows };
}

export function compactK46LeaderAssociationSource(artifacts: CharacterLeaderProjectionArtifactSet): CharacterLeaderAssociationK46Source {
    const dataset = artifacts.dataset, refs = artifacts.coverage.leaderReferences;
    if (!dataset.policy.sourceReferenceOrderAndMultiplicityPreserved || dataset.policy.referencesDeduplicated
        || dataset.policy.effectTargetAssociationsSelected || refs.effectReferences !== CHARACTER_LEADER_SCOPE_PIN.effectReferences
        || refs.targetReferences !== CHARACTER_LEADER_SCOPE_PIN.targetReferences
        || refs.repeatedEffectReferences !== CHARACTER_LEADER_PROJECTION_REPEAT_PIN.effectReferences
        || refs.repeatedTargetReferences !== CHARACTER_LEADER_PROJECTION_REPEAT_PIN.targetReferences
        || dataset.states.length !== CHARACTER_LEADER_SCOPE_PIN.includedStates) throw new Error("K47 requires K46 multiplicity policy and pins");
    const states = dataset.states.map(state => {
        if (state.leader.effects.some(ref => ref.table !== "leader_skills") || state.leader.targets.some(ref => ref.table !== "sub_target_types")) {
            throw new Error("K47 K46 reference table changed");
        }
        return {
            stateId: state.stateId, sourceStateKey: state.sourceStateKey, cardId: state.cardId, releaseState: state.releaseState,
            effectRowIds: state.leader.effects.map(ref => ref.rowId), flattenedTargetRowIds: state.leader.targets.map(ref => ref.rowId),
        };
    });
    const identity: CharacterLeaderAssociationK46Identity = {
        manifestSha256: hash(artifacts.manifestBytes), payloadSha256: artifacts.manifest.sha256,
        rawSha256: artifacts.manifest.uncompressedSha256, stateFingerprintSha256: hash(JSON.stringify(states)),
        k43: dataset.source.k43, k3: dataset.source.k3,
    };
    return {
        identity, states,
        policy: { sourceReferenceOrderAndMultiplicityPreserved: true, referencesDeduplicated: false, effectTargetAssociationsSelected: false },
        coverage: {
            states: dataset.states.length, effects: refs.effectReferences, targets: refs.targetReferences,
            repeatedEffects: refs.repeatedEffectReferences, repeatedTargets: refs.repeatedTargetReferences,
        },
    };
}

export function assertLeaderAssociationK3Stable(before: CharacterLeaderAssociationK3Identity, after: CharacterLeaderAssociationK3Identity): void {
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("K47 K3 identity or association fingerprint changed");
}
export function assertLeaderAssociationK46Stable(before: CharacterLeaderAssociationK46Identity, after: CharacterLeaderAssociationK46Identity): void {
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("K47 K46 identity or state fingerprint changed");
}
