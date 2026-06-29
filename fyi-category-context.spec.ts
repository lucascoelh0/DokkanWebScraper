import { deepEqual, equal } from "assert";
import { buildCategoryContextDataset } from "./fyi-category-context";

describe("buildCategoryContextDataset", () => {
    it("joins category leaders, support units and support memories back onto characters", () => {
        const dataset = buildCategoryContextDataset({
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
            ] as any,
        });

        equal(dataset.categoryCount, 2);
        equal(dataset.supportMemoryCount, 2);
        equal(dataset.characterCount, 3);

        const android13 = dataset.characters.find(character => character.id === "c1");
        const android18 = dataset.characters.find(character => character.id === "c2");
        const memory1 = dataset.supportMemories.find(memory => memory.id === "m1");
        const targetGoku = dataset.categories.find(category => category.id === "2");

        deepEqual(android13?.leaderOfCategoryIds, ["1"]);
        deepEqual(android13?.applicableSupportMemoryIds, ["m1", "m2"]);
        deepEqual(android18?.supportOfCategoryIds, ["1"]);
        deepEqual(memory1?.categoryIds, ["1", "2"]);
        deepEqual(memory1?.applicableCharacterIds, ["c1", "c2"]);
        deepEqual(targetGoku?.supportMemoryIds, ["m1", "m2"]);
    });
});
