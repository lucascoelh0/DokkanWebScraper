"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const fyi_categories_1 = require("./fyi-categories");
(0, mocha_1.describe)("mapCategoryCharacterRefFromFyi", function () {
    (0, mocha_1.it)("maps a category character card into a lightweight reference", () => {
        const character = (0, fyi_categories_1.mapCategoryCharacterRefFromFyi)({
            id: 1033551,
            canonical_id: 894,
            base_character_id: 1033551,
            character_id: 1085,
            name: "Vegeta + Nappa",
            rarity_text: "UR",
            type: 0,
            awakening_type_text: "Extreme",
            thumbnail_id: 1033550,
            has_eza: false,
            has_seza: false,
            is_reversibly_exchanged: true,
            is_freely_obtainable: false,
            release_dates: {
                latest_type: "initial",
            },
            leader_skill_id: 103355,
            leader_skill: {
                id: 103355,
                name: "Inconceivable Saiyan Power",
                description: "\"Saiyan Saga\" or \"Accelerated Battle\" Category Ki +3...",
            },
        });
        (0, assert_1.equal)(character.id, "1033551");
        (0, assert_1.equal)(character.name, "Vegeta + Nappa");
        (0, assert_1.equal)(character.type, "AGL");
        (0, assert_1.equal)(character.characterClass, "Extreme");
        (0, assert_1.equal)(character.isReversiblyExchanged, true);
        (0, assert_1.equal)(character.leaderSkillName, "Inconceivable Saiyan Power");
    });
});
(0, mocha_1.describe)("mapCategorySupportMemoryRefFromFyi", function () {
    (0, mocha_1.it)("maps category support memories into compact references", () => {
        const memory = (0, fyi_categories_1.mapCategorySupportMemoryRefFromFyi)({
            id: 100065,
            name: "First Friend Ever",
            description: "For 3 turns from the start of battle...",
            support_film_id: 1,
            cost: 120,
            unlock_quantity: 1,
        });
        (0, assert_1.equal)(memory.id, "100065");
        (0, assert_1.equal)(memory.supportFilmId, "1");
        (0, assert_1.equal)(memory.cost, 120);
        (0, assert_1.equal)(memory.unlockQuantity, 1);
    });
});
(0, mocha_1.describe)("mapCategoryFromFyi", function () {
    (0, mocha_1.it)("keeps leaders, support units and support memories grouped by category", () => {
        const category = (0, fyi_categories_1.mapCategoryFromFyi)({
            id: 21,
            name: "Androids",
            characters: {
                leaders: [
                    {
                        id: 1030941,
                        name: "Cell (Perfect Form)",
                        rarity_text: "UR",
                        type: 3,
                        awakening_type_text: "Extreme",
                        leader_skill: {
                            name: "Final Battle at the Highest Level",
                        },
                    },
                ],
                support: [
                    {
                        id: 1029771,
                        name: "Piccolo/Super Saiyan Vegeta",
                        rarity_text: "UR",
                        type: 4,
                        awakening_type_text: "Super",
                    },
                ],
            },
            support_memories: [
                {
                    id: 100065,
                    name: "First Friend Ever",
                    description: "For 3 turns from the start of battle...",
                    support_film_id: 1,
                    cost: 120,
                    unlock_quantity: 1,
                },
            ],
            members: [
                {
                    id: 1025511,
                    name: "Gamma 1",
                    rarity_text: "UR",
                    type: 3,
                    awakening_type_text: "Super",
                },
            ],
        });
        (0, assert_1.equal)(category.id, "21");
        (0, assert_1.equal)(category.leaders.length, 1);
        (0, assert_1.equal)(category.support.length, 1);
        (0, assert_1.equal)(category.supportMemories.length, 1);
        (0, assert_1.equal)(category.members?.length, 1);
        (0, assert_1.equal)(category.supportMemories[0].name, "First Friend Ever");
    });
});
(0, mocha_1.describe)("buildCategoryDataset", function () {
    (0, mocha_1.it)("sorts categories and wraps them with dataset metadata", () => {
        const dataset = (0, fyi_categories_1.buildCategoryDataset)([
            {
                id: "80",
                name: "Accelerated Battle",
                leaders: [],
                support: [],
                supportMemories: [],
                members: [],
            },
            {
                id: "21",
                name: "Androids",
                leaders: [],
                support: [],
                supportMemories: [],
                members: [],
            },
        ]);
        (0, assert_1.equal)(dataset.count, 2);
        (0, assert_1.deepEqual)(dataset.categories.map(category => category.name), ["Accelerated Battle", "Androids"]);
    });
});
//# sourceMappingURL=fyi-categories.spec.js.map