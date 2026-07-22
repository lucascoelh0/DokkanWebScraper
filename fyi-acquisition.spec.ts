import { deepEqual, equal } from "assert";
import { buildAcquisitionDataset } from "./fyi-acquisition";

describe("buildAcquisitionDataset", () => {
    it("groups multiple source types under a stable item key", () => {
        const dataset = buildAcquisitionDataset({
            eventMissions: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                count: 1,
                missionCount: 1,
                categories: [
                    {
                        id: "796",
                        type: "MissionCategory::ExtraMissionCategory",
                        imageUrl: "https://cdn.dokkan.fyi/assets/mission.png",
                        previewRewards: [],
                        missions: [
                            {
                                id: "24832",
                                type: "Mission::QuestAndZBattleClearMission::CountMission",
                                name: "Mission A",
                                description: "Clear Stage 3 once!",
                                rewards: [
                                    {
                                        id: "1",
                                        itemId: "11",
                                        itemType: "Point::Stone",
                                        quantity: 2,
                                        rewardType: "Dragon Stone",
                                        amount: 1,
                                        skills: [],
                                    },
                                ],
                                characters: [],
                            },
                        ],
                    },
                ],
            },
            awakeningMedals: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                count: 1,
                medals: [
                    {
                        id: "100874",
                        name: "Super Saiyan Trunks (Teen) [Rainbow]",
                        description: "Special Extreme Z-Battle medal.",
                        rarity: 4,
                        zeni: 500000,
                        tradePoints: 0,
                        usages: [],
                        stages: [
                            {
                                id: "17510014",
                                difficulty: "SUPER 2",
                                stamina: 0,
                                requiredKeys: 3,
                                questId: "1751001",
                                quest: {
                                    id: "1751001",
                                    name: "Stage 1",
                                    areaId: "1751",
                                    area: {
                                        id: "1751",
                                        name: "Seriously Serious! All-Out Battles 2",
                                        type: "Event",
                                        images: {
                                            banner: "https://cdn.dokkan.fyi/assets/banner.png",
                                        },
                                    },
                                },
                            },
                        ],
                        zBattle: {
                            id: "67",
                            type: "ZBattleStage::Normal",
                            images: {
                                banner: "https://cdn.dokkan.fyi/assets/zbattle.png",
                            },
                        },
                        babaShopSales: [],
                        worldTournaments: [],
                    },
                ],
            },
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
                        bannerImagePath: "origin/episode_banner/origin_map_02_01.png",
                        pages: [
                            {
                                id: "200101",
                                pageNumber: 1,
                                nodes: [
                                    {
                                        id: "20010102",
                                        missions: [
                                            {
                                                id: "32185",
                                                type: "Mission::QuestAndZBattleClearMission::CountMission",
                                                name: "Activate the specified character's Active Skill and clear Node 2.",
                                                description: "Clear Node 2 in Dokkan Frontier.",
                                                categoryId: "200101",
                                                rewards: [
                                                    {
                                                        id: "55289",
                                                        missionId: "32185",
                                                        itemId: "1",
                                                        itemType: "CardSkinItem",
                                                        quantity: 1,
                                                        name: "Vegeta card skin step 1",
                                                        description: "Unlock scene step 1.",
                                                        cardId: "1029571",
                                                        step: 1,
                                                        linkTo: "internal:OriginMapScene?episode=2001&battle=20010102",
                                                    },
                                                ],
                                                characters: [],
                                            },
                                        ],
                                        unlockMissions: [],
                                        requiredCharacters: [],
                                        intensityEffects: [],
                                        rounds: [],
                                    },
                                ],
                                backgroundImagePath: "origin/map_bg/test.png",
                            },
                        ],
                        groupExchange: [],
                        chapterMissions: [
                            {
                                id: "33000",
                                type: "Mission::CountMission",
                                name: "Clear Planet Namek Saga.",
                                description: "Clear the chapter.",
                                categoryId: "2001",
                                rewards: [
                                    {
                                        id: "33001",
                                        missionId: "33000",
                                        itemId: "11",
                                        itemType: "Point::Stone",
                                        quantity: 3,
                                        rewardType: "Dragon Stone",
                                        amount: 1,
                                    },
                                ],
                                characters: [],
                            },
                        ],
                    },
                ],
            },
            zBattles: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                count: 1,
                battles: [
                    {
                        id: "205",
                        name: "Turles",
                        nickname: "Demonic Fighter Wielding Forbidden Power",
                        sourceUrl: "https://dokkan.fyi/z-battles/205",
                        hasSuperStage: false,
                        phases: [
                            {
                                id: "205",
                                kind: "normal",
                                type: "ZBattleStage::Normal",
                                images: {
                                    bannerUrl: "https://cdn.dokkan.fyi/assets/zbattle-205.png",
                                },
                                enemies: [],
                                beneficialItems: [],
                                ezaCharacters: [],
                                levels: [
                                    {
                                        level: 1,
                                        skills: [],
                                        firstRewards: [
                                            {
                                                itemType: "Point::Stone",
                                                itemId: "11",
                                                quantity: 1,
                                                rewardType: "Dragon Stone",
                                                amount: 1,
                                            },
                                        ],
                                    },
                                ],
                                rewardCheckpoints: [],
                                missionCategories: [],
                            },
                        ],
                    },
                ],
            },
            dokkanInfoEventRewards: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkaninfo",
                eventCount: 2,
                rewardCount: 1,
                events: [
                    {
                        id: "796",
                        type: "challenge",
                        name: "Mission Event",
                        sourcePath: "https://dokkaninfo.com/events/challenge/796",
                        stages: [
                            {
                                id: "7960010",
                                title: "Level 3: Mission Event Stage 3",
                                level: 3,
                                difficulty: "SUPER",
                                sourcePath: "https://dokkaninfo.com/events/challenge/796/7960010",
                            },
                        ],
                        missions: [
                            {
                                id: "24832",
                                stageIds: ["7960010"],
                            },
                        ],
                        rewards: [],
                    },
                    {
                        id: "133",
                        type: "story",
                        name: "Adventure of Gratitude",
                        sourcePath: "https://dokkaninfo.com/events/story/133",
                        rewards: [
                            {
                                key: "dokkaninfo-event-reward:story:133:1330010:9000:EquipmentSkillItem:9000",
                                itemId: "9000",
                                itemType: "EquipmentSkillItem",
                                quantity: 1,
                                name: "Character-Exclusive Orb",
                                eventId: "133",
                                eventType: "story",
                                eventName: "Adventure of Gratitude",
                                eventPath: "https://dokkaninfo.com/events/story/133",
                                stageId: "1330010",
                                stagePath: "https://dokkaninfo.com/events/story/133/1330010",
                            },
                        ],
                    },
                ],
            },
        });

        equal(dataset.itemCount, 4);
        equal(dataset.sourceCount, 7);

        const stone = dataset.items.find(item => item.key === "Point::Stone:11");
        const medal = dataset.items.find(item => item.key === "AwakeningMedal:100874");
        const frontierSkin = dataset.items.find(item => item.itemType === "CardSkinItem");

        deepEqual(
            stone?.sources.map(source => source.kind),
            [
                "event-mission",
                "frontier-chapter-mission",
                "z-battle-level",
            ],
        );

        deepEqual(
            medal?.sources.map(source => source.kind),
            [
                "awakening-medal-stage",
                "awakening-medal-z-battle",
            ],
        );

        equal(frontierSkin?.itemId, "1");
        equal(frontierSkin?.cardId, "1029571");
        equal(frontierSkin?.step, 1);
        equal(frontierSkin?.sources[0].kind, "frontier-node-mission");
        equal(frontierSkin?.sources[0].frontierNodeId, "20010102");

        const orb = dataset.items.find(item => item.key === "EquipmentSkillItem:9000");
        equal(orb?.sources[0].kind, "dokkaninfo-event-reward");
        equal(orb?.sources[0].eventStageId, "1330010");

        deepEqual(
            stone?.sources.find(source => source.kind === "event-mission")?.stageReferences,
            [
                {
                    id: "7960010",
                    title: "Level 3: Mission Event Stage 3",
                    level: 3,
                    difficulty: "SUPER",
                    sourcePath: "https://dokkaninfo.com/events/challenge/796/7960010",
                    eventType: "challenge",
                    eventId: "796",
                    eventName: "Mission Event",
                },
            ],
        );
    });
});
