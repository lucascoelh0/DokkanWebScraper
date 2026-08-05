import { equal } from "assert";
import { describe, it } from "mocha";
import { DatabaseCharacterExperimentDataset } from "./contract";
import { compareWithCurrentDataset } from "./parity";

function sourced(table: string, rowId: string, values: Record<string, string | number | null>) {
    return { values, provenance: { table, rowId, columns: Object.keys(values) } };
}

describe("database experiment parity projection", function () {
    it("excludes future growth and deduplicates only identical logical Unit Attack rows", () => {
        const unitSet = sourced("special_sets", "1", { id: 1, name: "Unit", description: "Effect", causality_description: "Condition" });
        const unitAttack = (rowId: string) => ({
            cardSpecial: sourced("card_specials", rowId, { id: Number(rowId), style: "Condition", lv_start: 0, eball_num_start: 12, causality_conditions: "{}" }),
            specialSet: unitSet,
            effects: [],
            variant: { raw: "Condition", value: "unit", evidence: "first-party-string-enum" },
            availableFromSuperAttackLevel: 0,
        });
        const dataset = {
            cards: [{
                cardId: "1",
                recordKind: "collectable",
                localizedText: { name: "Card" },
                rarity: { raw: 4, value: "UR", evidence: "current-dataset-exact-id-parity" },
                type: { raw: 13, value: "STR", evidence: "current-dataset-exact-id-parity" },
                characterClass: { raw: 13, value: "Super", evidence: "current-dataset-exact-id-parity" },
                stats: {}, dates: {}, grouping: { awakeningFamilyId: "a", hardDuplicateGroupId: "h" },
                catalog: { isProjectedPrimary: true }, links: [], categories: [], awakeningPaths: { incoming: [], outgoing: [] },
                skillStates: [{
                    releaseState: "initial", release: { availableAtSnapshot: true },
                    leaderSkill: { set: sourced("leader_skill_sets", "1", { description: "Base leader" }), structuredPercentValues: [] },
                    attacks: [unitAttack("1"), unitAttack("2")],
                }, {
                    releaseState: "eza", release: { availableAtSnapshot: false },
                    leaderSkill: { set: sourced("leader_skill_sets", "2", { description: "Future leader" }), structuredPercentValues: [200] },
                    attacks: [],
                }],
                activeSkills: [], standbySkills: [], finishSkills: [], formRelations: [],
            }],
        } as unknown as DatabaseCharacterExperimentDataset;
        const summary = compareWithCurrentDataset(dataset, [{
            id: "1", name: "Card", rarity: "UR", type: "STR", characterClass: "Super", leaderSkill: "Base leader",
            leaderSkillDetails: { clauses: [] }, links: [], categories: [], transformations: [], unitSuperAttacks: [{}],
        }]);
        equal(summary.leaderTextMatches, 1);
        equal(summary.leaderPercentageMatches, 1);
        equal(summary.mechanicParity.unitAttackCount.matches, 1);
    });
});
