"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeFyiCharacterCandidateDirectory = exports.resolveFyiK15Directory = exports.resolveFyiCandidateDirectory = exports.candidateFiles = exports.buildFyiCharacterCandidateK19Report = exports.artifactLineage = exports.scopeCharacterCompactProjectionToTarget = exports.candidateReadyMarkerBytes = exports.formattedJsonBytes = exports.FYI_K19_AUDITED_BASELINE_PIN = exports.FYI_CHARACTER_CANDIDATE_READY_FILE = exports.FYI_CHARACTER_CANDIDATE_FILES = exports.FYI_CHARACTER_K15_DIRECTORY = exports.FYI_CHARACTER_CANDIDATE_DIRECTORY = void 0;
const fs_1 = require("fs");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const artifact_path_1 = require("./artifact-path");
const artifact_path_2 = require("./database-characters/artifact-path");
const compact_contract_1 = require("./database-characters/compact-contract");
exports.FYI_CHARACTER_CANDIDATE_DIRECTORY = "candidate-k19";
exports.FYI_CHARACTER_K15_DIRECTORY = "compact";
exports.FYI_CHARACTER_CANDIDATE_FILES = [
    "baseline-characters.json.gz",
    "baseline-characters-manifest.json",
    "characters.json.gz",
    "characters-manifest.json",
    "run-report.json",
    "candidate-k19-report.json",
];
exports.FYI_CHARACTER_CANDIDATE_READY_FILE = ".candidate-k19-ready.json";
exports.FYI_K19_AUDITED_BASELINE_PIN = {
    datasetVersion: "2026-08-04T22:43:50.776Z",
    generatedAt: "2026-08-04T22:43:50.776Z",
    payloadSha256: "56681e7327c56bce7becbda72ee507b77d964f449fd1862012d4e751b801b499",
    payloadSizeBytes: 1211389,
    characterCount: 1434,
    targetStateCount: 1625,
    targetScopedK15Records: 1576,
    excludedByTargetCatalog: 2720,
    targetStatesNotCovered: 49,
    typeAgreements: 1576,
    rarityAgreements: 1387,
    rarityNullFills: 189,
};
const sha256 = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const formattedJsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
exports.formattedJsonBytes = formattedJsonBytes;
function candidateReadyMarkerBytes(files) {
    const marker = {
        schemaVersion: 1,
        contract: "dokkan-fyi-character-database-candidate-commit",
        contractVersion: "1.0.0",
        files: exports.FYI_CHARACTER_CANDIDATE_FILES.map(name => {
            const file = files.find(item => item.name === name);
            if (!file)
                throw new Error("K19 candidate ready marker inventory rejected");
            return { name, sha256: sha256(file.bytes), sizeBytes: file.bytes.length };
        }),
    };
    return (0, exports.formattedJsonBytes)(marker);
}
exports.candidateReadyMarkerBytes = candidateReadyMarkerBytes;
function collectStructuralIds(characters) {
    const ids = new Set();
    const visit = (value) => {
        if (!value || value.id === undefined || value.id === null)
            return;
        ids.add(String(value.id));
        const transformations = Array.isArray(value.transformations) ? value.transformations : [];
        transformations.forEach(visit);
    };
    characters.forEach(visit);
    return [...ids].sort((left, right) => Number(left) - Number(right) || left.localeCompare(right));
}
function scopeCharacterCompactProjectionToTarget(validatedProjection, characters) {
    const targetStateIds = collectStructuralIds(characters);
    const targetIds = new Set(targetStateIds);
    const k15Ids = new Set(validatedProjection.records.map(record => record.cardId));
    const records = validatedProjection.records.filter(record => targetIds.has(record.cardId));
    const notCovered = targetStateIds.filter(id => !k15Ids.has(id));
    return {
        projection: { ...validatedProjection, records },
        targetStateIds,
        targetStateCount: targetStateIds.length,
        targetScopedK15Records: records.length,
        excludedByTargetCatalog: validatedProjection.records.length - records.length,
        targetStatesNotCovered: notCovered.length,
        targetStatesNotCoveredSample: notCovered.slice(0, 5),
    };
}
exports.scopeCharacterCompactProjectionToTarget = scopeCharacterCompactProjectionToTarget;
function artifactLineage(artifact, manifestFile) {
    const manifestBytes = (0, exports.formattedJsonBytes)(artifact.manifest);
    return {
        datasetVersion: artifact.manifest.datasetVersion,
        generatedAt: artifact.manifest.generatedAt,
        payloadFile: artifact.manifest.fileName,
        payloadSha256: artifact.manifest.sha256,
        payloadSizeBytes: artifact.manifest.sizeBytes,
        uncompressedSha256: sha256(Buffer.from(artifact.jsonText, "utf8")),
        uncompressedSizeBytes: artifact.manifest.uncompressedSizeBytes,
        manifestFile,
        manifestSha256: sha256(manifestBytes),
        manifestSizeBytes: manifestBytes.length,
        characterCount: artifact.manifest.characterCount,
    };
}
exports.artifactLineage = artifactLineage;
function buildFyiCharacterCandidateK19Report(options) {
    if (options.overlay.readiness !== "GO")
        throw new Error("K19 overlay blockers reject candidate reporting");
    const baseline = artifactLineage(options.baseline, "baseline-characters-manifest.json");
    const candidate = artifactLineage(options.candidate, "characters-manifest.json");
    const exactPinMatch = baseline.payloadSha256 === exports.FYI_K19_AUDITED_BASELINE_PIN.payloadSha256
        && baseline.payloadSizeBytes === exports.FYI_K19_AUDITED_BASELINE_PIN.payloadSizeBytes
        && baseline.characterCount === exports.FYI_K19_AUDITED_BASELINE_PIN.characterCount
        && options.baseline.manifest.datasetVersion === exports.FYI_K19_AUDITED_BASELINE_PIN.datasetVersion
        && options.baseline.manifest.generatedAt === exports.FYI_K19_AUDITED_BASELINE_PIN.generatedAt;
    if (exactPinMatch)
        assertAuditedCounts(options.scope, options.overlay);
    return {
        schemaVersion: 1,
        contract: "dokkan-fyi-character-database-candidate-k19",
        contractVersion: "1.0.0",
        generatedAt: options.generatedAt,
        mode: "explicit_offline_auditable_candidate",
        sources: {
            baselineFyi: baseline,
            k15: {
                contract: "dokkan-database-character-compact-shadow", contractVersion: "1.0.0",
                datasetVersion: options.k15Manifest.datasetVersion,
                manifestFile: compact_contract_1.CHARACTER_COMPACT_PINNED_RELEASE.manifestFile,
                manifestSha256: compact_contract_1.CHARACTER_COMPACT_PINNED_RELEASE.manifestSha256,
                payloadFile: options.k15Manifest.fileName,
                payloadSha256: options.k15Manifest.sha256,
                recordCount: options.k15RecordCount,
            },
        },
        candidate,
        targetScope: {
            structuralIdsOnly: true,
            targetStateCount: options.scope.targetStateCount,
            targetScopedK15Records: options.scope.targetScopedK15Records,
            excludedByTargetCatalog: options.scope.excludedByTargetCatalog,
            targetStatesNotCovered: options.scope.targetStatesNotCovered,
            targetStatesNotCoveredSample: options.scope.targetStatesNotCoveredSample,
            outOfScopeIsNotAgreementOrAuthority: true,
        },
        overlay: {
            readiness: "GO",
            candidates: options.overlay.candidates,
            evaluation: options.overlay.evaluation,
            appliedToClone: options.overlay.overlayProof.candidatesAppliedToClone,
            examples: options.overlay.examples,
        },
        auditedBaseline: { exactPinMatch, expectedCountsApplied: exactPinMatch },
        safety: {
            explicitOptIn: true, defaultLatestUntouched: true, candidateDirectoryOnly: true,
            k15ValidatedBeforeAndAfter: true, inMemoryOverlayOnly: true, k11Read: false,
            dataLatestWritten: false, publisherInvoked: false, androidWritten: false, r2Written: false,
        },
        readiness: {
            candidateGenerationValidation: "GO", promotion: "NO-GO", production: "NO-GO",
            publisher: "NO-GO", android: "NO-GO", r2: "NO-GO",
        },
    };
}
exports.buildFyiCharacterCandidateK19Report = buildFyiCharacterCandidateK19Report;
function assertAuditedCounts(scope, overlay) {
    const expected = exports.FYI_K19_AUDITED_BASELINE_PIN;
    const checks = [
        ["target states", scope.targetStateCount, expected.targetStateCount],
        ["target-scoped K15 records", scope.targetScopedK15Records, expected.targetScopedK15Records],
        ["excluded K15 records", scope.excludedByTargetCatalog, expected.excludedByTargetCatalog],
        ["target states not covered", scope.targetStatesNotCovered, expected.targetStatesNotCovered],
        ["type agreements", overlay.evaluation.type.agreements, expected.typeAgreements],
        ["rarity agreements", overlay.evaluation.rarity.agreementsBeforeOverlay, expected.rarityAgreements],
        ["rarity null fills", overlay.evaluation.rarity.nullFillCandidates, expected.rarityNullFills],
    ];
    const mismatch = checks.find(([, actual, wanted]) => actual !== wanted);
    if (mismatch)
        throw new Error(`K19 audited baseline ${mismatch[0]} changed: ${mismatch[1]} != ${mismatch[2]}`);
}
function candidateFiles(options) {
    return [
        { name: "baseline-characters.json.gz", bytes: options.baseline.gzipBuffer },
        { name: "baseline-characters-manifest.json", bytes: (0, exports.formattedJsonBytes)(options.baseline.manifest) },
        { name: "characters.json.gz", bytes: options.candidate.gzipBuffer },
        { name: "characters-manifest.json", bytes: (0, exports.formattedJsonBytes)(options.candidate.manifest) },
        { name: "run-report.json", bytes: (0, exports.formattedJsonBytes)(options.runReport) },
        { name: "candidate-k19-report.json", bytes: (0, exports.formattedJsonBytes)(options.candidateReport) },
    ];
}
exports.candidateFiles = candidateFiles;
async function resolveFyiCandidateDirectory(trustedRoot, untrustedName, allowMissing) {
    return (0, artifact_path_1.resolveContainedArtifactPath)({
        trustedRoot,
        untrustedPath: untrustedName,
        expectedType: "directory",
        exactName: exports.FYI_CHARACTER_CANDIDATE_DIRECTORY,
        allowMissing,
    }, (code, artifactType) => new artifact_path_2.DatabaseCharacterArtifactPathError(code, artifactType));
}
exports.resolveFyiCandidateDirectory = resolveFyiCandidateDirectory;
async function resolveFyiK15Directory(trustedRoot, untrustedName) {
    return (0, artifact_path_2.resolveDatabaseCharacterArtifactPath)({
        trustedRoot,
        untrustedPath: untrustedName,
        expectedType: "directory",
        exactName: exports.FYI_CHARACTER_K15_DIRECTORY,
    });
}
exports.resolveFyiK15Directory = resolveFyiK15Directory;
async function writeExclusiveFile(path, bytes) {
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_CREAT | fs_1.constants.O_EXCL | fs_1.constants.O_WRONLY | (fs_1.constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        const metadata = await handle.stat();
        if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size !== bytes.length) {
            throw new Error("K19 staged file identity rejected");
        }
    }
    finally {
        await handle.close();
    }
}
/** Reserves a candidate exactly once and commits it by writing the ready marker last. */
async function writeFyiCharacterCandidateDirectory(trustedRoot, candidateName, files, populate) {
    const root = (0, path_1.resolve)(trustedRoot);
    const rootMetadata = await (0, promises_1.lstat)(root);
    const rootRealPath = await (0, promises_1.realpath)(root);
    if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink() || (0, path_1.resolve)(rootRealPath) !== root) {
        throw new Error("K19 candidate root must be a regular canonical directory");
    }
    const candidatePath = await resolveFyiCandidateDirectory(root, candidateName, true);
    if (files.length !== exports.FYI_CHARACTER_CANDIDATE_FILES.length
        || new Set(files.map(file => file.name)).size !== files.length
        || exports.FYI_CHARACTER_CANDIDATE_FILES.some(name => !files.some(file => file.name === name))) {
        throw new Error("K19 candidate file inventory rejected");
    }
    // mkdir is the cross-platform no-replace primitive. Readers require the
    // marker written last, so an interrupted reservation is never considered complete.
    try {
        await (0, promises_1.mkdir)(candidatePath, { mode: 0o700 });
    }
    catch (error) {
        if (error?.code === "EEXIST")
            throw new Error("K19 candidate directory already exists");
        throw error;
    }
    const reservedMetadata = await (0, promises_1.lstat)(candidatePath);
    try {
        if (populate)
            await populate(candidatePath);
        for (const name of exports.FYI_CHARACTER_CANDIDATE_FILES) {
            const file = files.find(item => item.name === name);
            await writeExclusiveFile((0, path_1.join)(candidatePath, name), file.bytes);
        }
        if (await (0, promises_1.realpath)(root) !== rootRealPath)
            throw new Error("K19 candidate root identity changed");
        const currentMetadata = await (0, promises_1.lstat)(candidatePath);
        if (!currentMetadata.isDirectory() || currentMetadata.isSymbolicLink()
            || currentMetadata.dev !== reservedMetadata.dev || currentMetadata.ino !== reservedMetadata.ino) {
            throw new Error("K19 candidate directory identity changed");
        }
        await writeExclusiveFile((0, path_1.join)(candidatePath, exports.FYI_CHARACTER_CANDIDATE_READY_FILE), candidateReadyMarkerBytes(files));
        return candidatePath;
    }
    catch (error) {
        const currentMetadata = await (0, promises_1.lstat)(candidatePath).catch(() => undefined);
        if (currentMetadata?.isDirectory() && !currentMetadata.isSymbolicLink()
            && currentMetadata.dev === reservedMetadata.dev && currentMetadata.ino === reservedMetadata.ino) {
            await (0, promises_1.rm)(candidatePath, { recursive: true, force: true }).catch(() => undefined);
        }
        throw error;
    }
}
exports.writeFyiCharacterCandidateDirectory = writeFyiCharacterCandidateDirectory;
//# sourceMappingURL=fyi-character-candidate.js.map