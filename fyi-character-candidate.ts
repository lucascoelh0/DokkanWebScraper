import { constants } from "fs";
import { createHash } from "crypto";
import { lstat, mkdir, open, realpath, rm } from "fs/promises";
import { join, resolve } from "path";
import type { Character } from "./character";
import { resolveContainedArtifactPath } from "./artifact-path";
import type { CharacterDatasetArtifact } from "./dataset-artifacts";
import { DatabaseCharacterArtifactPathError, resolveDatabaseCharacterArtifactPath } from "./database-characters/artifact-path";
import {
    CHARACTER_COMPACT_PINNED_RELEASE,
    CharacterCompactManifest,
    CharacterCompactProjection,
} from "./database-characters/compact-contract";
import type { CharacterCompactOverlayDecision } from "./database-characters/compact-overlay";

export const FYI_CHARACTER_CANDIDATE_DIRECTORY = "candidate-k19" as const;
export const FYI_CHARACTER_K15_DIRECTORY = "compact" as const;
export const FYI_CHARACTER_CANDIDATE_FILES = [
    "baseline-characters.json.gz",
    "baseline-characters-manifest.json",
    "characters.json.gz",
    "characters-manifest.json",
    "run-report.json",
    "candidate-k19-report.json",
] as const;
export const FYI_CHARACTER_CANDIDATE_READY_FILE = ".candidate-k19-ready.json" as const;

export const FYI_K19_AUDITED_BASELINE_PIN = {
    datasetVersion: "2026-08-04T22:43:50.776Z",
    generatedAt: "2026-08-04T22:43:50.776Z",
    payloadSha256: "56681e7327c56bce7becbda72ee507b77d964f449fd1862012d4e751b801b499",
    payloadSizeBytes: 1_211_389,
    characterCount: 1_434,
    targetStateCount: 1_625,
    targetScopedK15Records: 1_576,
    excludedByTargetCatalog: 2_720,
    targetStatesNotCovered: 49,
    typeAgreements: 1_576,
    rarityAgreements: 1_387,
    rarityNullFills: 189,
} as const;

export interface FyiCharacterTargetScope {
    projection: CharacterCompactProjection;
    targetStateIds: string[];
    targetStateCount: number;
    targetScopedK15Records: number;
    excludedByTargetCatalog: number;
    targetStatesNotCovered: number;
    targetStatesNotCoveredSample: string[];
}

export interface FyiCharacterCandidateK19Report {
    schemaVersion: 1;
    contract: "dokkan-fyi-character-database-candidate-k19";
    contractVersion: "1.0.0";
    generatedAt: string;
    mode: "explicit_offline_auditable_candidate";
    sources: {
        baselineFyi: ArtifactLineage;
        k15: {
            contract: "dokkan-database-character-compact-shadow";
            contractVersion: "1.0.0";
            datasetVersion: string;
            manifestFile: "database-characters-k15-manifest.json";
            manifestSha256: string;
            payloadFile: string;
            payloadSha256: string;
            recordCount: number;
        };
    };
    candidate: ArtifactLineage;
    targetScope: {
        structuralIdsOnly: true;
        targetStateCount: number;
        targetScopedK15Records: number;
        excludedByTargetCatalog: number;
        targetStatesNotCovered: number;
        targetStatesNotCoveredSample: string[];
        outOfScopeIsNotAgreementOrAuthority: true;
    };
    overlay: {
        readiness: "GO";
        candidates: CharacterCompactOverlayDecision["candidates"];
        evaluation: CharacterCompactOverlayDecision["evaluation"];
        appliedToClone: number;
        examples: CharacterCompactOverlayDecision["examples"];
    };
    auditedBaseline: {
        exactPinMatch: boolean;
        expectedCountsApplied: boolean;
    };
    safety: {
        explicitOptIn: true;
        defaultLatestUntouched: true;
        candidateDirectoryOnly: true;
        k15ValidatedBeforeAndAfter: true;
        inMemoryOverlayOnly: true;
        k11Read: false;
        dataLatestWritten: false;
        publisherInvoked: false;
        androidWritten: false;
        r2Written: false;
    };
    readiness: {
        candidateGenerationValidation: "GO";
        promotion: "NO-GO";
        production: "NO-GO";
        publisher: "NO-GO";
        android: "NO-GO";
        r2: "NO-GO";
    };
}

interface ArtifactLineage {
    datasetVersion: string;
    generatedAt: string;
    payloadFile: string;
    payloadSha256: string;
    payloadSizeBytes: number;
    uncompressedSha256: string;
    uncompressedSizeBytes: number;
    manifestFile: string;
    manifestSha256: string;
    manifestSizeBytes: number;
    characterCount: number;
}

export interface CandidateFile {
    name: typeof FYI_CHARACTER_CANDIDATE_FILES[number];
    bytes: Buffer;
}

interface CandidateReadyMarker {
    schemaVersion: 1;
    contract: "dokkan-fyi-character-database-candidate-commit";
    contractVersion: "1.0.0";
    files: Array<{ name: CandidateFile["name"], sha256: string, sizeBytes: number }>;
}

const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
export const formattedJsonBytes = (value: unknown) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

export function candidateReadyMarkerBytes(files: CandidateFile[]): Buffer {
    const marker: CandidateReadyMarker = {
        schemaVersion: 1,
        contract: "dokkan-fyi-character-database-candidate-commit",
        contractVersion: "1.0.0",
        files: FYI_CHARACTER_CANDIDATE_FILES.map(name => {
            const file = files.find(item => item.name === name);
            if (!file) throw new Error("K19 candidate ready marker inventory rejected");
            return { name, sha256: sha256(file.bytes), sizeBytes: file.bytes.length };
        }),
    };
    return formattedJsonBytes(marker);
}

function collectStructuralIds(characters: Character[]): string[] {
    const ids = new Set<string>();
    const visit = (value: any): void => {
        if (!value || value.id === undefined || value.id === null) return;
        ids.add(String(value.id));
        const transformations = Array.isArray(value.transformations) ? value.transformations : [];
        transformations.forEach(visit);
    };
    characters.forEach(visit);
    return [...ids].sort((left, right) => Number(left) - Number(right) || left.localeCompare(right));
}

export function scopeCharacterCompactProjectionToTarget(
    validatedProjection: CharacterCompactProjection,
    characters: Character[],
): FyiCharacterTargetScope {
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

export function artifactLineage(
    artifact: CharacterDatasetArtifact,
    manifestFile: "baseline-characters-manifest.json" | "characters-manifest.json",
): ArtifactLineage {
    const manifestBytes = formattedJsonBytes(artifact.manifest);
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

export function buildFyiCharacterCandidateK19Report(options: {
    generatedAt: string;
    baseline: CharacterDatasetArtifact;
    candidate: CharacterDatasetArtifact;
    k15Manifest: CharacterCompactManifest;
    k15RecordCount: number;
    scope: FyiCharacterTargetScope;
    overlay: CharacterCompactOverlayDecision;
}): FyiCharacterCandidateK19Report {
    if (options.overlay.readiness !== "GO") throw new Error("K19 overlay blockers reject candidate reporting");
    const baseline = artifactLineage(options.baseline, "baseline-characters-manifest.json");
    const candidate = artifactLineage(options.candidate, "characters-manifest.json");
    const exactPinMatch = baseline.payloadSha256 === FYI_K19_AUDITED_BASELINE_PIN.payloadSha256
        && baseline.payloadSizeBytes === FYI_K19_AUDITED_BASELINE_PIN.payloadSizeBytes
        && baseline.characterCount === FYI_K19_AUDITED_BASELINE_PIN.characterCount
        && options.baseline.manifest.datasetVersion === FYI_K19_AUDITED_BASELINE_PIN.datasetVersion
        && options.baseline.manifest.generatedAt === FYI_K19_AUDITED_BASELINE_PIN.generatedAt;
    if (exactPinMatch) assertAuditedCounts(options.scope, options.overlay);
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
                manifestFile: CHARACTER_COMPACT_PINNED_RELEASE.manifestFile,
                manifestSha256: CHARACTER_COMPACT_PINNED_RELEASE.manifestSha256,
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

function assertAuditedCounts(scope: FyiCharacterTargetScope, overlay: CharacterCompactOverlayDecision): void {
    const expected = FYI_K19_AUDITED_BASELINE_PIN;
    const checks: Array<[string, number, number]> = [
        ["target states", scope.targetStateCount, expected.targetStateCount],
        ["target-scoped K15 records", scope.targetScopedK15Records, expected.targetScopedK15Records],
        ["excluded K15 records", scope.excludedByTargetCatalog, expected.excludedByTargetCatalog],
        ["target states not covered", scope.targetStatesNotCovered, expected.targetStatesNotCovered],
        ["type agreements", overlay.evaluation.type.agreements, expected.typeAgreements],
        ["rarity agreements", overlay.evaluation.rarity.agreementsBeforeOverlay, expected.rarityAgreements],
        ["rarity null fills", overlay.evaluation.rarity.nullFillCandidates, expected.rarityNullFills],
    ];
    const mismatch = checks.find(([, actual, wanted]) => actual !== wanted);
    if (mismatch) throw new Error(`K19 audited baseline ${mismatch[0]} changed: ${mismatch[1]} != ${mismatch[2]}`);
}

export function candidateFiles(options: {
    baseline: CharacterDatasetArtifact;
    candidate: CharacterDatasetArtifact;
    runReport: unknown;
    candidateReport: FyiCharacterCandidateK19Report;
}): CandidateFile[] {
    return [
        { name: "baseline-characters.json.gz", bytes: options.baseline.gzipBuffer },
        { name: "baseline-characters-manifest.json", bytes: formattedJsonBytes(options.baseline.manifest) },
        { name: "characters.json.gz", bytes: options.candidate.gzipBuffer },
        { name: "characters-manifest.json", bytes: formattedJsonBytes(options.candidate.manifest) },
        { name: "run-report.json", bytes: formattedJsonBytes(options.runReport) },
        { name: "candidate-k19-report.json", bytes: formattedJsonBytes(options.candidateReport) },
    ];
}

export async function resolveFyiCandidateDirectory(trustedRoot: string, untrustedName: unknown, allowMissing: boolean): Promise<string> {
    return resolveContainedArtifactPath({
        trustedRoot,
        untrustedPath: untrustedName,
        expectedType: "directory",
        exactName: FYI_CHARACTER_CANDIDATE_DIRECTORY,
        allowMissing,
    }, (code, artifactType) => new DatabaseCharacterArtifactPathError(code, artifactType));
}

export async function resolveFyiK15Directory(trustedRoot: string, untrustedName: unknown): Promise<string> {
    return resolveDatabaseCharacterArtifactPath({
        trustedRoot,
        untrustedPath: untrustedName,
        expectedType: "directory",
        exactName: FYI_CHARACTER_K15_DIRECTORY,
    });
}

async function writeExclusiveFile(path: string, bytes: Buffer): Promise<void> {
    const handle = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        const metadata = await handle.stat();
        if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size !== bytes.length) {
            throw new Error("K19 staged file identity rejected");
        }
    } finally {
        await handle.close();
    }
}

/** Reserves a candidate exactly once and commits it by writing the ready marker last. */
export async function writeFyiCharacterCandidateDirectory(
    trustedRoot: string,
    candidateName: unknown,
    files: CandidateFile[],
    populate?: (candidateDirectory: string) => Promise<void>,
): Promise<string> {
    const root = resolve(trustedRoot);
    const rootMetadata = await lstat(root);
    const rootRealPath = await realpath(root);
    if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink() || resolve(rootRealPath) !== root) {
        throw new Error("K19 candidate root must be a regular canonical directory");
    }
    const candidatePath = await resolveFyiCandidateDirectory(root, candidateName, true);
    if (files.length !== FYI_CHARACTER_CANDIDATE_FILES.length
        || new Set(files.map(file => file.name)).size !== files.length
        || FYI_CHARACTER_CANDIDATE_FILES.some(name => !files.some(file => file.name === name))) {
        throw new Error("K19 candidate file inventory rejected");
    }

    // mkdir is the cross-platform no-replace primitive. Readers require the
    // marker written last, so an interrupted reservation is never considered complete.
    try {
        await mkdir(candidatePath, { mode: 0o700 });
    } catch (error: any) {
        if (error?.code === "EEXIST") throw new Error("K19 candidate directory already exists");
        throw error;
    }
    const reservedMetadata = await lstat(candidatePath);
    try {
        if (populate) await populate(candidatePath);
        for (const name of FYI_CHARACTER_CANDIDATE_FILES) {
            const file = files.find(item => item.name === name)!;
            await writeExclusiveFile(join(candidatePath, name), file.bytes);
        }
        if (await realpath(root) !== rootRealPath) throw new Error("K19 candidate root identity changed");
        const currentMetadata = await lstat(candidatePath);
        if (!currentMetadata.isDirectory() || currentMetadata.isSymbolicLink()
            || currentMetadata.dev !== reservedMetadata.dev || currentMetadata.ino !== reservedMetadata.ino) {
            throw new Error("K19 candidate directory identity changed");
        }
        await writeExclusiveFile(join(candidatePath, FYI_CHARACTER_CANDIDATE_READY_FILE), candidateReadyMarkerBytes(files));
        return candidatePath;
    } catch (error) {
        const currentMetadata = await lstat(candidatePath).catch(() => undefined);
        if (currentMetadata?.isDirectory() && !currentMetadata.isSymbolicLink()
            && currentMetadata.dev === reservedMetadata.dev && currentMetadata.ino === reservedMetadata.ino) {
            await rm(candidatePath, { recursive: true, force: true }).catch(() => undefined);
        }
        throw error;
    }
}
