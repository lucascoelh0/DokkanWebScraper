import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import {
    buildPanelMissionDataset,
    mapPanelMissionBoardFromFyi,
    mapPanelMissionCampaignFromFyi,
    mapPanelMissionEntryFromFyi,
    mapPanelMissionRewardFromFyi,
} from "./fyi-panel-missions";

describe("mapPanelMissionRewardFromFyi", function () {
    it("maps mission rewards into a flat reusable shape", () => {
        const reward = mapPanelMissionRewardFromFyi({
            id: 57474,
            item_id: 11,
            item_type: "Point::Stone",
            quantity: 3,
            mission_id: 3031102,
            item: {
                id: 11,
                type: "Dragon Stone",
                amount: 1,
            },
        } as any);

        equal(reward.id, "57474");
        equal(reward.itemType, "Point::Stone");
        equal(reward.itemId, "11");
        equal(reward.quantity, 3);
        equal(reward.rewardType, "Dragon Stone");
    });
});

describe("mapPanelMissionEntryFromFyi", function () {
    it("maps mission text, dates, and reward arrays", () => {
        const mission = mapPanelMissionEntryFromFyi({
            id: 3031101,
            type: "Mission::QuestAndZBattleClearMission::CountMission",
            name: "Clear \"Turtle School's \\nIntensive Training\" 3 times.",
            description: "Clear the Limited-Attempts Event<br />\"Study Hard, Play Hard!\" 3 times!",
            rewards: [
                {
                    id: 57473,
                    item_id: 248,
                    item_type: "SpecialItem",
                    quantity: 2,
                    mission_id: 3031101,
                    item: {
                        id: 248,
                        name: "Transcendent Campaign Summon Ticket",
                        description: "Summon Ticket...",
                        rarity: 3,
                        trade_points: 0,
                    },
                },
            ],
            characters: [],
            priority: 1,
            starts_at: "2026-06-27T07:00:00.000000Z",
            ends_at: "2026-07-29T14:59:59.000000Z",
            category_id: 30311,
            completed: false,
        } as any);

        equal(mission.id, "3031101");
        equal(mission.rewards.length, 1);
        equal(mission.startsAt, "2026-06-27T07:00:00.000Z");
        equal(mission.description.includes("Limited-Attempts Event"), true);
    });
});

describe("mapPanelMissionBoardFromFyi", function () {
    it("merges board summary metadata with detail missions", () => {
        const board = mapPanelMissionBoardFromFyi({
            id: 30311,
            type: "MissionCategory::BoardMissionCategory",
            ends_at: null,
            is_indefinite: null,
            priority: 1,
            img: "https://cdn.dokkan.fyi/assets/en/",
            missions_count: 11,
            completed_count: null,
            missions: [
                {
                    id: 3031102,
                    type: "Mission::QuestAndZBattleClearMission::CountMission",
                    name: "Clear a stage.",
                    description: "Clear a stage.",
                    rewards: [],
                    characters: [],
                },
            ],
        } as any, {
            id: 30311,
            type: "MissionCategory::BoardMissionCategory",
            priority: 1,
            missions_count: 11,
        } as any);

        equal(board.id, "30311");
        equal(board.type, "MissionCategory::BoardMissionCategory");
        equal(board.missionsCount, 11);
        equal(board.missions.length, 1);
    });
});

describe("mapPanelMissionCampaignFromFyi", function () {
    it("keeps campaign board ids and nested board details together", () => {
        const campaign = mapPanelMissionCampaignFromFyi({
            id: 3031,
            name: "July Campaign \\nPart 1",
            ends_at: "2026-07-29T14:59:59.000000Z",
            is_indefinite: false,
            img: "https://cdn.dokkan.fyi/assets/en/images/en/panel_mission/banner.png",
            category_ids: [30311],
        } as any, [
            {
                id: "30311",
                type: "MissionCategory::BoardMissionCategory",
                missions: [],
            },
        ] as any);

        equal(campaign.id, "3031");
        equal(campaign.categoryIds[0], "30311");
        equal(campaign.boards.length, 1);
    });
});

describe("buildPanelMissionDataset", function () {
    it("counts campaigns, boards and missions for the dataset header", () => {
        const dataset = buildPanelMissionDataset([
            {
                id: "3031",
                name: "Campaign 1",
                isIndefinite: false,
                categoryIds: ["30311"],
                boards: [
                    {
                        id: "30311",
                        type: "MissionCategory::BoardMissionCategory",
                        missions: [
                            {
                                id: "3031101",
                                type: "Mission::QuestAndZBattleClearMission::CountMission",
                                name: "Mission 1",
                                description: "",
                                rewards: [],
                                characters: [],
                            },
                        ],
                    },
                ],
            },
        ] as any);

        equal(dataset.campaignCount, 1);
        equal(dataset.boardCount, 1);
        equal(dataset.missionCount, 1);
        deepEqual(dataset.campaigns.map(campaign => campaign.name), ["Campaign 1"]);
    });
});
