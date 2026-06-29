"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMissionCatalog = exports.writeDokkanFyiMissionCatalog = exports.getDokkanFyiMissionCatalog = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const format_json_1 = require("./format-json");
async function getDokkanFyiMissionCatalog() {
    const [panelMissions, eventMissions] = await Promise.all([
        readJsonFile("data/panel-missions/latest/panel-missions.json"),
        readJsonFile("data/event-missions/latest/event-missions.json"),
    ]);
    return buildMissionCatalog({
        panelMissions,
        eventMissions,
    });
}
exports.getDokkanFyiMissionCatalog = getDokkanFyiMissionCatalog;
async function writeDokkanFyiMissionCatalog() {
    const dataset = await getDokkanFyiMissionCatalog();
    const outputDir = (0, path_1.resolve)(__dirname, "data/mission-catalog/latest");
    const outputPath = (0, path_1.resolve)(outputDir, "mission-catalog.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, dataset);
    return outputPath;
}
exports.writeDokkanFyiMissionCatalog = writeDokkanFyiMissionCatalog;
function buildMissionCatalog(input) {
    const groups = [];
    const missions = [];
    for (const campaign of input.panelMissions.campaigns) {
        const campaignGroupKey = panelCampaignGroupKey(campaign.id);
        groups.push({
            key: campaignGroupKey,
            kind: "panel-campaign",
            id: campaign.id,
            title: campaign.name,
            imageUrl: campaign.imageUrl,
            endsAt: campaign.endsAt,
            isIndefinite: campaign.isIndefinite,
            categoryIds: [...campaign.categoryIds].sort(compareStrings),
            missionsCount: campaign.boards.flatMap(board => board.missions).length,
        });
        for (const board of campaign.boards) {
            const boardGroupKey = panelBoardGroupKey(board.id);
            groups.push({
                key: boardGroupKey,
                kind: "panel-board",
                id: board.id,
                title: board.type,
                parentGroupKey: campaignGroupKey,
                imageUrl: board.imageUrl,
                endsAt: board.endsAt,
                isIndefinite: board.isIndefinite,
                priority: board.priority,
                missionsCount: board.missionsCount ?? board.missions.length,
                completedCount: board.completedCount,
            });
            for (const mission of board.missions) {
                missions.push(mapPanelMission(mission, boardGroupKey));
            }
        }
    }
    for (const category of input.eventMissions.categories) {
        const groupKey = eventCategoryGroupKey(category.id);
        groups.push({
            key: groupKey,
            kind: "event-category",
            id: category.id,
            title: category.type || `Event Category ${category.id}`,
            imageUrl: category.imageUrl,
            endsAt: category.endsAt,
            isIndefinite: category.isIndefinite,
            priority: category.priority,
            missionsCount: category.missionsCount ?? category.missions.length,
            completedCount: category.completedCount,
            previewRewards: category.previewRewards.map(mapEventReward),
        });
        for (const mission of category.missions) {
            missions.push(mapEventMission(mission, groupKey));
        }
    }
    const sortedGroups = [...groups].sort(compareGroups);
    const sortedMissions = [...missions].sort(compareMissions);
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        groupCount: sortedGroups.length,
        missionCount: sortedMissions.length,
        rewardCount: sortedMissions.reduce((sum, mission) => sum + mission.rewards.length, 0),
        characterRefCount: sortedMissions.reduce((sum, mission) => sum + mission.characters.length, 0),
        groups: sortedGroups,
        missions: sortedMissions,
    };
}
exports.buildMissionCatalog = buildMissionCatalog;
function mapPanelMission(mission, groupKey) {
    return {
        key: `panel:${mission.id}`,
        kind: "panel",
        id: mission.id,
        groupKey,
        type: mission.type,
        title: mission.name,
        description: mission.description,
        priority: mission.priority,
        startsAt: mission.startsAt,
        endsAt: mission.endsAt,
        categoryId: mission.categoryId,
        completed: mission.completed,
        rewards: mission.rewards.map(mapPanelReward),
        characters: mission.characters.map(mapPanelCharacter),
    };
}
function mapEventMission(mission, groupKey) {
    return {
        key: `event:${mission.id}`,
        kind: "event",
        id: mission.id,
        groupKey,
        type: mission.type,
        title: mission.name,
        description: mission.description,
        priority: mission.priority,
        startsAt: mission.startsAt,
        endsAt: mission.endsAt,
        categoryId: mission.categoryId,
        completed: mission.completed,
        rewards: mission.rewards.map(mapEventReward),
        characters: mission.characters.map(mapEventCharacter),
    };
}
function mapPanelReward(reward) {
    return {
        id: reward.id,
        missionId: reward.missionId,
        itemId: reward.itemId,
        itemType: reward.itemType,
        quantity: reward.quantity,
        name: reward.name,
        description: reward.description,
        rarity: reward.rarity,
        zeni: reward.zeni,
        tradePoints: reward.tradePoints,
        rewardType: reward.rewardType,
        amount: reward.amount,
        skills: [],
    };
}
function mapEventReward(reward) {
    return {
        id: reward.id,
        missionId: reward.missionId,
        itemId: reward.itemId,
        itemType: reward.itemType,
        quantity: reward.quantity,
        name: reward.name,
        description: reward.description,
        rarity: reward.rarity,
        zeni: reward.zeni,
        tradePoints: reward.tradePoints,
        rewardType: reward.rewardType,
        amount: reward.amount,
        grade: reward.grade,
        isReusable: reward.isReusable,
        imageId: reward.imageId,
        skills: reward.skills.map(mapEventRewardSkill),
    };
}
function mapEventRewardSkill(skill) {
    return {
        id: skill.id,
        attribute: skill.attribute,
        level: skill.level,
        hiddenPotentialSkillId: skill.hiddenPotentialSkillId,
    };
}
function mapPanelCharacter(character) {
    return {
        id: character.id,
        canonicalId: character.canonicalId,
        baseCharacterId: character.baseCharacterId,
        characterId: character.characterId,
        name: character.name,
        rarity: character.rarity,
        type: character.type,
        characterClass: character.characterClass,
        thumbnailId: character.thumbnailId,
        portraitUrl: character.portraitUrl,
        latestReleaseType: character.latestReleaseType,
        hasEza: character.hasEza,
        hasSeza: character.hasSeza,
        isReversiblyExchanged: character.isReversiblyExchanged,
        isFreelyObtainable: character.isFreelyObtainable,
    };
}
function mapEventCharacter(character) {
    return {
        id: character.id,
        canonicalId: character.canonicalId,
        baseCharacterId: character.baseCharacterId,
        characterId: character.characterId,
        name: character.name,
        rarity: character.rarity,
        type: character.type,
        characterClass: character.characterClass,
        thumbnailId: character.thumbnailId,
        portraitUrl: character.portraitUrl,
        latestReleaseType: character.latestReleaseType,
        hasEza: character.hasEza,
        hasSeza: character.hasSeza,
        isReversiblyExchanged: character.isReversiblyExchanged,
        isFreelyObtainable: character.isFreelyObtainable,
    };
}
function panelCampaignGroupKey(campaignId) {
    return `panel-campaign:${campaignId}`;
}
function panelBoardGroupKey(boardId) {
    return `panel-board:${boardId}`;
}
function eventCategoryGroupKey(categoryId) {
    return `event-category:${categoryId}`;
}
function compareGroups(left, right) {
    return left.kind.localeCompare(right.kind)
        || left.title.localeCompare(right.title)
        || left.id.localeCompare(right.id);
}
function compareMissions(left, right) {
    return left.groupKey.localeCompare(right.groupKey)
        || (right.priority ?? 0) - (left.priority ?? 0)
        || left.title.localeCompare(right.title)
        || left.key.localeCompare(right.key);
}
function compareStrings(left, right) {
    return left.localeCompare(right);
}
async function readJsonFile(relativePath) {
    const filePath = (0, path_1.resolve)(__dirname, relativePath);
    const raw = await (0, promises_1.readFile)(filePath, { encoding: "utf8" });
    return JSON.parse(raw);
}
//# sourceMappingURL=fyi-mission-catalog.js.map