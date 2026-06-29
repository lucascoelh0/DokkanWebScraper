"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fyi_mission_catalog_1 = require("./fyi-mission-catalog");
describe("buildMissionCatalog", () => {
    it("normalizes panel and event mission datasets into shared groups and missions", () => {
        const dataset = (0, fyi_mission_catalog_1.buildMissionCatalog)({
            panelMissions: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                campaignCount: 1,
                boardCount: 1,
                missionCount: 1,
                campaigns: [
                    {
                        id: "100",
                        name: "Beginner Growth",
                        endsAt: "2026-02-01T00:00:00.000Z",
                        isIndefinite: false,
                        imageUrl: "panel.png",
                        categoryIds: ["9001"],
                        boards: [
                            {
                                id: "9001",
                                type: "Starter Board",
                                priority: 10,
                                missionsCount: 1,
                                missions: [
                                    {
                                        id: "501",
                                        type: "Daily",
                                        name: "Clear a stage",
                                        description: "Finish any stage.",
                                        rewards: [
                                            {
                                                itemType: "Point::Stone",
                                                quantity: 1,
                                                name: "Dragon Stone",
                                            },
                                        ],
                                        characters: [
                                            {
                                                id: "1029471",
                                                name: "Super Saiyan Gohan (Teen)",
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            eventMissions: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                count: 1,
                missionCount: 1,
                categories: [
                    {
                        id: "700",
                        type: "10th Anniversary Missions",
                        priority: 5,
                        previewRewards: [
                            {
                                itemType: "ExclusiveSkillOrb",
                                quantity: 1,
                                name: "Orb",
                                skills: [
                                    {
                                        attribute: "combo_attack",
                                        level: 6,
                                    },
                                ],
                            },
                        ],
                        missions: [
                            {
                                id: "901",
                                type: "Limited",
                                name: "Clear the anniversary event",
                                description: "Win once.",
                                rewards: [
                                    {
                                        itemType: "SupportFilm",
                                        quantity: 3,
                                        name: "Film Roll",
                                        skills: [],
                                    },
                                ],
                                characters: [],
                            },
                        ],
                    },
                ],
            },
        });
        (0, assert_1.equal)(dataset.groupCount, 3);
        (0, assert_1.equal)(dataset.missionCount, 2);
        (0, assert_1.equal)(dataset.rewardCount, 2);
        (0, assert_1.equal)(dataset.characterRefCount, 1);
        const campaign = dataset.groups.find(group => group.key === "panel-campaign:100");
        const board = dataset.groups.find(group => group.key === "panel-board:9001");
        const eventCategory = dataset.groups.find(group => group.key === "event-category:700");
        const panelMission = dataset.missions.find(mission => mission.key === "panel:501");
        const eventMission = dataset.missions.find(mission => mission.key === "event:901");
        (0, assert_1.deepEqual)({
            campaignKind: campaign?.kind,
            boardParent: board?.parentGroupKey,
            boardTitle: board?.title,
            eventTitle: eventCategory?.title,
            eventPreviewSkillLevel: eventCategory?.previewRewards?.[0]?.skills?.[0]?.level,
            panelGroupKey: panelMission?.groupKey,
            eventGroupKey: eventMission?.groupKey,
        }, {
            campaignKind: "panel-campaign",
            boardParent: "panel-campaign:100",
            boardTitle: "Starter Board",
            eventTitle: "10th Anniversary Missions",
            eventPreviewSkillLevel: 6,
            panelGroupKey: "panel-board:9001",
            eventGroupKey: "event-category:700",
        });
    });
});
//# sourceMappingURL=fyi-mission-catalog.spec.js.map