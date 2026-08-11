import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { gunzipSync } from "zlib";
import type { Character } from "./character";
import { resolveContainedArtifactPath } from "./artifact-path";
import type { DatasetManifest } from "./dataset-artifacts";
import { DatabaseCharacterArtifactPathError } from "./database-characters/artifact-path";
import { CHARACTER_COMPACT_PINNED_RELEASE, CharacterCompactManifest, CharacterCompactProjection } from "./database-characters/compact-contract";
import { createCharacterCompactRarityOverlay, CharacterCompactOverlayPatch } from "./database-characters/compact-overlay";
import { validateCharacterCompactArtifact } from "./database-characters/compact-validator";
import {
    artifactLineage,
    candidateReadyMarkerBytes,
    FYI_CHARACTER_CANDIDATE_FILES,
    FYI_CHARACTER_CANDIDATE_DIRECTORY,
    FYI_CHARACTER_CANDIDATE_READY_FILE,
    FYI_CHARACTER_K15_DIRECTORY,
    FYI_K19_AUDITED_BASELINE_PIN,
    FyiCharacterCandidateK19Report,
    formattedJsonBytes,
    resolveFyiCandidateDirectory,
    resolveFyiK15Directory,
    scopeCharacterCompactProjectionToTarget,
} from "./fyi-character-candidate";

const ISSUE_LIMIT = 5;
const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

export interface FyiCharacterCandidateReadinessReport {
    schemaVersion: 1;
    contract: "dokkan-fyi-character-database-candidate-readiness-k20";
    contractVersion: "1.0.0";
    generatedAt: string;
    mode: "offline_candidate_compare_readiness";
    sources: FyiCharacterCandidateK19Report["sources"] & { candidate: FyiCharacterCandidateK19Report["candidate"] };
    scope: FyiCharacterCandidateK19Report["targetScope"];
    checks: {
        baselineManifestMatchesBundle: boolean;
        candidateManifestMatchesBundle: boolean;
        baselineLineageMatchesK19: boolean;
        candidateLineageMatchesK19: boolean;
        artifactVersionsMatchK19: boolean;
        runReportMatchesCandidate: boolean;
        candidateCommitMarkerValid: boolean;
        k19ContractValid: boolean;
        k15LineageMatchesK19: boolean;
        targetScopeMatchesK19: boolean;
        k19OverlayMatchesFreshK18: boolean;
        k19SafetyBoundaryPreserved: boolean;
        candidateMatchesFreshK18Overlay: boolean;
        onlyAuthorizedRarityPathsChanged: boolean;
        typeByteSemanticallyEqual: boolean;
        nonRarityByteSemanticallyEqual: boolean;
        cardinalityPreserved: boolean;
        idsPreserved: boolean;
        orderPreserved: boolean;
        portraitReferencesPreserved: boolean;
        auditedCountsMatchWhenPinned: boolean;
        auditedPinDeclarationMatches: boolean;
        productionPublisherAndroidR2Untouched: true;
    };
    changes: {
        authorizedRarityPaths: number;
        appliedRarityPaths: number;
        typeChanges: number;
        nonRarityChanges: number;
        cardinalityDelta: number;
    };
    failures: { total: number; examples: string[]; exampleLimit: 5 };
    readiness: {
        candidateGenerationValidation: "GO" | "NO-GO";
        promotion: "NO-GO";
        production: "NO-GO";
        publisher: "NO-GO";
        android: "NO-GO";
        r2: "NO-GO";
    };
}

export interface FyiCharacterCandidateReadinessInput {
    baselineGzip: Buffer;
    baselineManifest: DatasetManifest;
    baselineManifestBytes: Buffer;
    candidateGzip: Buffer;
    candidateManifest: DatasetManifest;
    candidateManifestBytes: Buffer;
    candidateReadyMarkerBytes: Buffer;
    k19Report: FyiCharacterCandidateK19Report;
    runReport: {
        generatedAt?: string;
        publishable?: boolean;
        fullCatalog?: boolean;
        failedCharacterIds?: unknown[];
        missingCharacterIds?: unknown[];
        duplicateCharacterIds?: unknown[];
    };
    k15Projection: CharacterCompactProjection;
    k15Manifest: CharacterCompactManifest;
}

interface DecodedArtifact {
    characters: Character[];
    jsonText: string;
    manifestValid: boolean;
    lineage: ReturnType<typeof artifactLineage>;
}

function decodeArtifact(gzip: Buffer, manifest: DatasetManifest, manifestBytes: Buffer, manifestFile: "baseline-characters-manifest.json" | "characters-manifest.json"): DecodedArtifact {
    let raw = Buffer.alloc(0);
    let characters: Character[] = [];
    try {
        raw = gunzipSync(gzip);
        const parsed = JSON.parse(raw.toString("utf8"));
        if (Array.isArray(parsed)) characters = parsed as Character[];
    } catch {
        // Invalid compressed or JSON bytes remain a deterministic failed artifact.
    }
    const expectedManifestBytes = formattedJsonBytes(manifest);
    const manifestValid = manifest.schemaVersion === 1
        && manifest.compression === "gzip"
        && manifest.fileName === (manifestFile === "characters-manifest.json" ? "characters.json.gz" : "baseline-characters.json.gz")
        && manifest.sha256 === sha256(gzip)
        && manifest.sizeBytes === gzip.length
        && manifest.uncompressedSizeBytes === raw.length
        && manifest.characterCount === characters.length
        && manifestBytes.equals(expectedManifestBytes);
    const artifact = {
        jsonText: raw.toString("utf8"), gzipBuffer: gzip, manifest,
    } as any;
    return { characters, jsonText: raw.toString("utf8"), manifestValid, lineage: artifactLineage(artifact, manifestFile) };
}

function same(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

function structuralOrder(characters: Character[]): string[] {
    const result: string[] = [];
    const visit = (value: any, path: string): void => {
        if (!value || value.id === undefined || value.id === null) return;
        result.push(`${path}:${String(value.id)}`);
        const transformations = Array.isArray(value.transformations) ? value.transformations : [];
        transformations.forEach((item: any, index: number) => visit(item, `${path}.transformations[${index}]`));
    };
    characters.forEach((value, index) => visit(value, `$[${index}]`));
    return result;
}

function stateValues(characters: Character[], field: "type" | "portrait"): unknown[] {
    const values: unknown[] = [];
    const visit = (value: any, path: string): void => {
        if (!value || value.id === undefined || value.id === null) return;
        values.push(field === "type"
            ? [path, String(value.id), value.type]
            : [path, String(value.id), value.portraitURL, value.portraitFilename, value.portraitSpec]);
        const transformations = Array.isArray(value.transformations) ? value.transformations : [];
        transformations.forEach((item: any, index: number) => visit(item, `${path}.transformations[${index}]`));
    };
    characters.forEach((value, index) => visit(value, `$[${index}]`));
    return values;
}

function targetAtPath(characters: Character[], path: string): any {
    const match = /^\$\[(\d+)\]((?:\.transformations\[\d+\])*)$/.exec(path);
    if (!match) throw new Error(`K20 invalid authorized path ${path}`);
    let target: any = characters[Number(match[1])];
    const nested = /\.transformations\[(\d+)\]/g;
    let part: RegExpExecArray | null;
    while ((part = nested.exec(match[2])) !== null) target = target?.transformations?.[Number(part[1])];
    if (!target) throw new Error(`K20 authorized path missing ${path}`);
    return target;
}

function restoreAuthorizedRarities(candidate: Character[], baseline: Character[], patches: CharacterCompactOverlayPatch[]): Character[] {
    const restored = JSON.parse(JSON.stringify(candidate)) as Character[];
    for (const patch of patches) {
        const target = targetAtPath(restored, patch.productionPath);
        const original = targetAtPath(baseline, patch.productionPath);
        if (Object.prototype.hasOwnProperty.call(original, "rarity") && original.rarity !== undefined) target.rarity = original.rarity;
        else delete target.rarity;
    }
    return restored;
}

function auditedCountsMatch(
    baseline: DecodedArtifact,
    manifest: DatasetManifest,
    scope: ReturnType<typeof scopeCharacterCompactProjectionToTarget>,
    overlay: ReturnType<typeof createCharacterCompactRarityOverlay>["decision"],
): boolean {
    if (!matchesAuditedBaseline(baseline, manifest)) return true;
    const expected = FYI_K19_AUDITED_BASELINE_PIN;
    return scope.targetStateCount === expected.targetStateCount
        && scope.targetScopedK15Records === expected.targetScopedK15Records
        && scope.excludedByTargetCatalog === expected.excludedByTargetCatalog
        && scope.targetStatesNotCovered === expected.targetStatesNotCovered
        && overlay.evaluation.type.agreements === expected.typeAgreements
        && overlay.evaluation.type.differences === 0
        && overlay.evaluation.rarity.agreementsBeforeOverlay === expected.rarityAgreements
        && overlay.evaluation.rarity.nullFillCandidates === expected.rarityNullFills
        && overlay.evaluation.rarity.nonNullDifferences === 0;
}

function matchesAuditedBaseline(baseline: DecodedArtifact, manifest: DatasetManifest): boolean {
    const expected = FYI_K19_AUDITED_BASELINE_PIN;
    return baseline.lineage.payloadSha256 === expected.payloadSha256
        && baseline.lineage.payloadSizeBytes === expected.payloadSizeBytes
        && baseline.lineage.characterCount === expected.characterCount
        && manifest.datasetVersion === expected.datasetVersion
        && manifest.generatedAt === expected.generatedAt;
}

export function compareFyiCharacterCandidate(input: FyiCharacterCandidateReadinessInput): FyiCharacterCandidateReadinessReport {
    const baseline = decodeArtifact(input.baselineGzip, input.baselineManifest, input.baselineManifestBytes, "baseline-characters-manifest.json");
    const candidate = decodeArtifact(input.candidateGzip, input.candidateManifest, input.candidateManifestBytes, "characters-manifest.json");
    const scope = scopeCharacterCompactProjectionToTarget(input.k15Projection, baseline.characters);
    const overlay = createCharacterCompactRarityOverlay(baseline.characters, scope.projection);
    let restored: Character[] = [];
    let authorizedPathRestorationValid = true;
    try {
        restored = restoreAuthorizedRarities(candidate.characters, baseline.characters, overlay.patches);
    } catch {
        authorizedPathRestorationValid = false;
    }
    const baselineOrder = structuralOrder(baseline.characters);
    const candidateOrder = structuralOrder(candidate.characters);
    const checks = {
        baselineManifestMatchesBundle: baseline.manifestValid,
        candidateManifestMatchesBundle: candidate.manifestValid,
        baselineLineageMatchesK19: same(baseline.lineage, input.k19Report.sources.baselineFyi),
        candidateLineageMatchesK19: same(candidate.lineage, input.k19Report.candidate),
        artifactVersionsMatchK19: input.baselineManifest.datasetVersion === input.k19Report.generatedAt
            && input.baselineManifest.generatedAt === input.k19Report.generatedAt
            && input.candidateManifest.datasetVersion === input.k19Report.generatedAt
            && input.candidateManifest.generatedAt === input.k19Report.generatedAt,
        runReportMatchesCandidate: input.runReport.generatedAt === input.k19Report.generatedAt
            && input.runReport.publishable === true
            && input.runReport.fullCatalog === true
            && (input.runReport.failedCharacterIds?.length ?? -1) === 0
            && (input.runReport.missingCharacterIds?.length ?? -1) === 0
            && (input.runReport.duplicateCharacterIds?.length ?? -1) === 0,
        candidateCommitMarkerValid: input.candidateReadyMarkerBytes.equals(candidateReadyMarkerBytes([
            { name: "baseline-characters.json.gz", bytes: input.baselineGzip },
            { name: "baseline-characters-manifest.json", bytes: input.baselineManifestBytes },
            { name: "characters.json.gz", bytes: input.candidateGzip },
            { name: "characters-manifest.json", bytes: input.candidateManifestBytes },
            { name: "run-report.json", bytes: formattedJsonBytes(input.runReport) },
            { name: "candidate-k19-report.json", bytes: formattedJsonBytes(input.k19Report) },
        ])),
        k19ContractValid: input.k19Report.schemaVersion === 1
            && input.k19Report.contract === "dokkan-fyi-character-database-candidate-k19"
            && input.k19Report.contractVersion === "1.0.0"
            && input.k19Report.mode === "explicit_offline_auditable_candidate",
        k15LineageMatchesK19: input.k19Report.sources.k15.contract === input.k15Projection.contract
            && input.k19Report.sources.k15.contractVersion === input.k15Projection.contractVersion
            && input.k19Report.sources.k15.datasetVersion === input.k15Manifest.datasetVersion
            && input.k19Report.sources.k15.datasetVersion === input.k15Projection.datasetVersion
            && input.k19Report.sources.k15.manifestFile === CHARACTER_COMPACT_PINNED_RELEASE.manifestFile
            && input.k19Report.sources.k15.manifestSha256 === CHARACTER_COMPACT_PINNED_RELEASE.manifestSha256
            && input.k19Report.sources.k15.payloadSha256 === input.k15Manifest.sha256
            && input.k19Report.sources.k15.payloadFile === input.k15Manifest.fileName
            && input.k19Report.sources.k15.recordCount === input.k15Projection.records.length
            && input.k19Report.sources.k15.recordCount === input.k15Manifest.recordCount,
        targetScopeMatchesK19: same({
            structuralIdsOnly: true,
            targetStateCount: scope.targetStateCount,
            targetScopedK15Records: scope.targetScopedK15Records,
            excludedByTargetCatalog: scope.excludedByTargetCatalog,
            targetStatesNotCovered: scope.targetStatesNotCovered,
            targetStatesNotCoveredSample: scope.targetStatesNotCoveredSample,
            outOfScopeIsNotAgreementOrAuthority: true,
        }, input.k19Report.targetScope),
        k19OverlayMatchesFreshK18: same(input.k19Report.overlay, {
            readiness: "GO",
            candidates: overlay.decision.candidates,
            evaluation: overlay.decision.evaluation,
            appliedToClone: overlay.decision.overlayProof.candidatesAppliedToClone,
            examples: overlay.decision.examples,
        }),
        k19SafetyBoundaryPreserved: input.k19Report.safety.explicitOptIn === true
            && input.k19Report.safety.defaultLatestUntouched === true
            && input.k19Report.safety.candidateDirectoryOnly === true
            && input.k19Report.safety.k15ValidatedBeforeAndAfter === true
            && input.k19Report.safety.inMemoryOverlayOnly === true
            && input.k19Report.safety.k11Read === false
            && input.k19Report.safety.dataLatestWritten === false
            && input.k19Report.safety.publisherInvoked === false
            && input.k19Report.safety.androidWritten === false
            && input.k19Report.safety.r2Written === false
            && input.k19Report.readiness.promotion === "NO-GO"
            && input.k19Report.readiness.production === "NO-GO"
            && input.k19Report.readiness.publisher === "NO-GO"
            && input.k19Report.readiness.android === "NO-GO"
            && input.k19Report.readiness.r2 === "NO-GO",
        candidateMatchesFreshK18Overlay: overlay.decision.readiness === "GO" && same(candidate.characters, overlay.characters),
        onlyAuthorizedRarityPathsChanged: overlay.decision.readiness === "GO" && same(candidate.characters, overlay.characters),
        typeByteSemanticallyEqual: same(stateValues(baseline.characters, "type"), stateValues(candidate.characters, "type")),
        nonRarityByteSemanticallyEqual: authorizedPathRestorationValid
            && `${JSON.stringify(restored, null, 2)}\n` === baseline.jsonText,
        cardinalityPreserved: baseline.characters.length === candidate.characters.length && baselineOrder.length === candidateOrder.length,
        idsPreserved: same(baselineOrder.map(item => item.slice(item.indexOf(":"))), candidateOrder.map(item => item.slice(item.indexOf(":")))),
        orderPreserved: same(baselineOrder, candidateOrder),
        portraitReferencesPreserved: same(stateValues(baseline.characters, "portrait"), stateValues(candidate.characters, "portrait")),
        auditedCountsMatchWhenPinned: auditedCountsMatch(baseline, input.baselineManifest, scope, overlay.decision),
        auditedPinDeclarationMatches: input.k19Report.auditedBaseline.exactPinMatch === matchesAuditedBaseline(baseline, input.baselineManifest)
            && input.k19Report.auditedBaseline.expectedCountsApplied === matchesAuditedBaseline(baseline, input.baselineManifest),
        productionPublisherAndroidR2Untouched: true as const,
    };

    const failureNames = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
    const appliedRarityPaths = overlay.decision.readiness === "GO" && same(candidate.characters, overlay.characters)
        ? overlay.decision.overlayProof.candidatesAppliedToClone
        : 0;
    const ready = failureNames.length === 0;
    return {
        schemaVersion: 1,
        contract: "dokkan-fyi-character-database-candidate-readiness-k20",
        contractVersion: "1.0.0",
        generatedAt: input.k19Report.generatedAt,
        mode: "offline_candidate_compare_readiness",
        sources: { ...input.k19Report.sources, candidate: input.k19Report.candidate },
        scope: input.k19Report.targetScope,
        checks,
        changes: {
            authorizedRarityPaths: overlay.patches.length,
            appliedRarityPaths,
            typeChanges: checks.typeByteSemanticallyEqual ? 0 : 1,
            nonRarityChanges: checks.nonRarityByteSemanticallyEqual ? 0 : 1,
            cardinalityDelta: candidate.characters.length - baseline.characters.length,
        },
        failures: { total: failureNames.length, examples: failureNames.slice(0, ISSUE_LIMIT), exampleLimit: ISSUE_LIMIT },
        readiness: {
            candidateGenerationValidation: ready ? "GO" : "NO-GO",
            promotion: "NO-GO", production: "NO-GO", publisher: "NO-GO", android: "NO-GO", r2: "NO-GO",
        },
    };
}

export interface FyiCharacterCandidateReadinessOptions {
    optInK20: true;
    candidateDirectoryName?: typeof FYI_CHARACTER_CANDIDATE_DIRECTORY;
    k15DirectoryName?: typeof FYI_CHARACTER_K15_DIRECTORY;
}

async function readKnownFile(root: string, name: string): Promise<Buffer> {
    const path = await resolveContainedArtifactPath({ trustedRoot: root, untrustedPath: name, expectedType: "file", exactName: name },
        (code, artifactType) => new DatabaseCharacterArtifactPathError(code, artifactType));
    return readFile(path);
}

export async function runFyiCharacterCandidateReadiness(options: FyiCharacterCandidateReadinessOptions): Promise<FyiCharacterCandidateReadinessReport> {
    if (options?.optInK20 !== true) throw new Error("K20 requires explicit opt-in");
    const fyiRoot = resolve(__dirname, "data/fyi-characters");
    const k15Root = resolve(__dirname, "data/database-characters");
    const candidateDirectory = await resolveFyiCandidateDirectory(
        fyiRoot,
        options.candidateDirectoryName ?? FYI_CHARACTER_CANDIDATE_DIRECTORY,
        false,
    );
    const k15Directory = await resolveFyiK15Directory(k15Root, options.k15DirectoryName ?? FYI_CHARACTER_K15_DIRECTORY);
    const k15Before = await validateCharacterCompactArtifact(k15Directory);
    const k15Snapshot = JSON.stringify(k15Before);
    const candidateReadyMarker = await readKnownFile(candidateDirectory, FYI_CHARACTER_CANDIDATE_READY_FILE);
    const [baselineGzip, baselineManifestBytes, candidateGzip, candidateManifestBytes, runReportBytes, k19ReportBytes] = await Promise.all([
        readKnownFile(candidateDirectory, "baseline-characters.json.gz"),
        readKnownFile(candidateDirectory, "baseline-characters-manifest.json"),
        readKnownFile(candidateDirectory, "characters.json.gz"),
        readKnownFile(candidateDirectory, "characters-manifest.json"),
        readKnownFile(candidateDirectory, "run-report.json"),
        readKnownFile(candidateDirectory, "candidate-k19-report.json"),
    ]);
    const report = compareFyiCharacterCandidate({
        baselineGzip,
        baselineManifest: JSON.parse(baselineManifestBytes.toString("utf8")),
        baselineManifestBytes,
        candidateGzip,
        candidateManifest: JSON.parse(candidateManifestBytes.toString("utf8")),
        candidateManifestBytes,
        candidateReadyMarkerBytes: candidateReadyMarker,
        runReport: JSON.parse(runReportBytes.toString("utf8")),
        k19Report: JSON.parse(k19ReportBytes.toString("utf8")),
        k15Projection: k15Before.projection,
        k15Manifest: k15Before.manifest,
    });
    const k15After = await validateCharacterCompactArtifact(k15Directory);
    if (JSON.stringify(k15After) !== k15Snapshot) throw new Error("K20 K15 input changed during readiness comparison");
    return report;
}

export function parseFyiCharacterCandidateReadinessCli(args: string[]): FyiCharacterCandidateReadinessOptions {
    let optInCount = 0;
    const values = new Map<string, string>();
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument === "--opt-in-k20") {
            optInCount++;
            continue;
        }
        if (argument !== "--candidate-dir" && argument !== "--k15-dir") throw new Error(`K20 unsupported argument ${argument}`);
        if (values.has(argument)) throw new Error(`K20 duplicate ${argument}`);
        const value = args[++index];
        if (!value || value.startsWith("--")) throw new Error(`K20 missing value for ${argument}`);
        values.set(argument, value);
    }
    if (optInCount !== 1) throw new Error("K20 requires exactly one --opt-in-k20");
    const candidateDirectoryName = values.get("--candidate-dir") ?? FYI_CHARACTER_CANDIDATE_DIRECTORY;
    const k15DirectoryName = values.get("--k15-dir") ?? FYI_CHARACTER_K15_DIRECTORY;
    if (candidateDirectoryName !== FYI_CHARACTER_CANDIDATE_DIRECTORY) throw new Error("K20 candidate directory name not allowed");
    if (k15DirectoryName !== FYI_CHARACTER_K15_DIRECTORY) throw new Error("K20 K15 directory name not allowed");
    return { optInK20: true, candidateDirectoryName, k15DirectoryName };
}

async function run(): Promise<void> {
    const report = await runFyiCharacterCandidateReadiness(parseFyiCharacterCandidateReadinessCli(process.argv.slice(2)));
    console.log(JSON.stringify(report, null, 2));
    if (report.readiness.candidateGenerationValidation !== "GO") process.exitCode = 1;
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
