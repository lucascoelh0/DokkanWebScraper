"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const fyi_stages_1 = require("./fyi-stages");
(0, mocha_1.describe)("mapDifficultyStageFromFyi", function () {
    (0, mocha_1.it)("maps difficulty rows into stable numeric fields", () => {
        const stage = (0, fyi_stages_1.mapDifficultyStageFromFyi)({
            id: 17510093,
            difficulty: "SUPER",
            stamina: 0,
            required_keys: 2,
            rank_exp: 0,
            zeni: 0,
            link_skill_level_up_rate: 0,
            quest_id: 1751009,
        });
        (0, assert_1.equal)(stage.id, "17510093");
        (0, assert_1.equal)(stage.difficulty, "SUPER");
        (0, assert_1.equal)(stage.requiredKeys, 2);
        (0, assert_1.equal)(stage.questId, "1751009");
    });
});
(0, mocha_1.describe)("mapStageQuestFromFyi", function () {
    (0, mocha_1.it)("maps quest metadata and nested difficulty stages", () => {
        const quest = (0, fyi_stages_1.mapStageQuestFromFyi)({
            id: 1751009,
            name: "Stage 9",
            max_attempts: null,
            attempts_reset_days: null,
            boostable: false,
            start_date: "2026-06-27 07:00:00",
            area_id: 1751,
            stages: [
                {
                    id: 17510093,
                    difficulty: "SUPER",
                    stamina: 0,
                    required_keys: 2,
                    rank_exp: 0,
                    zeni: 0,
                    link_skill_level_up_rate: 0,
                    quest_id: 1751009,
                },
            ],
        });
        (0, assert_1.equal)(quest.id, "1751009");
        (0, assert_1.equal)(quest.startDate, "2026-06-27T07:00:00.000Z");
        (0, assert_1.equal)(quest.boostable, false);
        (0, assert_1.equal)(quest.stages.length, 1);
    });
});
(0, mocha_1.describe)("mapStageAreaFromFyi", function () {
    (0, mocha_1.it)("maps area images and quest lists", () => {
        const area = (0, fyi_stages_1.mapStageAreaFromFyi)({
            id: 1751,
            name: "Seriously Serious! All-Out Battles 2",
            type: "Event",
            chapter: null,
            images: {
                header: "banners/en/event/eve_header/quest_top_banner_1751.png",
                banner: "banners/en/event/eve_banner/quest_list_banner_1751.png",
                button: "banners/en/event/eve_listbutton/myp_banner_event_1751.png",
            },
            quests: [
                {
                    id: 1751009,
                    name: "Stage 9",
                    boostable: false,
                    start_date: "2026-06-27 07:00:00",
                    area_id: 1751,
                    stages: [],
                },
            ],
        });
        (0, assert_1.equal)(area.id, "1751");
        (0, assert_1.equal)(area.images.headerUrl, "https://cdn.dokkan.fyi/assets/banners/en/event/eve_header/quest_top_banner_1751.png");
        (0, assert_1.equal)(area.quests[0].name, "Stage 9");
    });
});
(0, mocha_1.describe)("mapStageChapterFromFyi", function () {
    (0, mocha_1.it)("maps quest-story chapters with nested areas", () => {
        const chapter = (0, fyi_stages_1.mapStageChapterFromFyi)({
            id: 1,
            name: "Chapter 1",
            areas: [
                {
                    id: 1,
                    name: "A Gloomy Parallel World",
                    type: "Quest Dokkan Story",
                    chapter: 1,
                    images: {},
                    quests: [],
                },
            ],
        });
        (0, assert_1.equal)(chapter.id, "1");
        (0, assert_1.equal)(chapter.areas.length, 1);
        (0, assert_1.equal)(chapter.areas[0].type, "Quest Dokkan Story");
    });
});
(0, mocha_1.describe)("buildQuestStoryStagesDataset", function () {
    (0, mocha_1.it)("counts nested chapter content for the dataset header", () => {
        const dataset = (0, fyi_stages_1.buildQuestStoryStagesDataset)([
            {
                id: "1",
                name: "Chapter 1",
                areas: [
                    {
                        id: "1",
                        name: "Area 1",
                        type: "Quest Dokkan Story",
                        images: {},
                        quests: [
                            {
                                id: "1000",
                                name: "Quest 1",
                                boostable: true,
                                areaId: "1",
                                stages: [
                                    {
                                        id: "10000",
                                        difficulty: "NORMAL",
                                        stamina: 4,
                                        requiredKeys: 0,
                                        rankExp: 20,
                                        zeni: 945,
                                        linkSkillLevelUpRate: 0.2,
                                        questId: "1000",
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ]);
        (0, assert_1.equal)(dataset.chapterCount, 1);
        (0, assert_1.equal)(dataset.areaCount, 1);
        (0, assert_1.equal)(dataset.questCount, 1);
        (0, assert_1.equal)(dataset.stageCount, 1);
    });
});
(0, mocha_1.describe)("buildEventStagesDataset", function () {
    (0, mocha_1.it)("keeps tabs and counts area content", () => {
        const dataset = (0, fyi_stages_1.buildEventStagesDataset)([
            {
                id: "1751",
                name: "Area 1",
                type: "Event",
                images: {},
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
        ], [
            {
                id: "5",
                name: "Challenge",
                limited: false,
            },
        ]);
        (0, assert_1.equal)(dataset.areaCount, 1);
        (0, assert_1.equal)(dataset.questCount, 1);
        (0, assert_1.equal)(dataset.stageCount, 1);
        (0, assert_1.deepEqual)(dataset.tabs.map(tab => tab.name), ["Challenge"]);
    });
});
//# sourceMappingURL=fyi-stages.spec.js.map