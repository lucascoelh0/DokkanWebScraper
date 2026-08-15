import { createHash } from "crypto";
import { constants } from "fs";
import { lstat, open } from "fs/promises";
import { resolve } from "path";
import { Readable } from "stream";
import { createGunzip } from "zlib";
import type { DatabaseCharacterSkillsDataset, CharacterStateSkills } from "./skills-contract";
import { resolveCharacterInputDirectory, resolveCharacterInputFile } from "./artifact-path";
import { CHARACTER_REFRESH_PROFILE } from "./refresh-contract";
import type {
    CharacterLeaderRowRef,
    CharacterLeaderScopeK3Identity,
    CharacterLeaderScopeK3Source,
    CharacterLeaderScopeK3State,
    CharacterLeaderScopeK43Identity,
    CharacterLeaderScopeK43Source,
} from "./leader-scope-contract";
import type { CharacterStateProductProjectionArtifactSet } from "./state-product-projection-contract";

const hash = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
const structuralOrder = (left: string, right: string): number => left.localeCompare(right, undefined, { numeric: true });
const K3_PROFILE = CHARACTER_REFRESH_PROFILE.sidecars.find(item => item.gate === "k3")!;
const C1 = CHARACTER_REFRESH_PROFILE.semanticFiles.find(item => item.fileName === "team-analysis-database-first-sidecar-c1.json.gz")!;
const C2 = CHARACTER_REFRESH_PROFILE.semanticFiles.find(item => item.fileName === "team-analysis-database-first-supported-c2.json.gz")!;

async function gunzipBounded(bytes: Buffer, maximumBytes: number): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let size = 0;
    const stream = Readable.from(bytes).pipe(createGunzip());
    for await (const chunk of stream) {
        const value = chunk as Buffer;
        size += value.length;
        if (size > maximumBytes) {
            stream.destroy();
            throw new Error("K45 K3 decompression exceeded pinned raw size");
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks, size);
}

function rowRef(value: unknown, label: string): CharacterLeaderRowRef {
    const ref = value as any;
    if (!ref || typeof ref.table !== "string" || !ref.table || typeof ref.rowId !== "string" || !ref.rowId
        || Object.keys(ref).some(key => key !== "table" && key !== "rowId")) throw new Error(`K45 malformed K3 ${label} row reference`);
    return { table: ref.table, rowId: ref.rowId };
}

export function compactK3LeaderStatesForAudit(stateSkills: CharacterStateSkills[]): CharacterLeaderScopeK3State[] {
    if (!Array.isArray(stateSkills)) throw new Error("K45 malformed K3 stateSkills");
    const states = stateSkills.map((state, index) => {
        if (!state || typeof state.stateId !== "string" || typeof state.sourceStateKey !== "string" || typeof state.cardId !== "string"
            || !["initial", "eza", "seza", "unknown"].includes(state.releaseState) || !state.leaderSkill) throw new Error(`K45 malformed K3 leader state ${index}`);
        const percentages = state.leaderSkill.structuredPercentValues;
        if (!Array.isArray(percentages) || percentages.some(value => typeof value !== "number" || !Number.isFinite(value))) throw new Error(`K45 malformed K3 structured percentages ${state.stateId}`);
        return {
            stateId: state.stateId,
            sourceStateKey: state.sourceStateKey,
            cardId: state.cardId,
            releaseState: state.releaseState,
            leader: {
                set: rowRef(state.leaderSkill.set, "set"),
                effects: state.leaderSkill.effects.map((item, itemIndex) => rowRef(item, `effect ${itemIndex}`)),
                targets: state.leaderSkill.targetRows.map((item, itemIndex) => rowRef(item, `target ${itemIndex}`)),
                structuredPercentValues: [...percentages],
            },
        } as CharacterLeaderScopeK3State;
    }).sort((left, right) => structuralOrder(left.stateId, right.stateId));
    if (new Set(states.map(item => item.stateId)).size !== states.length) throw new Error("K45 duplicate K3 stateId");
    return states;
}

function compactFingerprint(states: CharacterLeaderScopeK3State[]): string { return hash(JSON.stringify(states)); }

function exact(bytes: Buffer, expected: { sha256: string; sizeBytes: number }, label: string): void {
    if (bytes.length !== expected.sizeBytes || hash(bytes) !== expected.sha256) throw new Error(`K45 K3 ${label} identity changed`);
}

interface PinnedMemberStat { dev: number; ino: number; size: number; nlink: number; isFile(): boolean; isSymbolicLink?(): boolean }
const sameFile = (left: PinnedMemberStat, right: PinnedMemberStat): boolean => left.dev === right.dev && left.ino === right.ino;

export function assertPinnedLeaderScopeMemberIdentity(
    before: PinnedMemberStat,
    opened: PinnedMemberStat,
    after: PinnedMemberStat,
    expectedSize: number,
    label: string,
): void {
    if (!before.isFile() || before.isSymbolicLink?.() || before.nlink !== 1 || before.size !== expectedSize
        || !opened.isFile() || opened.nlink !== 1 || opened.size !== expectedSize
        || !after.isFile() || after.isSymbolicLink?.() || after.nlink !== 1 || after.size !== expectedSize
        || !sameFile(before, opened) || !sameFile(opened, after)) throw new Error(`K45 K3 ${label} member identity rejected`);
}

export async function readPinnedLeaderScopeMember(
    path: string,
    expected: { sha256: string; sizeBytes: number },
    label: string,
): Promise<Buffer> {
    if (!Number.isInteger(expected.sizeBytes) || expected.sizeBytes < 0) throw new Error(`K45 K3 ${label} size pin rejected`);
    const before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size !== expected.sizeBytes) {
        throw new Error(`K45 K3 ${label} member identity rejected`);
    }
    const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (!sameFile(before, opened) || !opened.isFile() || opened.nlink !== 1 || opened.size !== expected.sizeBytes) {
            throw new Error(`K45 K3 ${label} member identity rejected`);
        }
        const bytes = Buffer.allocUnsafe(expected.sizeBytes);
        let offset = 0;
        while (offset < bytes.length) {
            const result = await handle.read(bytes, offset, bytes.length - offset, offset);
            if (result.bytesRead <= 0) throw new Error(`K45 K3 ${label} truncated while reading`);
            offset += result.bytesRead;
        }
        const eof = Buffer.allocUnsafe(1);
        if ((await handle.read(eof, 0, 1, offset)).bytesRead !== 0) throw new Error(`K45 K3 ${label} exceeded pinned size while reading`);
        const openedAfter = await handle.stat();
        const after = await lstat(path);
        assertPinnedLeaderScopeMemberIdentity(before, openedAfter, after, expected.sizeBytes, label);
        exact(bytes, expected, label);
        return bytes;
    } finally { await handle.close(); }
}

export async function loadPinnedK3LeaderScopeSource(sidecarRoot: string): Promise<CharacterLeaderScopeK3Source> {
    if (!sidecarRoot) throw new Error("K45 requires explicit sidecar root");
    const directory = await resolveCharacterInputDirectory(resolve(sidecarRoot), "k3", "k3");
    const [manifestPath, artifactPath, coveragePath, validationPath] = await Promise.all([
        resolveCharacterInputFile(directory, K3_PROFILE.manifest.fileName, K3_PROFILE.manifest.fileName),
        resolveCharacterInputFile(directory, K3_PROFILE.artifact.fileName, K3_PROFILE.artifact.fileName),
        resolveCharacterInputFile(directory, K3_PROFILE.coverage.fileName, K3_PROFILE.coverage.fileName),
        resolveCharacterInputFile(directory, K3_PROFILE.validation.fileName, K3_PROFILE.validation.fileName),
    ]);
    const [manifestBytes, artifactBytes, coverageBytes, validationBytes] = await Promise.all([
        readPinnedLeaderScopeMember(manifestPath, K3_PROFILE.manifest, "manifest"),
        readPinnedLeaderScopeMember(artifactPath, K3_PROFILE.artifact, "artifact"),
        readPinnedLeaderScopeMember(coveragePath, K3_PROFILE.coverage, "coverage"),
        readPinnedLeaderScopeMember(validationPath, K3_PROFILE.validation, "validation"),
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
        || manifest.validationSizeBytes !== K3_PROFILE.validation.sizeBytes) throw new Error("K45 K3 manifest contract changed");
    if (coverage.schemaVersion !== 1 || coverage.stateCount !== 10_654 || coverage.leaderSkillStateCount !== 10_654
        || coverage.duplicateStateIdentityCount !== 0 || validation.schemaVersion !== 1 || validation.valid !== true
        || !Array.isArray(validation.failures) || validation.failures.length !== 0) throw new Error("K45 K3 coverage or validation changed");
    let raw: Buffer | undefined = await gunzipBounded(artifactBytes, K3_PROFILE.artifact.uncompressedSizeBytes);
    if (raw.length !== K3_PROFILE.artifact.uncompressedSizeBytes) throw new Error("K45 K3 raw size changed");
    const uncompressedSha256 = hash(raw);
    const parsed = JSON.parse(raw.toString("utf8")) as DatabaseCharacterSkillsDataset;
    raw = undefined;
    if (parsed.schemaVersion !== 1 || parsed.contract !== "dokkan-database-characters-skills" || parsed.contractVersion !== K3_PROFILE.contractVersion
        || parsed.generatedAt !== CHARACTER_REFRESH_PROFILE.generatedAt || parsed.source?.snapshotVersion !== CHARACTER_REFRESH_PROFILE.snapshotVersion
        || parsed.source.databaseSha256 !== CHARACTER_REFRESH_PROFILE.sqlite.sha256 || parsed.source.db1ArtifactSha256 !== CHARACTER_REFRESH_PROFILE.db1.sha256
        || parsed.source.c1AuditArtifact.sha256 !== C1.sha256 || parsed.source.c2SupportedArtifact.sha256 !== C2.sha256
        || !parsed.policy.rawSkillRowsAreAuditOnly || !parsed.policy.rawRowsNormalizedByTableAndRowId
        || parsed.policy.textUsedAsIdentity || !Array.isArray(parsed.rawRows)) throw new Error("K45 K3 dataset contract changed");
    const states = compactK3LeaderStatesForAudit(parsed.stateSkills);
    parsed.rawRows.length = 0;
    parsed.actionSkills.length = 0;
    parsed.supportedMechanics.length = 0;
    parsed.stateSkills.length = 0;
    const identity: CharacterLeaderScopeK3Identity = {
        profileId: CHARACTER_REFRESH_PROFILE.profileId,
        snapshotVersion: CHARACTER_REFRESH_PROFILE.snapshotVersion,
        manifest: { sha256: K3_PROFILE.manifest.sha256, sizeBytes: K3_PROFILE.manifest.sizeBytes },
        artifact: { sha256: K3_PROFILE.artifact.sha256, sizeBytes: K3_PROFILE.artifact.sizeBytes, uncompressedSizeBytes: K3_PROFILE.artifact.uncompressedSizeBytes, uncompressedSha256 },
        coverage: { sha256: K3_PROFILE.coverage.sha256, sizeBytes: K3_PROFILE.coverage.sizeBytes },
        validation: { sha256: K3_PROFILE.validation.sha256, sizeBytes: K3_PROFILE.validation.sizeBytes },
        compactFingerprintSha256: compactFingerprint(states),
    };
    return { identity, states };
}

export function compactK43LeaderScopeSource(artifacts: CharacterStateProductProjectionArtifactSet): CharacterLeaderScopeK43Source {
    const states = artifacts.dataset.states.map(item => ({ stateId: item.stateId, sourceStateKey: item.sourceStateKey, cardId: item.cardId, releaseState: item.releaseState }))
        .sort((left, right) => structuralOrder(left.stateId, right.stateId));
    if (new Set(states.map(item => item.stateId)).size !== states.length) throw new Error("K45 duplicate K43 stateId");
    const identity: CharacterLeaderScopeK43Identity = {
        manifestSha256: hash(artifacts.manifestBytes), payloadSha256: artifacts.manifest.sha256,
        rawSha256: artifacts.manifest.uncompressedSha256, k42SourceFingerprintSha256: artifacts.manifest.source.k42.sourceFingerprintSha256,
        stateFingerprintSha256: hash(JSON.stringify(states)),
    };
    return { identity, states };
}

export function assertK3LeaderScopeSourceStable(before: CharacterLeaderScopeK3Identity, after: CharacterLeaderScopeK3Identity): void {
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("K45 K3 identity or compact fingerprint changed after audit");
}

export function assertK43LeaderScopeSourceStable(before: CharacterLeaderScopeK43Identity, after: CharacterLeaderScopeK43Identity): void {
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("K45 K43 identity or state fingerprint changed after audit");
}
