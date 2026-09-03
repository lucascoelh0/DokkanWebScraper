import { createHash } from "crypto";
import { gzipSync } from "zlib";
import {
    StageDetail,
    StageDetailEventMission,
    StageDetailSupportMemoryRelation,
    StageDetailZBattle,
    StageDetailsDataset,
} from "../stage-detail";

export const STAGE_DELIVERY_CONTRACT = "dokkan-stage-delivery";
export const STAGE_DELIVERY_CONTRACT_VERSION = "1.0.0";
export const DEFAULT_STAGE_SHARD_MAX_EXPANDED_BYTES = 2 * 1024 * 1024;
export const DEFAULT_STAGE_ASSET_BASE_URL = "https://assets.dokkanstats.com/assets/global/en";

export type StageCatalogEntryKind = "quest-level" | "z-battle";
export type StageCatalogBrowseCategory =
    | "quests"
    | "db-story"
    | "story"
    | "bonus"
    | "growth"
    | "limited"
    | "challenge"
    | "z-battles";

export interface StageDeliveryObject {
    objectKey: string,
    sha256: string,
    sizeBytes: number,
    expandedSizeBytes: number,
    contentType: "application/json",
    contentEncoding: "gzip",
}

export interface StageCatalogEntry {
    key: string,
    kind: StageCatalogEntryKind,
    id: string,
    title: string,
    subtitle?: string,
    areaId?: string,
    areaName?: string,
    areaType?: string,
    areaCategoryRaw?: number,
    browseCategory?: StageCatalogBrowseCategory,
    chapterId?: string,
    chapterName?: string,
    chapterImagePath?: string,
    eventImagePath?: string,
    questId?: string,
    difficultyRaw?: number,
    difficulty?: string,
    startsAt?: string,
    stamina?: number,
    requiredKeys?: number,
    rankExp?: number,
    zeni?: number,
    linkSkillLevelUpRate?: number,
    enemyNames: string[],
    supportMemoryIds: string[],
    hasRewards: boolean,
    hasGimmicks: boolean,
    detailShardId: string,
}

export interface StageCatalogPayload {
    schemaVersion: 1,
    contract: typeof STAGE_DELIVERY_CONTRACT,
    contractVersion: typeof STAGE_DELIVERY_CONTRACT_VERSION,
    datasetVersion: string,
    generatedAt: string,
    source: "dokkan-game-db",
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    assetBaseUrl: string,
    count: number,
    questLevelCount: number,
    zBattleCount: number,
    entries: StageCatalogEntry[],
    supportMemoryRelations: StageDetailSupportMemoryRelation[],
    eventMissionsComplete: boolean,
    eventMissions: StageDetailEventMission[],
}

export interface StageDetailShardPayload {
    schemaVersion: 1,
    contract: typeof STAGE_DELIVERY_CONTRACT,
    contractVersion: typeof STAGE_DELIVERY_CONTRACT_VERSION,
    datasetVersion: string,
    shardId: string,
    questLevels: StageDetail[],
    zBattles: StageDetailZBattle[],
}

export interface StageDeliveryShardManifest extends StageDeliveryObject {
    id: string,
    questLevelIds: string[],
    zBattleIds: string[],
    areaIds: string[],
}

export interface StageDeliveryManifest {
    schemaVersion: 2,
    contract: typeof STAGE_DELIVERY_CONTRACT,
    contractVersion: typeof STAGE_DELIVERY_CONTRACT_VERSION,
    datasetVersion: string,
    generatedAt: string,
    source: "dokkan-game-db",
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    questLevelCount: number,
    zBattleCount: number,
    supportMemoryRelationCount: number,
    eventMissionCount: number,
    fileName: string,
    sha256: string,
    sizeBytes: number,
    stageCount: number,
    catalog: StageDeliveryObject,
    shards: StageDeliveryShardManifest[],
}

export interface StageDeliveryAudit {
    shardMaxExpandedBytes: number,
    shardCount: number,
    totalCompressedBytes: number,
    totalExpandedBytes: number,
    minimumShardExpandedBytes: number,
    medianShardExpandedBytes: number,
    p95ShardExpandedBytes: number,
    maximumShardExpandedBytes: number,
    questLevelRoutes: number,
    zBattleRoutes: number,
    supportMemoryRelations: number,
    eventMissions: number,
}

export interface StageDeliveryBuild {
    catalog: StageCatalogPayload,
    catalogBytes: Buffer,
    catalogGzip: Buffer,
    shards: Array<{
        payload: StageDetailShardPayload,
        bytes: Buffer,
        gzip: Buffer,
        manifest: StageDeliveryShardManifest,
    }>,
    manifest: StageDeliveryManifest,
    audit: StageDeliveryAudit,
}

interface DeliveryItem {
    kind: StageCatalogEntryKind,
    id: string,
    areaId?: string,
    value: StageDetail | StageDetailZBattle,
    serializedBytes: number,
}

interface PendingShard {
    id: string,
    items: DeliveryItem[],
}

export function buildStageDelivery(
    dataset: StageDetailsDataset,
    shardMaxExpandedBytes = DEFAULT_STAGE_SHARD_MAX_EXPANDED_BYTES,
    compressionLevel = 9,
    assetBaseUrl = DEFAULT_STAGE_ASSET_BASE_URL,
): StageDeliveryBuild {
    validateDataset(dataset);
    if (!Number.isSafeInteger(shardMaxExpandedBytes) || shardMaxExpandedBytes < 32 * 1024) {
        throw new Error("Stage shard maximum must be an integer of at least 32768 bytes");
    }
    if (!Number.isSafeInteger(compressionLevel) || compressionLevel < 1 || compressionLevel > 9) {
        throw new Error("Stage delivery compression level must be an integer from 1 to 9");
    }
    validateAssetBaseUrl(assetBaseUrl);

    const datasetVersion = dataset.generatedAt;
    const items = deliveryItems(dataset);
    const pendingShards = partitionItems(items, datasetVersion, shardMaxExpandedBytes);
    const shardIdByKey = new Map<string, string>();
    const shards = pendingShards.map(shard => {
        const payload = shardPayload(datasetVersion, shard);
        const bytes = Buffer.from(JSON.stringify(payload), "utf8");
        if (bytes.byteLength > shardMaxExpandedBytes) {
            throw new Error(`Stage shard ${shard.id} exceeds ${shardMaxExpandedBytes} expanded bytes`);
        }
        const gzip = gzipSync(bytes, { level: compressionLevel });
        const sha256 = sha(gzip);
        const questLevelIds = shard.items
            .filter(item => item.kind === "quest-level")
            .map(item => item.id);
        const zBattleIds = shard.items
            .filter(item => item.kind === "z-battle")
            .map(item => item.id);
        const areaIds = [...new Set(shard.items.flatMap(item => item.areaId ? [item.areaId] : []))]
            .sort(numericCompare);
        for (const item of shard.items) {
            const key = catalogKey(item.kind, item.id);
            if (shardIdByKey.has(key)) throw new Error(`Duplicate Stage delivery route ${key}`);
            shardIdByKey.set(key, shard.id);
        }
        return {
            payload,
            bytes,
            gzip,
            manifest: {
                id: shard.id,
                objectKey: `stage-details/objects/${sha256}.json.gz`,
                sha256,
                sizeBytes: gzip.byteLength,
                expandedSizeBytes: bytes.byteLength,
                contentType: "application/json" as const,
                contentEncoding: "gzip" as const,
                questLevelIds,
                zBattleIds,
                areaIds,
            },
        };
    });

    const relations = [...(dataset.supportMemoryRelations ?? [])].sort(compareRelations);
    const eventMissions = [...(dataset.eventMissions ?? [])];
    const catalog: StageCatalogPayload = {
        schemaVersion: 1,
        contract: STAGE_DELIVERY_CONTRACT,
        contractVersion: STAGE_DELIVERY_CONTRACT_VERSION,
        datasetVersion,
        generatedAt: dataset.generatedAt,
        source: "dokkan-game-db",
        sourceSnapshotVersion: dataset.sourceSnapshotVersion!,
        sourceDatabaseSha256: dataset.sourceDatabaseSha256!,
        assetBaseUrl: assetBaseUrl.replace(/\/$/, ""),
        count: items.length,
        questLevelCount: dataset.entries.length,
        zBattleCount: dataset.zBattles?.length ?? 0,
        entries: [
            ...dataset.entries.map(stage => questCatalogEntry(stage, requireShardId(shardIdByKey, "quest-level", stage.id))),
            ...(dataset.zBattles ?? []).map(stage => zBattleCatalogEntry(
                stage,
                relations,
                requireShardId(shardIdByKey, "z-battle", stage.id),
            )),
        ],
        supportMemoryRelations: relations,
        eventMissionsComplete: dataset.eventMissions !== undefined,
        eventMissions,
    };
    assertUniqueCatalog(catalog);
    const catalogBytes = Buffer.from(JSON.stringify(catalog), "utf8");
    const catalogGzip = gzipSync(catalogBytes, { level: compressionLevel });
    const catalogSha = sha(catalogGzip);
    const catalogObject: StageDeliveryObject = {
        objectKey: `stage-details/objects/${catalogSha}.json.gz`,
        sha256: catalogSha,
        sizeBytes: catalogGzip.byteLength,
        expandedSizeBytes: catalogBytes.byteLength,
        contentType: "application/json",
        contentEncoding: "gzip",
    };
    const manifest: StageDeliveryManifest = {
        schemaVersion: 2,
        contract: STAGE_DELIVERY_CONTRACT,
        contractVersion: STAGE_DELIVERY_CONTRACT_VERSION,
        datasetVersion,
        generatedAt: dataset.generatedAt,
        source: "dokkan-game-db",
        sourceSnapshotVersion: dataset.sourceSnapshotVersion!,
        sourceDatabaseSha256: dataset.sourceDatabaseSha256!,
        questLevelCount: dataset.entries.length,
        zBattleCount: dataset.zBattles?.length ?? 0,
        supportMemoryRelationCount: relations.length,
        eventMissionCount: eventMissions.length,
        fileName: catalogObject.objectKey,
        sha256: catalogObject.sha256,
        sizeBytes: catalogObject.sizeBytes,
        stageCount: dataset.entries.length,
        catalog: catalogObject,
        shards: shards.map(shard => shard.manifest),
    };
    validateRoutes(catalog, manifest);
    const expandedSizes = shards.map(shard => shard.bytes.byteLength).sort((left, right) => left - right);
    const totalCompressedBytes = catalogGzip.byteLength + shards.reduce((sum, shard) => sum + shard.gzip.byteLength, 0);
    const totalExpandedBytes = catalogBytes.byteLength + shards.reduce((sum, shard) => sum + shard.bytes.byteLength, 0);
    return {
        catalog,
        catalogBytes,
        catalogGzip,
        shards,
        manifest,
        audit: {
            shardMaxExpandedBytes,
            shardCount: shards.length,
            totalCompressedBytes,
            totalExpandedBytes,
            minimumShardExpandedBytes: expandedSizes[0] ?? 0,
            medianShardExpandedBytes: percentile(expandedSizes, 0.5),
            p95ShardExpandedBytes: percentile(expandedSizes, 0.95),
            maximumShardExpandedBytes: expandedSizes.at(-1) ?? 0,
            questLevelRoutes: catalog.entries.filter(entry => entry.kind === "quest-level").length,
            zBattleRoutes: catalog.entries.filter(entry => entry.kind === "z-battle").length,
            supportMemoryRelations: relations.length,
            eventMissions: eventMissions.length,
        },
    };
}

function validateAssetBaseUrl(value: string): void {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error("Stage asset base URL must be a valid HTTPS URL");
    }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
        throw new Error("Stage asset base URL must be a safe HTTPS URL");
    }
}

function validateDataset(dataset: StageDetailsDataset): void {
    if (dataset.schemaVersion !== 2 || dataset.source !== "dokkan-game-db") {
        throw new Error("Stage delivery requires the first-party schema-2 dataset");
    }
    if (!dataset.generatedAt || Number.isNaN(Date.parse(dataset.generatedAt))) {
        throw new Error("Stage delivery requires a valid generatedAt dataset version");
    }
    if (!dataset.sourceSnapshotVersion || !/^\d+$/.test(dataset.sourceSnapshotVersion)) {
        throw new Error("Stage delivery requires a numeric source snapshot version");
    }
    if (!dataset.sourceDatabaseSha256 || !/^[a-f0-9]{64}$/i.test(dataset.sourceDatabaseSha256)) {
        throw new Error("Stage delivery requires a source database SHA-256");
    }
    if (dataset.count !== dataset.entries.length) {
        throw new Error("Stage delivery dataset count does not match its quest entries");
    }
    const questIds = dataset.entries.map(entry => entry.id);
    const zBattleIds = (dataset.zBattles ?? []).map(entry => entry.id);
    if (new Set(questIds).size !== questIds.length || new Set(zBattleIds).size !== zBattleIds.length) {
        throw new Error("Stage delivery requires unique quest and Z-Battle IDs");
    }
    const missionIds = (dataset.eventMissions ?? []).map(mission => mission.id);
    if (new Set(missionIds).size !== missionIds.length) {
        throw new Error("Stage delivery requires unique event mission IDs");
    }
    for (const enemy of dataset.entries.flatMap(entry => entry.enemies)) {
        if (!enemy.stats || enemy.stats.status !== "unavailable-in-game-db") {
            throw new Error(`Quest enemy ${enemy.id} lacks the explicit first-party availability boundary`);
        }
        if (enemy.stats.hp !== undefined || enemy.stats.atk !== undefined || enemy.stats.def !== undefined) {
            throw new Error(`Quest enemy ${enemy.id} invents unavailable HP/ATK/DEF`);
        }
    }
}

function deliveryItems(dataset: StageDetailsDataset): DeliveryItem[] {
    const questItems: DeliveryItem[] = [...dataset.entries]
        .sort((left, right) => numericCompare(left.areaId, right.areaId)
            || numericCompare(left.questId, right.questId)
            || numericCompare(left.id, right.id))
        .map(value => ({
            kind: "quest-level",
            id: value.id,
            areaId: value.areaId,
            value,
            serializedBytes: Buffer.byteLength(JSON.stringify(value), "utf8"),
        }));
    const zBattleItems: DeliveryItem[] = [...(dataset.zBattles ?? [])]
        .sort((left, right) => numericCompare(left.id, right.id))
        .map(value => ({
            kind: "z-battle",
            id: value.id,
            value,
            serializedBytes: Buffer.byteLength(JSON.stringify(value), "utf8"),
        }));
    return [...questItems, ...zBattleItems];
}

function partitionItems(
    items: DeliveryItem[],
    datasetVersion: string,
    maximumBytes: number,
): PendingShard[] {
    const emptyWrapperBytes = Buffer.byteLength(JSON.stringify(shardPayload(datasetVersion, { id: "0000", items: [] })), "utf8");
    const shards: PendingShard[] = [];
    let pending: DeliveryItem[] = [];
    let estimatedBytes = emptyWrapperBytes;
    const flush = () => {
        if (pending.length === 0) return;
        shards.push({ id: String(shards.length + 1).padStart(4, "0"), items: pending });
        pending = [];
        estimatedBytes = emptyWrapperBytes;
    };
    for (const item of items) {
        const separatorBytes = pending.length > 0 ? 1 : 0;
        if (pending.length > 0 && estimatedBytes + separatorBytes + item.serializedBytes > maximumBytes) flush();
        const singleBytes = emptyWrapperBytes + item.serializedBytes;
        if (singleBytes > maximumBytes) {
            throw new Error(`Stage ${catalogKey(item.kind, item.id)} exceeds the shard maximum by itself`);
        }
        pending.push(item);
        estimatedBytes += separatorBytes + item.serializedBytes;
    }
    flush();
    return shards;
}

function shardPayload(datasetVersion: string, shard: PendingShard): StageDetailShardPayload {
    return {
        schemaVersion: 1,
        contract: STAGE_DELIVERY_CONTRACT,
        contractVersion: STAGE_DELIVERY_CONTRACT_VERSION,
        datasetVersion,
        shardId: shard.id,
        questLevels: shard.items
            .filter(item => item.kind === "quest-level")
            .map(item => item.value as StageDetail),
        zBattles: shard.items
            .filter(item => item.kind === "z-battle")
            .map(item => item.value as StageDetailZBattle),
    };
}

function questCatalogEntry(stage: StageDetail, shardId: string): StageCatalogEntry {
    const chapterId = stage.areaType === "Area::MainArea" ? stage.chapter?.id : undefined;
    return {
        key: catalogKey("quest-level", stage.id),
        kind: "quest-level",
        id: stage.id,
        title: stage.questName,
        subtitle: stage.difficulty,
        areaId: stage.areaId,
        areaName: stage.areaName,
        areaType: stage.areaType,
        areaCategoryRaw: stage.areaCategoryRaw,
        browseCategory: questBrowseCategory(stage),
        ...(chapterId ? {
            chapterId,
            chapterName: stage.chapter?.name ?? `Chapter ${chapterId}`,
            chapterImagePath: questChapterImagePath(chapterId),
        } : {}),
        eventImagePath: stage.images.button?.sourcePath ?? stage.images.header?.sourcePath,
        questId: stage.questId,
        difficultyRaw: stage.difficultyRaw,
        difficulty: stage.difficulty,
        startsAt: stage.startDate ?? stage.areaFirstReleasedAt,
        stamina: stage.stamina,
        requiredKeys: stage.requiredKeys,
        rankExp: stage.rankExp,
        zeni: stage.zeni,
        linkSkillLevelUpRate: stage.linkSkillLevelUpRate,
        enemyNames: uniqueText(stage.enemies.map(enemy => enemy.name)),
        supportMemoryIds: uniqueText((stage.supportMemories ?? []).map(link => link.memoryId), numericCompare),
        hasRewards: Boolean(
            stage.bossDrops?.length
            || stage.dropPreviews?.length
            || stage.rewards && Object.values(stage.rewards).some(value => value !== undefined),
        ),
        hasGimmicks: stage.enemies.some(enemy => enemy.skills.length > 0 || Boolean(enemy.roundSkillSet?.skills.length)),
        detailShardId: shardId,
    };
}

function questChapterImagePath(chapterId: string): string {
    if (!/^\d+$/.test(chapterId)) throw new Error(`Quest chapter ID must be numeric: ${chapterId}`);
    return `outgame/extension/adventure/chapter/${chapterId}/${chapterId}001.png`;
}

function questBrowseCategory(stage: StageDetail): StageCatalogBrowseCategory | undefined {
    if (stage.areaType === "Area::MainArea" && stage.chapter?.id) return "quests";
    if (stage.areaType === "Area::DbStory") return "db-story";
    if (stage.areaType !== "Area::EventArea") return undefined;
    if ([2, 7].includes(stage.areaCategoryRaw)) return "story";
    if ([4, 6].includes(stage.areaCategoryRaw)) return "bonus";
    if ([1, 8, 9, 10, 11, 12].includes(stage.areaCategoryRaw)) return "growth";
    if (stage.areaCategoryRaw === 16) return "limited";
    if (stage.areaCategoryRaw === 20) return "challenge";
    return undefined;
}

function zBattleCatalogEntry(
    stage: StageDetailZBattle,
    relations: StageDetailSupportMemoryRelation[],
    shardId: string,
): StageCatalogEntry {
    const memoryIds = relations
        .filter(relation => relation.targetKind === "z-battle" && relation.targetId === stage.id)
        .map(relation => relation.memoryId);
    return {
        key: catalogKey("z-battle", stage.id),
        kind: "z-battle",
        id: stage.id,
        title: stage.title ?? `Z-Battle ${stage.id}`,
        subtitle: stage.subtitle,
        browseCategory: "z-battles",
        eventImagePath: stage.listButton?.sourcePath,
        startsAt: stage.startDate,
        enemyNames: uniqueText([stage.title ?? "", stage.subtitle ?? ""]),
        supportMemoryIds: uniqueText(memoryIds, numericCompare),
        hasRewards: Boolean(stage.checkpoints?.length || stage.firstRewards?.length),
        hasGimmicks: stage.skillEscalations.length > 0 || stage.statusCurves.length > 0,
        detailShardId: shardId,
    };
}

function assertUniqueCatalog(catalog: StageCatalogPayload): void {
    const keys = catalog.entries.map(entry => entry.key);
    if (keys.length !== catalog.count || new Set(keys).size !== keys.length) {
        throw new Error("Stage catalog contains duplicate or mismatched entries");
    }
}

function validateRoutes(catalog: StageCatalogPayload, manifest: StageDeliveryManifest): void {
    const shards = new Map(manifest.shards.map(shard => [shard.id, shard]));
    for (const entry of catalog.entries) {
        const shard = shards.get(entry.detailShardId);
        if (!shard) throw new Error(`Stage catalog entry ${entry.key} references a missing shard`);
        const ids = entry.kind === "quest-level" ? shard.questLevelIds : shard.zBattleIds;
        if (!ids.includes(entry.id)) throw new Error(`Stage catalog entry ${entry.key} is absent from its shard manifest`);
    }
    const relationKeys = catalog.supportMemoryRelations.map(relationKey);
    if (new Set(relationKeys).size !== relationKeys.length) {
        throw new Error("Stage catalog contains duplicate Support Memory relations");
    }
    const questIds = new Set(catalog.entries.filter(entry => entry.kind === "quest-level").map(entry => entry.id));
    const zBattleIds = new Set(catalog.entries.filter(entry => entry.kind === "z-battle").map(entry => entry.id));
    const areaIds = new Set(catalog.entries.flatMap(entry => entry.areaId ? [entry.areaId] : []));
    for (const relation of catalog.supportMemoryRelations) {
        const resolved = relation.targetKind === "quest-level"
            ? questIds.has(relation.targetId)
            : relation.targetKind === "z-battle"
                ? zBattleIds.has(relation.targetId)
                : areaIds.has(relation.targetId);
        if (!resolved) throw new Error(`Support Memory relation ${relationKey(relation)} has no catalog target`);
    }
    for (const mission of catalog.eventMissions) {
        if (!areaIds.has(mission.areaId)) {
            throw new Error(`Event mission ${mission.id} has no catalog area target`);
        }
        if (mission.stageIds.some(stageId => !questIds.has(stageId))) {
            throw new Error(`Event mission ${mission.id} has no catalog Stage target`);
        }
    }
}

function requireShardId(map: Map<string, string>, kind: StageCatalogEntryKind, id: string): string {
    const key = catalogKey(kind, id);
    const shardId = map.get(key);
    if (!shardId) throw new Error(`Stage delivery route ${key} was not partitioned`);
    return shardId;
}

function catalogKey(kind: StageCatalogEntryKind, id: string): string {
    return `${kind}:${id}`;
}

function relationKey(relation: StageDetailSupportMemoryRelation): string {
    return [relation.memoryId, relation.targetKind, relation.targetId, relation.relation, ...relation.missionIds].join(":");
}

function compareRelations(left: StageDetailSupportMemoryRelation, right: StageDetailSupportMemoryRelation): number {
    return numericCompare(left.memoryId, right.memoryId)
        || left.targetKind.localeCompare(right.targetKind)
        || numericCompare(left.targetId, right.targetId)
        || left.relation.localeCompare(right.relation)
        || left.missionIds.join(",").localeCompare(right.missionIds.join(","));
}

function uniqueText(values: string[], comparator: (left: string, right: string) => number = (left, right) => left.localeCompare(right)): string[] {
    return [...new Set(values.map(value => value.trim()).filter(Boolean))].sort(comparator);
}

function sha(bytes: Buffer): string {
    return createHash("sha256").update(bytes).digest("hex");
}

function numericCompare(left: string, right: string): number {
    return Number(left) - Number(right) || left.localeCompare(right);
}

function percentile(sorted: number[], value: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1);
    return sorted[Math.max(0, index)];
}
