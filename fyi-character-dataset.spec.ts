import { deepEqual, equal } from "assert";
import { FyiCharacterCatalogDataset } from "./fyi-character-catalog";
import { buildFyiCharacterDatasetRunReport } from "./fyi-character-dataset";
import { Character, Classes, Rarities, Types } from "./character";

const catalog: FyiCharacterCatalogDataset = {
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

describe("dokkan.fyi character dataset runner", () => {
    it("marks a complete, unique scrape as publishable", () => {
        const report = buildFyiCharacterDatasetRunReport(
            catalog,
            ["1", "2"],
            [character("1", { activeSkill: "Active" }), character("2", { isFreeToPlay: true })],
            [],
        );

        equal(report.publishable, true);
        equal(report.fullCatalog, true);
        equal(report.mechanicCoverage.activeSkillCount, 1);
        equal(report.mechanicCoverage.freeToPlayCount, 1);
    });

    it("keeps partial or failed runs non-publishable and reports missing IDs", () => {
        const report = buildFyiCharacterDatasetRunReport(
            catalog,
            ["1"],
            [character("1")],
            ["2"],
        );

        equal(report.publishable, false);
        equal(report.fullCatalog, false);
        deepEqual(report.failedCharacterIds, ["2"]);
        deepEqual(report.missingCharacterIds, []);
    });
});
