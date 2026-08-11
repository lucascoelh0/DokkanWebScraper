import { deepStrictEqual, equal } from "assert";
import type { CharacterCompactProjection } from "./compact-contract";
import { createCharacterCompactRarityOverlay } from "./compact-overlay";
import * as overlayApi from "./compact-overlay";

function projection(records: any[]): CharacterCompactProjection {
    return { records } as CharacterCompactProjection;
}

describe("database character K18 pure field-scoped overlay", () => {
    it("returns an isolated clone with only an authorized rarity null fill", () => {
        const characters = [{
            id: "base", rarity: "SSR", type: "AGL",
            transformations: [{ id: "2", rarity: null, type: "TEQ", name: "form" }],
        }] as any;
        const compact = projection([{ cardId: "2", stateId: "20", rarity: "UR", type: "TEQ" }]);
        const charactersBefore = JSON.stringify(characters);
        const compactBefore = JSON.stringify(compact);

        const result = createCharacterCompactRarityOverlay(characters, compact);

        equal(result.decision.readiness, "GO");
        equal(result.decision.overlayProof.candidatesAppliedToClone, 1);
        equal((result.characters[0].transformations![0] as any).rarity, "UR");
        equal((result.characters[0].transformations![0] as any).name, "form");
        equal(JSON.stringify(characters), charactersBefore);
        equal(JSON.stringify(compact), compactBefore);
    });

    it("applies zero patches globally when a candidate and blocker are mixed", () => {
        const characters = [
            { id: "1", rarity: null, type: "AGL" },
            { id: "2", rarity: "SSR", type: "STR" },
        ] as any;
        const compact = projection([
            { cardId: "1", stateId: "10", rarity: "UR", type: "AGL" },
            { cardId: "2", stateId: "20", rarity: "SSR", type: "TEQ" },
        ]);
        const result = createCharacterCompactRarityOverlay(characters, compact);

        equal(result.patches.length, 1);
        equal(result.decision.evaluation.blockers.typeDifferences, 1);
        equal(result.decision.overlayProof.candidatesAppliedToClone, 0);
        equal(result.decision.readiness, "NO-GO");
        deepStrictEqual(result.characters, characters);
    });

    it("exposes no generic merge or write surface", () => {
        equal((overlayApi as any).apply, undefined);
        equal((overlayApi as any).merge, undefined);
        equal((overlayApi as any).write, undefined);
    });
});
