import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import {
    buildFallbackCategoryEntry,
    buildCategoryDataset,
    mapCategoryCharacterRefFromFyi,
    mapCategoryFromFyi,
    mapCategorySupportMemoryRefFromFyi,
} from "./fyi-categories";

describe("mapCategoryCharacterRefFromFyi", function () {
    it("maps a category character card into a lightweight reference", () => {
        const character = mapCategoryCharacterRefFromFyi({
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
        } as any);

        equal(character.id, "1033551");
        equal(character.name, "Vegeta + Nappa");
        equal(character.type, "AGL");
        equal(character.characterClass, "Extreme");
        equal(character.isReversiblyExchanged, true);
        equal(character.leaderSkillName, "Inconceivable Saiyan Power");
    });
});

describe("mapCategorySupportMemoryRefFromFyi", function () {
    it("maps category support memories into compact references", () => {
        const memory = mapCategorySupportMemoryRefFromFyi({
            id: 100065,
            name: "First Friend Ever",
            description: "For 3 turns from the start of battle...",
            support_film_id: 1,
            cost: 120,
            unlock_quantity: 1,
        } as any);

        equal(memory.id, "100065");
        equal(memory.supportFilmId, "1");
        equal(memory.cost, 120);
        equal(memory.unlockQuantity, 1);
    });
});

describe("mapCategoryFromFyi", function () {
    it("keeps leaders, support units and support memories grouped by category", () => {
        const category = mapCategoryFromFyi({
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
        } as any);

        equal(category.id, "21");
        equal(category.leaders.length, 1);
        equal(category.support.length, 1);
        equal(category.supportMemories.length, 1);
        equal(category.members?.length, 1);
        equal(category.supportMemories[0].name, "First Friend Ever");
    });
});

describe("buildCategoryDataset", function () {
    it("sorts categories and wraps them with dataset metadata", () => {
        const dataset = buildCategoryDataset([
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

        equal(dataset.count, 2);
        deepEqual(dataset.categories.map(category => category.name), ["Accelerated Battle", "Androids"]);
    });
});

describe("buildFallbackCategoryEntry", function () {
    it("reuses existing members and augments them with current leaders and support units", () => {
        const category = buildFallbackCategoryEntry({
            id: 80,
            name: "Accelerated Battle",
            characters: {
                leaders: [
                    {
                        id: 1033551,
                        name: "Vegeta + Nappa",
                        rarity_text: "UR",
                        type: 0,
                        awakening_type_text: "Extreme",
                    },
                ],
                support: [
                    {
                        id: 1029021,
                        name: "Dyspo",
                        rarity_text: "UR",
                        type: 3,
                        awakening_type_text: "Super",
                    },
                ],
            },
        } as any, {
            id: "80",
            name: "Accelerated Battle",
            leaders: [],
            support: [],
            supportMemories: [],
            members: [
                {
                    id: "1025511",
                    name: "Gamma 1",
                },
            ],
        });

        deepEqual(category.members?.map(member => member.id), ["1029021", "1025511", "1033551"]);
    });
});
