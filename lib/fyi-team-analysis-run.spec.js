"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const fyi_team_analysis_run_1 = require("./fyi-team-analysis-run");
function entry(id, canonicalId) {
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
(0, mocha_1.describe)("applyTeamAnalysisCardIdentityContract", function () {
    (0, mocha_1.it)("lets first-party card identity replace missing or stale catalog identity", () => {
        const original = [entry("1034411"), entry("1032391", "stale")];
        const result = (0, fyi_team_analysis_run_1.applyTeamAnalysisCardIdentityContract)(original, new Map([
            ["1034411", { canonicalId: "910", gameCharacterId: "1510" }],
            ["1032391", { canonicalId: "873", gameCharacterId: "1485" }],
        ]));
        (0, assert_1.deepEqual)(result.map(value => ({
            id: value.id,
            canonicalId: value.canonicalId,
            characterId: value.characterId,
        })), [
            { id: "1034411", canonicalId: "910", characterId: "1510" },
            { id: "1032391", canonicalId: "873", characterId: "1485" },
        ]);
        (0, assert_1.equal)(original[0].canonicalId, undefined);
        (0, assert_1.equal)(original[1].canonicalId, "stale");
    });
});
//# sourceMappingURL=fyi-team-analysis-run.spec.js.map