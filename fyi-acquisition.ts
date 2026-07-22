import { mkdir, readFile } from "fs/promises";
import { resolve } from "path";
import { AcquisitionDataset, AcquisitionItem, AcquisitionSource, AcquisitionStageReference } from "./acquisition";
import { AwakeningMedal, AwakeningMedalDataset, AwakeningMedalStageSource, AwakeningMedalWorldTournamentSource } from "./awakening-path";
import { DokkanFrontierChapter, DokkanFrontierChaptersDataset, DokkanFrontierMission, DokkanFrontierNode, DokkanFrontierPage, DokkanFrontierReward } from "./dokkan-frontier";
import { DokkanInfoEventRewardDataset, DokkanInfoEventStage } from "./dokkaninfo-event-reward";
import { EventMissionCategory, EventMissionDataset, EventMissionEntry, EventMissionReward } from "./event-mission";
import { writeFormattedJson } from "./format-json";
import { buildStableRewardItemKey, resolveStableRewardItemId } from "./reward-item-key";
import { ZBattle, ZBattleDataset, ZBattleLevel, ZBattlePhase, ZBattleRewardCheckpoint, ZBattleRewardItem } from "./z-battle";

interface AcquisitionBuildInput {
    eventMissions: EventMissionDataset,
    awakeningMedals: AwakeningMedalDataset,
    frontierChapters: DokkanFrontierChaptersDataset,
    zBattles: ZBattleDataset,
    dokkanInfoEventRewards?: DokkanInfoEventRewardDataset,
}

interface AcquisitionItemBuilder extends AcquisitionItem {
    sourceKeys: Set<string>,
}

const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";

export async function getDokkanFyiAcquisitionDataset(): Promise<AcquisitionDataset> {
    const [eventMissions, awakeningMedals, frontierChapters, zBattles, dokkanInfoEventRewards] = await Promise.all([
        readJsonFile<EventMissionDataset>("data/event-missions/latest/event-missions.json"),
        readJsonFile<AwakeningMedalDataset>("data/awakening/latest/awakening-medals.json"),
        readJsonFile<DokkanFrontierChaptersDataset>("data/dokkan-frontier/latest/dokkan-frontier-chapters.json"),
        readJsonFile<ZBattleDataset>("data/z-battles/latest/z-battles.json"),
        readOptionalJsonFile<DokkanInfoEventRewardDataset>("data/dokkaninfo-events/latest/event-rewards.json"),
    ]);

    return buildAcquisitionDataset({
        eventMissions,
        awakeningMedals,
        frontierChapters,
        zBattles,
        dokkanInfoEventRewards: dokkanInfoEventRewards ?? undefined,
    });
}

export async function writeDokkanFyiAcquisitionDataset(): Promise<string> {
    const dataset = await getDokkanFyiAcquisitionDataset();
    const outputDir = resolve(__dirname, "data/acquisition/latest");
    const outputPath = resolve(outputDir, "acquisition.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(outputPath, dataset);

    return outputPath;
}

export function buildAcquisitionDataset(input: AcquisitionBuildInput): AcquisitionDataset {
    const itemsByKey = new Map<string, AcquisitionItemBuilder>();
    const dokkanInfoStageById = buildDokkanInfoStageIndex(input.dokkanInfoEventRewards);
    const dokkanInfoMissionStageIdsByKey = buildDokkanInfoMissionStageIndex(input.dokkanInfoEventRewards);

    for (const medal of input.awakeningMedals.medals) {
        addAwakeningMedalSources(itemsByKey, medal);
    }

    for (const category of input.eventMissions.categories) {
        addEventMissionSources(itemsByKey, category, dokkanInfoMissionStageIdsByKey, dokkanInfoStageById);
    }

    for (const chapter of input.frontierChapters.chapters) {
        addFrontierSources(itemsByKey, chapter);
    }

    for (const battle of input.zBattles.battles) {
        addZBattleSources(itemsByKey, battle);
    }

    if (input.dokkanInfoEventRewards) {
        addDokkanInfoEventRewardSources(itemsByKey, input.dokkanInfoEventRewards);
    }

    const items = [...itemsByKey.values()]
        .map(({ sourceKeys: _sourceKeys, ...item }) => ({
            ...item,
            sources: [...item.sources].sort(compareSources),
        }))
        .sort(compareItems);

    const sourceCount = items.reduce((count, item) => count + item.sources.length, 0);

    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        itemCount: items.length,
        sourceCount,
        items,
    };
}

function addDokkanInfoEventRewardSources(
    itemsByKey: Map<string, AcquisitionItemBuilder>,
    dataset: DokkanInfoEventRewardDataset,
) {
    for (const event of dataset.events) {
        for (const reward of event.rewards) {
            upsertSource(
                itemsByKey,
                createItemIdentity(reward.itemType, reward.itemId, {
                    name: reward.name,
                    description: reward.description,
                }),
                {
                    key: reward.key,
                    kind: "dokkaninfo-event-reward",
                    title: event.name,
                    subtitle: reward.stageId ? `Stage ${reward.stageId}` : event.type,
                    description: reward.description,
                    quantity: reward.quantity,
                    sourcePath: reward.stagePath || event.sourcePath,
                    startsAt: event.startAt,
                    endsAt: event.endAt,
                    eventType: event.type,
                    eventId: event.id,
                    eventStageId: reward.stageId,
                    stageId: reward.stageId,
                },
            );
        }
    }
}

function addAwakeningMedalSources(itemsByKey: Map<string, AcquisitionItemBuilder>, medal: AwakeningMedal) {
    for (const stage of medal.stages) {
        upsertSource(
            itemsByKey,
            createItemIdentity("AwakeningMedal", medal.id, medal),
            {
                key: `awakening-medal-stage:${medal.id}:${stage.id}`,
                kind: "awakening-medal-stage",
                title: stage.quest?.name || medal.name,
                subtitle: buildStageSubtitle(stage),
                description: buildStageDescription(stage),
                quantity: 1,
                missionType: stage.quest?.area?.type,
                areaId: stage.quest?.area?.id,
                questId: stage.quest?.id,
                stageId: stage.id,
                difficulty: stage.difficulty,
                imageUrl: stage.quest?.area?.images?.banner || stage.quest?.area?.images?.header || stage.quest?.area?.images?.button,
            },
        );
    }

    if (medal.zBattle?.id) {
        upsertSource(
            itemsByKey,
            createItemIdentity("AwakeningMedal", medal.id, medal),
            {
                key: `awakening-medal-z-battle:${medal.id}:${medal.zBattle.id}`,
                kind: "awakening-medal-z-battle",
                title: medal.zBattle.name || medal.name,
                subtitle: "Extreme Z-Battle",
                quantity: 1,
                zBattleId: medal.zBattle.id,
                imageUrl: medal.zBattle.images?.banner || medal.zBattle.images?.header || medal.zBattle.images?.button,
                sourcePath: `${DOKKAN_FYI_BASE_URL}/z-battles/${medal.zBattle.id}`,
            },
        );
    }

    for (const sale of medal.babaShopSales) {
        upsertSource(
            itemsByKey,
            createItemIdentity("AwakeningMedal", medal.id, medal),
            {
                key: `awakening-medal-baba-shop:${medal.id}:${sale.id}`,
                kind: "awakening-medal-baba-shop",
                title: "Baba Shop",
                subtitle: buildBabaShopSubtitle(sale),
                quantity: sale.itemQuantity ?? 1,
                saleId: sale.id,
                currencyType: sale.currencyType,
                currencyId: sale.currencyId,
                price: sale.discountedPrice ?? sale.price,
                buyableNum: sale.buyableNum,
                startsAt: sale.startAt,
                endsAt: sale.endAt,
            },
        );
    }

    for (const tournament of medal.worldTournaments) {
        upsertSource(
            itemsByKey,
            createItemIdentity("AwakeningMedal", medal.id, medal),
            {
                key: `awakening-medal-world-tournament:${medal.id}:${tournament.id}`,
                kind: "awakening-medal-world-tournament",
                title: "World Tournament",
                subtitle: tournament.budokaiRankingGiftSet?.ranking || tournament.description,
                description: tournament.description,
                quantity: tournament.quantity ?? 1,
                tournamentId: tournament.budokaiRankingGiftSet?.budokaiId,
                ranking: tournament.budokaiRankingGiftSet?.ranking,
            },
        );
    }
}

function addEventMissionSources(
    itemsByKey: Map<string, AcquisitionItemBuilder>,
    category: EventMissionCategory,
    dokkanInfoMissionStageIdsByKey: Map<string, string[]>,
    dokkanInfoStageById: Map<string, AcquisitionStageReference>,
) {
    for (const mission of category.missions) {
        for (const reward of mission.rewards) {
            if (!reward.itemId || !reward.itemType) {
                continue;
            }

            upsertSource(
                itemsByKey,
                createItemIdentity(reward.itemType, reward.itemId, reward),
                {
                    key: `event-mission:${category.id}:${mission.id}:${reward.id || reward.itemType}:${reward.itemId}`,
                    kind: "event-mission",
                    title: mission.name || "Event mission",
                    subtitle: category.type,
                    description: mission.description,
                    quantity: reward.quantity,
                    imageUrl: category.imageUrl,
                    sourcePath: `${DOKKAN_FYI_BASE_URL}/missions/${category.id}`,
                    startsAt: mission.startsAt,
                    endsAt: mission.endsAt || category.endsAt,
                    missionCategoryId: category.id,
                    missionId: mission.id,
                    missionType: mission.type,
                    stageReferences: resolveMissionStageReferences(
                        category.id,
                        mission.id,
                        dokkanInfoMissionStageIdsByKey,
                        dokkanInfoStageById,
                    ),
                },
            );
        }
    }
}

function buildDokkanInfoStageIndex(
    dataset: DokkanInfoEventRewardDataset | undefined,
): Map<string, AcquisitionStageReference> {
    const stages = new Map<string, AcquisitionStageReference>();

    for (const event of dataset?.events ?? []) {
        for (const stage of event.stages ?? []) {
            stages.set(stage.id, mapDokkanInfoStageReference(event, stage));
        }
    }

    return stages;
}

function buildDokkanInfoMissionStageIndex(
    dataset: DokkanInfoEventRewardDataset | undefined,
): Map<string, string[]> {
    const missionStageIds = new Map<string, string[]>();

    for (const event of dataset?.events ?? []) {
        for (const mission of event.missions ?? []) {
            missionStageIds.set(`${event.id}:${mission.id}`, [...new Set(mission.stageIds)]);
        }
    }

    return missionStageIds;
}

function resolveMissionStageReferences(
    categoryId: string,
    missionId: string,
    missionStageIdsByKey: Map<string, string[]>,
    stagesById: Map<string, AcquisitionStageReference>,
): AcquisitionStageReference[] | undefined {
    const stageIds = missionStageIdsByKey.get(`${categoryId}:${missionId}`);
    if (!stageIds?.length) {
        return undefined;
    }

    const references = stageIds
        .map(stageId => stagesById.get(stageId))
        .filter((stage): stage is AcquisitionStageReference => Boolean(stage));

    return references.length ? references : undefined;
}

function mapDokkanInfoStageReference(
    event: NonNullable<DokkanInfoEventRewardDataset["events"]>[number],
    stage: DokkanInfoEventStage,
): AcquisitionStageReference {
    return {
        id: stage.id,
        title: stage.title,
        level: stage.level,
        difficulty: stage.difficulty,
        sourcePath: stage.sourcePath,
        eventType: event.type,
        eventId: event.id,
        eventName: event.name,
    };
}

function addFrontierSources(itemsByKey: Map<string, AcquisitionItemBuilder>, chapter: DokkanFrontierChapter) {
    for (const mission of chapter.chapterMissions) {
        addFrontierMissionSources(itemsByKey, chapter, mission);
    }

    for (const page of chapter.pages) {
        for (const node of page.nodes) {
            for (const mission of node.missions) {
                addFrontierMissionSources(itemsByKey, chapter, mission, page, node);
            }
        }
    }
}

function addFrontierMissionSources(
    itemsByKey: Map<string, AcquisitionItemBuilder>,
    chapter: DokkanFrontierChapter,
    mission: DokkanFrontierMission,
    page?: DokkanFrontierPage,
    node?: DokkanFrontierNode,
) {
    for (const reward of mission.rewards) {
        const itemIdentity = createFrontierRewardIdentity(reward);

        if (!itemIdentity) {
            continue;
        }

        upsertSource(
            itemsByKey,
            itemIdentity,
            {
                key: buildFrontierSourceKey(chapter, mission, reward, page, node),
                kind: node ? "frontier-node-mission" : "frontier-chapter-mission",
                title: mission.name || "Dokkan Frontier mission",
                subtitle: buildFrontierSubtitle(chapter, page, node),
                description: mission.description,
                quantity: reward.quantity,
                imageUrl: toDokkanCdnUrl(chapter.bannerImagePath),
                sourcePath: `${DOKKAN_FYI_BASE_URL}/dokkan-frontier/${chapter.seriesId}/chapters/${chapter.id}`,
                startsAt: mission.startsAt,
                endsAt: mission.endsAt,
                missionCategoryId: mission.categoryId,
                missionId: mission.id,
                missionType: mission.type,
                frontierSeriesId: chapter.seriesId,
                frontierChapterId: chapter.id,
                frontierPageId: page?.id,
                frontierNodeId: node?.id,
            },
        );
    }
}

function addZBattleSources(itemsByKey: Map<string, AcquisitionItemBuilder>, battle: ZBattle) {
    for (const phase of battle.phases) {
        for (const level of phase.levels) {
            addZBattleLevelSources(itemsByKey, battle, phase, level);
        }

        for (const checkpoint of phase.rewardCheckpoints) {
            addZBattleCheckpointSources(itemsByKey, battle, phase, checkpoint);
        }
    }
}

function addZBattleLevelSources(
    itemsByKey: Map<string, AcquisitionItemBuilder>,
    battle: ZBattle,
    phase: ZBattlePhase,
    level: ZBattleLevel,
) {
    for (const reward of level.firstRewards) {
        if (!reward.itemId) {
            continue;
        }

        upsertSource(
            itemsByKey,
            createItemIdentity(reward.itemType, reward.itemId, reward),
            {
                key: `z-battle-level:${battle.id}:${phase.id}:${level.level}:${reward.id || reward.itemType}:${reward.itemId}`,
                kind: "z-battle-level",
                title: `${battle.name} Lv. ${level.level}`,
                subtitle: battle.nickname || phase.kind,
                quantity: reward.quantity,
                imageUrl: phase.images.bannerUrl || phase.images.buttonUrl,
                sourcePath: `${DOKKAN_FYI_BASE_URL}/z-battles/${battle.id}`,
                zBattleId: battle.id,
                zBattlePhaseId: phase.id,
                level: level.level,
            },
        );
    }
}

function addZBattleCheckpointSources(
    itemsByKey: Map<string, AcquisitionItemBuilder>,
    battle: ZBattle,
    phase: ZBattlePhase,
    checkpoint: ZBattleRewardCheckpoint,
) {
    for (const reward of checkpoint.rewards) {
        if (!reward.itemId) {
            continue;
        }

        upsertSource(
            itemsByKey,
            createItemIdentity(reward.itemType, reward.itemId, reward),
            {
                key: `z-battle-checkpoint:${battle.id}:${phase.id}:${checkpoint.level}:${reward.id || reward.itemType}:${reward.itemId}`,
                kind: "z-battle-checkpoint",
                title: `${battle.name} reward checkpoint`,
                subtitle: `Lv. ${checkpoint.level}`,
                quantity: reward.quantity,
                imageUrl: phase.images.bannerUrl || phase.images.buttonUrl,
                sourcePath: `${DOKKAN_FYI_BASE_URL}/z-battles/${battle.id}`,
                zBattleId: battle.id,
                zBattlePhaseId: phase.id,
                checkpointLevel: checkpoint.level,
            },
        );
    }
}

function upsertSource(
    itemsByKey: Map<string, AcquisitionItemBuilder>,
    itemIdentity: Omit<AcquisitionItem, "sources">,
    source: AcquisitionSource,
) {
    const item = ensureItem(itemsByKey, itemIdentity);

    if (item.sourceKeys.has(source.key)) {
        return;
    }

    item.sourceKeys.add(source.key);
    item.sources.push(source);
}

function ensureItem(
    itemsByKey: Map<string, AcquisitionItemBuilder>,
    itemIdentity: Omit<AcquisitionItem, "sources">,
): AcquisitionItemBuilder {
    const existing = itemsByKey.get(itemIdentity.key);

    if (existing) {
        existing.name = existing.name || itemIdentity.name;
        existing.description = existing.description || itemIdentity.description;
        existing.rarity = existing.rarity ?? itemIdentity.rarity;
        existing.zeni = existing.zeni ?? itemIdentity.zeni;
        existing.tradePoints = existing.tradePoints ?? itemIdentity.tradePoints;
        return existing;
    }

    const created: AcquisitionItemBuilder = {
        ...itemIdentity,
        sources: [],
        sourceKeys: new Set<string>(),
    };

    itemsByKey.set(itemIdentity.key, created);
    return created;
}

function createItemIdentity(
    itemType: string,
    itemId: string,
    payload: {
        name?: string,
        description?: string,
        rarity?: number,
        zeni?: number,
        tradePoints?: number,
        cardId?: string,
        step?: number,
        linkTo?: string,
        bgmId?: string,
        key?: string,
    },
): Omit<AcquisitionItem, "sources"> {
    const stableKey = buildStableRewardItemKey({
        itemType,
        itemId,
        cardId: payload.cardId,
        step: payload.step,
        linkTo: payload.linkTo,
        bgmId: payload.bgmId,
    });

    return {
        key: payload.key || stableKey || `${itemType}:${itemId}`,
        itemType,
        itemId,
        name: payload.name,
        description: payload.description,
        rarity: payload.rarity,
        zeni: payload.zeni,
        tradePoints: payload.tradePoints,
        cardId: payload.cardId,
        step: payload.step,
        linkTo: payload.linkTo,
        bgmId: payload.bgmId,
    };
}

function createFrontierRewardIdentity(reward: DokkanFrontierReward): Omit<AcquisitionItem, "sources"> | undefined {
    const itemType = reward.itemType;

    if (!itemType) {
        return undefined;
    }

    const stableItemId = resolveStableRewardItemId({
        itemType: reward.itemType,
        itemId: reward.itemId,
        cardId: reward.cardId,
        bgmId: reward.bgmId,
    });
    const stableKey = buildStableRewardItemKey({
        itemType: reward.itemType,
        itemId: reward.itemId,
        cardId: reward.cardId,
        step: reward.step,
        linkTo: reward.linkTo,
        bgmId: reward.bgmId,
    });

    if (!stableItemId || !stableKey) {
        return undefined;
    }

    return createItemIdentity(itemType, stableItemId, {
        key: stableKey,
        name: reward.name,
        description: reward.description,
        rarity: reward.rarity,
        zeni: reward.zeni,
        tradePoints: reward.tradePoints,
        cardId: reward.cardId,
        step: reward.step,
        linkTo: reward.linkTo,
        bgmId: reward.bgmId,
    });
}

function compareItems(left: AcquisitionItem, right: AcquisitionItem): number {
    return (left.name || "").localeCompare(right.name || "") || left.key.localeCompare(right.key);
}

function compareSources(left: AcquisitionSource, right: AcquisitionSource): number {
    return left.kind.localeCompare(right.kind)
        || (left.title || "").localeCompare(right.title || "")
        || (left.subtitle || "").localeCompare(right.subtitle || "")
        || left.key.localeCompare(right.key);
}

function buildStageSubtitle(stage: AwakeningMedalStageSource): string | undefined {
    const parts = [
        stage.quest?.area?.name,
        stage.difficulty,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(" - ") : undefined;
}

function buildStageDescription(stage: AwakeningMedalStageSource): string | undefined {
    const parts = [
        stage.requiredKeys ? `${stage.requiredKeys} key(s)` : undefined,
        stage.stamina ? `${stage.stamina} STA` : undefined,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(" | ") : undefined;
}

function buildBabaShopSubtitle(sale: AwakeningMedal["babaShopSales"][number]): string | undefined {
    const price = sale.discountedPrice ?? sale.price;
    const parts = [
        sale.currencyType,
        price !== undefined ? `${price}` : undefined,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(" x ") : undefined;
}

function buildFrontierSourceKey(
    chapter: DokkanFrontierChapter,
    mission: DokkanFrontierMission,
    reward: DokkanFrontierReward,
    page?: DokkanFrontierPage,
    node?: DokkanFrontierNode,
): string {
    const parts = [
        node ? "frontier-node-mission" : "frontier-chapter-mission",
        chapter.id,
        page?.id,
        node?.id,
        mission.id,
        reward.id || reward.itemType || reward.itemId,
        resolveFrontierItemId(reward),
    ].filter(Boolean);

    return parts.join(":");
}

function buildFrontierSubtitle(
    chapter: DokkanFrontierChapter,
    page?: DokkanFrontierPage,
    node?: DokkanFrontierNode,
): string {
    const parts = [
        `Dokkan Frontier - ${chapter.seriesName}`,
        chapter.name,
        page?.pageNumber ? `Page ${page.pageNumber}` : undefined,
        node ? `Node ${frontierNodeOrdinal(node.id)}` : undefined,
    ].filter(Boolean);

    return parts.join(" - ");
}

function frontierNodeOrdinal(nodeId: string): string {
    const match = nodeId.match(/(\d{2})$/);

    if (!match) {
        return nodeId;
    }

    return String(parseInt(match[1], 10));
}

function resolveFrontierItemId(reward: DokkanFrontierReward): string | undefined {
    return reward.itemId || reward.cardId || reward.bgmId;
}

function toDokkanCdnUrl(path?: string): string | undefined {
    if (!path) {
        return undefined;
    }

    if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
    }

    return `https://cdn.dokkan.fyi/assets/${path.replace(/^\/+/, "")}`;
}

async function readJsonFile<T>(relativePath: string): Promise<T> {
    const filePath = resolve(__dirname, relativePath);
    const raw = await readFile(filePath, { encoding: "utf8" });
    return JSON.parse(raw) as T;
}

async function readOptionalJsonFile<T>(relativePath: string): Promise<T | undefined> {
    try {
        return await readJsonFile<T>(relativePath);
    } catch {
        return undefined;
    }
}
