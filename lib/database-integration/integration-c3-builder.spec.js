"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const integration_c3_builder_1 = require("./integration-c3-builder");
const rule = (operation, valueUnit, target = { scope: "self", selfInclusion: "included" }) => ({ identity: { snapshotVersion: "s", cardId: "1", stateKey: "1:1:initial", formId: "1", releaseState: "initial", passiveSkillId: "2", ruleKey: "2:3:4", efficacyType: 13, effectOrdinal: 0, effectKey: "2:3:4:13:0" }, supported: { operation, valueUnit, target, calculationBucket: { paths: [] } } });
const state = (effects) => ({ stateKey: "1:1:initial", passive: { rules: [{ id: "text-parser-id", effects }] } });
describe("database-first integration C3 shadow parity", () => {
    it("maps native mitigation and guard values without changing units or signs", () => {
        (0, assert_1.deepEqual)((0, integration_c3_builder_1.expectedIntegrationC3Representation)(rule({ kind: "damage_mitigation" }, { kind: "remaining_damage_rate", reductionContributionPercentPoints: 30 })), { kind: "damage_reduction", value: 30, unit: "percent", target: { status: "supported", scope: "self" } });
        (0, assert_1.deepEqual)((0, integration_c3_builder_1.expectedIntegrationC3Representation)(rule({ kind: "force_guard" }, { kind: "boolean" })), { kind: "guard", value: 1, unit: "boolean", target: { status: "supported", scope: "self" } });
    });
    it("classifies exact representation, gains, unknowns and missing state conservatively", () => {
        const mitigation = rule({ kind: "damage_mitigation" }, { kind: "remaining_damage_rate", reductionContributionPercentPoints: 30 });
        (0, assert_1.equal)((0, integration_c3_builder_1.compareIntegrationC3Rule)(mitigation, state([{ kind: "damage_reduction", value: 30, unit: "percent", target: { scope: "self" } }])).classification, "agreement");
        (0, assert_1.equal)((0, integration_c3_builder_1.compareIntegrationC3Rule)(mitigation, state([])).classification, "representation_gain");
        (0, assert_1.equal)((0, integration_c3_builder_1.compareIntegrationC3Rule)(mitigation, state([{ kind: "damage_reduction", value: 40, unit: "percent", target: { scope: "self" } }])).classification, "unknown");
        (0, assert_1.equal)((0, integration_c3_builder_1.compareIntegrationC3Rule)(mitigation, undefined).classification, "unjoinable");
        (0, assert_1.equal)((0, integration_c3_builder_1.compareIntegrationC3Rule)(rule({ kind: "counter_resistance" }, {}), state([])).classification, "representation_gain");
    });
    it("does not claim equality when selectors cannot be joined by structural IDs", () => {
        const mitigation = rule({ kind: "damage_mitigation" }, { kind: "remaining_damage_rate", reductionContributionPercentPoints: 30 }, { scope: "team_allies", selfInclusion: "included", subTarget: { filters: [{ selector: "card_category_id", selectorId: "1" }] } });
        (0, assert_1.equal)((0, integration_c3_builder_1.compareIntegrationC3Rule)(mitigation, state([{ kind: "damage_reduction", value: 30, unit: "percent", target: { scope: "team_allies", selfInclusion: "included" } }])).classification, "unknown");
    });
    it("never upgrades a mismatched representation to confirmed conflict without common rule identity", () => {
        const result = (0, integration_c3_builder_1.compareIntegrationC3Rule)(rule({ kind: "force_guard" }, {}), state([{ kind: "guard", value: 0, unit: "boolean", target: { scope: "self" } }]));
        (0, assert_1.equal)(result.classification, "unknown");
        (0, assert_1.equal)(result.ruleJoin.status, "unavailable");
    });
});
//# sourceMappingURL=integration-c3-builder.spec.js.map