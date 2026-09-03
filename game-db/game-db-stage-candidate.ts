import { createHash } from "crypto";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { gzipSync } from "zlib";
import { writeFormattedJson } from "../format-json";
import { StageDetailsDataset } from "../stage-detail";
import { buildStageFirstPartyCandidate, StageFirstPartyTables } from "./game-db-stage";
import { buildStageDelivery } from "./game-db-stage-delivery";
import { GameDbSourceConfig, readGameDbTable } from "./game-db-source";

interface Options {
    sourceDataDir: string,
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    outputDir: string,
    generatedAt: string,
    previousDatasetPath?: string,
    assetBaseUrl?: string,
}

export const PINNED_STAGE_SOURCE_PROFILE = {
    sourceSnapshotVersion: "1788329250",
    sourceDatabaseSha256: "7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495",
    questLevelCount: 5394,
    zBattleCount: 235,
    equipmentItemCount: 8751,
    equipmentItemMaxId: 9069,
    equipmentSkillCount: 14021,
    equipmentLimitationCount: 310,
} as const;

export function validatePinnedStageSourceProfile(
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    tables: StageFirstPartyTables,
): void {
    if (sourceSnapshotVersion !== PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion) return;
    const observed = {
        sourceDatabaseSha256: sourceDatabaseSha256.toLowerCase(),
        questLevelCount: tables.sugoroku_maps.filter(row => String(row.quest_id ?? "").trim()).length,
        zBattleCount: tables.z_battle_stages.length,
        equipmentItemCount: tables.equipment_skill_items.length,
        equipmentItemMaxId: Math.max(...tables.equipment_skill_items.map(row => Number(row.id))),
        equipmentSkillCount: tables.equipment_skills.length,
        equipmentLimitationCount: tables.equipment_skill_limitations.length,
    };
    for (const [key, expected] of Object.entries(PINNED_STAGE_SOURCE_PROFILE)) {
        if (key === "sourceSnapshotVersion") continue;
        if (observed[key as keyof typeof observed] !== expected) {
            throw new Error(`Pinned Stage source profile mismatch for ${key}: expected ${expected}, observed ${observed[key as keyof typeof observed]}`);
        }
    }
}

export const REQUIRED_STAGE_TABLES: Array<keyof StageFirstPartyTables> = [
    "areas",
    "card_awakening_routes",
    "cards",
    "card_unique_infos",
    "card_unique_info_set_relations",
    "card_specials",
    "card_categories",
    "chapters",
    "db_stories",
    "enemy_round_skill_set_relations",
    "enemy_round_skill_sets",
    "enemy_round_skills",
    "enemy_skill_cutin_extensions",
    "enemy_skills",
    "equipment_skill_items",
    "equipment_skill_limitations",
    "equipment_skills",
    "link_skills",
    "mission_rewards",
    "missions",
    "passive_skill_sets",
    "quest_category_bonus_groups",
    "quest_category_bonus_rarity_tables",
    "quest_category_bonuses",
    "quest_drop_item_views",
    "quests",
    "related_card_categories",
    "related_link_skills",
    "related_optimal_awakenings",
    "related_passive_skill_sets",
    "sugoroku_map_boss_drop_items",
    "sugoroku_map_enemy_informations",
    "sugoroku_map_puzzle_colors",
    "sugoroku_maps",
    "treasure_items",
    "special_sets",
    "special_views",
    "special_categories",
    "z_battle_check_points",
    "z_battle_enemies",
    "z_battle_enemy_card_escalations",
    "z_battle_enemy_skill_escalations",
    "z_battle_enemy_status_escalations",
    "z_battle_first_reward_level_ranges",
    "z_battle_first_rewards",
    "z_battle_normal_reward_tables",
    "z_battle_normal_rewards",
    "z_battle_powerup_thresholds",
    "z_battle_stage_views",
    "z_battle_stages",
];

export function parseStageCandidateArgs(args: string[]): Options {
    const supported = new Set([
        "--source-data-dir",
        "--source-snapshot-version",
        "--source-database-sha256",
        "--output-dir",
        "--generated-at",
        "--previous-dataset",
        "--asset-base-url",
    ]);
    const values = new Map<string, string>();
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        const separator = token.indexOf("=");
        const key = separator >= 0 ? token.slice(0, separator) : token;
        if (!supported.has(key)) throw new Error(`Unexpected Stage candidate argument: ${token}`);
        const value = separator >= 0 ? token.slice(separator + 1) : args[++index];
        if (!value || values.has(key)) throw new Error(`Missing or duplicate Stage candidate argument: ${key}`);
        values.set(key, value);
    }
    for (const key of ["--source-data-dir", "--source-snapshot-version", "--source-database-sha256", "--output-dir"]) {
        if (!values.has(key)) throw new Error(`Missing Stage candidate argument: ${key}`);
    }
    const generatedAt = values.get("--generated-at") ?? new Date().toISOString();
    if (Number.isNaN(Date.parse(generatedAt))) throw new Error("Invalid Stage --generated-at");
    return {
        sourceDataDir: resolve(values.get("--source-data-dir")!),
        sourceSnapshotVersion: values.get("--source-snapshot-version")!,
        sourceDatabaseSha256: values.get("--source-database-sha256")!,
        outputDir: resolve(values.get("--output-dir")!),
        generatedAt,
        ...(values.get("--previous-dataset") ? { previousDatasetPath: resolve(values.get("--previous-dataset")!) } : {}),
        ...(values.get("--asset-base-url") ? { assetBaseUrl: values.get("--asset-base-url") } : {}),
    };
}

async function loadTables(sourceDataDir: string): Promise<StageFirstPartyTables> {
    const config: GameDbSourceConfig = { sourceRoot: sourceDataDir, dataDir: sourceDataDir };
    const entries = await Promise.all(REQUIRED_STAGE_TABLES.map(async table => [table, await readGameDbTable(config, table)] as const));
    return Object.fromEntries(entries) as unknown as StageFirstPartyTables;
}

async function requireMissing(path: string): Promise<void> {
    try {
        await stat(path);
        throw new Error(`Stage candidate output must not already exist: ${path}`);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
}

async function main(): Promise<void> {
    const options = parseStageCandidateArgs(process.argv.slice(2));
    await requireMissing(options.outputDir);
    const tables = await loadTables(options.sourceDataDir);
    validatePinnedStageSourceProfile(options.sourceSnapshotVersion, options.sourceDatabaseSha256, tables);
    const candidate = buildStageFirstPartyCandidate({
        generatedAt: options.generatedAt,
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        tables,
    });
    const previous = options.previousDatasetPath
        ? JSON.parse(await readFile(options.previousDatasetPath, "utf8")) as StageDetailsDataset
        : undefined;
    const previousIds = new Set(previous?.entries.map(entry => entry.id) ?? []);
    const candidateIds = new Set(candidate.dataset.entries.map(entry => entry.id));
    const comparison = {
        previousCount: previous?.count ?? 0,
        candidateCount: candidate.dataset.count,
        addedIds: [...candidateIds].filter(stageId => !previousIds.has(stageId)).sort((left, right) => Number(left) - Number(right)),
        removedIds: [...previousIds].filter(stageId => !candidateIds.has(stageId)).sort((left, right) => Number(left) - Number(right)),
    };
    await mkdir(dirname(options.outputDir), { recursive: true });
    await mkdir(options.outputDir);
    const datasetPath = resolve(options.outputDir, "stage-details.json");
    const auditPath = resolve(options.outputDir, "stage-first-party-audit.json");
    const transportPath = resolve(options.outputDir, "stage-details.json.gz");
    const deliveryManifestPath = resolve(options.outputDir, "stage-details-manifest.json");
    const deliveryAuditPath = resolve(options.outputDir, "stage-delivery-audit.json");
    await writeFormattedJson(datasetPath, candidate.dataset);
    await writeFormattedJson(auditPath, { ...candidate.audit, comparison });
    const compactDatasetBytes = Buffer.from(JSON.stringify(candidate.dataset), "utf8");
    await writeFile(transportPath, gzipSync(compactDatasetBytes, { level: 9 }), { flag: "wx" });
    const delivery = buildStageDelivery(candidate.dataset, undefined, undefined, options.assetBaseUrl);
    await writeFormattedJson(deliveryManifestPath, delivery.manifest);
    await writeFormattedJson(deliveryAuditPath, delivery.audit);
    const deliveryObjectRoot = resolve(options.outputDir, "stage-details", "objects");
    await mkdir(deliveryObjectRoot, { recursive: true });
    const deliveryObjects = [
        { object: delivery.manifest.catalog, bytes: delivery.catalogGzip },
        ...delivery.shards.map(shard => ({ object: shard.manifest, bytes: shard.gzip })),
    ];
    for (const item of deliveryObjects) {
        const objectPath = resolve(options.outputDir, item.object.objectKey);
        await mkdir(dirname(objectPath), { recursive: true });
        await writeFile(objectPath, item.bytes, { flag: "wx" });
    }
    const datasetBytes = await readFile(datasetPath);
    const auditBytes = await readFile(auditPath);
    const transportBytes = await readFile(transportPath);
    const deliveryManifestBytes = await readFile(deliveryManifestPath);
    const deliveryAuditBytes = await readFile(deliveryAuditPath);
    const deliveryFileEntries = deliveryObjects.map(item => ({
        name: item.object.objectKey,
        sizeBytes: item.bytes.byteLength,
        sha256: createHash("sha256").update(item.bytes).digest("hex"),
    }));
    await writeFile(resolve(options.outputDir, "candidate-manifest.json"), `${JSON.stringify({
        schemaVersion: 2,
        generatedAt: options.generatedAt,
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        stageCount: candidate.dataset.count,
        zBattleCount: candidate.dataset.zBattles?.length ?? 0,
        transport: {
            fileName: "stage-details.json.gz",
            contentType: "application/json",
            contentEncoding: "gzip",
            uncompressedSizeBytes: compactDatasetBytes.byteLength,
        },
        delivery: {
            manifestFileName: "stage-details-manifest.json",
            catalogObjectKey: delivery.manifest.catalog.objectKey,
            shardCount: delivery.manifest.shards.length,
            totalCompressedBytes: delivery.audit.totalCompressedBytes,
            totalExpandedBytes: delivery.audit.totalExpandedBytes,
            shardMaxExpandedBytes: delivery.audit.shardMaxExpandedBytes,
        },
        files: [
            { name: "stage-details.json", sizeBytes: datasetBytes.byteLength, sha256: createHash("sha256").update(datasetBytes).digest("hex") },
            { name: "stage-details.json.gz", sizeBytes: transportBytes.byteLength, sha256: createHash("sha256").update(transportBytes).digest("hex") },
            { name: "stage-first-party-audit.json", sizeBytes: auditBytes.byteLength, sha256: createHash("sha256").update(auditBytes).digest("hex") },
            { name: "stage-details-manifest.json", sizeBytes: deliveryManifestBytes.byteLength, sha256: createHash("sha256").update(deliveryManifestBytes).digest("hex") },
            { name: "stage-delivery-audit.json", sizeBytes: deliveryAuditBytes.byteLength, sha256: createHash("sha256").update(deliveryAuditBytes).digest("hex") },
            ...deliveryFileEntries,
        ],
    }, null, 2)}\n`, { encoding: "utf8", flag: "w" });
    console.log(JSON.stringify({
        outputDir: options.outputDir,
        counts: candidate.audit.counts,
        comparison,
        delivery: delivery.audit,
    }, null, 2));
}

if (require.main === module) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}
