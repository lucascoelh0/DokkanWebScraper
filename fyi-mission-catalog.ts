import { mkdir, readFile } from "fs/promises";
import { resolve } from "path";
import { EventMissionCategory, EventMissionCharacterRef, EventMissionDataset, EventMissionEntry, EventMissionReward, EventMissionRewardSkill } from "./event-mission";
import {
    MissionCatalogCharacterRef,
    MissionCatalogDataset,
    MissionCatalogGroup,
    MissionCatalogMission,
    MissionCatalogReward,
    MissionCatalogRewardSkill,
} from "./mission-catalog";
import { PanelMissionBoard, PanelMissionCampaign, PanelMissionCharacterRef, PanelMissionDataset, PanelMissionEntry, PanelMissionReward } from "./panel-mission";
import { writeFormattedJson } from "./format-json";

interface MissionCatalogBuildInput {
    panelMissions: PanelMissionDataset,
    eventMissions: EventMissionDataset,
}

export async function getDokkanFyiMissionCatalog(): Promise<MissionCatalogDataset> {
    const [panelMissions, eventMissions] = await Promise.all([
        readJsonFile<PanelMissionDataset>("data/panel-missions/latest/panel-missions.json"),
        readJsonFile<EventMissionDataset>("data/event-missions/latest/event-missions.json"),
    ]);

    return buildMissionCatalog({
        panelMissions,
        eventMissions,
    });
}

export async function writeDokkanFyiMissionCatalog(): Promise<string> {
    const dataset = await getDokkanFyiMissionCatalog();
    const outputDir = resolve(__dirname, "data/mission-catalog/latest");
    const outputPath = resolve(outputDir, "mission-catalog.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(outputPath, dataset);

    return outputPath;
}

export function buildMissionCatalog(input: MissionCatalogBuildInput): MissionCatalogDataset {
    const groups: MissionCatalogGroup[] = [];
    const missions: MissionCatalogMission[] = [];

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

function mapPanelMission(mission: PanelMissionEntry, groupKey: string): MissionCatalogMission {
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

function mapEventMission(mission: EventMissionEntry, groupKey: string): MissionCatalogMission {
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

function mapPanelReward(reward: PanelMissionReward): MissionCatalogReward {
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

function mapEventReward(reward: EventMissionReward): MissionCatalogReward {
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

function mapEventRewardSkill(skill: EventMissionRewardSkill): MissionCatalogRewardSkill {
    return {
        id: skill.id,
        attribute: skill.attribute,
        level: skill.level,
        hiddenPotentialSkillId: skill.hiddenPotentialSkillId,
    };
}

function mapPanelCharacter(character: PanelMissionCharacterRef): MissionCatalogCharacterRef {
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

function mapEventCharacter(character: EventMissionCharacterRef): MissionCatalogCharacterRef {
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

function panelCampaignGroupKey(campaignId: string): string {
    return `panel-campaign:${campaignId}`;
}

function panelBoardGroupKey(boardId: string): string {
    return `panel-board:${boardId}`;
}

function eventCategoryGroupKey(categoryId: string): string {
    return `event-category:${categoryId}`;
}

function compareGroups(left: MissionCatalogGroup, right: MissionCatalogGroup): number {
    return left.kind.localeCompare(right.kind)
        || left.title.localeCompare(right.title)
        || left.id.localeCompare(right.id);
}

function compareMissions(left: MissionCatalogMission, right: MissionCatalogMission): number {
    return left.groupKey.localeCompare(right.groupKey)
        || (right.priority ?? 0) - (left.priority ?? 0)
        || left.title.localeCompare(right.title)
        || left.key.localeCompare(right.key);
}

function compareStrings(left: string, right: string): number {
    return left.localeCompare(right);
}

async function readJsonFile<T>(relativePath: string): Promise<T> {
    const filePath = resolve(__dirname, relativePath);
    const raw = await readFile(filePath, { encoding: "utf8" });
    return JSON.parse(raw) as T;
}
