import { readFile } from "fs/promises";
import { resolve } from "path";
import { gunzipSync } from "zlib";
import { Character } from "./character";
import { DatasetManifest } from "./dataset-artifacts";
import { FyiCharacterCatalogDataset } from "./fyi-character-catalog";
import {
    assertValidTeamAnalysisDataset,
    buildTeamAnalysisCoverageReport,
    buildTeamAnalysisDataset,
    TeamAnalysisActiveSkillActivationContract,
    TeamAnalysisCardIdentity,
    TeamAnalysisNameIdentityContract,
} from "./team-analysis";
import {
    buildTeamAnalysisArtifact,
    sha256,
    validateTeamAnalysisArtifact,
    writeTeamAnalysisBundle,
} from "./team-analysis-artifacts";

const DEFAULT_OUTPUT_DIR = "data/fyi-characters/latest";
const DEFAULT_CHARACTER_DATASET_PATH = `${DEFAULT_OUTPUT_DIR}/characters.json.gz`;
const DEFAULT_CHARACTER_MANIFEST_PATH = `${DEFAULT_OUTPUT_DIR}/characters-manifest.json`;
const DEFAULT_CATALOG_PATH = "data/fyi-character-catalog/latest/character-catalog.json";

export interface FyiTeamAnalysisRunOptions {
    outputDir: string,
    characterDatasetPath: string,
    characterManifestPath: string,
    catalogPath: string,
    nameIdentityContract?: TeamAnalysisNameIdentityContract,
    cardIdentityContract?: ReadonlyMap<string, TeamAnalysisCardIdentity>,
    activeSkillActivationContract?: TeamAnalysisActiveSkillActivationContract,
}

export function applyTeamAnalysisCardIdentityContract(
    entries: FyiCharacterCatalogDataset["characters"],
    contract?: ReadonlyMap<string, TeamAnalysisCardIdentity>,
): FyiCharacterCatalogDataset["characters"] {
    if (!contract) return entries;
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

export async function runFyiTeamAnalysis(
    options: FyiTeamAnalysisRunOptions,
): Promise<{
    datasetPath: string,
    manifestPath: string,
    coveragePath: string,
    compressedSizeBytes: number,
    uncompressedSizeBytes: number,
    stateCount: number,
    passiveStateCount: number,
    supportedRuleCount: number,
    partialRuleCount: number,
    unknownRuleCount: number,
}> {
    const [characterGzip, manifestText, catalogText] = await Promise.all([
        readFile(options.characterDatasetPath),
        readFile(options.characterManifestPath, "utf8"),
        readFile(options.catalogPath, "utf8"),
    ]);
    const characterManifest = JSON.parse(manifestText) as DatasetManifest;
    assertCharacterManifestMatchesPayload(characterManifest, characterGzip);
    const characters = JSON.parse(gunzipSync(characterGzip).toString("utf8")) as Character[];
    if (characters.length !== characterManifest.characterCount) {
        throw new Error(`Character manifest count ${characterManifest.characterCount} does not match ${characters.length}.`);
    }
    const catalog = JSON.parse(catalogText) as FyiCharacterCatalogDataset;
    const catalogEntries = applyTeamAnalysisCardIdentityContract(
        catalog.characters,
        options.cardIdentityContract,
    );
    const dataset = buildTeamAnalysisDataset(characters, catalogEntries, {
        generatedAt: characterManifest.generatedAt,
        sourceCharacterDatasetVersion: characterManifest.datasetVersion,
        sourceCharacterPayloadSha256: characterManifest.sha256,
        ...(options.nameIdentityContract ? { nameIdentityContract: options.nameIdentityContract } : {}),
        ...(options.cardIdentityContract ? { cardIdentityContract: options.cardIdentityContract } : {}),
        ...(options.activeSkillActivationContract
            ? { activeSkillActivationContract: options.activeSkillActivationContract }
            : {}),
    });
    assertValidTeamAnalysisDataset(dataset, characters, catalogEntries, {
        ...(options.cardIdentityContract ? { cardIdentityContract: options.cardIdentityContract } : {}),
        ...(options.activeSkillActivationContract
            ? { activeSkillActivationContract: options.activeSkillActivationContract }
            : {}),
    });

    const coverage = buildTeamAnalysisCoverageReport(dataset);
    const artifact = buildTeamAnalysisArtifact(dataset);
    const artifactIssues = validateTeamAnalysisArtifact(artifact, dataset);
    if (artifactIssues.length > 0) {
        throw new Error(`Team analysis artifact validation failed:\n${artifactIssues.join("\n")}`);
    }
    await writeTeamAnalysisBundle(options.outputDir, artifact, coverage);

    return {
        datasetPath: resolve(options.outputDir, artifact.manifest.fileName),
        manifestPath: resolve(options.outputDir, "team-analysis-manifest.json"),
        coveragePath: resolve(options.outputDir, "team-analysis-coverage.json"),
        compressedSizeBytes: artifact.manifest.sizeBytes,
        uncompressedSizeBytes: artifact.manifest.uncompressedSizeBytes,
        stateCount: dataset.stateCount,
        passiveStateCount: coverage.passiveStateCount,
        supportedRuleCount: dataset.supportedRuleCount,
        partialRuleCount: dataset.partialRuleCount,
        unknownRuleCount: dataset.unknownRuleCount,
    };
}

function assertCharacterManifestMatchesPayload(manifest: DatasetManifest, gzipBuffer: Buffer): void {
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip") {
        throw new Error("Unsupported character manifest schema or compression.");
    }
    if (manifest.sha256 !== sha256(gzipBuffer)) {
        throw new Error("Character payload SHA-256 does not match its manifest.");
    }
    if (manifest.sizeBytes !== gzipBuffer.byteLength) {
        throw new Error("Character payload size does not match its manifest.");
    }
}

function parseArgs(argv: string[]): FyiTeamAnalysisRunOptions {
    const values = new Map<string, string>();
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
        outputDir: resolve(values.get("--output-dir") ?? DEFAULT_OUTPUT_DIR),
        characterDatasetPath: resolve(values.get("--characters") ?? DEFAULT_CHARACTER_DATASET_PATH),
        characterManifestPath: resolve(values.get("--character-manifest") ?? DEFAULT_CHARACTER_MANIFEST_PATH),
        catalogPath: resolve(values.get("--catalog") ?? DEFAULT_CATALOG_PATH),
    };
}

async function main(): Promise<void> {
    const report = await runFyiTeamAnalysis(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
