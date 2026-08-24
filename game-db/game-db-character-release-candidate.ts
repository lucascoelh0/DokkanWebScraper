import { createHash } from "crypto";
import { lstat, mkdir, readFile, realpath } from "fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "path";
import { gunzipSync } from "zlib";
import type { Character } from "../character";
import { buildCharacterDatasetArtifact, DatasetManifest, writeCharacterDatasetBundle } from "../dataset-artifacts";
import { writeFormattedJson } from "../format-json";
import { runFyiTeamAnalysis } from "../fyi-team-analysis-run";
import type { TeamAnalysisManifest } from "../team-analysis-artifacts";
import { projectGameDbCharactersToDokkanpanion } from "./game-db-app-projection";
import { overlayGameDbCharacterReleaseStates } from "./game-db-character-release-overlay";
import { buildGameDbCharacterSnapshots, loadRequiredGameDbTables } from "./game-db-experiment";
import {
    buildGameDbCardIdentityContract,
    buildGameDbNameIdentityContract,
} from "./game-db-name-identity";
import { buildGameDbActiveSkillActivationContract } from "./game-db-active-skill";
import { resolveGameDbSourceConfig } from "./game-db-source";

const DEFAULT_BASELINE_DIR = resolve("data", "fyi-characters", "latest");
const DEFAULT_CATALOG_PATH = resolve("data", "fyi-character-catalog", "latest", "character-catalog.json");
export const GAME_DB_CHARACTER_RELEASE_CANDIDATE_ROOT = resolve(
    "game-db",
    "data",
    "game-db-character-release-candidate",
);

function defaultOutputDir(): string {
    return resolve(
        GAME_DB_CHARACTER_RELEASE_CANDIDATE_ROOT,
        `run-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    );
}

interface CandidateOptions {
    firstPartyDir: string,
    cardIds: string[],
    baselineDir: string,
    outputDir: string,
    catalogPath: string,
}

export function parseGameDbCharacterReleaseCandidateArgs(args: string[]): CandidateOptions {
    const values = new Map<string, string>();
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (!["--first-party-dir", "--card-ids", "--baseline-dir", "--output-dir", "--catalog"].includes(token)) {
            throw new Error(`unsupported release candidate argument ${token}`);
        }
        if (values.has(token)) throw new Error(`duplicate release candidate argument ${token}`);
        const value = args[++index];
        if (!value || value.startsWith("--")) throw new Error(`missing value for ${token}`);
        values.set(token, value);
    }

    const firstPartyDir = values.get("--first-party-dir");
    const cardIds = values.get("--card-ids")?.split(",").map(value => value.trim()).filter(Boolean) ?? [];
    if (!firstPartyDir) throw new Error("missing --first-party-dir");
    if (cardIds.length === 0 || new Set(cardIds).size !== cardIds.length || cardIds.some(id => !/^\d+$/.test(id))) {
        throw new Error("--card-ids must contain unique numeric IDs");
    }

    return {
        firstPartyDir: resolve(firstPartyDir),
        cardIds,
        baselineDir: resolve(values.get("--baseline-dir") ?? DEFAULT_BASELINE_DIR),
        outputDir: resolve(values.get("--output-dir") ?? defaultOutputDir()),
        catalogPath: resolve(values.get("--catalog") ?? DEFAULT_CATALOG_PATH),
    };
}

function isStrictlyContained(root: string, target: string): boolean {
    const path = relative(resolve(root), resolve(target));
    return path.length > 0
        && path !== ".."
        && !path.startsWith(`..${sep}`)
        && !isAbsolute(path);
}

export async function assertFreshCandidateOutput(outputDir: string, baselineDir: string): Promise<void> {
    await mkdir(GAME_DB_CHARACTER_RELEASE_CANDIDATE_ROOT, { recursive: true });
    const canonicalRoot = await realpath(GAME_DB_CHARACTER_RELEASE_CANDIDATE_ROOT);
    const canonicalParent = await realpath(dirname(outputDir));
    const resolvedOutput = resolve(outputDir);
    const resolvedBaseline = resolve(baselineDir);
    if (!isStrictlyContained(canonicalRoot, resolvedOutput)
        || (!isStrictlyContained(canonicalRoot, canonicalParent) && canonicalParent !== canonicalRoot)) {
        throw new Error("release candidate output must stay inside the dedicated candidate root");
    }
    if (resolvedOutput === resolvedBaseline
        || isStrictlyContained(resolvedOutput, resolvedBaseline)
        || isStrictlyContained(resolvedBaseline, resolvedOutput)) {
        throw new Error("release candidate output must not overlap the baseline catalog");
    }
    if (await lstat(resolvedOutput).catch(() => undefined)) {
        throw new Error("release candidate output must be a fresh directory");
    }
}

function sha256(bytes: Buffer): string {
    return createHash("sha256").update(bytes).digest("hex");
}

async function readBaseline(directory: string): Promise<{
    characters: Character[],
    manifest: DatasetManifest,
    payload: Buffer,
}> {
    const manifest = JSON.parse(await readFile(resolve(directory, "characters-manifest.json"), "utf8")) as DatasetManifest;
    const payload = await readFile(resolve(directory, basename(manifest.fileName)));
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip"
        || manifest.sizeBytes !== payload.length || manifest.sha256 !== sha256(payload)) {
        throw new Error("baseline character manifest does not match its payload");
    }
    const raw = gunzipSync(payload);
    if (raw.length !== manifest.uncompressedSizeBytes) throw new Error("baseline character raw size mismatch");
    const characters = JSON.parse(raw.toString("utf8")) as Character[];
    if (!Array.isArray(characters) || characters.length !== manifest.characterCount) {
        throw new Error("baseline character count mismatch");
    }
    return { characters, manifest, payload };
}

export function assertTeamAnalysisBoundToCharacterArtifact(
    teamAnalysisManifest: TeamAnalysisManifest,
    characterManifest: DatasetManifest,
): void {
    if (teamAnalysisManifest.sourceCharacterDatasetVersion !== characterManifest.datasetVersion
        || teamAnalysisManifest.sourceCharacterPayloadSha256 !== characterManifest.sha256) {
        throw new Error("Team Analysis candidate is not bound to the generated Character payload");
    }
}

export async function buildGameDbCharacterReleaseCandidate(options: CandidateOptions): Promise<{
    datasetPath: string,
    manifestPath: string,
    reportPath: string,
    teamAnalysisDatasetPath: string,
    teamAnalysisManifestPath: string,
}> {
    await assertFreshCandidateOutput(options.outputDir, options.baselineDir);
    const baseline = await readBaseline(options.baselineDir);
    const metadata = JSON.parse(await readFile(resolve(options.firstPartyDir, "metadata.json"), "utf8"));
    if (metadata?.source !== "first-party-export") throw new Error("game DB source is not a first-party export");
    if (typeof metadata.dbVersion !== "string" || !/^\d+$/.test(metadata.dbVersion)) {
        throw new Error("game DB source has an invalid dbVersion");
    }

    const sourceConfig = resolveGameDbSourceConfig(options.firstPartyDir);
    const tables = await loadRequiredGameDbTables(sourceConfig);
    const nameIdentityContract = buildGameDbNameIdentityContract(tables);
    const cardIdentityContract = buildGameDbCardIdentityContract(tables);
    const activeSkillActivationContract = buildGameDbActiveSkillActivationContract(tables);
    const snapshots = buildGameDbCharacterSnapshots(options.cardIds, tables);
    const projections = projectGameDbCharactersToDokkanpanion(snapshots, {
        sourceVersion: metadata.dbVersion,
    });
    const overlay = overlayGameDbCharacterReleaseStates(baseline.characters, projections, options.cardIds);
    const generatedAt = new Date().toISOString();
    const artifact = buildCharacterDatasetArtifact(overlay.characters, {
        datasetVersion: generatedAt,
        generatedAt,
        fileName: "characters.json.gz",
    });

    await writeCharacterDatasetBundle(options.outputDir, artifact, { manifestFileName: "characters-manifest.json" });
    const teamAnalysis = await runFyiTeamAnalysis({
        outputDir: resolve(options.outputDir, "team-analysis"),
        characterDatasetPath: resolve(options.outputDir, artifact.manifest.fileName),
        characterManifestPath: resolve(options.outputDir, "characters-manifest.json"),
        catalogPath: options.catalogPath,
        nameIdentityContract,
        cardIdentityContract,
        activeSkillActivationContract,
    });
    const teamAnalysisManifest = JSON.parse(
        await readFile(teamAnalysis.manifestPath, "utf8"),
    ) as TeamAnalysisManifest;
    assertTeamAnalysisBoundToCharacterArtifact(teamAnalysisManifest, artifact.manifest);
    const reportPath = resolve(options.outputDir, "release-state-overlay-report.json");
    await writeFormattedJson(reportPath, {
        schemaVersion: 1,
        contract: "dokkan-game-db-character-release-overlay-candidate",
        contractVersion: "1.0.0",
        generatedAt,
        source: {
            kind: "first-party-game-db-over-current-character-catalog",
            noWebsiteScraping: true,
            firstPartyExport: {
                directory: options.firstPartyDir,
                dbVersion: metadata.dbVersion,
                assetVersion: metadata.assetVersion,
                apkVersion: metadata.apkVersion,
            },
            baseline: {
                directory: options.baselineDir,
                datasetVersion: baseline.manifest.datasetVersion,
                payloadSha256: baseline.manifest.sha256,
                characterCount: baseline.manifest.characterCount,
            },
        },
        targetCardIds: options.cardIds,
        patches: overlay.patches,
        checks: overlay.checks,
        output: artifact.manifest,
        teamAnalysis: {
            datasetPath: teamAnalysis.datasetPath,
            manifestPath: teamAnalysis.manifestPath,
            coveragePath: teamAnalysis.coveragePath,
            manifest: teamAnalysisManifest,
            compressedSizeBytes: teamAnalysis.compressedSizeBytes,
            uncompressedSizeBytes: teamAnalysis.uncompressedSizeBytes,
            stateCount: teamAnalysis.stateCount,
            passiveStateCount: teamAnalysis.passiveStateCount,
            supportedRuleCount: teamAnalysis.supportedRuleCount,
            partialRuleCount: teamAnalysis.partialRuleCount,
            unknownRuleCount: teamAnalysis.unknownRuleCount,
        },
        readiness: {
            charactersCandidate: "GO",
            teamAnalysisCandidate: "GO",
            sourcePayloadBound: "GO",
            remoteDryRun: "NO-GO",
            publication: "NO-GO",
        },
    });

    return {
        datasetPath: resolve(options.outputDir, artifact.manifest.fileName),
        manifestPath: resolve(options.outputDir, "characters-manifest.json"),
        reportPath,
        teamAnalysisDatasetPath: teamAnalysis.datasetPath,
        teamAnalysisManifestPath: teamAnalysis.manifestPath,
    };
}

async function main(): Promise<void> {
    const result = await buildGameDbCharacterReleaseCandidate(
        parseGameDbCharacterReleaseCandidateArgs(process.argv.slice(2)),
    );
    console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
