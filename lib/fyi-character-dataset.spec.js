"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fyi_character_dataset_1 = require("./fyi-character-dataset");
const character_1 = require("./character");
const catalog = {
    generatedAt: "2026-07-18T00:00:00.000Z",
    source: "dokkan.fyi",
    request: { compact: true, fullyAwakened: true },
    pageSize: 96,
    pageCount: 1,
    isComplete: true,
    candidateCount: 2,
    characterCount: 2,
    awakeningLineCount: 2,
    duplicateGroupCount: 0,
    failedPages: [],
    characters: [
        { id: "1", baseCharacterId: "1", name: "A", hasEza: false, hasSeza: false, isReversiblyExchanged: false, isFreelyObtainable: false, isStageDropReward: false, isWorldTournamentReward: false, hasBattleMotion: false, sourceUrl: "" },
        { id: "2", baseCharacterId: "2", name: "B", hasEza: false, hasSeza: false, isReversiblyExchanged: false, isFreelyObtainable: false, isStageDropReward: false, isWorldTournamentReward: false, hasBattleMotion: false, sourceUrl: "" },
    ],
};
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
describe("dokkan.fyi character dataset runner", () => {
    it("marks a complete, unique scrape as publishable", () => {
        const report = (0, fyi_character_dataset_1.buildFyiCharacterDatasetRunReport)(catalog, ["1", "2"], [character("1", { activeSkill: "Active" }), character("2", { isFreeToPlay: true })], []);
        (0, assert_1.equal)(report.publishable, true);
        (0, assert_1.equal)(report.fullCatalog, true);
        (0, assert_1.equal)(report.mechanicCoverage.activeSkillCount, 1);
        (0, assert_1.equal)(report.mechanicCoverage.freeToPlayCount, 1);
    });
    it("keeps partial or failed runs non-publishable and reports missing IDs", () => {
        const report = (0, fyi_character_dataset_1.buildFyiCharacterDatasetRunReport)(catalog, ["1"], [character("1")], ["2"]);
        (0, assert_1.equal)(report.publishable, false);
        (0, assert_1.equal)(report.fullCatalog, false);
        (0, assert_1.deepEqual)(report.failedCharacterIds, ["2"]);
        (0, assert_1.deepEqual)(report.missingCharacterIds, []);
    });
});
//# sourceMappingURL=fyi-character-dataset.spec.js.map