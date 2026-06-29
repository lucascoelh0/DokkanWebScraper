"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fyi_acquisition_1 = require("./fyi-acquisition");
describe("buildAcquisitionDataset", () => {
    it("groups multiple source types under a stable item key", () => {
        const dataset = (0, fyi_acquisition_1.buildAcquisitionDataset)({
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
        });
        (0, assert_1.equal)(dataset.itemCount, 2);
        (0, assert_1.equal)(dataset.sourceCount, 4);
        const stone = dataset.items.find(item => item.key === "Point::Stone:11");
        const medal = dataset.items.find(item => item.key === "AwakeningMedal:100874");
        (0, assert_1.deepEqual)(stone?.sources.map(source => source.kind), [
            "event-mission",
            "z-battle-level",
        ]);
        (0, assert_1.deepEqual)(medal?.sources.map(source => source.kind), [
            "awakening-medal-stage",
            "awakening-medal-z-battle",
        ]);
    });
});
//# sourceMappingURL=fyi-acquisition.spec.js.map