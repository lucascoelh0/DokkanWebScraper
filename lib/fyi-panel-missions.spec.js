"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const fyi_panel_missions_1 = require("./fyi-panel-missions");
(0, mocha_1.describe)("mapPanelMissionRewardFromFyi", function () {
    (0, mocha_1.it)("maps mission rewards into a flat reusable shape", () => {
        const reward = (0, fyi_panel_missions_1.mapPanelMissionRewardFromFyi)({
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
        });
        (0, assert_1.equal)(reward.id, "57474");
        (0, assert_1.equal)(reward.itemType, "Point::Stone");
        (0, assert_1.equal)(reward.itemId, "11");
        (0, assert_1.equal)(reward.quantity, 3);
        (0, assert_1.equal)(reward.rewardType, "Dragon Stone");
    });
});
(0, mocha_1.describe)("mapPanelMissionEntryFromFyi", function () {
    (0, mocha_1.it)("maps mission text, dates, and reward arrays", () => {
        const mission = (0, fyi_panel_missions_1.mapPanelMissionEntryFromFyi)({
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
        });
        (0, assert_1.equal)(mission.id, "3031101");
        (0, assert_1.equal)(mission.rewards.length, 1);
        (0, assert_1.equal)(mission.startsAt, "2026-06-27T07:00:00.000Z");
        (0, assert_1.equal)(mission.description.includes("Limited-Attempts Event"), true);
    });
});
(0, mocha_1.describe)("mapPanelMissionBoardFromFyi", function () {
    (0, mocha_1.it)("merges board summary metadata with detail missions", () => {
        const board = (0, fyi_panel_missions_1.mapPanelMissionBoardFromFyi)({
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
        }, {
            id: 30311,
            type: "MissionCategory::BoardMissionCategory",
            priority: 1,
            missions_count: 11,
        });
        (0, assert_1.equal)(board.id, "30311");
        (0, assert_1.equal)(board.type, "MissionCategory::BoardMissionCategory");
        (0, assert_1.equal)(board.missionsCount, 11);
        (0, assert_1.equal)(board.missions.length, 1);
    });
});
(0, mocha_1.describe)("mapPanelMissionCampaignFromFyi", function () {
    (0, mocha_1.it)("keeps campaign board ids and nested board details together", () => {
        const campaign = (0, fyi_panel_missions_1.mapPanelMissionCampaignFromFyi)({
            id: 3031,
            name: "July Campaign \\nPart 1",
            ends_at: "2026-07-29T14:59:59.000000Z",
            is_indefinite: false,
            img: "https://cdn.dokkan.fyi/assets/en/images/en/panel_mission/banner.png",
            category_ids: [30311],
        }, [
            {
                id: "30311",
                type: "MissionCategory::BoardMissionCategory",
                missions: [],
            },
        ]);
        (0, assert_1.equal)(campaign.id, "3031");
        (0, assert_1.equal)(campaign.categoryIds[0], "30311");
        (0, assert_1.equal)(campaign.boards.length, 1);
    });
});
(0, mocha_1.describe)("buildPanelMissionDataset", function () {
    (0, mocha_1.it)("counts campaigns, boards and missions for the dataset header", () => {
        const dataset = (0, fyi_panel_missions_1.buildPanelMissionDataset)([
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
        ]);
        (0, assert_1.equal)(dataset.campaignCount, 1);
        (0, assert_1.equal)(dataset.boardCount, 1);
        (0, assert_1.equal)(dataset.missionCount, 1);
        (0, assert_1.deepEqual)(dataset.campaigns.map(campaign => campaign.name), ["Campaign 1"]);
    });
});
//# sourceMappingURL=fyi-panel-missions.spec.js.map