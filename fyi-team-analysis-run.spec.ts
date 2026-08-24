import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import type { FyiCharacterCatalogEntry } from "./fyi-character-catalog";
import { applyTeamAnalysisCardIdentityContract } from "./fyi-team-analysis-run";

function entry(id: string, canonicalId?: string): FyiCharacterCatalogEntry {
    return {
        id,
        ...(canonicalId ? { canonicalId } : {}),
        baseCharacterId: id,
        name: id,
        hasEza: false,
        hasSeza: false,
        isReversiblyExchanged: false,
        isFreelyObtainable: false,
        isStageDropReward: false,
        isWorldTournamentReward: false,
        hasBattleMotion: false,
        sourceUrl: "fixture",
    };
}

describe("applyTeamAnalysisCardIdentityContract", function () {
    it("lets first-party card identity replace missing or stale catalog identity", () => {
        const original = [entry("1034411"), entry("1032391", "stale")];
        const result = applyTeamAnalysisCardIdentityContract(original, new Map([
            ["1034411", { canonicalId: "910", gameCharacterId: "1510" }],
            ["1032391", { canonicalId: "873", gameCharacterId: "1485" }],
        ]));

        deepEqual(result.map(value => ({
            id: value.id,
            canonicalId: value.canonicalId,
            characterId: value.characterId,
        })), [
            { id: "1034411", canonicalId: "910", characterId: "1510" },
            { id: "1032391", canonicalId: "873", characterId: "1485" },
        ]);
        equal(original[0].canonicalId, undefined);
        equal(original[1].canonicalId, "stale");
    });
});
