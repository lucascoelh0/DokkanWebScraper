"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const game_db_experiment_1 = require("./game-db-experiment");
(0, mocha_1.describe)("finalizeFormRelations", function () {
    (0, mocha_1.it)("drops self-links and CardAwakeningRoute::Optimal noise", () => {
        const cardById = new Map([
            ["4025741", { id: "4025741", name: "Super Saiyan Goku (Standby)" }],
        ]);
        const relations = [
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
        (0, assert_1.deepEqual)((0, game_db_experiment_1.finalizeFormRelations)(relations, cardById), [
            {
                sourceCardId: "1025731",
                targetCardId: "4025741",
                targetName: "Super Saiyan Goku (Standby)",
                kind: "standby-transformation",
                sourceSkillSetId: "4",
            },
        ]);
    });
    (0, mocha_1.it)("dedupes identical relations and keeps them in stable order", () => {
        const cardById = new Map([
            ["4033071", { id: "4033071", name: "Super Saiyan 2 Goku (Angel) + Majin Vegeta" }],
            ["5020001", { id: "5020001", name: "Rage Form" }],
        ]);
        const relations = [
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
        const finalized = (0, game_db_experiment_1.finalizeFormRelations)(relations, cardById);
        (0, assert_1.equal)(finalized.length, 2);
        (0, assert_1.deepEqual)(finalized.map(relation => relation.kind), [
            "passive-reversible-exchange",
            "active-giant-rage",
        ]);
        (0, assert_1.deepEqual)(finalized.map(relation => relation.targetName), [
            "Super Saiyan 2 Goku (Angel) + Majin Vegeta",
            "Rage Form",
        ]);
    });
});
//# sourceMappingURL=game-db-experiment.spec.js.map