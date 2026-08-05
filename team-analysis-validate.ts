import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { validateTeamAnalysisDeliveryBuffers } from "./team-analysis-delivery";

const DEFAULT_ROOT = "data/fyi-characters/latest";

interface TeamAnalysisValidateOptions {
    datasetPath: string,
    manifestPath: string,
    characterDatasetPath: string,
    characterManifestPath: string,
}

function parseArgs(argv: string[]): TeamAnalysisValidateOptions {
    const allowed = new Set(["--dataset", "--manifest", "--characters", "--character-manifest"]);
    const values = new Map<string, string>();
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        const separatorIndex = token.indexOf("=");
        const name = separatorIndex >= 0 ? token.slice(0, separatorIndex) : token;
        if (!allowed.has(name)) throw new Error(`Unknown option: ${name}`);
        const value = separatorIndex >= 0 ? token.slice(separatorIndex + 1) : argv[++index];
        if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}.`);
        values.set(name, value);
    }
    return {
        datasetPath: resolve(values.get("--dataset") ?? `${DEFAULT_ROOT}/team-analysis.json.gz`),
        manifestPath: resolve(values.get("--manifest") ?? `${DEFAULT_ROOT}/team-analysis-manifest.json`),
        characterDatasetPath: resolve(values.get("--characters") ?? `${DEFAULT_ROOT}/characters.json.gz`),
        characterManifestPath: resolve(
            values.get("--character-manifest") ?? `${DEFAULT_ROOT}/characters-manifest.json`,
        ),
    };
}

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));
    for (const filePath of Object.values(options)) {
        if (!existsSync(filePath)) throw new Error(`Required artifact not found: ${filePath}`);
    }
    const [datasetBuffer, manifestBuffer, characterDatasetBuffer, characterManifestBuffer] = await Promise.all([
        readFile(options.datasetPath),
        readFile(options.manifestPath),
        readFile(options.characterDatasetPath),
        readFile(options.characterManifestPath),
    ]);
    const validated = validateTeamAnalysisDeliveryBuffers({
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
