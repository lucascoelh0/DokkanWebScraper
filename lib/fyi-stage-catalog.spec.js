"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fyi_stage_catalog_1 = require("./fyi-stage-catalog");
describe("buildStageCatalog", () => {
    it("normalizes quest, event and z-battle surfaces into shared groups and entries", () => {
        const dataset = (0, fyi_stage_catalog_1.buildStageCatalog)({
            questStory: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                chapterCount: 1,
                areaCount: 1,
                questCount: 1,
                stageCount: 1,
                chapters: [
                    {
                        id: "1",
                        name: "Chapter 1",
                        areas: [
                            {
                                id: "10",
                                name: "Area 10",
                                type: "Quest Dokkan Story",
                                chapter: 1,
                                images: { bannerUrl: "quest.png" },
                                quests: [
                                    {
                                        id: "100",
                                        name: "Quest 100",
                                        boostable: true,
                                        areaId: "10",
                                        stages: [
                                            {
                                                id: "1000",
                                                difficulty: "NORMAL",
                                                stamina: 4,
                                                requiredKeys: 0,
                                                rankExp: 20,
                                                zeni: 945,
                                                linkSkillLevelUpRate: 0.2,
                                                questId: "100",
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            eventStages: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                areaCount: 1,
                questCount: 1,
                stageCount: 1,
                tabs: [],
                areas: [
                    {
                        id: "1751",
                        name: "Event Area",
                        type: "Event",
                        images: { bannerUrl: "event.png" },
                        quests: [
                            {
                                id: "1751009",
                                name: "Stage 9",
                                boostable: false,
                                areaId: "1751",
                                stages: [
                                    {
                                        id: "17510093",
                                        difficulty: "SUPER",
                                        stamina: 0,
                                        requiredKeys: 2,
                                        rankExp: 0,
                                        zeni: 0,
                                        linkSkillLevelUpRate: 0,
                                        questId: "1751009",
                                    },
                                ],
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
                        name: "Extreme Z-Battle: Turles",
                        nickname: "Turles",
                        sourceUrl: "https://dokkan.fyi/z-battles/205",
                        hasSuperStage: true,
                        phases: [
                            {
                                id: "205-normal",
                                kind: "normal",
                                type: "Extreme Z-Battle",
                                images: { bannerUrl: "zbattle.png" },
                                enemies: [],
                                beneficialItems: [],
                                ezaCharacters: [],
                                levels: [
                                    {
                                        level: 30,
                                        skills: [],
                                        firstRewards: [],
                                    },
                                ],
                                rewardCheckpoints: [
                                    {
                                        level: 10,
                                        rewards: [],
                                    },
                                ],
                                missionCategories: [],
                            },
                        ],
                    },
                ],
            },
        });
        (0, assert_1.equal)(dataset.groupCount, 4);
        (0, assert_1.equal)(dataset.entryCount, 4);
        const questArea = dataset.groups.find(group => group.key === "quest-story-area:10");
        const eventArea = dataset.groups.find(group => group.key === "event-area:1751");
        const zBattle = dataset.groups.find(group => group.key === "z-battle:205");
        const questStage = dataset.entries.find(entry => entry.key === "quest-stage:1000");
        const eventStage = dataset.entries.find(entry => entry.key === "event-stage:17510093");
        const zBattleLevel = dataset.entries.find(entry => entry.key === "z-battle-level:205:205-normal:30");
        const zBattleCheckpoint = dataset.entries.find(entry => entry.key === "z-battle-checkpoint:205:205-normal:10");
        (0, assert_1.deepEqual)({
            questAreaParent: questArea?.parentGroupKey,
            eventAreaType: eventArea?.areaType,
            zBattleHasSuper: zBattle?.hasSuperStage,
            questStageQuestId: questStage?.questId,
            eventStageDifficulty: eventStage?.difficulty,
            zBattleLevelPhase: zBattleLevel?.zBattlePhaseId,
            zBattleCheckpointLevel: zBattleCheckpoint?.checkpointLevel,
        }, {
            questAreaParent: "quest-story-chapter:1",
            eventAreaType: "Event",
            zBattleHasSuper: true,
            questStageQuestId: "100",
            eventStageDifficulty: "SUPER",
            zBattleLevelPhase: "205-normal",
            zBattleCheckpointLevel: 10,
        });
    });
});
//# sourceMappingURL=fyi-stage-catalog.spec.js.map