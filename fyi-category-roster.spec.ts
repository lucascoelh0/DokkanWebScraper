import { deepEqual, equal } from "assert";
import { buildCategoryRosterDataset } from "./fyi-category-roster";

describe("buildCategoryRosterDataset", () => {
    it("builds an app-facing category roster with role flags and category assets", () => {
        const dataset = buildCategoryRosterDataset({
            teamContext: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                categoryCount: 1,
                characterCount: 3,
                supportMemoryCount: 1,
                leaderCount: 1,
                supportUnitCount: 1,
                categories: [
                    {
                        id: "1",
                        name: "Androids",
                        leaders: [
                            {
                                id: "c1",
                                name: "Android 13",
                                rarity: "UR" as any,
                                type: "STR" as any,
                                characterClass: "Extreme" as any,
                                portraitUrl: "leader.png",
                                leaderSkillName: "Androids Ki +3",
                            },
                        ],
                        supportUnits: [
                            {
                                id: "c2",
                                name: "Android 18",
                                rarity: "SSR" as any,
                                type: "AGL" as any,
                                characterClass: "Super" as any,
                                portraitUrl: "support.png",
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
                ],
                characters: [],
                supportMemories: [],
            },
            categoryContext: {
                generatedAt: "2026-01-01T00:00:00.000Z",
                source: "dokkan.fyi",
                categoryCount: 1,
                supportMemoryCount: 1,
                characterCount: 3,
                categories: [],
                supportMemories: [],
                characters: [
                    {
                        id: "c1",
                        name: "Android 13",
                        title: "Fusion of Hatred",
                        categoryIds: ["1"],
                        categoryNames: ["Androids"],
                        leaderOfCategoryIds: ["1"],
                        supportOfCategoryIds: [],
                        applicableSupportMemoryIds: ["m1"],
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
                    {
                        id: "c3",
                        name: "Cell",
                        title: "Perfect Life Form",
                        categoryIds: ["1"],
                        categoryNames: ["Androids"],
                        leaderOfCategoryIds: [],
                        supportOfCategoryIds: [],
                        applicableSupportMemoryIds: ["m1"],
                    },
                ],
            },
            characters: [
                {
                    id: "c1",
                    name: "Android 13",
                    title: "Fusion of Hatred",
                    rarity: "UR",
                    type: "STR",
                    characterClass: "Extreme",
                    portraitURL: "leader.png",
                    portraitFilename: "portrait_c1",
                    isFreeToPlay: false,
                    categories: ["Androids"],
                    links: [],
                    kiMeter: [],
                    maxLevel: 120,
                    maxSALevel: 10,
                    cost: 58,
                    portraitURL2: undefined,
                    leaderSkill: "",
                    superAttack: "",
                    passive: "",
                    domain: "",
                    artURL: "",
                    artFilename: "",
                    baseHP: 0,
                    maxLevelHP: 0,
                    freeDupeHP: 0,
                    rainbowHP: 0,
                    baseAttack: 0,
                    maxLevelAttack: 0,
                    freeDupeAttack: 0,
                    rainbowAttack: 0,
                    baseDefence: 0,
                    maxDefence: 0,
                    freeDupeDefence: 0,
                    rainbowDefence: 0,
                    kiMultiplier: "",
                    standbySkill: "",
                } as any,
                {
                    id: "c2",
                    name: "Android 18",
                    title: "Support",
                    rarity: "SSR",
                    type: "AGL",
                    characterClass: "Super",
                    portraitURL: "support.png",
                    portraitFilename: "portrait_c2",
                    isFreeToPlay: true,
                    ezaReleaseDate: "2026-01-01T00:00:00.000Z",
                    categories: ["Androids"],
                    links: [],
                    kiMeter: [],
                    maxLevel: 120,
                    maxSALevel: 10,
                    cost: 58,
                    leaderSkill: "",
                    superAttack: "",
                    passive: "",
                    domain: "",
                    artURL: "",
                    artFilename: "",
                    baseHP: 0,
                    maxLevelHP: 0,
                    freeDupeHP: 0,
                    rainbowHP: 0,
                    baseAttack: 0,
                    maxLevelAttack: 0,
                    freeDupeAttack: 0,
                    rainbowAttack: 0,
                    baseDefence: 0,
                    maxDefence: 0,
                    freeDupeDefence: 0,
                    rainbowDefence: 0,
                    kiMultiplier: "",
                    standbySkill: "",
                } as any,
                {
                    id: "c3",
                    name: "Cell",
                    title: "Perfect Life Form",
                    rarity: "LR",
                    type: "INT",
                    characterClass: "Extreme",
                    portraitURL: "member.png",
                    portraitFilename: "portrait_c3",
                    isFreeToPlay: false,
                    sezaReleaseDate: "2026-01-01T00:00:00.000Z",
                    categories: ["Androids"],
                    links: [],
                    kiMeter: [],
                    maxLevel: 150,
                    maxSALevel: 20,
                    cost: 77,
                    leaderSkill: "",
                    superAttack: "",
                    passive: "",
                    domain: "",
                    artURL: "",
                    artFilename: "",
                    baseHP: 0,
                    maxLevelHP: 0,
                    freeDupeHP: 0,
                    rainbowHP: 0,
                    baseAttack: 0,
                    maxLevelAttack: 0,
                    freeDupeAttack: 0,
                    rainbowAttack: 0,
                    baseDefence: 0,
                    maxDefence: 0,
                    freeDupeDefence: 0,
                    rainbowDefence: 0,
                    kiMultiplier: "",
                    standbySkill: "",
                    reversibleExchange: {
                        targetCharacterId: "c4",
                        condition: "Turn 4",
                    },
                } as any,
            ],
        });

        equal(dataset.categoryCount, 1);
        equal(dataset.memberCharacterCount, 3);

        const androids = dataset.categories[0];
        equal(androids.memberCount, 3);
        equal(androids.leaderCount, 1);
        equal(androids.supportUnitCount, 1);
        equal(androids.supportMemoryCount, 1);
        deepEqual(androids.members.map(member => member.id), ["c1", "c2", "c3"]);

        const leader = androids.members.find(member => member.id === "c1");
        const support = androids.members.find(member => member.id === "c2");
        const member = androids.members.find(member => member.id === "c3");

        equal(leader?.isLeader, true);
        equal(leader?.isSupportUnit, false);
        equal(support?.isLeader, false);
        equal(support?.isSupportUnit, true);
        equal(support?.latestReleaseType, "eza");
        equal(support?.isFreelyObtainable, true);
        equal(member?.latestReleaseType, "seza");
        equal(member?.hasEza, true);
        equal(member?.hasSeza, true);
        equal(member?.isReversiblyExchanged, true);
    });
});
