import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { StageDetailsDataset } from "../stage-detail";
import { GameDbRow, normalizeDbId, readGameDbTable } from "./game-db-source";
import { stageDropPreviewDifficultiesForMap } from "./game-db-stage-drop-preview";
import { validateWallpaperAssetManifest } from "./game-db-wallpaper-assets";

export type RewardItemClassification =
    "complete" | "partial" | "detail-missing" | "metadata-missing" | "asset-missing" |
    "contract-missing" | "semantics-unproved";
export type RewardCoverageStatus = "complete" | "partial" | "missing" | "not-applicable" | "unproved";

const SURFACES = [
    { table: "budokai_box_ranking_rewards", pairs: [["item_type", "item_id"]] },
    { table: "budokai_mission_rewards", pairs: [["item_type", "item_id"]] },
    { table: "budokai_ranking_gifts", pairs: [["item_type", "item_id"]] },
    { table: "dot_character_lv_rewards", pairs: [["item_type", "item_id"]] },
    { table: "mission_category_rewards", pairs: [1, 2, 3, 4].map(index => [`item${index}_type`, `item${index}_id`]) },
    { table: "mission_rewards", pairs: [["item_type", "item_id"]] },
    { table: "quest_drop_item_views", pairs: [1, 2, 3, 4, 5, 6].map(index => [`item${index}_type`, `item${index}_id`]) },
    { table: "rmbattle_mission_rewards", pairs: [["item_type", "item_id"]] },
    { table: "sugoroku_map_boss_drop_items", pairs: [["item_type", "item_id"]] },
    { table: "z_battle_first_rewards", pairs: [["item_type", "item_id"]] },
    { table: "z_battle_normal_rewards", pairs: [["item_type", "item_id"]] },
] as const;

const TARGETS: Record<string, string> = {
    Achievement: "achievements", ActItem: "act_items", AwakeningItem: "awakening_items", Card: "cards",
    CardSkinItem: "card_skin_items", CardStickerItem: "card_sticker_items", EquipmentSkillItem: "equipment_skill_items",
    EventkagiItem: "eventkagi_items", LinkSkillLvUpItem: "link_skill_lv_up_items", PotentialItem: "potential_items",
    "SD::Pack": "sd_packs", SpecialItem: "special_items", SupportFilm: "support_films", SupportItem: "support_items",
    SupportMemory: "support_memories", SupportMemoryEnhancementItem: "support_memory_enhancement_items",
    TrainingField: "training_fields", TrainingItem: "training_items", TreasureItem: "treasure_items", WallpaperItem: "wallpaper_items",
};

export const REWARD_ITEM_AUDIT_TABLES = [...new Set([
    ...SURFACES.map(surface => surface.table), ...Object.values(TARGETS), "areas", "missions", "sugoroku_maps",
    "z_battle_check_points", "z_battle_first_reward_level_ranges", "z_battle_normal_reward_tables",
])];

interface Occurrence {
    table: string, rowId: string, slot: string, itemType: string, itemId: string, quantity?: number, missionId?: string,
}
interface CoverageDimension { status: RewardCoverageStatus, evidence: string }
interface CoverageDimensions {
    metadata: CoverageDimension, asset: CoverageDimension, stageProjection: CoverageDimension,
    renderer: CoverageDimension, detailNavigation: CoverageDimension, surfaceCoverage: CoverageDimension,
}

type StageWallpaperSourceTable =
    "mission_rewards" | "sugoroku_map_boss_drop_items" | "quest_drop_item_views" |
    "z_battle_normal_rewards" | "z_battle_first_rewards";
type StageWallpaperDeliverySurface =
    "eventMissions" | "questLevelBossDrops" | "questLevelDropPreviews" |
    "zBattleCheckpointRewards" | "zBattleFirstRewards";
type StageWallpaperIdentityCoverage =
    "exact-mission-item-quantity" | "exact-source-row-owner-item" |
    "owner-row-item-multiset-slot-not-preserved" | "owner-item-quantity-multiset-source-row-not-preserved";

interface StageWallpaperSurfaceCoverage {
    sourceTable: StageWallpaperSourceTable,
    deliverySurface: StageWallpaperDeliverySurface,
    sourceOccurrenceCount: number,
    deliverableOccurrenceCount: number,
    expectedDeliveryCount: number,
    deliveredOccurrenceCount: number,
    uniqueItemCount: number,
    identityCoverage: StageWallpaperIdentityCoverage,
    reconciliation: "exact",
}

export interface RewardItemAudit {
    schemaVersion: 3,
    generatedAt: string,
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    surfaceCount: number,
    occurrenceCount: number,
    uniqueReferenceCount: number,
    wallpaper: {
        catalogCount: number,
        occurrenceCount: number,
        uniqueReferencedCount: number,
        referencedIds: string[],
        quantitiesSha256: string,
        surfaceOccurrences: Array<{ table: string, occurrenceCount: number }>,
        catalogAndAssets: { catalogCount: number, assetPresentationCount: number, completeCount: number, status: "complete" },
        globalAuditedCoverage: { occurrenceCount: number, uniqueItemCount: number },
        stageDeliverableCoverage: {
            occurrenceCount: number,
            uniqueItemCount: number,
            sourceSurfaces: Array<{ table: StageWallpaperSourceTable, occurrenceCount: number }>,
        },
        stageDeliveredCoverage: {
            occurrenceCount: number,
            uniqueItemCount: number,
            surfaceOccurrences: Array<{ surface: StageWallpaperDeliverySurface, occurrenceCount: number }>,
            rendererStatus: "complete",
        },
        stageSurfaceCoverage: StageWallpaperSurfaceCoverage[],
        outsideCurrentConsumerContract: {
            occurrenceCount: number,
            classifications: Array<{
                kind: "mission-category-completion-rewards" | "rmbattle-mission-rewards" |
                    "general-missions-without-stage-binding" | "supported-stage-source-without-owner",
                disposition: "surface-missing" | "contract-missing" | "out-of-scope",
                occurrenceCount: number,
                followUp: string,
            }>,
            occurrences: Array<Occurrence & { disposition: "surface-missing" | "contract-missing" | "out-of-scope" }>,
        },
    },
    matrix: Array<{
        itemType: string, occurrenceCount: number, uniqueItemCount: number, catalogTable?: string, joinedItemCount: number,
        metadataAvailable: boolean, officialAssetKnown: string, pipelineCoverage: string, androidCoverage: string,
        currentFallback: string, dimensions: CoverageDimensions, classification: RewardItemClassification,
    }>,
    surfaceOccurrences: Array<{ table: string, occurrenceCount: number }>,
}

function value(row: GameDbRow, column: string): string | undefined {
    const raw = row[column]?.trim();
    return raw || undefined;
}
function id(row: GameDbRow): string { return normalizeDbId(row.id) ?? "row-without-id"; }
function dimension(status: RewardCoverageStatus, evidence: string): CoverageDimension { return { status, evidence }; }

function coverage(itemType: string): Pick<RewardItemAudit["matrix"][number], "metadataAvailable" | "officialAssetKnown" | "pipelineCoverage" | "androidCoverage" | "currentFallback" | "dimensions" | "classification"> {
    if (["Card", "EquipmentSkillItem", "LinkSkillLvUpItem"].includes(itemType)) return {
        metadataAvailable: true,
        officialAssetKnown: "verified first-party asset contract",
        pipelineCoverage: "typed first-party Stage projection",
        androidCoverage: "typed reward renderer and supported interaction",
        currentFallback: "safe typed fallback if optional cached fields are absent",
        dimensions: {
            metadata: dimension("complete", "catalog or typed first-party presentation"),
            asset: dimension("complete", "owned or canonical official asset path"),
            stageProjection: dimension("complete", "typed Stage reward fields"),
            renderer: dimension("complete", "typed Android presentation"),
            detailNavigation: dimension("complete", "supported typed interaction or no detail required"),
            surfaceCoverage: dimension("partial", "global reward surfaces are audited; Stage consumes only its contracted surfaces"),
        }, classification: "complete",
    };
    if (itemType === "WallpaperItem") return {
        metadataAvailable: true,
        officialAssetKnown: "verified 88-row first-party wallpaper asset contract",
        pipelineCoverage: "typed for Stage-deliverable event mission rewards",
        androidCoverage: "typed tile and detail renderer for delivered Stage rewards",
        currentFallback: "optional full image falls back to selector thumbnail, then reward icon",
        dimensions: {
            metadata: dimension("complete", "official wallpaper_items catalog rows"),
            asset: dimension("complete", "manifest presentations cover the exact wallpaper catalog with reward icon and selector thumbnail"),
            stageProjection: dimension("partial", "complete for Stage-deliverable rewards; other reward surfaces are not projected"),
            renderer: dimension("complete", "typed Android Wallpaper reward renderer"),
            detailNavigation: dimension("complete", "Wallpaper detail sheet is available for delivered rewards"),
            surfaceCoverage: dimension("partial", "audited occurrences outside the current Stage consumer contract are explicitly classified"),
        }, classification: "partial",
    };
    if (itemType === "Point::Stone") return {
        metadataAvailable: false,
        officialAssetKnown: "established official Dragon Stone asset path",
        pipelineCoverage: "semantic fallback without a catalog row",
        androidCoverage: "typed Dragon Stone name and official visual",
        currentFallback: "Dragon Stone label and official icon; no visible placeholder",
        dimensions: {
            metadata: dimension("missing", "Point::Stone has no catalog row"),
            asset: dimension("complete", "official stone.png presentation is established"),
            stageProjection: dimension("complete", "typed Stone reward projection"),
            renderer: dimension("complete", "typed Stone visual"),
            detailNavigation: dimension("not-applicable", "no detail destination is required"),
            surfaceCoverage: dimension("partial", "global audit exceeds the Stage surface contract"),
        }, classification: "metadata-missing",
    };
    if (itemType === "AwakeningItem") return {
        metadataAvailable: true,
        officialAssetKnown: "established medal icon convention with catalog-backed backgrounds when available",
        pipelineCoverage: "typed reward metadata and presentation fields",
        androidCoverage: "typed Awakening Medal presenter",
        currentFallback: "official medal icon; catalog background is optional",
        dimensions: {
            metadata: dimension("complete", "awakening_items catalog join"),
            asset: dimension("partial", "icon convention exists; owned background coverage depends on catalog evidence"),
            stageProjection: dimension("complete", "typed Stage reward identity and presentation"),
            renderer: dimension("complete", "typed Awakening Medal presenter"),
            detailNavigation: dimension("missing", "no medal detail destination is wired"),
            surfaceCoverage: dimension("partial", "not every audited reward surface is projected to Stage"),
        }, classification: "detail-missing",
    };
    if (itemType === "SupportMemory") return {
        metadataAvailable: true,
        officialAssetKnown: "established Support Memory thumbnail convention",
        pipelineCoverage: "typed Stage reward plus Support Memory catalog relation",
        androidCoverage: "typed Support Memory presenter and navigation",
        currentFallback: "typed Support Memory name and official thumbnail",
        dimensions: {
            metadata: dimension("complete", "support_memories catalog join"),
            asset: dimension("complete", "official Support Memory thumbnail convention"),
            stageProjection: dimension("complete", "typed Stage SupportMemory reward"),
            renderer: dimension("complete", "typed Support Memory presenter"),
            detailNavigation: dimension("complete", "Support Memory navigation is wired"),
            surfaceCoverage: dimension("partial", "not every audited reward surface is projected to Stage"),
        }, classification: "partial",
    };
    if (itemType === "TreasureItem") return {
        metadataAvailable: true,
        officialAssetKnown: "canonical Treasure icon convention with partial global mirror coverage",
        pipelineCoverage: "typed first-party Treasure presentation on Stage-contracted reward surfaces",
        androidCoverage: "typed Treasure tile and detail sheet for enriched Stage rewards",
        currentFallback: "legacy Stage payloads retain the non-clickable Treasure tile",
        dimensions: {
            metadata: dimension("complete", "treasure_items catalog join and typed presentation fields"),
            asset: dimension("partial", "Stage-referenced icons are covered; the complete 303-suffix catalog is not mirrored"),
            stageProjection: dimension("complete", "typed Treasure presentation is emitted for every Stage-contracted source"),
            renderer: dimension("complete", "typed Android Treasure presentation"),
            detailNavigation: dimension("complete", "Treasure detail sheet is available only for verified enriched rewards"),
            surfaceCoverage: dimension("partial", "not every audited reward surface is projected to Stage"),
        }, classification: "partial",
    };
    if (itemType === "TrainingItem") return {
        metadataAvailable: true,
        officialAssetKnown: "partial established asset convention",
        pipelineCoverage: "typed metadata or catalog-backed presentation",
        androidCoverage: "item-specific presenter logic in the shared reward tile",
        currentFallback: "official item-specific icon when identity is available",
        dimensions: {
            metadata: dimension("complete", `${TARGETS[itemType]} catalog join`),
            asset: dimension("partial", "item-specific asset convention is not complete for every surface"),
            stageProjection: dimension("partial", "typed presentation is limited to Stage-contracted sources"),
            renderer: dimension("partial", "item-specific presentation exists in the shared renderer"),
            detailNavigation: dimension("missing", "no dedicated detail destination is wired"),
            surfaceCoverage: dimension("partial", "not every audited reward surface is projected to Stage"),
        }, classification: "detail-missing",
    };
    if (TARGETS[itemType]) return {
        metadataAvailable: true,
        officialAssetKnown: "not established by the Stage asset contract",
        pipelineCoverage: "catalog join audited; no typed Stage asset projection",
        androidCoverage: "generic reward renderer",
        currentFallback: "generic reward tile",
        dimensions: {
            metadata: dimension("complete", `${TARGETS[itemType]} catalog join`),
            asset: dimension("missing", "no verified Stage asset contract"),
            stageProjection: dimension("partial", "raw identity can pass through contracted Stage surfaces"),
            renderer: dimension("partial", "generic reward tile exists"),
            detailNavigation: dimension("missing", "no typed detail destination is established"),
            surfaceCoverage: dimension("partial", "not every audited reward surface is projected to Stage"),
        }, classification: "asset-missing",
    };
    const semanticsUnproved = itemType.startsWith("Point::") || itemType.startsWith("StatusExtension::");
    return {
        metadataAvailable: false, officialAssetKnown: "none in the audited contract",
        pipelineCoverage: "raw item_type and item_id only", androidCoverage: "generic reward renderer",
        currentFallback: "generic reward tile",
        dimensions: {
            metadata: dimension("missing", "no joined catalog authority"),
            asset: dimension("missing", "no verified Stage asset contract"),
            stageProjection: dimension("partial", "raw identity only where an existing Stage source carries it"),
            renderer: dimension("partial", "generic reward tile exists"),
            detailNavigation: dimension("missing", "no typed detail destination is established"),
            surfaceCoverage: dimension("partial", "not every audited reward surface is projected to Stage"),
        }, classification: semanticsUnproved ? "semantics-unproved" : "contract-missing",
    };
}

interface StageWallpaperDeliveryOccurrence {
    surface: StageWallpaperDeliverySurface,
    key: string,
    itemId: string,
}

interface ExpectedStageWallpaperDelivery {
    key: string,
    source: Occurrence,
}

function requiredRelationId(row: GameDbRow, column: string, label: string): string {
    const result = normalizeDbId(row[column]);
    if (!result) throw new Error(`${label} has no ${column}`);
    return result;
}

function validateDeliveredWallpaper(reward: { itemId: string, wallpaper?: {
    rewardThumbnailAssetPath: string, thumbnailAssetPath: string, fullImageAssetPath?: string,
} }, surface: StageWallpaperDeliverySurface): void {
    const numericId = Number(reward.itemId);
    if (!Number.isSafeInteger(numericId) || numericId < 0 || numericId > 9999) {
        throw new Error(`${surface} has an invalid WallpaperItem ID ${reward.itemId}`);
    }
    const paddedId = String(numericId).padStart(4, "0");
    const wallpaper = reward.wallpaper;
    if (!wallpaper
        || wallpaper.rewardThumbnailAssetPath !== `item/wallpaper/${paddedId}/icon_${paddedId}.png`
        || wallpaper.thumbnailAssetPath !== `item/wallpaper/${paddedId}/thumb_${paddedId}.png`
        || (wallpaper.fullImageAssetPath !== undefined
            && wallpaper.fullImageAssetPath !== `item/wallpaper/${paddedId}/full_${paddedId}.png`)) {
        throw new Error(`${surface} WallpaperItem:${reward.itemId} has invalid wallpaper enrichment`);
    }
}

function collectDeliveredWallpapers(dataset: StageDetailsDataset): StageWallpaperDeliveryOccurrence[] {
    const result: StageWallpaperDeliveryOccurrence[] = [];
    const add = (
        surface: StageWallpaperDeliverySurface,
        key: string,
        reward: { itemType: string, itemId: string, quantity?: number, wallpaper?: {
            rewardThumbnailAssetPath: string, thumbnailAssetPath: string, fullImageAssetPath?: string,
        } },
    ) => {
        if (reward.itemType !== "WallpaperItem") return;
        validateDeliveredWallpaper(reward, surface);
        result.push({ surface, key, itemId: reward.itemId });
    };
    for (const stage of dataset.entries) {
        stage.bossDrops?.forEach(reward => add(
            "questLevelBossDrops",
            `map:${stage.id}:row:${reward.sourceRowId}:item:${reward.itemId}`,
            reward,
        ));
        stage.dropPreviews?.forEach(preview => preview.items.forEach(reward => add(
            "questLevelDropPreviews",
            `map:${stage.id}:row:${preview.sourceRowId}:item:${reward.itemId}`,
            reward,
        )));
    }
    for (const stage of dataset.zBattles ?? []) {
        stage.checkpoints?.forEach(checkpoint => checkpoint.repeatRewards.forEach(reward => add(
            "zBattleCheckpointRewards",
            `stage:${stage.id}:checkpoint:${checkpoint.id}:group:${checkpoint.normalRewardTableGroupId}` +
                `:item:${reward.itemId}:quantity:${reward.quantity ?? "n/a"}`,
            reward,
        )));
        stage.firstRewards?.forEach(range => range.rewards.forEach(reward => add(
            "zBattleFirstRewards",
            `stage:${stage.id}:range:${range.id}:set:${range.rewardSetId}` +
                `:item:${reward.itemId}:quantity:${reward.quantity ?? "n/a"}`,
            reward,
        )));
    }
    for (const mission of dataset.eventMissions ?? []) mission.rewards.forEach(reward => add(
        "eventMissions",
        `mission:${mission.id}:item:${reward.itemId}:quantity:${reward.quantity ?? "n/a"}`,
        reward,
    ));
    return result;
}

function reconcileStageWallpaperSurface(options: {
    sourceTable: StageWallpaperSourceTable,
    deliverySurface: StageWallpaperDeliverySurface,
    sourceOccurrences: Occurrence[],
    expected: ExpectedStageWallpaperDelivery[],
    delivered: StageWallpaperDeliveryOccurrence[],
    identityCoverage: StageWallpaperIdentityCoverage,
}): { coverage: StageWallpaperSurfaceCoverage, deliverableSources: Occurrence[] } {
    const expectedKeys = options.expected.map(item => item.key).sort();
    const deliveredForSurface = options.delivered.filter(item => item.surface === options.deliverySurface);
    const deliveredKeys = deliveredForSurface.map(item => item.key).sort();
    if (JSON.stringify(expectedKeys) !== JSON.stringify(deliveredKeys)) {
        throw new Error(`${options.deliverySurface} wallpaper delivery does not match ${options.sourceTable}`);
    }
    const deliverableSources = [...new Set(options.expected.map(item => item.source))];
    return {
        coverage: {
            sourceTable: options.sourceTable,
            deliverySurface: options.deliverySurface,
            sourceOccurrenceCount: options.sourceOccurrences.length,
            deliverableOccurrenceCount: deliverableSources.length,
            expectedDeliveryCount: options.expected.length,
            deliveredOccurrenceCount: deliveredForSurface.length,
            uniqueItemCount: new Set(deliveredForSurface.map(item => item.itemId)).size,
            identityCoverage: options.identityCoverage,
            reconciliation: "exact",
        },
        deliverableSources,
    };
}

export function buildRewardItemAudit(options: {
    generatedAt: string, sourceSnapshotVersion: string, sourceDatabaseSha256: string,
    tables: Record<string, GameDbRow[]>, stageDataset: StageDetailsDataset, wallpaperAssetPresentationIds: string[],
}): RewardItemAudit {
    if (Number.isNaN(Date.parse(options.generatedAt)) || !/^\d+$/.test(options.sourceSnapshotVersion)
        || !/^[a-f0-9]{64}$/.test(options.sourceDatabaseSha256)) throw new Error("Invalid reward audit provenance");
    if (options.stageDataset.sourceSnapshotVersion !== options.sourceSnapshotVersion
        || options.stageDataset.sourceDatabaseSha256 !== options.sourceDatabaseSha256) throw new Error("Stage dataset does not match reward audit provenance");
    const occurrences: Occurrence[] = [];
    for (const surface of SURFACES) {
        const rows = options.tables[surface.table];
        if (!rows) throw new Error(`Reward audit is missing surface ${surface.table}`);
        for (const row of rows) for (const [typeColumn, idColumn] of surface.pairs) {
            const itemType = value(row, typeColumn);
            const itemId = value(row, idColumn);
            if (!itemType && !itemId) continue;
            if (!itemType || !itemId) throw new Error(`${surface.table} row ${id(row)} has incomplete ${typeColumn}/${idColumn}`);
            const quantityRaw = value(row, "quantity");
            const quantity = quantityRaw !== undefined && Number.isSafeInteger(Number(quantityRaw)) ? Number(quantityRaw) : undefined;
            const missionId = value(row, "mission_id");
            occurrences.push({ table: surface.table, rowId: id(row), slot: typeColumn, itemType, itemId,
                ...(quantity !== undefined ? { quantity } : {}), ...(missionId ? { missionId } : {}) });
        }
    }

    const byType = new Map<string, Occurrence[]>();
    for (const occurrence of occurrences) byType.set(occurrence.itemType, [...(byType.get(occurrence.itemType) ?? []), occurrence]);
    const matrix = [...byType].sort(([left], [right]) => left.localeCompare(right)).map(([itemType, items]) => {
        const catalogTable = TARGETS[itemType];
        let joinedItemCount = 0;
        if (catalogTable) {
            const catalogRows = options.tables[catalogTable];
            if (!catalogRows) throw new Error(`Reward audit is missing catalog ${catalogTable}`);
            const catalog = new Map<string, GameDbRow>();
            for (const row of catalogRows) {
                const itemId = normalizeDbId(row.id);
                if (!itemId) throw new Error(`${catalogTable} contains a row without id`);
                if (catalog.has(itemId)) throw new Error(`${catalogTable} contains duplicate id ${itemId}`);
                catalog.set(itemId, row);
            }
            const referencedIds = [...new Set(items.map(item => item.itemId))];
            const missing = referencedIds.filter(itemId => !catalog.has(itemId));
            if (missing.length) throw new Error(`${itemType} references missing ${catalogTable} IDs: ${missing.join(", ")}`);
            joinedItemCount = referencedIds.length;
            if (itemType === "WallpaperItem") for (const itemId of referencedIds) {
                const row = catalog.get(itemId)!;
                if (!value(row, "name") || !value(row, "description")) throw new Error(`Wallpaper item ${itemId} is missing official presentation text`);
            }
        }
        return { itemType, occurrenceCount: items.length, uniqueItemCount: new Set(items.map(item => item.itemId)).size,
            ...(catalogTable ? { catalogTable } : {}), joinedItemCount, ...coverage(itemType) };
    });

    const wallpaperOccurrences = byType.get("WallpaperItem") ?? [];
    const wallpaperCatalog = options.tables.wallpaper_items ?? [];
    const catalogIds = wallpaperCatalog.map(row => id(row)).sort((left, right) => Number(left) - Number(right));
    const assetPresentationIds = [...new Set(options.wallpaperAssetPresentationIds)].sort((left, right) => Number(left) - Number(right));
    if (assetPresentationIds.length !== options.wallpaperAssetPresentationIds.length
        || JSON.stringify(assetPresentationIds) !== JSON.stringify(catalogIds)) throw new Error("Wallpaper asset presentations do not cover the exact wallpaper catalog");

    const areas = new Set((options.tables.areas ?? []).map(row => id(row)));
    const missions = new Map((options.tables.missions ?? []).map(row => [id(row), row]));
    const missionWallpaperOccurrences = wallpaperOccurrences.filter(item => item.table === "mission_rewards");
    const stageDeliverableMissions = missionWallpaperOccurrences.filter(item => {
        if (!item.missionId) throw new Error(`mission_rewards row ${item.rowId} has no mission_id`);
        const mission = missions.get(item.missionId);
        if (!mission) throw new Error(`mission_rewards row ${item.rowId} references missing mission ${item.missionId}`);
        const areaId = normalizeDbId(mission.area_id);
        return areaId !== undefined && areas.has(areaId);
    });
    const delivered = collectDeliveredWallpapers(options.stageDataset);
    const rowsBySurface = new Map<string, Map<string, GameDbRow>>();
    const sourceRow = (occurrence: Occurrence): GameDbRow => {
        let rows = rowsBySurface.get(occurrence.table);
        if (!rows) {
            rows = new Map((options.tables[occurrence.table] ?? []).map(row => [id(row), row]));
            rowsBySurface.set(occurrence.table, rows);
        }
        const row = rows.get(occurrence.rowId);
        if (!row) throw new Error(`${occurrence.table} is missing source row ${occurrence.rowId}`);
        return row;
    };

    const bossSources = wallpaperOccurrences.filter(item => item.table === "sugoroku_map_boss_drop_items");
    const previewSources = wallpaperOccurrences.filter(item => item.table === "quest_drop_item_views");
    const normalSources = wallpaperOccurrences.filter(item => item.table === "z_battle_normal_rewards");
    const firstSources = wallpaperOccurrences.filter(item => item.table === "z_battle_first_rewards");
    const mapsByQuest = new Map<string, GameDbRow[]>();
    for (const map of options.tables.sugoroku_maps ?? []) {
        const questId = normalizeDbId(map.quest_id);
        if (!questId) continue;
        mapsByQuest.set(questId, [...(mapsByQuest.get(questId) ?? []), map]);
    }
    const normalTables = new Map((options.tables.z_battle_normal_reward_tables ?? []).map(row => [id(row), row]));
    const checkpointsByGroup = new Map<string, GameDbRow[]>();
    for (const checkpoint of options.tables.z_battle_check_points ?? []) {
        const groupId = requiredRelationId(checkpoint, "z_battle_normal_reward_table_group_id", `Z-Battle checkpoint ${id(checkpoint)}`);
        checkpointsByGroup.set(groupId, [...(checkpointsByGroup.get(groupId) ?? []), checkpoint]);
    }
    const firstRangesBySet = new Map<string, GameDbRow[]>();
    for (const range of options.tables.z_battle_first_reward_level_ranges ?? []) {
        const setId = requiredRelationId(range, "z_battle_first_reward_set_id", `Z-Battle first reward range ${id(range)}`);
        firstRangesBySet.set(setId, [...(firstRangesBySet.get(setId) ?? []), range]);
    }

    const reconciliations = [
        reconcileStageWallpaperSurface({
            sourceTable: "mission_rewards",
            deliverySurface: "eventMissions",
            sourceOccurrences: missionWallpaperOccurrences,
            expected: stageDeliverableMissions.map(item => ({
                source: item,
                key: `mission:${item.missionId}:item:${item.itemId}:quantity:${item.quantity ?? "n/a"}`,
            })),
            delivered,
            identityCoverage: "exact-mission-item-quantity",
        }),
        reconcileStageWallpaperSurface({
            sourceTable: "sugoroku_map_boss_drop_items",
            deliverySurface: "questLevelBossDrops",
            sourceOccurrences: bossSources,
            expected: bossSources.map(item => ({
                source: item,
                key: `map:${requiredRelationId(sourceRow(item), "sugoroku_map_id", `Boss drop ${item.rowId}`)}` +
                    `:row:${item.rowId}:item:${item.itemId}`,
            })),
            delivered,
            identityCoverage: "exact-source-row-owner-item",
        }),
        reconcileStageWallpaperSurface({
            sourceTable: "quest_drop_item_views",
            deliverySurface: "questLevelDropPreviews",
            sourceOccurrences: previewSources,
            expected: previewSources.flatMap(item => {
                const row = sourceRow(item);
                const questId = requiredRelationId(row, "quest_id", `Quest drop view ${item.rowId}`);
                return (mapsByQuest.get(questId) ?? []).flatMap(map => {
                    if (!stageDropPreviewDifficultiesForMap(row, map)) return [];
                    return [{
                        source: item,
                        key: `map:${id(map)}:row:${item.rowId}:item:${item.itemId}`,
                    }];
                });
            }),
            delivered,
            identityCoverage: "owner-row-item-multiset-slot-not-preserved",
        }),
        reconcileStageWallpaperSurface({
            sourceTable: "z_battle_normal_rewards",
            deliverySurface: "zBattleCheckpointRewards",
            sourceOccurrences: normalSources,
            expected: normalSources.flatMap(item => {
                const tableId = requiredRelationId(sourceRow(item), "z_battle_normal_reward_table_id", `Z-Battle normal reward ${item.rowId}`);
                const table = normalTables.get(tableId);
                if (!table) throw new Error(`Z-Battle normal reward ${item.rowId} references missing table ${tableId}`);
                const groupId = requiredRelationId(table, "z_battle_normal_reward_table_group_id", `Z-Battle normal reward table ${tableId}`);
                return (checkpointsByGroup.get(groupId) ?? []).map(checkpoint => ({
                    source: item,
                    key: `stage:${requiredRelationId(checkpoint, "z_battle_stage_id", `Z-Battle checkpoint ${id(checkpoint)}`)}` +
                        `:checkpoint:${id(checkpoint)}:group:${groupId}:item:${item.itemId}:quantity:${item.quantity ?? "n/a"}`,
                }));
            }),
            delivered,
            identityCoverage: "owner-item-quantity-multiset-source-row-not-preserved",
        }),
        reconcileStageWallpaperSurface({
            sourceTable: "z_battle_first_rewards",
            deliverySurface: "zBattleFirstRewards",
            sourceOccurrences: firstSources,
            expected: firstSources.flatMap(item => {
                const setId = requiredRelationId(sourceRow(item), "z_battle_first_reward_set_id", `Z-Battle first reward ${item.rowId}`);
                return (firstRangesBySet.get(setId) ?? []).map(range => ({
                    source: item,
                    key: `stage:${requiredRelationId(range, "z_battle_stage_id", `Z-Battle first reward range ${id(range)}`)}` +
                        `:range:${id(range)}:set:${setId}:item:${item.itemId}:quantity:${item.quantity ?? "n/a"}`,
                }));
            }),
            delivered,
            identityCoverage: "owner-item-quantity-multiset-source-row-not-preserved",
        }),
    ];
    const stageSurfaceCoverage = reconciliations.map(item => item.coverage);
    const stageDeliverable = [...new Set(reconciliations.flatMap(item => item.deliverableSources))];
    const outside = wallpaperOccurrences.filter(item => !stageDeliverable.includes(item));
    const classifiedOutside = outside.map(item => {
        if (item.table === "mission_category_rewards") return { ...item, disposition: "surface-missing" as const };
        if (item.table === "rmbattle_mission_rewards") return { ...item, disposition: "contract-missing" as const };
        if (item.table === "mission_rewards") return { ...item, disposition: "out-of-scope" as const };
        if (["sugoroku_map_boss_drop_items", "quest_drop_item_views", "z_battle_normal_rewards", "z_battle_first_rewards"].includes(item.table)) {
            return { ...item, disposition: "out-of-scope" as const };
        }
        throw new Error(`Wallpaper occurrence ${item.table}:${item.rowId} has no consumer classification`);
    });
    const unboundSupportedCount = classifiedOutside.filter(item =>
        ["sugoroku_map_boss_drop_items", "quest_drop_item_views", "z_battle_normal_rewards", "z_battle_first_rewards"].includes(item.table)).length;
    const outsideClassifications: RewardItemAudit["wallpaper"]["outsideCurrentConsumerContract"]["classifications"] = [
        { kind: "mission-category-completion-rewards", disposition: "surface-missing",
            occurrenceCount: classifiedOutside.filter(item => item.table === "mission_category_rewards").length,
            followUp: "Prove mission-category completion semantics and navigation before adding a consumer surface." },
        { kind: "rmbattle-mission-rewards", disposition: "contract-missing",
            occurrenceCount: classifiedOutside.filter(item => item.table === "rmbattle_mission_rewards").length,
            followUp: "Prove RMBattle mission ownership, identity, and navigation before extending the Stage contract." },
        { kind: "general-missions-without-stage-binding", disposition: "out-of-scope",
            occurrenceCount: classifiedOutside.filter(item => item.table === "mission_rewards").length,
            followUp: "Define a general-mission surface for rewards whose missions have no valid Stage area binding." },
    ];
    if (unboundSupportedCount > 0) outsideClassifications.push({
        kind: "supported-stage-source-without-owner",
        disposition: "out-of-scope",
        occurrenceCount: unboundSupportedCount,
        followUp: "Resolve the missing Stage owner relation before treating these source rewards as deliverable.",
    });
    const quantityEvidence = wallpaperOccurrences.map(item => `${item.table}:${item.rowId}:${item.slot}:${item.itemId}:${item.quantity ?? "n/a"}`).sort();
    return {
        schemaVersion: 3, generatedAt: options.generatedAt, sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256, surfaceCount: SURFACES.length, occurrenceCount: occurrences.length,
        uniqueReferenceCount: new Set(occurrences.map(item => `${item.itemType}:${item.itemId}`)).size,
        wallpaper: {
            catalogCount: wallpaperCatalog.length, occurrenceCount: wallpaperOccurrences.length,
            uniqueReferencedCount: new Set(wallpaperOccurrences.map(item => item.itemId)).size,
            referencedIds: [...new Set(wallpaperOccurrences.map(item => item.itemId))].sort((left, right) => Number(left) - Number(right)),
            quantitiesSha256: createHash("sha256").update(quantityEvidence.join("\n")).digest("hex"),
            surfaceOccurrences: SURFACES.map(surface => ({ table: surface.table,
                occurrenceCount: wallpaperOccurrences.filter(item => item.table === surface.table).length })).filter(surface => surface.occurrenceCount > 0),
            catalogAndAssets: { catalogCount: wallpaperCatalog.length, assetPresentationCount: assetPresentationIds.length,
                completeCount: assetPresentationIds.length, status: "complete" },
            globalAuditedCoverage: { occurrenceCount: wallpaperOccurrences.length,
                uniqueItemCount: new Set(wallpaperOccurrences.map(item => item.itemId)).size },
            stageDeliverableCoverage: { occurrenceCount: stageDeliverable.length,
                uniqueItemCount: new Set(stageDeliverable.map(item => item.itemId)).size,
                sourceSurfaces: stageSurfaceCoverage.map(surface => ({
                    table: surface.sourceTable,
                    occurrenceCount: surface.deliverableOccurrenceCount,
                })),
            },
            stageDeliveredCoverage: { occurrenceCount: delivered.length,
                uniqueItemCount: new Set(delivered.map(item => item.itemId)).size,
                surfaceOccurrences: stageSurfaceCoverage.map(surface => ({
                    surface: surface.deliverySurface,
                    occurrenceCount: surface.deliveredOccurrenceCount,
                })),
                rendererStatus: "complete",
            },
            stageSurfaceCoverage,
            outsideCurrentConsumerContract: {
                occurrenceCount: classifiedOutside.length,
                classifications: outsideClassifications,
                occurrences: classifiedOutside,
            },
        }, matrix,
        surfaceOccurrences: SURFACES.map(surface => ({ table: surface.table,
            occurrenceCount: occurrences.filter(item => item.table === surface.table).length })),
    };
}

async function main(): Promise<void> {
    const values = new Map<string, string>();
    const args = process.argv.slice(2);
    for (let index = 0; index < args.length; index += 1) {
        const separator = args[index].indexOf("=");
        const name = separator >= 0 ? args[index].slice(0, separator) : args[index];
        if (!["--source-data-dir", "--source-snapshot-version", "--source-database-sha256", "--stage-dataset", "--wallpaper-manifest", "--output", "--generated-at"].includes(name)) throw new Error(`Unexpected reward audit argument: ${name}`);
        const item = separator >= 0 ? args[index].slice(separator + 1) : args[++index];
        if (!item || values.has(name)) throw new Error(`Missing or duplicate reward audit argument: ${name}`);
        values.set(name, item);
    }
    for (const required of ["--source-data-dir", "--source-snapshot-version", "--source-database-sha256", "--stage-dataset", "--wallpaper-manifest", "--output"]) if (!values.has(required)) throw new Error(`Missing reward audit argument: ${required}`);
    const source = resolve(values.get("--source-data-dir")!);
    const tables = Object.fromEntries(await Promise.all(REWARD_ITEM_AUDIT_TABLES.map(async table => [table, await readGameDbTable({ sourceRoot: source, dataDir: source }, table)])));
    const stageDataset = JSON.parse(await readFile(resolve(values.get("--stage-dataset")!), "utf8")) as StageDetailsDataset;
    const wallpaperManifest = validateWallpaperAssetManifest(JSON.parse(await readFile(resolve(values.get("--wallpaper-manifest")!), "utf8")));
    if (wallpaperManifest.source.databaseSnapshotVersion !== values.get("--source-snapshot-version")
        || wallpaperManifest.source.databaseSha256 !== values.get("--source-database-sha256")) throw new Error("Wallpaper asset manifest does not match reward audit provenance");
    const audit = buildRewardItemAudit({
        generatedAt: values.get("--generated-at") ?? new Date().toISOString(), sourceSnapshotVersion: values.get("--source-snapshot-version")!,
        sourceDatabaseSha256: values.get("--source-database-sha256")!, tables, stageDataset,
        wallpaperAssetPresentationIds: wallpaperManifest.presentations.map(item => item.itemId),
    });
    const output = resolve(values.get("--output")!);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(audit, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    console.log(JSON.stringify({ output, occurrenceCount: audit.occurrenceCount, wallpaper: audit.wallpaper, matrix: audit.matrix }, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
