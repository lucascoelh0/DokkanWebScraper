import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import { GameDbFormRelation } from "./game-db-contract";
import { finalizeFormRelations } from "./game-db-experiment";
import { GameDbRow } from "./game-db-source";

describe("finalizeFormRelations", function () {
    it("drops self-links and CardAwakeningRoute::Optimal noise", () => {
        const cardById = new Map<string, GameDbRow>([
            ["4025741", { id: "4025741", name: "Super Saiyan Goku (Standby)" }],
        ]);

        const relations: GameDbFormRelation[] = [
            {
                sourceCardId: "1025731",
                targetCardId: "1025731",
                kind: "awakening-other",
                sourceName: "CardAwakeningRoute::Optimal",
            },
            {
                sourceCardId: "1025731",
                targetCardId: "4025741",
                kind: "standby-transformation",
                sourceSkillSetId: "4",
            },
        ];

        deepEqual(finalizeFormRelations(relations, cardById), [
            {
                sourceCardId: "1025731",
                targetCardId: "4025741",
                targetName: "Super Saiyan Goku (Standby)",
                kind: "standby-transformation",
                sourceSkillSetId: "4",
            },
        ]);
    });

    it("dedupes identical relations and keeps them in stable order", () => {
        const cardById = new Map<string, GameDbRow>([
            ["4033071", { id: "4033071", name: "Super Saiyan 2 Goku (Angel) + Majin Vegeta" }],
            ["5020001", { id: "5020001", name: "Rage Form" }],
        ]);

        const relations: GameDbFormRelation[] = [
            {
                sourceCardId: "1033061",
                targetCardId: "5020001",
                kind: "active-giant-rage",
                sourceSkillSetId: "100",
                sourceSkillId: "9001",
            },
            {
                sourceCardId: "1033061",
                targetCardId: "4033071",
                kind: "passive-reversible-exchange",
                sourceSkillSetId: "4887",
                sourceSkillId: "4887",
            },
            {
                sourceCardId: "1033061",
                targetCardId: "4033071",
                kind: "passive-reversible-exchange",
                sourceSkillSetId: "4887",
                sourceSkillId: "4887",
            },
        ];

        const finalized = finalizeFormRelations(relations, cardById);

        equal(finalized.length, 2);
        deepEqual(finalized.map(relation => relation.kind), [
            "passive-reversible-exchange",
            "active-giant-rage",
        ]);
        deepEqual(finalized.map(relation => relation.targetName), [
            "Super Saiyan 2 Goku (Angel) + Majin Vegeta",
            "Rage Form",
        ]);
    });
});

