"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const path_1 = require("path");
const team_analysis_db49_builder_1 = require("./team-analysis-db49-builder");
const team_analysis_db49_validator_1 = require("./team-analysis-db49-validator");
const evidence = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "native-forced-guard-semantics.json"), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));
describe("database Team Analysis DB49 forced guard", () => {
    it("proves efficacy 78 is an overriding input to the guard truth table", () => { (0, assert_1.equal)((0, team_analysis_db49_builder_1.evaluateDb49GuardDecision)({ elementAffinityResultEq1: false, defenderHasEfficacy24: true, independentRawAttackerOverride: true, defenderHasEfficacy78: true, independentPlayerModeOverride: true }), true); (0, assert_1.equal)((0, team_analysis_db49_builder_1.evaluateDb49GuardDecision)({ elementAffinityResultEq1: true, defenderHasEfficacy24: true, independentRawAttackerOverride: false, defenderHasEfficacy78: false, independentPlayerModeOverride: false }), false); (0, assert_1.equal)((0, team_analysis_db49_builder_1.evaluateDb49GuardDecision)({ elementAffinityResultEq1: true, defenderHasEfficacy24: false, independentRawAttackerOverride: false, defenderHasEfficacy78: false, independentPlayerModeOverride: false }), true); });
    it("applies the native coefficient with signed truncation toward zero", () => { (0, assert_1.equal)((0, team_analysis_db49_builder_1.applyDb49GuardCoefficient)(3, true), 1); (0, assert_1.equal)((0, team_analysis_db49_builder_1.applyDb49GuardCoefficient)(-3, true), -1); (0, assert_1.equal)((0, team_analysis_db49_builder_1.applyDb49GuardCoefficient)(0, true), 0); (0, assert_1.equal)((0, team_analysis_db49_builder_1.applyDb49GuardCoefficient)(3, false), 3); });
    it("rejects semantic evidence mutations before ELF lookup", () => { for (const mutate of [(v) => v.sqliteBinding.enumValue = 77, (v) => v.dispatch.slotVma += 8, (v) => v.handlerBehavior.parametersNotReadByHandler = [], (v) => v.guardDecision.formula = "name-only", (v) => v.coefficient.getterReturn = 0.4, (v) => v.consumerBehavior.enemySource.bucket = "unknown", (v) => v.enemyAbiFlow.callerStackOffset = 16, (v) => v.directCalls[0].callVma += 4, (v) => v.codeRegions.pop(), (v) => v.unknowns = []]) {
        const value = clone(evidence);
        mutate(value);
        (0, assert_1.throws)(() => (0, team_analysis_db49_builder_1.validateDb49NativeEvidence)({}, value, evidence.sourceSha256), /DB49/);
    } });
    it("rejects payload identity and unknown-boundary mutations", () => { const rule = { efficacyType: 78, sourceEffectCount: 1, effect: { handlerParameters: { status: "preserved_not_read_by_type_78_handler" } }, consumers: { playerSource: { status: "supported", bucket: "after_enemy_defense_before_efficacy_13_damage_mitigation", formula: "trunc_toward_zero(pre_guard_damage_times_0_5)", laterModifiersRemain: true }, enemySource: { status: "supported", bucket: "after_efficacy_13_counter_resist_defense_and_critical_correction_before_increase_received_damage_and_final_clamps", formula: "trunc_toward_zero(pre_guard_damage_times_0_5)", laterModifiersRemain: true }, independentType78ElementCoefficientInput: { status: "unknown", value: "preserved_unknown" }, attackKind: { status: "unknown", value: "unknown" }, finalHpApplication: { status: "unknown", value: "unknown" } }, independentDimensions: { condition: "independent", operation: "native_boolean_presence_not_skill_calc_option", target: "inherited_db35_db36", timing: "inherited_db47_independent", duration: "inherited_db37_independent", probability: "unknown", recurrence: "partial", reset: "unknown", stacking: "boolean_presence_cross_status_lifecycle_unknown" } }; (0, assert_1.equal)((0, team_analysis_db49_validator_1.hasDb49RuleIdentity)(rule, 1), true); (0, assert_1.equal)((0, team_analysis_db49_validator_1.hasDb49ConservativeBoundaries)(rule), true); for (const mutate of [(v) => v.efficacyType = 77, (v) => v.sourceEffectCount = 2]) {
        const value = clone(rule);
        mutate(value);
        (0, assert_1.equal)((0, team_analysis_db49_validator_1.hasDb49RuleIdentity)(value, 1), false);
    } for (const mutate of [(v) => v.effect.handlerParameters.status = "applied", (v) => v.consumers.independentType78ElementCoefficientInput = { status: "supported", value: "advantage" }, (v) => v.independentDimensions.probability = "supported"]) {
        const value = clone(rule);
        mutate(value);
        (0, assert_1.equal)((0, team_analysis_db49_validator_1.hasDb49ConservativeBoundaries)(value), false);
    } });
    it("rejects passive-skill and effect-count mutations in every inherited join", () => { const joins = Array.from({ length: 4 }, () => ({ passiveSkillId: "42", effectCount: 1 })); (0, assert_1.equal)((0, team_analysis_db49_builder_1.hasDb49JoinIdentity)("42", 1, ...joins), true); for (let index = 0; index < joins.length; index++) {
        const idMutation = clone(joins);
        idMutation[index].passiveSkillId = "43";
        (0, assert_1.equal)((0, team_analysis_db49_builder_1.hasDb49JoinIdentity)("42", 1, ...idMutation), false);
        const countMutation = clone(joins);
        countMutation[index].effectCount = 2;
        (0, assert_1.equal)((0, team_analysis_db49_builder_1.hasDb49JoinIdentity)("42", 1, ...countMutation), false);
    } });
});
//# sourceMappingURL=team-analysis-db49-builder.spec.js.map