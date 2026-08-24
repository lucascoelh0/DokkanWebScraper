import { createHash } from "crypto";
import { lstat, mkdir, readFile, writeFile } from "fs/promises";
import { isAbsolute, relative, resolve, sep } from "path";
import { gunzipSync } from "zlib";
import {
    ANDROID_V1_CONSUMER_COMMIT,
    ANDROID_V1_PROJECTOR_VERSION,
    projectCharactersForAndroidV1,
    projectTeamAnalysisForAndroidV1,
} from "./android-v1-contract-projector";
import { Character } from "./character";
import {
    buildCharacterDatasetArtifact,
    DatasetManifest,
} from "./dataset-artifacts";
import {
    TeamAnalysisDataset,
} from "./team-analysis";
import {
    buildTeamAnalysisArtifact,
    TeamAnalysisManifest,
    validateTeamAnalysisArtifact,
} from "./team-analysis-artifacts";

interface AndroidV1ProjectorRunOptions {
    charactersManifestPath: string,
    charactersPayloadPath: string,
    teamAnalysisManifestPath: string,
    teamAnalysisPayloadPath: string,
    outputDir: string,
}

export interface AndroidV1ProjectorRunReport {
    schemaVersion: 1,
    contract: "dokkanpanion-android-v1-projection",
    projectorVersion: string,
    consumerCommit: string,
    input: {
        characters: DatasetManifest,
        teamAnalysis: TeamAnalysisManifest,
    },
    output: {
        characters: DatasetManifest,
        teamAnalysis: TeamAnalysisManifest,
    },
    changes: {
        characters: ReturnType<typeof projectCharactersForAndroidV1>["report"],
        teamAnalysis: ReturnType<typeof projectTeamAnalysisForAndroidV1>["report"],
    },
    files: {
        charactersManifestPath: string,
        charactersPayloadPath: string,
        teamAnalysisManifestPath: string,
        teamAnalysisPayloadPath: string,
        reportPath: string,
    },
}

export async function runAndroidV1ContractProjector(
    options: AndroidV1ProjectorRunOptions,
): Promise<AndroidV1ProjectorRunReport> {
    const resolved = resolveOptions(options);
    await assertFreshOutput(resolved.outputDir, [
        resolved.charactersManifestPath,
        resolved.charactersPayloadPath,
        resolved.teamAnalysisManifestPath,
        resolved.teamAnalysisPayloadPath,
    ]);

    const characterManifest = JSON.parse(
        await readFile(resolved.charactersManifestPath, "utf8"),
    ) as DatasetManifest;
    const characterPayload = await readFile(resolved.charactersPayloadPath);
    const characters = readCharacterDataset(characterManifest, characterPayload);

    const teamManifest = JSON.parse(
        await readFile(resolved.teamAnalysisManifestPath, "utf8"),
    ) as TeamAnalysisManifest;
    const teamPayload = await readFile(resolved.teamAnalysisPayloadPath);
    const teamDataset = readTeamAnalysisDataset(teamManifest, teamPayload, characterManifest);

    const projectedCharacters = projectCharactersForAndroidV1(characters);
    const characterArtifact = buildCharacterDatasetArtifact(projectedCharacters.characters, {
        datasetVersion: characterManifest.datasetVersion,
        generatedAt: characterManifest.generatedAt,
        fileName: "characters.json.gz",
    });
    const projectedTeam = projectTeamAnalysisForAndroidV1(
        teamDataset,
        characterArtifact.manifest.sha256,
    );
    const teamArtifact = buildTeamAnalysisArtifact(projectedTeam.dataset, {
        fileName: "team-analysis.json.gz",
        datasetVersion: teamManifest.datasetVersion,
    });
    const artifactIssues = validateTeamAnalysisArtifact(teamArtifact, projectedTeam.dataset);
    if (artifactIssues.length > 0) {
        throw new Error(`Projected Team Analysis artifact is invalid:\n${artifactIssues.join("\n")}`);
    }

    await mkdir(resolved.outputDir, { recursive: false });
    const files = {
        charactersManifestPath: resolve(resolved.outputDir, "characters-manifest.json"),
        charactersPayloadPath: resolve(resolved.outputDir, "characters.json.gz"),
        teamAnalysisManifestPath: resolve(resolved.outputDir, "team-analysis-manifest.json"),
        teamAnalysisPayloadPath: resolve(resolved.outputDir, "team-analysis.json.gz"),
        reportPath: resolve(resolved.outputDir, "android-v1-projection-report.json"),
    };
    const report: AndroidV1ProjectorRunReport = {
        schemaVersion: 1,
        contract: "dokkanpanion-android-v1-projection",
        projectorVersion: ANDROID_V1_PROJECTOR_VERSION,
        consumerCommit: ANDROID_V1_CONSUMER_COMMIT,
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
        writeFile(files.charactersPayloadPath, characterArtifact.gzipBuffer),
        writeFile(
            files.charactersManifestPath,
            `${JSON.stringify(characterArtifact.manifest, null, 2)}\n`,
            "utf8",
        ),
        writeFile(files.teamAnalysisPayloadPath, teamArtifact.gzipBuffer),
        writeFile(
            files.teamAnalysisManifestPath,
            `${JSON.stringify(teamArtifact.manifest, null, 2)}\n`,
            "utf8",
        ),
        writeFile(files.reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    ]);
    return report;
}

function readCharacterDataset(manifest: DatasetManifest, payload: Buffer): Character[] {
    assertManifestPayload(manifest, payload, "Characters");
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip") {
        throw new Error("Characters input does not use the supported canonical contract.");
    }
    const raw = gunzipSync(payload);
    if (raw.byteLength !== manifest.uncompressedSizeBytes) {
        throw new Error("Characters input uncompressed size does not match its manifest.");
    }
    const characters = JSON.parse(raw.toString("utf8")) as Character[];
    if (!Array.isArray(characters) || characters.length !== manifest.characterCount) {
        throw new Error("Characters input count does not match its manifest.");
    }
    return characters;
}

function readTeamAnalysisDataset(
    manifest: TeamAnalysisManifest,
    payload: Buffer,
    characterManifest: DatasetManifest,
): TeamAnalysisDataset {
    assertManifestPayload(manifest, payload, "Team Analysis");
    if (manifest.schemaVersion !== 1 || manifest.rulesVersion !== "1" || manifest.compression !== "gzip") {
        throw new Error("Team Analysis input does not use the supported canonical contract.");
    }
    if (manifest.sourceCharacterDatasetVersion !== characterManifest.datasetVersion
        || manifest.sourceCharacterPayloadSha256 !== characterManifest.sha256) {
        throw new Error("Team Analysis input is not bound to the exact Characters input.");
    }
    const raw = gunzipSync(payload);
    if (raw.byteLength !== manifest.uncompressedSizeBytes) {
        throw new Error("Team Analysis input uncompressed size does not match its manifest.");
    }
    const dataset = JSON.parse(raw.toString("utf8")) as TeamAnalysisDataset;
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

function assertManifestPayload(
    manifest: { sha256: string, sizeBytes: number },
    payload: Buffer,
    label: string,
): void {
    if (!/^[a-f0-9]{64}$/.test(manifest.sha256)) throw new Error(`${label} manifest SHA-256 is invalid.`);
    if (manifest.sizeBytes !== payload.byteLength) throw new Error(`${label} input size mismatch.`);
    if (sha256(payload) !== manifest.sha256) throw new Error(`${label} input SHA-256 mismatch.`);
}

async function assertFreshOutput(outputDir: string, inputPaths: string[]): Promise<void> {
    if (await lstat(outputDir).catch(() => undefined)) {
        throw new Error(`Android v1 projector output must be a fresh directory: ${outputDir}`);
    }
    inputPaths.forEach(inputPath => {
        if (inputPath === outputDir || isStrictlyContained(outputDir, inputPath)) {
            throw new Error("Android v1 projector output must not contain an input artifact.");
        }
    });
}

function resolveOptions(options: AndroidV1ProjectorRunOptions): AndroidV1ProjectorRunOptions {
    return {
        charactersManifestPath: resolve(options.charactersManifestPath),
        charactersPayloadPath: resolve(options.charactersPayloadPath),
        teamAnalysisManifestPath: resolve(options.teamAnalysisManifestPath),
        teamAnalysisPayloadPath: resolve(options.teamAnalysisPayloadPath),
        outputDir: resolve(options.outputDir),
    };
}

function isStrictlyContained(root: string, target: string): boolean {
    const path = relative(resolve(root), resolve(target));
    return path.length > 0
        && path !== ".."
        && !path.startsWith(`..${sep}`)
        && !isAbsolute(path);
}

function sha256(bytes: Buffer): string {
    return createHash("sha256").update(bytes).digest("hex");
}

function parseArgs(argv: string[]): AndroidV1ProjectorRunOptions {
    const values = new Map<string, string>();
    const supported = new Set([
        "--characters-manifest",
        "--characters-payload",
        "--team-analysis-manifest",
        "--team-analysis-payload",
        "--output-dir",
    ]);
    for (let index = 0; index < argv.length; index += 1) {
        const name = argv[index];
        if (!supported.has(name) || values.has(name)) throw new Error(`Unsupported or duplicate argument ${name}.`);
        const value = argv[++index];
        if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}.`);
        values.set(name, value);
    }
    const required = (name: string): string => {
        const value = values.get(name);
        if (!value) throw new Error(`Missing required argument ${name}.`);
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

async function main(): Promise<void> {
    const report = await runAndroidV1ContractProjector(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
