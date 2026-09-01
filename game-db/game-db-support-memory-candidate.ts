import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { gunzipSync } from "zlib";
import { writeFormattedJson } from "../format-json";
import { SupportMemoryDetailsDataset } from "../support-memory-details";
import { buildSupportMemoryFirstPartyCandidate, SupportMemoryFirstPartyTables } from "./game-db-support-memory";
import { GameDbSourceConfig, readGameDbTable } from "./game-db-source";

interface Options {
    sourceDataDir: string,
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    previousDatasetPath: string,
    outputDir: string,
    generatedAt: string,
    charactersPath: string,
}

const REQUIRED_TABLES: Array<keyof SupportMemoryFirstPartyTables> = [
    "cards",
    "card_card_categories",
    "card_categories",
    "card_unique_info_set_relations",
    "mission_categories",
    "mission_rewards",
    "missions",
    "sub_target_type_sets",
    "sub_target_types",
    "support_films",
    "support_memories",
    "support_memory_enhancement_items",
    "support_memory_enhancement_levels",
    "support_memory_enhancement_require_items",
    "support_memory_skills",
];

export function parseSupportMemoryCandidateArgs(args: string[]): Options {
    const supported = new Set([
        "--source-data-dir", "--source-snapshot-version", "--source-database-sha256",
        "--previous-dataset", "--characters", "--output-dir", "--generated-at",
    ]);
    const values = new Map<string, string>();
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        const separator = token.indexOf("=");
        const key = separator >= 0 ? token.slice(0, separator) : token;
        if (!supported.has(key)) throw new Error(`Unexpected Support Memory candidate argument: ${token}`);
        const value = separator >= 0 ? token.slice(separator + 1) : args[++index];
        if (!value || values.has(key)) throw new Error(`Missing or duplicate Support Memory candidate argument: ${key}`);
        values.set(key, value);
    }
    const required = ["--source-data-dir", "--source-snapshot-version", "--source-database-sha256", "--previous-dataset", "--characters", "--output-dir"];
    for (const key of required) if (!values.has(key)) throw new Error(`Missing Support Memory candidate argument: ${key}`);
    const generatedAt = values.get("--generated-at") ?? new Date().toISOString();
    if (Number.isNaN(new Date(generatedAt).getTime())) throw new Error("Invalid --generated-at");
    return {
        sourceDataDir: resolve(values.get("--source-data-dir")!),
        sourceSnapshotVersion: values.get("--source-snapshot-version")!,
        sourceDatabaseSha256: values.get("--source-database-sha256")!,
        previousDatasetPath: resolve(values.get("--previous-dataset")!),
        charactersPath: resolve(values.get("--characters")!),
        outputDir: resolve(values.get("--output-dir")!),
        generatedAt,
    };
}

async function loadTables(sourceDataDir: string): Promise<SupportMemoryFirstPartyTables> {
    const config: GameDbSourceConfig = { sourceRoot: sourceDataDir, dataDir: sourceDataDir };
    const entries = await Promise.all(REQUIRED_TABLES.map(async table => [table, await readGameDbTable(config, table)] as const));
    return Object.fromEntries(entries) as unknown as SupportMemoryFirstPartyTables;
}

async function main(): Promise<void> {
    const options = parseSupportMemoryCandidateArgs(process.argv.slice(2));
    const previousDataset = JSON.parse(await readFile(options.previousDatasetPath, "utf8")) as SupportMemoryDetailsDataset;
    const characterBuffer = await readFile(options.charactersPath);
    const characterJson = JSON.parse(options.charactersPath.endsWith(".gz") ? gunzipSync(characterBuffer).toString("utf8") : characterBuffer.toString("utf8"));
    const characters = Array.isArray(characterJson) ? characterJson : characterJson.characters;
    if (!Array.isArray(characters) || characters.some(character => typeof character?.id !== "string")) {
        throw new Error("Support Memory candidate character artifact is invalid");
    }
    const consumerCharacterIds = new Set<string>(characters.map(character => character.id));
    if (consumerCharacterIds.size !== characters.length) throw new Error("Support Memory candidate character artifact contains duplicate IDs");
    const candidate = buildSupportMemoryFirstPartyCandidate({
        generatedAt: options.generatedAt,
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        tables: await loadTables(options.sourceDataDir),
        previousDataset,
        consumerCharacterIds,
    });
    await mkdir(dirname(options.outputDir), { recursive: true });
    try {
        await mkdir(options.outputDir);
    } catch {
        throw new Error(`Support Memory candidate output must not already exist: ${options.outputDir}`);
    }
    const detailsPath = resolve(options.outputDir, "support-memory-details.json");
    const auditPath = resolve(options.outputDir, "support-memory-first-party-audit.json");
    await writeFormattedJson(detailsPath, candidate.dataset);
    await writeFormattedJson(auditPath, candidate.audit);
    const details = await readFile(detailsPath);
    const audit = await readFile(auditPath);
    await writeFile(resolve(options.outputDir, "candidate-manifest.json"), `${JSON.stringify({
        schemaVersion: 1,
        generatedAt: options.generatedAt,
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        supportMemoryCount: candidate.dataset.count,
        files: [
            { name: "support-memory-details.json", sizeBytes: details.byteLength, sha256: createHash("sha256").update(details).digest("hex") },
            { name: "support-memory-first-party-audit.json", sizeBytes: audit.byteLength, sha256: createHash("sha256").update(audit).digest("hex") },
        ],
    }, null, 2)}\n`, { encoding: "utf8", flag: "w" });
    console.log(JSON.stringify({
        outputDir: options.outputDir,
        supportMemoryCount: candidate.dataset.count,
        compatibility: candidate.audit.compatibility,
        counts: candidate.audit.counts,
    }, null, 2));
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
