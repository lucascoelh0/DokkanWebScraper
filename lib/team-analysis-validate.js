"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const team_analysis_delivery_1 = require("./team-analysis-delivery");
const DEFAULT_ROOT = "data/fyi-characters/latest";
function parseArgs(argv) {
    const allowed = new Set(["--dataset", "--manifest", "--characters", "--character-manifest"]);
    const values = new Map();
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        const separatorIndex = token.indexOf("=");
        const name = separatorIndex >= 0 ? token.slice(0, separatorIndex) : token;
        if (!allowed.has(name))
            throw new Error(`Unknown option: ${name}`);
        const value = separatorIndex >= 0 ? token.slice(separatorIndex + 1) : argv[++index];
        if (!value || value.startsWith("--"))
            throw new Error(`Missing value for ${name}.`);
        values.set(name, value);
    }
    return {
        datasetPath: (0, path_1.resolve)(values.get("--dataset") ?? `${DEFAULT_ROOT}/team-analysis.json.gz`),
        manifestPath: (0, path_1.resolve)(values.get("--manifest") ?? `${DEFAULT_ROOT}/team-analysis-manifest.json`),
        characterDatasetPath: (0, path_1.resolve)(values.get("--characters") ?? `${DEFAULT_ROOT}/characters.json.gz`),
        characterManifestPath: (0, path_1.resolve)(values.get("--character-manifest") ?? `${DEFAULT_ROOT}/characters-manifest.json`),
    };
}
async function main() {
    const options = parseArgs(process.argv.slice(2));
    for (const filePath of Object.values(options)) {
        if (!(0, fs_1.existsSync)(filePath))
            throw new Error(`Required artifact not found: ${filePath}`);
    }
    const [datasetBuffer, manifestBuffer, characterDatasetBuffer, characterManifestBuffer] = await Promise.all([
        (0, promises_1.readFile)(options.datasetPath),
        (0, promises_1.readFile)(options.manifestPath),
        (0, promises_1.readFile)(options.characterDatasetPath),
        (0, promises_1.readFile)(options.characterManifestPath),
    ]);
    const validated = (0, team_analysis_delivery_1.validateTeamAnalysisDeliveryBuffers)({
        datasetBuffer,
        manifestBuffer,
        characterDatasetBuffer,
        characterManifestBuffer,
    });
    console.log(JSON.stringify({
        valid: true,
        datasetVersion: validated.manifest.datasetVersion,
        sha256: validated.manifest.sha256,
        sizeBytes: validated.manifest.sizeBytes,
        uncompressedSizeBytes: validated.manifest.uncompressedSizeBytes,
        stateCount: validated.manifest.stateCount,
        sourceCharacterDatasetVersion: validated.manifest.sourceCharacterDatasetVersion,
        sourceCharacterPayloadSha256: validated.manifest.sourceCharacterPayloadSha256,
    }, null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=team-analysis-validate.js.map