import { deepEqual, equal } from "assert";
import { compareIntegrationC3Rule, expectedIntegrationC3Representation } from "./integration-c3-builder";

const rule = (operation: any, valueUnit: any, target: any = { scope: "self", selfInclusion: "included" }): any => ({ identity: { snapshotVersion: "s", cardId: "1", stateKey: "1:1:initial", formId: "1", releaseState: "initial", passiveSkillId: "2", ruleKey: "2:3:4", efficacyType: 13, effectOrdinal: 0, effectKey: "2:3:4:13:0" }, supported: { operation, valueUnit, target, calculationBucket: { paths: [] } } });
const state = (effects: any[]): any => ({ stateKey: "1:1:initial", passive: { rules: [{ id: "text-parser-id", effects }] } });

describe("database-first integration C3 shadow parity", () => {
    it("maps native mitigation and guard values without changing units or signs", () => {
        deepEqual(expectedIntegrationC3Representation(rule({ kind: "damage_mitigation" }, { kind: "remaining_damage_rate", reductionContributionPercentPoints: 30 })), { kind: "damage_reduction", value: 30, unit: "percent", target: { status: "supported", scope: "self" } });
        deepEqual(expectedIntegrationC3Representation(rule({ kind: "force_guard" }, { kind: "boolean" })), { kind: "guard", value: 1, unit: "boolean", target: { status: "supported", scope: "self" } });
    });
    it("classifies exact representation, gains, unknowns and missing state conservatively", () => {
        const mitigation = rule({ kind: "damage_mitigation" }, { kind: "remaining_damage_rate", reductionContributionPercentPoints: 30 });
        equal(compareIntegrationC3Rule(mitigation, state([{ kind: "damage_reduction", value: 30, unit: "percent", target: { scope: "self" } }])).classification, "agreement");
        equal(compareIntegrationC3Rule(mitigation, state([])).classification, "representation_gain");
        equal(compareIntegrationC3Rule(mitigation, state([{ kind: "damage_reduction", value: 40, unit: "percent", target: { scope: "self" } }])).classification, "unknown");
        equal(compareIntegrationC3Rule(mitigation, undefined).classification, "unjoinable");
        equal(compareIntegrationC3Rule(rule({ kind: "counter_resistance" }, {}), state([])).classification, "representation_gain");
    });
    it("does not claim equality when selectors cannot be joined by structural IDs", () => {
        const mitigation = rule({ kind: "damage_mitigation" }, { kind: "remaining_damage_rate", reductionContributionPercentPoints: 30 }, { scope: "team_allies", selfInclusion: "included", subTarget: { filters: [{ selector: "card_category_id", selectorId: "1" }] } });
        equal(compareIntegrationC3Rule(mitigation, state([{ kind: "damage_reduction", value: 30, unit: "percent", target: { scope: "team_allies", selfInclusion: "included" } }])).classification, "unknown");
    });
    it("never upgrades a mismatched representation to confirmed conflict without common rule identity", () => {
        const result = compareIntegrationC3Rule(rule({ kind: "force_guard" }, {}), state([{ kind: "guard", value: 0, unit: "boolean", target: { scope: "self" } }]));
        equal(result.classification, "unknown"); equal(result.ruleJoin.status, "unavailable");
    });
});
