import { createHash } from "crypto";
import { resolve } from "path";
import { Readable } from "stream";
import { createGunzip } from "zlib";
import type { SourcedRow, SqliteScalar } from "../database-experiment/contract";
import type { DatabaseCharacterSkillsDataset } from "./skills-contract";
import { resolveCharacterInputDirectory, resolveCharacterInputFile } from "./artifact-path";
import { CHARACTER_REFRESH_PROFILE } from "./refresh-contract";
import { readPinnedLeaderScopeMember } from "./leader-scope-source";
import { compactLeaderAssociationRawRows } from "./leader-association-scope-source";
import type { CharacterLeaderAssociationProjectionArtifactSet } from "./leader-association-projection-contract";
import { CHARACTER_LEADER_ASSOCIATION_SCOPE_PIN } from "./leader-association-scope-contract";
import type {
    CharacterLeaderValueK3Identity,
    CharacterLeaderValueK3Source,
    CharacterLeaderValueK48Identity,
    CharacterLeaderValueK48Source,
    CharacterLeaderValueRawEffect,
} from "./leader-value-scope-contract";

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
        if (size > K3_PROFILE.artifact.uncompressedSizeBytes) { stream.destroy(); throw new Error("K49 K3 decompression exceeded pinned raw size"); }
        chunks.push(value);
    }
    if (size !== K3_PROFILE.artifact.uncompressedSizeBytes) throw new Error("K49 K3 decompressed size changed");
    return Buffer.concat(chunks, size);
}
function id(value: SqliteScalar | undefined, label: string, nullable = false): string | null {
    if (value === null || value === undefined || value === "") {
        if (nullable) return null;
        throw new Error(`K49 missing ${label}`);
    }
    if ((typeof value !== "string" && typeof value !== "number") || (typeof value === "number" && !Number.isFinite(value))) throw new Error(`K49 malformed ${label}`);
    return String(value);
}
function integer(value: SqliteScalar | undefined, label: string): number {
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    if (!Number.isSafeInteger(parsed)) throw new Error(`K49 malformed ${label}`);
    return parsed;
}
function numericVector(value: SqliteScalar | undefined): number[] | null {
    if (typeof value !== "string") return null;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) && parsed.every(item => typeof item === "number" && Number.isFinite(item)) ? [...parsed] : null;
    } catch { return null; }
}
function descriptionCorrelates(description: string | undefined, value: number | undefined): boolean {
    if (description === undefined || value === undefined || !Number.isFinite(value)) return false;
    const normalized = description.normalize("NFKC").replace(/\s+/g, " ").toUpperCase();
    const commonStats = normalized.matchAll(/\bHP\s*,\s*ATK\s*(?:&|AND)\s*DEF\s*\+\s*(-?\d+(?:\.\d+)?)\s*%/g);
    return [...commonStats].some(match => Number(match[1]) === value);
}

export function compactLeaderValueRawRows(rawRows: SourcedRow[]): CharacterLeaderValueRawEffect[] {
    if (!Array.isArray(rawRows)) throw new Error("K49 malformed K3 rawRows");
    const descriptions = new Map<string, string>();
    for (const row of rawRows) if (row?.provenance?.table === "leader_skill_sets") {
        if (typeof row.provenance.rowId !== "string" || !row.provenance.rowId || !row.values || typeof row.values !== "object") throw new Error("K49 malformed leader set row");
        if (typeof row.values.description === "string") descriptions.set(row.provenance.rowId, row.values.description);
    }
    const effects: CharacterLeaderValueRawEffect[] = [];
    for (const row of rawRows) if (row?.provenance?.table === "leader_skills") {
        if (typeof row.provenance.rowId !== "string" || !row.provenance.rowId || !row.values || typeof row.values !== "object") throw new Error("K49 malformed leader effect row");
        const leaderSkillSetId = id(row.values.leader_skill_set_id, "leader skill set ID")!;
        const efficacyVector = numericVector(row.values.efficacy_values);
        const causality = row.values.causality_conditions;
        if (!(causality === null || typeof causality === "string")) throw new Error("K49 malformed causality_conditions");
        const causalityShapeSha256 = causality === null ? null : hash(causality as string);
        effects.push({
            rowId: row.provenance.rowId,
            leaderSkillSetId,
            efficacyType: integer(row.values.efficacy_type, "efficacy_type"),
            efficacyVector,
            calcOption: integer(row.values.calc_option, "calc_option"),
            targetType: integer(row.values.target_type, "target_type"),
            subTargetTypeSetId: id(row.values.sub_target_type_set_id, "sub target type set ID", true),
            causalitySerializedShapeSha256: causalityShapeSha256,
            execTimingType: integer(row.values.exec_timing_type, "exec_timing_type"),
            descriptionCorrelatedToVectorPosition1: descriptionCorrelates(descriptions.get(leaderSkillSetId), efficacyVector?.[1]),
        });
    }
    if (new Set(effects.map(row => row.rowId)).size !== effects.length) throw new Error("K49 duplicate leader effect row ID");
    return effects;
}

function compactAssociationStates(dataset: DatabaseCharacterSkillsDataset) {
    return dataset.stateSkills.map((state, index) => {
        if (!state?.leaderSkill || typeof state.stateId !== "string" || typeof state.sourceStateKey !== "string" || typeof state.cardId !== "string"
            || !["initial", "eza", "seza", "unknown"].includes(state.releaseState)) throw new Error(`K49 malformed K3 state ${index}`);
        return {
            stateId: state.stateId, sourceStateKey: state.sourceStateKey, cardId: state.cardId, releaseState: state.releaseState,
            effectRowIds: state.leaderSkill.effects.map(ref => {
                if (ref.table !== "leader_skills") throw new Error("K49 malformed effect ref table"); return ref.rowId;
            }),
            flattenedTargetRowIds: state.leaderSkill.targetRows.map(ref => {
                if (ref.table !== "sub_target_types") throw new Error("K49 malformed target ref table"); return ref.rowId;
            }),
        };
    }).sort((left, right) => structuralOrder(left.stateId, right.stateId));
}

export async function loadPinnedK3LeaderValueSource(sidecarRoot: string): Promise<CharacterLeaderValueK3Source> {
    if (!sidecarRoot) throw new Error("K49 requires explicit sidecar root");
    const directory = await resolveCharacterInputDirectory(resolve(sidecarRoot), "k3", "k3");
    const [manifestPath, artifactPath, coveragePath, validationPath] = await Promise.all([
        resolveCharacterInputFile(directory, K3_PROFILE.manifest.fileName, K3_PROFILE.manifest.fileName),
        resolveCharacterInputFile(directory, K3_PROFILE.artifact.fileName, K3_PROFILE.artifact.fileName),
        resolveCharacterInputFile(directory, K3_PROFILE.coverage.fileName, K3_PROFILE.coverage.fileName),
        resolveCharacterInputFile(directory, K3_PROFILE.validation.fileName, K3_PROFILE.validation.fileName),
    ]);
    const [manifestBytes, artifactBytes, coverageBytes, validationBytes] = await Promise.all([
        readPinnedLeaderScopeMember(manifestPath, K3_PROFILE.manifest, "K49 manifest"),
        readPinnedLeaderScopeMember(artifactPath, K3_PROFILE.artifact, "K49 artifact"),
        readPinnedLeaderScopeMember(coveragePath, K3_PROFILE.coverage, "K49 coverage"),
        readPinnedLeaderScopeMember(validationPath, K3_PROFILE.validation, "K49 validation"),
    ]);
    const manifest = JSON.parse(manifestBytes.toString("utf8")), coverage = JSON.parse(coverageBytes.toString("utf8")), validation = JSON.parse(validationBytes.toString("utf8"));
    if (manifest.schemaVersion !== 1 || manifest.contractVersion !== K3_PROFILE.contractVersion || manifest.generatedAt !== CHARACTER_REFRESH_PROFILE.generatedAt
        || manifest.fileName !== K3_PROFILE.artifact.fileName || manifest.compression !== "gzip" || manifest.sha256 !== K3_PROFILE.artifact.sha256
        || manifest.sizeBytes !== K3_PROFILE.artifact.sizeBytes || manifest.uncompressedSizeBytes !== K3_PROFILE.artifact.uncompressedSizeBytes
        || manifest.sourceSnapshotVersion !== CHARACTER_REFRESH_PROFILE.snapshotVersion || manifest.sourceDatabaseSha256 !== CHARACTER_REFRESH_PROFILE.sqlite.sha256
        || manifest.sourceDb1ArtifactSha256 !== CHARACTER_REFRESH_PROFILE.db1.sha256 || manifest.sourceC1AuditSha256 !== C1.sha256
        || manifest.sourceC2SupportedSha256 !== C2.sha256 || manifest.coverageFile !== K3_PROFILE.coverage.fileName
        || manifest.coverageSha256 !== K3_PROFILE.coverage.sha256 || manifest.coverageSizeBytes !== K3_PROFILE.coverage.sizeBytes
        || manifest.validationFile !== K3_PROFILE.validation.fileName || manifest.validationSha256 !== K3_PROFILE.validation.sha256
        || manifest.validationSizeBytes !== K3_PROFILE.validation.sizeBytes || coverage.schemaVersion !== 1 || coverage.stateCount !== 10_654
        || coverage.leaderSkillStateCount !== 10_654 || coverage.duplicateStateIdentityCount !== 0
        || validation.schemaVersion !== 1 || validation.valid !== true || !Array.isArray(validation.failures) || validation.failures.length !== 0) throw new Error("K49 K3 pinned contract changed");
    let raw: Buffer | undefined = await gunzipPinned(artifactBytes);
    const uncompressedSha256 = hash(raw);
    const parsed = JSON.parse(raw.toString("utf8")) as DatabaseCharacterSkillsDataset;
    raw = undefined;
    if (parsed.schemaVersion !== 1 || parsed.contract !== "dokkan-database-characters-skills" || parsed.contractVersion !== K3_PROFILE.contractVersion
        || parsed.generatedAt !== CHARACTER_REFRESH_PROFILE.generatedAt || parsed.source?.snapshotVersion !== CHARACTER_REFRESH_PROFILE.snapshotVersion
        || parsed.source.databaseSha256 !== CHARACTER_REFRESH_PROFILE.sqlite.sha256 || parsed.source.db1ArtifactSha256 !== CHARACTER_REFRESH_PROFILE.db1.sha256
        || parsed.source.c1AuditArtifact.sha256 !== C1.sha256 || parsed.source.c2SupportedArtifact.sha256 !== C2.sha256
        || !parsed.policy.rawSkillRowsAreAuditOnly || !parsed.policy.rawRowsNormalizedByTableAndRowId || parsed.policy.textUsedAsIdentity) throw new Error("K49 K3 dataset contract changed");
    const effects = compactLeaderValueRawRows(parsed.rawRows);
    const associationRows = compactLeaderAssociationRawRows(parsed.rawRows), associationStates = compactAssociationStates(parsed);
    const identity: CharacterLeaderValueK3Identity = {
        profileId: CHARACTER_REFRESH_PROFILE.profileId, snapshotVersion: CHARACTER_REFRESH_PROFILE.snapshotVersion,
        manifest: { sha256: K3_PROFILE.manifest.sha256, sizeBytes: K3_PROFILE.manifest.sizeBytes },
        artifact: { sha256: K3_PROFILE.artifact.sha256, sizeBytes: K3_PROFILE.artifact.sizeBytes, uncompressedSizeBytes: K3_PROFILE.artifact.uncompressedSizeBytes, uncompressedSha256 },
        coverage: { sha256: K3_PROFILE.coverage.sha256, sizeBytes: K3_PROFILE.coverage.sizeBytes },
        validation: { sha256: K3_PROFILE.validation.sha256, sizeBytes: K3_PROFILE.validation.sizeBytes },
        associationInputFingerprintSha256: hash(JSON.stringify({ states: associationStates, effects: associationRows.effects, targets: associationRows.targets })),
        valueInputFingerprintSha256: hash(JSON.stringify(effects)),
    };
    parsed.rawRows.length = 0; parsed.stateSkills.length = 0; parsed.actionSkills.length = 0; parsed.supportedMechanics.length = 0;
    return { identity, effects };
}

export function compactK48LeaderValueSource(artifacts: CharacterLeaderAssociationProjectionArtifactSet): CharacterLeaderValueK48Source {
    const dataset = artifacts.dataset, coverage = artifacts.coverage;
    if (!dataset.policy.structuralIdsOnly || !dataset.policy.sourceOrderAndMultiplicityPreserved || dataset.policy.semanticAssociationSelected
        || coverage.states.included !== CHARACTER_LEADER_ASSOCIATION_SCOPE_PIN.states
        || coverage.effectAssociations !== CHARACTER_LEADER_ASSOCIATION_SCOPE_PIN.effectAssociations
        || coverage.targetReferences !== CHARACTER_LEADER_ASSOCIATION_SCOPE_PIN.flattenedTargetReferences
        || coverage.repeatedTargetReferences !== CHARACTER_LEADER_ASSOCIATION_SCOPE_PIN.repeatedFlattenedTargetReferences
        || coverage.missingEffectRows !== 0 || coverage.missingTargetRows !== 0 || coverage.flattenedTargetMismatchStates !== 0) throw new Error("K49 requires K48 structural pins and policy");
    const states = dataset.states.map(state => {
        if (state.leader.set.table !== "leader_skill_sets") throw new Error("K49 K48 leader set table changed");
        return {
            stateId: state.stateId, sourceStateKey: state.sourceStateKey, cardId: state.cardId, releaseState: state.releaseState,
            leaderSetRowId: state.leader.set.rowId,
            effects: state.leader.effects.map(effect => ({ effectRowId: effect.effect.rowId, targetSetId: effect.targetSetId })),
        };
    });
    const identity: CharacterLeaderValueK48Identity = {
        manifestSha256: hash(artifacts.manifestBytes), payloadSha256: artifacts.manifest.sha256,
        rawSha256: artifacts.manifest.uncompressedSha256, stateFingerprintSha256: hash(JSON.stringify(states)),
        k46: dataset.source.k46, k3: dataset.source.k3,
    };
    return {
        identity, states,
        policy: { structuralIdsOnly: true, sourceOrderAndMultiplicityPreserved: true, semanticAssociationSelected: false },
        coverage: { states: coverage.states.included, effectReferences: coverage.effectAssociations, targetReferences: coverage.targetReferences, repeatedTargetReferences: coverage.repeatedTargetReferences },
    };
}

export function assertLeaderValueK3Stable(before: CharacterLeaderValueK3Identity, after: CharacterLeaderValueK3Identity): void {
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("K49 K3 identity or value fingerprint changed");
}
export function assertLeaderValueK48Stable(before: CharacterLeaderValueK48Identity, after: CharacterLeaderValueK48Identity): void {
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("K49 K48 identity or state fingerprint changed");
}
