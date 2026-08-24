"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGameDbCharacterReleaseCandidate = exports.assertTeamAnalysisBoundToCharacterArtifact = exports.assertFreshCandidateOutput = exports.parseGameDbCharacterReleaseCandidateArgs = exports.GAME_DB_CHARACTER_RELEASE_CANDIDATE_ROOT = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const dataset_artifacts_1 = require("../dataset-artifacts");
const format_json_1 = require("../format-json");
const fyi_team_analysis_run_1 = require("../fyi-team-analysis-run");
const game_db_app_projection_1 = require("./game-db-app-projection");
const game_db_character_release_overlay_1 = require("./game-db-character-release-overlay");
const game_db_experiment_1 = require("./game-db-experiment");
const game_db_name_identity_1 = require("./game-db-name-identity");
const game_db_active_skill_1 = require("./game-db-active-skill");
const game_db_source_1 = require("./game-db-source");
const DEFAULT_BASELINE_DIR = (0, path_1.resolve)("data", "fyi-characters", "latest");
const DEFAULT_CATALOG_PATH = (0, path_1.resolve)("data", "fyi-character-catalog", "latest", "character-catalog.json");
exports.GAME_DB_CHARACTER_RELEASE_CANDIDATE_ROOT = (0, path_1.resolve)("game-db", "data", "game-db-character-release-candidate");
function defaultOutputDir() {
    return (0, path_1.resolve)(exports.GAME_DB_CHARACTER_RELEASE_CANDIDATE_ROOT, `run-${new Date().toISOString().replace(/[:.]/g, "-")}`);
}
function parseGameDbCharacterReleaseCandidateArgs(args) {
    const values = new Map();
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (!["--first-party-dir", "--card-ids", "--baseline-dir", "--output-dir", "--catalog"].includes(token)) {
            throw new Error(`unsupported release candidate argument ${token}`);
        }
        if (values.has(token))
            throw new Error(`duplicate release candidate argument ${token}`);
        const value = args[++index];
        if (!value || value.startsWith("--"))
            throw new Error(`missing value for ${token}`);
        values.set(token, value);
    }
    const firstPartyDir = values.get("--first-party-dir");
    const cardIds = values.get("--card-ids")?.split(",").map(value => value.trim()).filter(Boolean) ?? [];
    if (!firstPartyDir)
        throw new Error("missing --first-party-dir");
    if (cardIds.length === 0 || new Set(cardIds).size !== cardIds.length || cardIds.some(id => !/^\d+$/.test(id))) {
        throw new Error("--card-ids must contain unique numeric IDs");
    }
    return {
        firstPartyDir: (0, path_1.resolve)(firstPartyDir),
        cardIds,
        baselineDir: (0, path_1.resolve)(values.get("--baseline-dir") ?? DEFAULT_BASELINE_DIR),
        outputDir: (0, path_1.resolve)(values.get("--output-dir") ?? defaultOutputDir()),
        catalogPath: (0, path_1.resolve)(values.get("--catalog") ?? DEFAULT_CATALOG_PATH),
    };
}
exports.parseGameDbCharacterReleaseCandidateArgs = parseGameDbCharacterReleaseCandidateArgs;
function isStrictlyContained(root, target) {
    const path = (0, path_1.relative)((0, path_1.resolve)(root), (0, path_1.resolve)(target));
    return path.length > 0
        && path !== ".."
        && !path.startsWith(`..${path_1.sep}`)
        && !(0, path_1.isAbsolute)(path);
}
async function assertFreshCandidateOutput(outputDir, baselineDir) {
    await (0, promises_1.mkdir)(exports.GAME_DB_CHARACTER_RELEASE_CANDIDATE_ROOT, { recursive: true });
    const canonicalRoot = await (0, promises_1.realpath)(exports.GAME_DB_CHARACTER_RELEASE_CANDIDATE_ROOT);
    const canonicalParent = await (0, promises_1.realpath)((0, path_1.dirname)(outputDir));
    const resolvedOutput = (0, path_1.resolve)(outputDir);
    const resolvedBaseline = (0, path_1.resolve)(baselineDir);
    if (!isStrictlyContained(canonicalRoot, resolvedOutput)
        || (!isStrictlyContained(canonicalRoot, canonicalParent) && canonicalParent !== canonicalRoot)) {
        throw new Error("release candidate output must stay inside the dedicated candidate root");
    }
    if (resolvedOutput === resolvedBaseline
        || isStrictlyContained(resolvedOutput, resolvedBaseline)
        || isStrictlyContained(resolvedBaseline, resolvedOutput)) {
        throw new Error("release candidate output must not overlap the baseline catalog");
    }
    if (await (0, promises_1.lstat)(resolvedOutput).catch(() => undefined)) {
        throw new Error("release candidate output must be a fresh directory");
    }
}
exports.assertFreshCandidateOutput = assertFreshCandidateOutput;
function sha256(bytes) {
    return (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
async function readBaseline(directory) {
    const manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(directory, "characters-manifest.json"), "utf8"));
    const payload = await (0, promises_1.readFile)((0, path_1.resolve)(directory, (0, path_1.basename)(manifest.fileName)));
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip"
        || manifest.sizeBytes !== payload.length || manifest.sha256 !== sha256(payload)) {
        throw new Error("baseline character manifest does not match its payload");
    }
    const raw = (0, zlib_1.gunzipSync)(payload);
    if (raw.length !== manifest.uncompressedSizeBytes)
        throw new Error("baseline character raw size mismatch");
    const characters = JSON.parse(raw.toString("utf8"));
    if (!Array.isArray(characters) || characters.length !== manifest.characterCount) {
        throw new Error("baseline character count mismatch");
    }
    return { characters, manifest, payload };
}
function assertTeamAnalysisBoundToCharacterArtifact(teamAnalysisManifest, characterManifest) {
    if (teamAnalysisManifest.sourceCharacterDatasetVersion !== characterManifest.datasetVersion
        || teamAnalysisManifest.sourceCharacterPayloadSha256 !== characterManifest.sha256) {
        throw new Error("Team Analysis candidate is not bound to the generated Character payload");
    }
}
exports.assertTeamAnalysisBoundToCharacterArtifact = assertTeamAnalysisBoundToCharacterArtifact;
async function buildGameDbCharacterReleaseCandidate(options) {
    await assertFreshCandidateOutput(options.outputDir, options.baselineDir);
    const baseline = await readBaseline(options.baselineDir);
    const metadata = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(options.firstPartyDir, "metadata.json"), "utf8"));
    if (metadata?.source !== "first-party-export")
        throw new Error("game DB source is not a first-party export");
    if (typeof metadata.dbVersion !== "string" || !/^\d+$/.test(metadata.dbVersion)) {
        throw new Error("game DB source has an invalid dbVersion");
    }
    const sourceConfig = (0, game_db_source_1.resolveGameDbSourceConfig)(options.firstPartyDir);
    const tables = await (0, game_db_experiment_1.loadRequiredGameDbTables)(sourceConfig);
    const nameIdentityContract = (0, game_db_name_identity_1.buildGameDbNameIdentityContract)(tables);
    const activeSkillActivationContract = (0, game_db_active_skill_1.buildGameDbActiveSkillActivationContract)(tables);
    const snapshots = (0, game_db_experiment_1.buildGameDbCharacterSnapshots)(options.cardIds, tables);
    const projections = (0, game_db_app_projection_1.projectGameDbCharactersToDokkanpanion)(snapshots, {
        sourceVersion: metadata.dbVersion,
    });
    const overlay = (0, game_db_character_release_overlay_1.overlayGameDbCharacterReleaseStates)(baseline.characters, projections, options.cardIds);
    const generatedAt = new Date().toISOString();
    const artifact = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)(overlay.characters, {
        datasetVersion: generatedAt,
        generatedAt,
        fileName: "characters.json.gz",
    });
    await (0, dataset_artifacts_1.writeCharacterDatasetBundle)(options.outputDir, artifact, { manifestFileName: "characters-manifest.json" });
    const teamAnalysis = await (0, fyi_team_analysis_run_1.runFyiTeamAnalysis)({
        outputDir: (0, path_1.resolve)(options.outputDir, "team-analysis"),
        characterDatasetPath: (0, path_1.resolve)(options.outputDir, artifact.manifest.fileName),
        characterManifestPath: (0, path_1.resolve)(options.outputDir, "characters-manifest.json"),
        catalogPath: options.catalogPath,
        nameIdentityContract,
        activeSkillActivationContract,
    });
    const teamAnalysisManifest = JSON.parse(await (0, promises_1.readFile)(teamAnalysis.manifestPath, "utf8"));
    assertTeamAnalysisBoundToCharacterArtifact(teamAnalysisManifest, artifact.manifest);
    const reportPath = (0, path_1.resolve)(options.outputDir, "release-state-overlay-report.json");
    await (0, format_json_1.writeFormattedJson)(reportPath, {
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
        datasetPath: (0, path_1.resolve)(options.outputDir, artifact.manifest.fileName),
        manifestPath: (0, path_1.resolve)(options.outputDir, "characters-manifest.json"),
        reportPath,
        teamAnalysisDatasetPath: teamAnalysis.datasetPath,
        teamAnalysisManifestPath: teamAnalysis.manifestPath,
    };
}
exports.buildGameDbCharacterReleaseCandidate = buildGameDbCharacterReleaseCandidate;
async function main() {
    const result = await buildGameDbCharacterReleaseCandidate(parseGameDbCharacterReleaseCandidateArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=game-db-character-release-candidate.js.map