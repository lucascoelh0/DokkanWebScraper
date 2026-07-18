"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const character_1 = require("./character");
const fyi_character_dataset_validate_1 = require("./fyi-character-dataset-validate");
function character(id, options = {}) {
    return {
        name: id,
        title: "",
        maxLevel: 1,
        maxSALevel: 1,
        rarity: character_1.Rarities.UR,
        characterClass: character_1.Classes.Super,
        type: character_1.Types.AGL,
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
        const issues = (0, fyi_character_dataset_validate_1.validateCharacterRecords)([
            character("1"),
            character("1", {
                rarity: "INVALID",
                characterClass: "INVALID",
                type: "INVALID",
            }),
        ]);
        (0, assert_1.deepEqual)(issues.duplicateCharacterIds, ["1"]);
        (0, assert_1.deepEqual)(issues.invalidCharacterIds, []);
        (0, assert_1.deepEqual)(issues.invalidRarities, ["1:INVALID"]);
        (0, assert_1.deepEqual)(issues.invalidClasses, ["1:INVALID"]);
        (0, assert_1.deepEqual)(issues.invalidTypes, ["1:INVALID"]);
    });
    it("reports the expected ID delta against the legacy dataset", () => {
        const comparison = (0, fyi_character_dataset_validate_1.compareCharacterIds)(["2", "1", "2"], ["1", "3"]);
        (0, assert_1.deepEqual)(comparison.currentOnly, ["2"]);
        (0, assert_1.deepEqual)(comparison.legacyOnly, ["3"]);
    });
    it("accepts valid character records", () => {
        const issues = (0, fyi_character_dataset_validate_1.validateCharacterRecords)([character("123")]);
        (0, assert_1.equal)(issues.duplicateCharacterIds.length, 0);
        (0, assert_1.equal)(issues.invalidCharacterIds.length, 0);
        (0, assert_1.equal)(issues.invalidRarities.length, 0);
        (0, assert_1.equal)(issues.invalidClasses.length, 0);
        (0, assert_1.equal)(issues.invalidTypes.length, 0);
    });
});
//# sourceMappingURL=fyi-character-dataset-validate.spec.js.map