"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fyi_team_context_1 = require("./fyi-team-context");
describe("buildTeamContextDataset", () => {
    it("joins categories, support memories and character roles into an app-facing team context", () => {
        const dataset = (0, fyi_team_context_1.buildTeamContextDataset)({
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
                                leaderSkillName: "Androids Ki +3",
                            },
                        ],
                        support: [
                            {
                                id: "c2",
                                name: "Android 18",
                            },
                        ],
                        supportMemories: [],
                        members: [],
                    },
                    {
                        id: "2",
                        name: "Target: Goku",
                        leaders: [],
                        support: [],
                        supportMemories: [],
                        members: [],
                    },
                ],
            },
            categoryContext: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                categoryCount: 2,
                supportMemoryCount: 2,
                characterCount: 2,
                categories: [
                    {
                        id: "1",
                        name: "Androids",
                        leaderIds: ["c1"],
                        supportIds: ["c2"],
                        supportMemoryIds: ["m1"],
                    },
                    {
                        id: "2",
                        name: "Target: Goku",
                        leaderIds: [],
                        supportIds: [],
                        supportMemoryIds: ["m1", "m2"],
                    },
                ],
                supportMemories: [
                    {
                        id: "m1",
                        name: "Android #16 Activated!",
                        categoryIds: ["1", "2"],
                        categoryNames: ["Androids", "Target: Goku"],
                        applicableCharacterIds: ["c1", "c2"],
                    },
                    {
                        id: "m2",
                        name: "Secret Feelings",
                        categoryIds: ["2"],
                        categoryNames: ["Target: Goku"],
                        applicableCharacterIds: ["c1"],
                    },
                ],
                characters: [
                    {
                        id: "c1",
                        name: "Android 13",
                        title: "Leader",
                        categoryIds: ["1", "2"],
                        categoryNames: ["Androids", "Target: Goku"],
                        leaderOfCategoryIds: ["1"],
                        supportOfCategoryIds: [],
                        applicableSupportMemoryIds: ["m1", "m2"],
                    },
                    {
                        id: "c2",
                        name: "Android 18",
                        title: "Support",
                        categoryIds: ["1"],
                        categoryNames: ["Androids"],
                        leaderOfCategoryIds: [],
                        supportOfCategoryIds: ["1"],
                        applicableSupportMemoryIds: ["m1"],
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
                        filmId: "1",
                        film: { id: "1", name: "Film (Blue)" },
                        cost: 200,
                        unlockQuantity: 10,
                        lastsEntireBattle: true,
                        maxLevel: 3,
                        enhancementChain: [],
                        effects: [],
                    },
                    {
                        id: "m2",
                        name: "Secret Feelings",
                        description: "\"Majin Buu Saga\" Category allies' Ki +3",
                        maxLevel: 1,
                        enhancementChain: [],
                        effects: [],
                    },
                ],
            },
        });
        (0, assert_1.equal)(dataset.categoryCount, 2);
        (0, assert_1.equal)(dataset.characterCount, 2);
        (0, assert_1.equal)(dataset.supportMemoryCount, 2);
        (0, assert_1.equal)(dataset.leaderCount, 1);
        (0, assert_1.equal)(dataset.supportUnitCount, 1);
        const androids = dataset.categories.find(category => category.id === "1");
        const android13 = dataset.characters.find(character => character.id === "c1");
        const memory1 = dataset.supportMemories.find(memory => memory.id === "m1");
        (0, assert_1.deepEqual)(androids?.leaders.map(character => character.id), ["c1"]);
        (0, assert_1.deepEqual)(androids?.supportUnits.map(character => character.id), ["c2"]);
        (0, assert_1.deepEqual)(androids?.supportMemories.map(memory => memory.id), ["m1"]);
        (0, assert_1.deepEqual)(android13?.leaderOfCategories.map(category => category.id), ["1"]);
        (0, assert_1.deepEqual)(android13?.applicableSupportMemories.map(memory => memory.id), ["m1", "m2"]);
        (0, assert_1.deepEqual)(memory1?.categories.map(category => category.id), ["1", "2"]);
        (0, assert_1.deepEqual)(memory1?.applicableCharacterIds, ["c1", "c2"]);
    });
});
//# sourceMappingURL=fyi-team-context.spec.js.map