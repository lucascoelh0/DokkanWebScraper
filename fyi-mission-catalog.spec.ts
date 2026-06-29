import { deepEqual, equal } from "assert";
import { buildMissionCatalog } from "./fyi-mission-catalog";

describe("buildMissionCatalog", () => {
    it("normalizes panel and event mission datasets into shared groups and missions", () => {
        const dataset = buildMissionCatalog({
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
            } as any,
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
            } as any,
            frontierChapters: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                chapterCount: 1,
                pageCount: 1,
                nodeCount: 1,
                missionCount: 2,
                chapters: [
                    {
                        id: "2001",
                        seriesId: "2",
                        seriesName: "Dragon Ball Z",
                        name: "Planet Namek Saga",
                        chapterMissions: [
                            {
                                id: "33001",
                                name: "Clear the chapter",
                                description: "Finish the chapter.",
                                rewards: [
                                    {
                                        itemType: "Point::Stone",
                                        quantity: 2,
                                        name: "Dragon Stone",
                                    },
                                ],
                                characters: [],
                            },
                        ],
                        pages: [
                            {
                                id: "200101",
                                pageNumber: 1,
                                nodes: [
                                    {
                                        id: "20010102",
                                        stamina: 10,
                                        isSpecialNode: true,
                                        missions: [
                                            {
                                                id: "55289",
                                                name: "Use an Active Skill",
                                                description: "Trigger one Active Skill.",
                                                rewards: [
                                                    {
                                                        itemType: "CardSkinItem",
                                                        quantity: 1,
                                                        name: "Card Skin",
                                                    },
                                                ],
                                                characters: [],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            } as any,
        });

        equal(dataset.groupCount, 5);
        equal(dataset.missionCount, 4);
        equal(dataset.rewardCount, 4);
        equal(dataset.characterRefCount, 1);

        const campaign = dataset.groups.find(group => group.key === "panel-campaign:100");
        const board = dataset.groups.find(group => group.key === "panel-board:9001");
        const eventCategory = dataset.groups.find(group => group.key === "event-category:700");
        const frontierChapter = dataset.groups.find(group => group.key === "frontier-chapter:2001");
        const frontierNode = dataset.groups.find(group => group.key === "frontier-node:2001:20010102");
        const panelMission = dataset.missions.find(mission => mission.key === "panel:501");
        const eventMission = dataset.missions.find(mission => mission.key === "event:901");
        const frontierChapterMission = dataset.missions.find(mission => mission.key === "frontier-chapter:33001");
        const frontierNodeMission = dataset.missions.find(mission => mission.key === "frontier-node:55289");

        deepEqual(
            {
                campaignKind: campaign?.kind,
                boardParent: board?.parentGroupKey,
                boardTitle: board?.title,
                eventTitle: eventCategory?.title,
                eventPreviewSkillLevel: eventCategory?.previewRewards?.[0]?.skills?.[0]?.level,
                frontierSeriesName: frontierChapter?.seriesName,
                frontierNodeParent: frontierNode?.parentGroupKey,
                frontierNodeStamina: frontierNode?.stamina,
                panelGroupKey: panelMission?.groupKey,
                eventGroupKey: eventMission?.groupKey,
                frontierChapterGroupKey: frontierChapterMission?.groupKey,
                frontierNodeGroupKey: frontierNodeMission?.groupKey,
            },
            {
                campaignKind: "panel-campaign",
                boardParent: "panel-campaign:100",
                boardTitle: "Starter Board",
                eventTitle: "10th Anniversary Missions",
                eventPreviewSkillLevel: 6,
                frontierSeriesName: "Dragon Ball Z",
                frontierNodeParent: "frontier-chapter:2001",
                frontierNodeStamina: 10,
                panelGroupKey: "panel-board:9001",
                eventGroupKey: "event-category:700",
                frontierChapterGroupKey: "frontier-chapter:2001",
                frontierNodeGroupKey: "frontier-node:2001:20010102",
            },
        );
    });
});
