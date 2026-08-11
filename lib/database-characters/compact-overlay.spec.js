"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const compact_overlay_1 = require("./compact-overlay");
const overlayApi = require("./compact-overlay");
function projection(records) {
    return { records };
}
describe("database character K18 pure field-scoped overlay", () => {
    it("returns an isolated clone with only an authorized rarity null fill", () => {
        const characters = [{
                id: "base", rarity: "SSR", type: "AGL",
                transformations: [{ id: "2", rarity: null, type: "TEQ", name: "form" }],
            }];
        const compact = projection([{ cardId: "2", stateId: "20", rarity: "UR", type: "TEQ" }]);
        const charactersBefore = JSON.stringify(characters);
        const compactBefore = JSON.stringify(compact);
        const result = (0, compact_overlay_1.createCharacterCompactRarityOverlay)(characters, compact);
        (0, assert_1.equal)(result.decision.readiness, "GO");
        (0, assert_1.equal)(result.decision.overlayProof.candidatesAppliedToClone, 1);
        (0, assert_1.equal)(result.characters[0].transformations[0].rarity, "UR");
        (0, assert_1.equal)(result.characters[0].transformations[0].name, "form");
        (0, assert_1.equal)(JSON.stringify(characters), charactersBefore);
        (0, assert_1.equal)(JSON.stringify(compact), compactBefore);
    });
    it("applies zero patches globally when a candidate and blocker are mixed", () => {
        const characters = [
            { id: "1", rarity: null, type: "AGL" },
            { id: "2", rarity: "SSR", type: "STR" },
        ];
        const compact = projection([
            { cardId: "1", stateId: "10", rarity: "UR", type: "AGL" },
            { cardId: "2", stateId: "20", rarity: "SSR", type: "TEQ" },
        ]);
        const result = (0, compact_overlay_1.createCharacterCompactRarityOverlay)(characters, compact);
        (0, assert_1.equal)(result.patches.length, 1);
        (0, assert_1.equal)(result.decision.evaluation.blockers.typeDifferences, 1);
        (0, assert_1.equal)(result.decision.overlayProof.candidatesAppliedToClone, 0);
        (0, assert_1.equal)(result.decision.readiness, "NO-GO");
        (0, assert_1.deepStrictEqual)(result.characters, characters);
    });
    it("exposes no generic merge or write surface", () => {
        (0, assert_1.equal)(overlayApi.apply, undefined);
        (0, assert_1.equal)(overlayApi.merge, undefined);
        (0, assert_1.equal)(overlayApi.write, undefined);
    });
});
//# sourceMappingURL=compact-overlay.spec.js.map