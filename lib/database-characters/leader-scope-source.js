"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertK43LeaderScopeSourceStable = exports.assertK3LeaderScopeSourceStable = exports.compactK43LeaderScopeSource = exports.loadPinnedK3LeaderScopeSource = exports.readPinnedLeaderScopeMember = exports.assertPinnedLeaderScopeMemberIdentity = exports.compactK3LeaderStatesForAudit = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const stream_1 = require("stream");
const zlib_1 = require("zlib");
const artifact_path_1 = require("./artifact-path");
const refresh_contract_1 = require("./refresh-contract");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const structuralOrder = (left, right) => left.localeCompare(right, undefined, { numeric: true });
const K3_PROFILE = refresh_contract_1.CHARACTER_REFRESH_PROFILE.sidecars.find(item => item.gate === "k3");
const C1 = refresh_contract_1.CHARACTER_REFRESH_PROFILE.semanticFiles.find(item => item.fileName === "team-analysis-database-first-sidecar-c1.json.gz");
const C2 = refresh_contract_1.CHARACTER_REFRESH_PROFILE.semanticFiles.find(item => item.fileName === "team-analysis-database-first-supported-c2.json.gz");
async function gunzipBounded(bytes, maximumBytes) {
    const chunks = [];
    let size = 0;
    const stream = stream_1.Readable.from(bytes).pipe((0, zlib_1.createGunzip)());
    for await (const chunk of stream) {
        const value = chunk;
        size += value.length;
        if (size > maximumBytes) {
            stream.destroy();
            throw new Error("K45 K3 decompression exceeded pinned raw size");
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks, size);
}
function rowRef(value, label) {
    const ref = value;
    if (!ref || typeof ref.table !== "string" || !ref.table || typeof ref.rowId !== "string" || !ref.rowId
        || Object.keys(ref).some(key => key !== "table" && key !== "rowId"))
        throw new Error(`K45 malformed K3 ${label} row reference`);
    return { table: ref.table, rowId: ref.rowId };
}
function compactK3LeaderStatesForAudit(stateSkills) {
    if (!Array.isArray(stateSkills))
        throw new Error("K45 malformed K3 stateSkills");
    const states = stateSkills.map((state, index) => {
        if (!state || typeof state.stateId !== "string" || typeof state.sourceStateKey !== "string" || typeof state.cardId !== "string"
            || !["initial", "eza", "seza", "unknown"].includes(state.releaseState) || !state.leaderSkill)
            throw new Error(`K45 malformed K3 leader state ${index}`);
        const percentages = state.leaderSkill.structuredPercentValues;
        if (!Array.isArray(percentages) || percentages.some(value => typeof value !== "number" || !Number.isFinite(value)))
            throw new Error(`K45 malformed K3 structured percentages ${state.stateId}`);
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
        };
    }).sort((left, right) => structuralOrder(left.stateId, right.stateId));
    if (new Set(states.map(item => item.stateId)).size !== states.length)
        throw new Error("K45 duplicate K3 stateId");
    return states;
}
exports.compactK3LeaderStatesForAudit = compactK3LeaderStatesForAudit;
function compactFingerprint(states) { return hash(JSON.stringify(states)); }
function exact(bytes, expected, label) {
    if (bytes.length !== expected.sizeBytes || hash(bytes) !== expected.sha256)
        throw new Error(`K45 K3 ${label} identity changed`);
}
const sameFile = (left, right) => left.dev === right.dev && left.ino === right.ino;
function assertPinnedLeaderScopeMemberIdentity(before, opened, after, expectedSize, label) {
    if (!before.isFile() || before.isSymbolicLink?.() || before.nlink !== 1 || before.size !== expectedSize
        || !opened.isFile() || opened.nlink !== 1 || opened.size !== expectedSize
        || !after.isFile() || after.isSymbolicLink?.() || after.nlink !== 1 || after.size !== expectedSize
        || !sameFile(before, opened) || !sameFile(opened, after))
        throw new Error(`K45 K3 ${label} member identity rejected`);
}
exports.assertPinnedLeaderScopeMemberIdentity = assertPinnedLeaderScopeMemberIdentity;
async function readPinnedLeaderScopeMember(path, expected, label) {
    if (!Number.isInteger(expected.sizeBytes) || expected.sizeBytes < 0)
        throw new Error(`K45 K3 ${label} size pin rejected`);
    const before = await (0, promises_1.lstat)(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size !== expected.sizeBytes) {
        throw new Error(`K45 K3 ${label} member identity rejected`);
    }
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (!sameFile(before, opened) || !opened.isFile() || opened.nlink !== 1 || opened.size !== expected.sizeBytes) {
            throw new Error(`K45 K3 ${label} member identity rejected`);
        }
        const bytes = Buffer.allocUnsafe(expected.sizeBytes);
        let offset = 0;
        while (offset < bytes.length) {
            const result = await handle.read(bytes, offset, bytes.length - offset, offset);
            if (result.bytesRead <= 0)
                throw new Error(`K45 K3 ${label} truncated while reading`);
            offset += result.bytesRead;
        }
        const eof = Buffer.allocUnsafe(1);
        if ((await handle.read(eof, 0, 1, offset)).bytesRead !== 0)
            throw new Error(`K45 K3 ${label} exceeded pinned size while reading`);
        const openedAfter = await handle.stat();
        const after = await (0, promises_1.lstat)(path);
        assertPinnedLeaderScopeMemberIdentity(before, openedAfter, after, expected.sizeBytes, label);
        exact(bytes, expected, label);
        return bytes;
    }
    finally {
        await handle.close();
    }
}
exports.readPinnedLeaderScopeMember = readPinnedLeaderScopeMember;
async function loadPinnedK3LeaderScopeSource(sidecarRoot) {
    if (!sidecarRoot)
        throw new Error("K45 requires explicit sidecar root");
    const directory = await (0, artifact_path_1.resolveCharacterInputDirectory)((0, path_1.resolve)(sidecarRoot), "k3", "k3");
    const [manifestPath, artifactPath, coveragePath, validationPath] = await Promise.all([
        (0, artifact_path_1.resolveCharacterInputFile)(directory, K3_PROFILE.manifest.fileName, K3_PROFILE.manifest.fileName),
        (0, artifact_path_1.resolveCharacterInputFile)(directory, K3_PROFILE.artifact.fileName, K3_PROFILE.artifact.fileName),
        (0, artifact_path_1.resolveCharacterInputFile)(directory, K3_PROFILE.coverage.fileName, K3_PROFILE.coverage.fileName),
        (0, artifact_path_1.resolveCharacterInputFile)(directory, K3_PROFILE.validation.fileName, K3_PROFILE.validation.fileName),
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
    if (manifest.schemaVersion !== 1 || manifest.contractVersion !== K3_PROFILE.contractVersion || manifest.generatedAt !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.generatedAt
        || manifest.fileName !== K3_PROFILE.artifact.fileName || manifest.compression !== "gzip" || manifest.sha256 !== K3_PROFILE.artifact.sha256
        || manifest.sizeBytes !== K3_PROFILE.artifact.sizeBytes || manifest.uncompressedSizeBytes !== K3_PROFILE.artifact.uncompressedSizeBytes
        || manifest.sourceSnapshotVersion !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.snapshotVersion || manifest.sourceDatabaseSha256 !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.sqlite.sha256
        || manifest.sourceDb1ArtifactSha256 !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.db1.sha256 || manifest.sourceC1AuditSha256 !== C1.sha256
        || manifest.sourceC2SupportedSha256 !== C2.sha256 || manifest.coverageFile !== K3_PROFILE.coverage.fileName
        || manifest.coverageSha256 !== K3_PROFILE.coverage.sha256 || manifest.coverageSizeBytes !== K3_PROFILE.coverage.sizeBytes
        || manifest.validationFile !== K3_PROFILE.validation.fileName || manifest.validationSha256 !== K3_PROFILE.validation.sha256
        || manifest.validationSizeBytes !== K3_PROFILE.validation.sizeBytes)
        throw new Error("K45 K3 manifest contract changed");
    if (coverage.schemaVersion !== 1 || coverage.stateCount !== 10654 || coverage.leaderSkillStateCount !== 10654
        || coverage.duplicateStateIdentityCount !== 0 || validation.schemaVersion !== 1 || validation.valid !== true
        || !Array.isArray(validation.failures) || validation.failures.length !== 0)
        throw new Error("K45 K3 coverage or validation changed");
    let raw = await gunzipBounded(artifactBytes, K3_PROFILE.artifact.uncompressedSizeBytes);
    if (raw.length !== K3_PROFILE.artifact.uncompressedSizeBytes)
        throw new Error("K45 K3 raw size changed");
    const uncompressedSha256 = hash(raw);
    const parsed = JSON.parse(raw.toString("utf8"));
    raw = undefined;
    if (parsed.schemaVersion !== 1 || parsed.contract !== "dokkan-database-characters-skills" || parsed.contractVersion !== K3_PROFILE.contractVersion
        || parsed.generatedAt !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.generatedAt || parsed.source?.snapshotVersion !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.snapshotVersion
        || parsed.source.databaseSha256 !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.sqlite.sha256 || parsed.source.db1ArtifactSha256 !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.db1.sha256
        || parsed.source.c1AuditArtifact.sha256 !== C1.sha256 || parsed.source.c2SupportedArtifact.sha256 !== C2.sha256
        || !parsed.policy.rawSkillRowsAreAuditOnly || !parsed.policy.rawRowsNormalizedByTableAndRowId
        || parsed.policy.textUsedAsIdentity || !Array.isArray(parsed.rawRows))
        throw new Error("K45 K3 dataset contract changed");
    const states = compactK3LeaderStatesForAudit(parsed.stateSkills);
    parsed.rawRows.length = 0;
    parsed.actionSkills.length = 0;
    parsed.supportedMechanics.length = 0;
    parsed.stateSkills.length = 0;
    const identity = {
        profileId: refresh_contract_1.CHARACTER_REFRESH_PROFILE.profileId,
        snapshotVersion: refresh_contract_1.CHARACTER_REFRESH_PROFILE.snapshotVersion,
        manifest: { sha256: K3_PROFILE.manifest.sha256, sizeBytes: K3_PROFILE.manifest.sizeBytes },
        artifact: { sha256: K3_PROFILE.artifact.sha256, sizeBytes: K3_PROFILE.artifact.sizeBytes, uncompressedSizeBytes: K3_PROFILE.artifact.uncompressedSizeBytes, uncompressedSha256 },
        coverage: { sha256: K3_PROFILE.coverage.sha256, sizeBytes: K3_PROFILE.coverage.sizeBytes },
        validation: { sha256: K3_PROFILE.validation.sha256, sizeBytes: K3_PROFILE.validation.sizeBytes },
        compactFingerprintSha256: compactFingerprint(states),
    };
    return { identity, states };
}
exports.loadPinnedK3LeaderScopeSource = loadPinnedK3LeaderScopeSource;
function compactK43LeaderScopeSource(artifacts) {
    const states = artifacts.dataset.states.map(item => ({ stateId: item.stateId, sourceStateKey: item.sourceStateKey, cardId: item.cardId, releaseState: item.releaseState }))
        .sort((left, right) => structuralOrder(left.stateId, right.stateId));
    if (new Set(states.map(item => item.stateId)).size !== states.length)
        throw new Error("K45 duplicate K43 stateId");
    const identity = {
        manifestSha256: hash(artifacts.manifestBytes), payloadSha256: artifacts.manifest.sha256,
        rawSha256: artifacts.manifest.uncompressedSha256, k42SourceFingerprintSha256: artifacts.manifest.source.k42.sourceFingerprintSha256,
        stateFingerprintSha256: hash(JSON.stringify(states)),
    };
    return { identity, states };
}
exports.compactK43LeaderScopeSource = compactK43LeaderScopeSource;
function assertK3LeaderScopeSourceStable(before, after) {
    if (JSON.stringify(before) !== JSON.stringify(after))
        throw new Error("K45 K3 identity or compact fingerprint changed after audit");
}
exports.assertK3LeaderScopeSourceStable = assertK3LeaderScopeSourceStable;
function assertK43LeaderScopeSourceStable(before, after) {
    if (JSON.stringify(before) !== JSON.stringify(after))
        throw new Error("K45 K43 identity or state fingerprint changed after audit");
}
exports.assertK43LeaderScopeSourceStable = assertK43LeaderScopeSourceStable;
//# sourceMappingURL=leader-scope-source.js.map