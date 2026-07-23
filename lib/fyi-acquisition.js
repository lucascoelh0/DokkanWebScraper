"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveMissionStageReferences = exports.parseMissionStageLevels = exports.buildAcquisitionDataset = exports.writeDokkanFyiAcquisitionDataset = exports.getDokkanFyiAcquisitionDataset = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const format_json_1 = require("./format-json");
const reward_item_key_1 = require("./reward-item-key");
const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
async function getDokkanFyiAcquisitionDataset() {
    const [eventMissions, awakeningMedals, frontierChapters, zBattles, dokkanInfoEventRewards] = await Promise.all([
        readJsonFile("data/event-missions/latest/event-missions.json"),
        readJsonFile("data/awakening/latest/awakening-medals.json"),
        readJsonFile("data/dokkan-frontier/latest/dokkan-frontier-chapters.json"),
        readJsonFile("data/z-battles/latest/z-battles.json"),
        readOptionalJsonFile("data/dokkaninfo-events/latest/event-rewards.json"),
    ]);
    return buildAcquisitionDataset({
        eventMissions,
        awakeningMedals,
        frontierChapters,
        zBattles,
        dokkanInfoEventRewards: dokkanInfoEventRewards ?? undefined,
    });
}
exports.getDokkanFyiAcquisitionDataset = getDokkanFyiAcquisitionDataset;
async function writeDokkanFyiAcquisitionDataset() {
    const dataset = await getDokkanFyiAcquisitionDataset();
    const outputDir = (0, path_1.resolve)(__dirname, "data/acquisition/latest");
    const outputPath = (0, path_1.resolve)(outputDir, "acquisition.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, dataset);
    return outputPath;
}
exports.writeDokkanFyiAcquisitionDataset = writeDokkanFyiAcquisitionDataset;
function buildAcquisitionDataset(input) {
    const itemsByKey = new Map();
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
exports.buildAcquisitionDataset = buildAcquisitionDataset;
function addDokkanInfoEventRewardSources(itemsByKey, dataset) {
    for (const event of dataset.events) {
        for (const reward of event.rewards) {
            upsertSource(itemsByKey, createItemIdentity(reward.itemType, reward.itemId, {
                name: reward.name,
                description: reward.description,
            }), {
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
            });
        }
    }
}
function addAwakeningMedalSources(itemsByKey, medal) {
    for (const stage of medal.stages) {
        upsertSource(itemsByKey, createItemIdentity("AwakeningMedal", medal.id, medal), {
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
        });
    }
    if (medal.zBattle?.id) {
        upsertSource(itemsByKey, createItemIdentity("AwakeningMedal", medal.id, medal), {
            key: `awakening-medal-z-battle:${medal.id}:${medal.zBattle.id}`,
            kind: "awakening-medal-z-battle",
            title: medal.zBattle.name || medal.name,
            subtitle: "Extreme Z-Battle",
            quantity: 1,
            zBattleId: medal.zBattle.id,
            imageUrl: medal.zBattle.images?.banner || medal.zBattle.images?.header || medal.zBattle.images?.button,
            sourcePath: `${DOKKAN_FYI_BASE_URL}/z-battles/${medal.zBattle.id}`,
        });
    }
    for (const sale of medal.babaShopSales) {
        upsertSource(itemsByKey, createItemIdentity("AwakeningMedal", medal.id, medal), {
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
        });
    }
    for (const tournament of medal.worldTournaments) {
        upsertSource(itemsByKey, createItemIdentity("AwakeningMedal", medal.id, medal), {
            key: `awakening-medal-world-tournament:${medal.id}:${tournament.id}`,
            kind: "awakening-medal-world-tournament",
            title: "World Tournament",
            subtitle: tournament.budokaiRankingGiftSet?.ranking || tournament.description,
            description: tournament.description,
            quantity: tournament.quantity ?? 1,
            tournamentId: tournament.budokaiRankingGiftSet?.budokaiId,
            ranking: tournament.budokaiRankingGiftSet?.ranking,
        });
    }
}
function addEventMissionSources(itemsByKey, category, dokkanInfoMissionStageIdsByKey, dokkanInfoStageById) {
    for (const mission of category.missions) {
        for (const reward of mission.rewards) {
            if (!reward.itemId || !reward.itemType) {
                continue;
            }
            upsertSource(itemsByKey, createItemIdentity(reward.itemType, reward.itemId, reward), {
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
                stageReferences: resolveMissionStageReferences(category.id, mission.id, mission.name, dokkanInfoMissionStageIdsByKey, dokkanInfoStageById),
            });
        }
    }
}
function buildDokkanInfoStageIndex(dataset) {
    const stages = new Map();
    for (const event of dataset?.events ?? []) {
        for (const stage of event.stages ?? []) {
            stages.set(stage.id, mapDokkanInfoStageReference(event, stage));
        }
    }
    return stages;
}
function buildDokkanInfoMissionStageIndex(dataset) {
    const missionStageIds = new Map();
    for (const event of dataset?.events ?? []) {
        for (const mission of event.missions ?? []) {
            missionStageIds.set(`${event.id}:${mission.id}`, [...new Set(mission.stageIds)]);
        }
    }
    return missionStageIds;
}
function parseMissionStageLevels(missionName) {
    const stageSelectorMatch = missionName
        .replace(/\s+/g, " ")
        .match(/clear\s+stages?\s+(.+?)(?:\.|$)/i);
    if (!stageSelectorMatch) {
        return undefined;
    }
    const selector = stageSelectorMatch[1]
        .split(/\s+(?:of|times?)\b/i)[0]
        .trim();
    const rangeMatch = selector.match(/^(\d+)\s*(?:to|[-~])\s*(\d+)$/i);
    if (rangeMatch) {
        const start = Number.parseInt(rangeMatch[1], 10);
        const end = Number.parseInt(rangeMatch[2], 10);
        const lower = Math.min(start, end);
        const upper = Math.max(start, end);
        return new Set(Array.from({ length: upper - lower + 1 }, (_, index) => lower + index));
    }
    const levels = [...selector.matchAll(/\d+/g)]
        .map(match => Number.parseInt(match[0], 10))
        .filter(level => Number.isFinite(level));
    return levels.length ? new Set(levels) : undefined;
}
exports.parseMissionStageLevels = parseMissionStageLevels;
function resolveMissionStageReferences(categoryId, missionId, missionName, missionStageIdsByKey, stagesById) {
    const stageIds = missionStageIdsByKey.get(`${categoryId}:${missionId}`);
    if (!stageIds?.length) {
        return undefined;
    }
    const references = stageIds
        .map(stageId => stagesById.get(stageId))
        .filter((stage) => Boolean(stage));
    const currentEventReferences = references.filter(reference => reference.eventId === categoryId);
    const candidateReferences = currentEventReferences.length > 0 ? currentEventReferences : references;
    const requestedLevels = parseMissionStageLevels(missionName);
    const filteredReferences = requestedLevels
        ? candidateReferences.filter(reference => reference.level !== undefined && requestedLevels.has(reference.level))
        : candidateReferences;
    return filteredReferences.length ? filteredReferences : candidateReferences.length ? candidateReferences : undefined;
}
exports.resolveMissionStageReferences = resolveMissionStageReferences;
function mapDokkanInfoStageReference(event, stage) {
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
function addFrontierSources(itemsByKey, chapter) {
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
function addFrontierMissionSources(itemsByKey, chapter, mission, page, node) {
    for (const reward of mission.rewards) {
        const itemIdentity = createFrontierRewardIdentity(reward);
        if (!itemIdentity) {
            continue;
        }
        upsertSource(itemsByKey, itemIdentity, {
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
        });
    }
}
function addZBattleSources(itemsByKey, battle) {
    for (const phase of battle.phases) {
        for (const level of phase.levels) {
            addZBattleLevelSources(itemsByKey, battle, phase, level);
        }
        for (const checkpoint of phase.rewardCheckpoints) {
            addZBattleCheckpointSources(itemsByKey, battle, phase, checkpoint);
        }
    }
}
function addZBattleLevelSources(itemsByKey, battle, phase, level) {
    for (const reward of level.firstRewards) {
        if (!reward.itemId) {
            continue;
        }
        upsertSource(itemsByKey, createItemIdentity(reward.itemType, reward.itemId, reward), {
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
        });
    }
}
function addZBattleCheckpointSources(itemsByKey, battle, phase, checkpoint) {
    for (const reward of checkpoint.rewards) {
        if (!reward.itemId) {
            continue;
        }
        upsertSource(itemsByKey, createItemIdentity(reward.itemType, reward.itemId, reward), {
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
        });
    }
}
function upsertSource(itemsByKey, itemIdentity, source) {
    const item = ensureItem(itemsByKey, itemIdentity);
    if (item.sourceKeys.has(source.key)) {
        return;
    }
    item.sourceKeys.add(source.key);
    item.sources.push(source);
}
function ensureItem(itemsByKey, itemIdentity) {
    const existing = itemsByKey.get(itemIdentity.key);
    if (existing) {
        existing.name = existing.name || itemIdentity.name;
        existing.description = existing.description || itemIdentity.description;
        existing.rarity = existing.rarity ?? itemIdentity.rarity;
        existing.zeni = existing.zeni ?? itemIdentity.zeni;
        existing.tradePoints = existing.tradePoints ?? itemIdentity.tradePoints;
        return existing;
    }
    const created = {
        ...itemIdentity,
        sources: [],
        sourceKeys: new Set(),
    };
    itemsByKey.set(itemIdentity.key, created);
    return created;
}
function createItemIdentity(itemType, itemId, payload) {
    const stableKey = (0, reward_item_key_1.buildStableRewardItemKey)({
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
function createFrontierRewardIdentity(reward) {
    const itemType = reward.itemType;
    if (!itemType) {
        return undefined;
    }
    const stableItemId = (0, reward_item_key_1.resolveStableRewardItemId)({
        itemType: reward.itemType,
        itemId: reward.itemId,
        cardId: reward.cardId,
        bgmId: reward.bgmId,
    });
    const stableKey = (0, reward_item_key_1.buildStableRewardItemKey)({
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
function compareItems(left, right) {
    return (left.name || "").localeCompare(right.name || "") || left.key.localeCompare(right.key);
}
function compareSources(left, right) {
    return left.kind.localeCompare(right.kind)
        || (left.title || "").localeCompare(right.title || "")
        || (left.subtitle || "").localeCompare(right.subtitle || "")
        || left.key.localeCompare(right.key);
}
function buildStageSubtitle(stage) {
    const parts = [
        stage.quest?.area?.name,
        stage.difficulty,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" - ") : undefined;
}
function buildStageDescription(stage) {
    const parts = [
        stage.requiredKeys ? `${stage.requiredKeys} key(s)` : undefined,
        stage.stamina ? `${stage.stamina} STA` : undefined,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" | ") : undefined;
}
function buildBabaShopSubtitle(sale) {
    const price = sale.discountedPrice ?? sale.price;
    const parts = [
        sale.currencyType,
        price !== undefined ? `${price}` : undefined,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" x ") : undefined;
}
function buildFrontierSourceKey(chapter, mission, reward, page, node) {
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
function buildFrontierSubtitle(chapter, page, node) {
    const parts = [
        `Dokkan Frontier - ${chapter.seriesName}`,
        chapter.name,
        page?.pageNumber ? `Page ${page.pageNumber}` : undefined,
        node ? `Node ${frontierNodeOrdinal(node.id)}` : undefined,
    ].filter(Boolean);
    return parts.join(" - ");
}
function frontierNodeOrdinal(nodeId) {
    const match = nodeId.match(/(\d{2})$/);
    if (!match) {
        return nodeId;
    }
    return String(parseInt(match[1], 10));
}
function resolveFrontierItemId(reward) {
    return reward.itemId || reward.cardId || reward.bgmId;
}
function toDokkanCdnUrl(path) {
    if (!path) {
        return undefined;
    }
    if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
    }
    return `https://cdn.dokkan.fyi/assets/${path.replace(/^\/+/, "")}`;
}
async function readJsonFile(relativePath) {
    const filePath = (0, path_1.resolve)(__dirname, relativePath);
    const raw = await (0, promises_1.readFile)(filePath, { encoding: "utf8" });
    return JSON.parse(raw);
}
async function readOptionalJsonFile(relativePath) {
    try {
        return await readJsonFile(relativePath);
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=fyi-acquisition.js.map