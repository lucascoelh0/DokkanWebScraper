import { deepEqual, equal } from "assert";
import { Classes, Character, Rarities, Types } from "./character";
import { compareCharacterIds, validateCharacterRecords } from "./fyi-character-dataset-validate";

function character(id: string, options: Partial<Character> = {}): Character {
    return {
        name: id,
        title: "",
        maxLevel: 1,
        maxSALevel: 1,
        rarity: Rarities.UR,
        characterClass: Classes.Super,
        type: Types.AGL,
        cost: 1,
        id,
        portraitURL: "",
        portraitFilename: "",
        leaderSkill: "",
        superAttack: "",
        passive: "",
        domain: "",
        links: [],
        categories: [],
        kiMeter: [],
        artURL: "",
        artFilename: "",
        baseHP: 1,
        maxLevelHP: 1,
        freeDupeHP: 1,
        rainbowHP: 1,
        baseAttack: 1,
        maxLevelAttack: 1,
        freeDupeAttack: 1,
        rainbowAttack: 1,
        baseDefence: 1,
        maxDefence: 1,
        freeDupeDefence: 1,
        rainbowDefence: 1,
        kiMultiplier: "",
        standbySkill: "",
        ...options,
    };
}

describe("dokkan.fyi character dataset validation", () => {
    it("detects duplicate IDs and invalid enum values", () => {
        const issues = validateCharacterRecords([
            character("1"),
            character("1", {
                rarity: "INVALID" as Rarities,
                characterClass: "INVALID" as Classes,
                type: "INVALID" as Types,
            }),
        ]);

        deepEqual(issues.duplicateCharacterIds, ["1"]);
        deepEqual(issues.invalidCharacterIds, []);
        deepEqual(issues.invalidRarities, ["1:INVALID"]);
        deepEqual(issues.invalidClasses, ["1:INVALID"]);
        deepEqual(issues.invalidTypes, ["1:INVALID"]);
    });

    it("reports the expected ID delta against the legacy dataset", () => {
        const comparison = compareCharacterIds(["2", "1", "2"], ["1", "3"]);

        deepEqual(comparison.currentOnly, ["2"]);
        deepEqual(comparison.legacyOnly, ["3"]);
    });

    it("accepts valid character records", () => {
        const issues = validateCharacterRecords([character("123")]);

        equal(issues.duplicateCharacterIds.length, 0);
        equal(issues.invalidCharacterIds.length, 0);
        equal(issues.invalidRarities.length, 0);
        equal(issues.invalidClasses.length, 0);
        equal(issues.invalidTypes.length, 0);
    });
});
