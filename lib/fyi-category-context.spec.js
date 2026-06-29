"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fyi_category_context_1 = require("./fyi-category-context");
describe("buildCategoryContextDataset", () => {
    it("joins category leaders, support units and support memories back onto characters", () => {
        const dataset = (0, fyi_category_context_1.buildCategoryContextDataset)({
            categories: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                count: 2,
                categories: [
                    {
                        id: "1",
                        name: "Androids",
                        leaders: [
                            {
                                id: "c1",
                                name: "Android 13",
                            },
                        ],
                        support: [
                            {
                                id: "c2",
                                name: "Android 18",
                            },
                        ],
                        supportMemories: [
                            {
                                id: "m1",
                                name: "Android #16 Activated!",
                                description: "\"Target: Goku\" Category allies' ATK & DEF +16%",
                            },
                        ],
                        members: [
                            {
                                id: "c1",
                                name: "Android 13",
                            },
                            {
                                id: "c2",
                                name: "Android 18",
                            },
                        ],
                    },
                    {
                        id: "2",
                        name: "Target: Goku",
                        leaders: [],
                        support: [],
                        supportMemories: [
                            {
                                id: "m1",
                                name: "Android #16 Activated!",
                                description: "\"Target: Goku\" Category allies' ATK & DEF +16%",
                            },
                            {
                                id: "m2",
                                name: "Secret Feelings",
                                description: "\"Majin Buu Saga\" or \"Defenders of Justice\" Category allies' Ki +3",
                            },
                        ],
                        members: [
                            {
                                id: "c1",
                                name: "Android 13",
                            },
                        ],
                    },
                ],
            },
            supportMemories: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                count: 2,
                films: [],
                supportMemories: [
                    {
                        id: "m1",
                        name: "Android #16 Activated!",
                        description: "\"Target: Goku\" Category allies' ATK & DEF +16%",
                        maxLevel: 1,
                        enhancementChain: [],
                        effects: [],
                    },
                    {
                        id: "m2",
                        name: "Secret Feelings",
                        description: "\"Majin Buu Saga\" or \"Defenders of Justice\" Category allies' Ki +3",
                        maxLevel: 1,
                        enhancementChain: [],
                        effects: [],
                    },
                ],
            },
            characters: [
                {
                    id: "c1",
                    name: "Android 13",
                    title: "Leader",
                    categories: ["Androids", "Target: Goku"],
                },
                {
                    id: "c2",
                    name: "Android 18",
                    title: "Support",
                    categories: ["Androids"],
                },
                {
                    id: "c3",
                    name: "Vegeta",
                    title: "Other",
                    categories: ["Pure Saiyans"],
                },
            ],
        });
        (0, assert_1.equal)(dataset.categoryCount, 2);
        (0, assert_1.equal)(dataset.supportMemoryCount, 2);
        (0, assert_1.equal)(dataset.characterCount, 3);
        const android13 = dataset.characters.find(character => character.id === "c1");
        const android18 = dataset.characters.find(character => character.id === "c2");
        const memory1 = dataset.supportMemories.find(memory => memory.id === "m1");
        const targetGoku = dataset.categories.find(category => category.id === "2");
        (0, assert_1.deepEqual)(android13?.leaderOfCategoryIds, ["1"]);
        (0, assert_1.deepEqual)(android13?.applicableSupportMemoryIds, ["m1", "m2"]);
        (0, assert_1.deepEqual)(android18?.supportOfCategoryIds, ["1"]);
        (0, assert_1.deepEqual)(memory1?.categoryIds, ["1", "2"]);
        (0, assert_1.deepEqual)(memory1?.applicableCharacterIds, ["c1", "c2"]);
        (0, assert_1.deepEqual)(targetGoku?.supportMemoryIds, ["m1", "m2"]);
    });
    it("falls back to category members when the character payload has no category names", () => {
        const dataset = (0, fyi_category_context_1.buildCategoryContextDataset)({
            categories: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                count: 1,
                categories: [
                    {
                        id: "80",
                        name: "Accelerated Battle",
                        leaders: [],
                        support: [],
                        supportMemories: [],
                        members: [
                            {
                                id: "c80",
                                name: "Vegeta + Nappa",
                            },
                        ],
                    },
                ],
            },
            supportMemories: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                count: 0,
                films: [],
                supportMemories: [],
            },
            characters: [
                {
                    id: "c80",
                    name: "Vegeta + Nappa",
                    title: "Saiyan Assault",
                    categories: [],
                },
            ],
        });
        (0, assert_1.deepEqual)(dataset.characters[0].categoryIds, ["80"]);
        (0, assert_1.deepEqual)(dataset.characters[0].categoryNames, ["Accelerated Battle"]);
    });
});
//# sourceMappingURL=fyi-category-context.spec.js.map