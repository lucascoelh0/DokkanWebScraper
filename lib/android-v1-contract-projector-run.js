"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAndroidV1ContractProjector = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const android_v1_contract_projector_1 = require("./android-v1-contract-projector");
const dataset_artifacts_1 = require("./dataset-artifacts");
const team_analysis_artifacts_1 = require("./team-analysis-artifacts");
async function runAndroidV1ContractProjector(options) {
    const resolved = resolveOptions(options);
    await assertFreshOutput(resolved.outputDir, [
        resolved.charactersManifestPath,
        resolved.charactersPayloadPath,
        resolved.teamAnalysisManifestPath,
        resolved.teamAnalysisPayloadPath,
    ]);
    const characterManifest = JSON.parse(await (0, promises_1.readFile)(resolved.charactersManifestPath, "utf8"));
    const characterPayload = await (0, promises_1.readFile)(resolved.charactersPayloadPath);
    const characters = readCharacterDataset(characterManifest, characterPayload);
    const teamManifest = JSON.parse(await (0, promises_1.readFile)(resolved.teamAnalysisManifestPath, "utf8"));
    const teamPayload = await (0, promises_1.readFile)(resolved.teamAnalysisPayloadPath);
    const teamDataset = readTeamAnalysisDataset(teamManifest, teamPayload, characterManifest);
    const projectedCharacters = (0, android_v1_contract_projector_1.projectCharactersForAndroidV1)(characters);
    const characterArtifact = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)(projectedCharacters.characters, {
        datasetVersion: characterManifest.datasetVersion,
        generatedAt: characterManifest.generatedAt,
        fileName: "characters.json.gz",
    });
    const projectedTeam = (0, android_v1_contract_projector_1.projectTeamAnalysisForAndroidV1)(teamDataset, characterArtifact.manifest.sha256);
    const teamArtifact = (0, team_analysis_artifacts_1.buildTeamAnalysisArtifact)(projectedTeam.dataset, {
        fileName: "team-analysis.json.gz",
        datasetVersion: teamManifest.datasetVersion,
    });
    const artifactIssues = (0, team_analysis_artifacts_1.validateTeamAnalysisArtifact)(teamArtifact, projectedTeam.dataset);
    if (artifactIssues.length > 0) {
        throw new Error(`Projected Team Analysis artifact is invalid:\n${artifactIssues.join("\n")}`);
    }
    await (0, promises_1.mkdir)(resolved.outputDir, { recursive: false });
    const files = {
        charactersManifestPath: (0, path_1.resolve)(resolved.outputDir, "characters-manifest.json"),
        charactersPayloadPath: (0, path_1.resolve)(resolved.outputDir, "characters.json.gz"),
        teamAnalysisManifestPath: (0, path_1.resolve)(resolved.outputDir, "team-analysis-manifest.json"),
        teamAnalysisPayloadPath: (0, path_1.resolve)(resolved.outputDir, "team-analysis.json.gz"),
        reportPath: (0, path_1.resolve)(resolved.outputDir, "android-v1-projection-report.json"),
    };
    const report = {
        schemaVersion: 1,
        contract: "dokkanpanion-android-v1-projection",
        projectorVersion: android_v1_contract_projector_1.ANDROID_V1_PROJECTOR_VERSION,
        consumerCommit: android_v1_contract_projector_1.ANDROID_V1_CONSUMER_COMMIT,
        input: {
            characters: characterManifest,
            teamAnalysis: teamManifest,
        },
        output: {
            characters: characterArtifact.manifest,
            teamAnalysis: teamArtifact.manifest,
        },
        changes: {
            characters: projectedCharacters.report,
            teamAnalysis: projectedTeam.report,
        },
        files,
    };
    await Promise.all([
        (0, promises_1.writeFile)(files.charactersPayloadPath, characterArtifact.gzipBuffer),
        (0, promises_1.writeFile)(files.charactersManifestPath, `${JSON.stringify(characterArtifact.manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)(files.teamAnalysisPayloadPath, teamArtifact.gzipBuffer),
        (0, promises_1.writeFile)(files.teamAnalysisManifestPath, `${JSON.stringify(teamArtifact.manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)(files.reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    ]);
    return report;
}
exports.runAndroidV1ContractProjector = runAndroidV1ContractProjector;
function readCharacterDataset(manifest, payload) {
    assertManifestPayload(manifest, payload, "Characters");
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip") {
        throw new Error("Characters input does not use the supported canonical contract.");
    }
    const raw = (0, zlib_1.gunzipSync)(payload);
    if (raw.byteLength !== manifest.uncompressedSizeBytes) {
        throw new Error("Characters input uncompressed size does not match its manifest.");
    }
    const characters = JSON.parse(raw.toString("utf8"));
    if (!Array.isArray(characters) || characters.length !== manifest.characterCount) {
        throw new Error("Characters input count does not match its manifest.");
    }
    return characters;
}
function readTeamAnalysisDataset(manifest, payload, characterManifest) {
    assertManifestPayload(manifest, payload, "Team Analysis");
    if (manifest.schemaVersion !== 1 || manifest.rulesVersion !== "1" || manifest.compression !== "gzip") {
        throw new Error("Team Analysis input does not use the supported canonical contract.");
    }
    if (manifest.sourceCharacterDatasetVersion !== characterManifest.datasetVersion
        || manifest.sourceCharacterPayloadSha256 !== characterManifest.sha256) {
        throw new Error("Team Analysis input is not bound to the exact Characters input.");
    }
    const raw = (0, zlib_1.gunzipSync)(payload);
    if (raw.byteLength !== manifest.uncompressedSizeBytes) {
        throw new Error("Team Analysis input uncompressed size does not match its manifest.");
    }
    const dataset = JSON.parse(raw.toString("utf8"));
    if (!Array.isArray(dataset.states) || dataset.states.length !== manifest.stateCount
        || dataset.stateCount !== manifest.stateCount) {
        throw new Error("Team Analysis input state count does not match its manifest.");
    }
    if (dataset.schemaVersion !== manifest.schemaVersion
        || dataset.rulesVersion !== manifest.rulesVersion
        || dataset.parserVersion !== manifest.parserVersion
        || dataset.generatedAt !== manifest.generatedAt
        || dataset.sourceCharacterDatasetVersion !== manifest.sourceCharacterDatasetVersion
        || dataset.sourceCharacterPayloadSha256 !== manifest.sourceCharacterPayloadSha256) {
        throw new Error("Team Analysis payload metadata does not match its manifest.");
    }
    return dataset;
}
function assertManifestPayload(manifest, payload, label) {
    if (!/^[a-f0-9]{64}$/.test(manifest.sha256))
        throw new Error(`${label} manifest SHA-256 is invalid.`);
    if (manifest.sizeBytes !== payload.byteLength)
        throw new Error(`${label} input size mismatch.`);
    if (sha256(payload) !== manifest.sha256)
        throw new Error(`${label} input SHA-256 mismatch.`);
}
async function assertFreshOutput(outputDir, inputPaths) {
    if (await (0, promises_1.lstat)(outputDir).catch(() => undefined)) {
        throw new Error(`Android v1 projector output must be a fresh directory: ${outputDir}`);
    }
    inputPaths.forEach(inputPath => {
        if (inputPath === outputDir || isStrictlyContained(outputDir, inputPath)) {
            throw new Error("Android v1 projector output must not contain an input artifact.");
        }
    });
}
function resolveOptions(options) {
    return {
        charactersManifestPath: (0, path_1.resolve)(options.charactersManifestPath),
        charactersPayloadPath: (0, path_1.resolve)(options.charactersPayloadPath),
        teamAnalysisManifestPath: (0, path_1.resolve)(options.teamAnalysisManifestPath),
        teamAnalysisPayloadPath: (0, path_1.resolve)(options.teamAnalysisPayloadPath),
        outputDir: (0, path_1.resolve)(options.outputDir),
    };
}
function isStrictlyContained(root, target) {
    const path = (0, path_1.relative)((0, path_1.resolve)(root), (0, path_1.resolve)(target));
    return path.length > 0
        && path !== ".."
        && !path.startsWith(`..${path_1.sep}`)
        && !(0, path_1.isAbsolute)(path);
}
function sha256(bytes) {
    return (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
function parseArgs(argv) {
    const values = new Map();
    const supported = new Set([
        "--characters-manifest",
        "--characters-payload",
        "--team-analysis-manifest",
        "--team-analysis-payload",
        "--output-dir",
    ]);
    for (let index = 0; index < argv.length; index += 1) {
        const name = argv[index];
        if (!supported.has(name) || values.has(name))
            throw new Error(`Unsupported or duplicate argument ${name}.`);
        const value = argv[++index];
        if (!value || value.startsWith("--"))
            throw new Error(`Missing value for ${name}.`);
        values.set(name, value);
    }
    const required = (name) => {
        const value = values.get(name);
        if (!value)
            throw new Error(`Missing required argument ${name}.`);
        return value;
    };
    return {
        charactersManifestPath: required("--characters-manifest"),
        charactersPayloadPath: required("--characters-payload"),
        teamAnalysisManifestPath: required("--team-analysis-manifest"),
        teamAnalysisPayloadPath: required("--team-analysis-payload"),
        outputDir: required("--output-dir"),
    };
}
async function main() {
    const report = await runAndroidV1ContractProjector(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(report, null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=android-v1-contract-projector-run.js.map