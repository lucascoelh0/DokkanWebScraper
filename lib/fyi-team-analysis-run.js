"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFyiTeamAnalysis = exports.applyTeamAnalysisCardIdentityContract = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const team_analysis_1 = require("./team-analysis");
const team_analysis_artifacts_1 = require("./team-analysis-artifacts");
const DEFAULT_OUTPUT_DIR = "data/fyi-characters/latest";
const DEFAULT_CHARACTER_DATASET_PATH = `${DEFAULT_OUTPUT_DIR}/characters.json.gz`;
const DEFAULT_CHARACTER_MANIFEST_PATH = `${DEFAULT_OUTPUT_DIR}/characters-manifest.json`;
const DEFAULT_CATALOG_PATH = "data/fyi-character-catalog/latest/character-catalog.json";
function applyTeamAnalysisCardIdentityContract(entries, contract) {
    if (!contract)
        return entries;
    return entries.map(entry => {
        const identity = contract.get(entry.id);
        return identity
            ? {
                ...entry,
                canonicalId: identity.canonicalId,
                characterId: identity.gameCharacterId,
            }
            : entry;
    });
}
exports.applyTeamAnalysisCardIdentityContract = applyTeamAnalysisCardIdentityContract;
async function runFyiTeamAnalysis(options) {
    const [characterGzip, manifestText, catalogText] = await Promise.all([
        (0, promises_1.readFile)(options.characterDatasetPath),
        (0, promises_1.readFile)(options.characterManifestPath, "utf8"),
        (0, promises_1.readFile)(options.catalogPath, "utf8"),
    ]);
    const characterManifest = JSON.parse(manifestText);
    assertCharacterManifestMatchesPayload(characterManifest, characterGzip);
    const characters = JSON.parse((0, zlib_1.gunzipSync)(characterGzip).toString("utf8"));
    if (characters.length !== characterManifest.characterCount) {
        throw new Error(`Character manifest count ${characterManifest.characterCount} does not match ${characters.length}.`);
    }
    const catalog = JSON.parse(catalogText);
    const catalogEntries = applyTeamAnalysisCardIdentityContract(catalog.characters, options.cardIdentityContract);
    const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(characters, catalogEntries, {
        generatedAt: characterManifest.generatedAt,
        sourceCharacterDatasetVersion: characterManifest.datasetVersion,
        sourceCharacterPayloadSha256: characterManifest.sha256,
        ...(options.nameIdentityContract ? { nameIdentityContract: options.nameIdentityContract } : {}),
        ...(options.cardIdentityContract ? { cardIdentityContract: options.cardIdentityContract } : {}),
        ...(options.activeSkillActivationContract
            ? { activeSkillActivationContract: options.activeSkillActivationContract }
            : {}),
    });
    (0, team_analysis_1.assertValidTeamAnalysisDataset)(dataset, characters, catalogEntries, {
        ...(options.cardIdentityContract ? { cardIdentityContract: options.cardIdentityContract } : {}),
        ...(options.activeSkillActivationContract
            ? { activeSkillActivationContract: options.activeSkillActivationContract }
            : {}),
    });
    const coverage = (0, team_analysis_1.buildTeamAnalysisCoverageReport)(dataset);
    const artifact = (0, team_analysis_artifacts_1.buildTeamAnalysisArtifact)(dataset);
    const artifactIssues = (0, team_analysis_artifacts_1.validateTeamAnalysisArtifact)(artifact, dataset);
    if (artifactIssues.length > 0) {
        throw new Error(`Team analysis artifact validation failed:\n${artifactIssues.join("\n")}`);
    }
    await (0, team_analysis_artifacts_1.writeTeamAnalysisBundle)(options.outputDir, artifact, coverage);
    return {
        datasetPath: (0, path_1.resolve)(options.outputDir, artifact.manifest.fileName),
        manifestPath: (0, path_1.resolve)(options.outputDir, "team-analysis-manifest.json"),
        coveragePath: (0, path_1.resolve)(options.outputDir, "team-analysis-coverage.json"),
        compressedSizeBytes: artifact.manifest.sizeBytes,
        uncompressedSizeBytes: artifact.manifest.uncompressedSizeBytes,
        stateCount: dataset.stateCount,
        passiveStateCount: coverage.passiveStateCount,
        supportedRuleCount: dataset.supportedRuleCount,
        partialRuleCount: dataset.partialRuleCount,
        unknownRuleCount: dataset.unknownRuleCount,
    };
}
exports.runFyiTeamAnalysis = runFyiTeamAnalysis;
function assertCharacterManifestMatchesPayload(manifest, gzipBuffer) {
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip") {
        throw new Error("Unsupported character manifest schema or compression.");
    }
    if (manifest.sha256 !== (0, team_analysis_artifacts_1.sha256)(gzipBuffer)) {
        throw new Error("Character payload SHA-256 does not match its manifest.");
    }
    if (manifest.sizeBytes !== gzipBuffer.byteLength) {
        throw new Error("Character payload size does not match its manifest.");
    }
}
function parseArgs(argv) {
    const values = new Map();
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith("--")) {
            throw new Error(`Unexpected argument: ${token}`);
        }
        const [name, inlineValue] = token.split("=", 2);
        if (inlineValue !== undefined) {
            values.set(name, inlineValue);
            continue;
        }
        const value = argv[index + 1];
        if (!value || value.startsWith("--")) {
            throw new Error(`Missing value for ${name}.`);
        }
        values.set(name, value);
        index += 1;
    }
    return {
        outputDir: (0, path_1.resolve)(values.get("--output-dir") ?? DEFAULT_OUTPUT_DIR),
        characterDatasetPath: (0, path_1.resolve)(values.get("--characters") ?? DEFAULT_CHARACTER_DATASET_PATH),
        characterManifestPath: (0, path_1.resolve)(values.get("--character-manifest") ?? DEFAULT_CHARACTER_MANIFEST_PATH),
        catalogPath: (0, path_1.resolve)(values.get("--catalog") ?? DEFAULT_CATALOG_PATH),
    };
}
async function main() {
    const report = await runFyiTeamAnalysis(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(report, null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=fyi-team-analysis-run.js.map