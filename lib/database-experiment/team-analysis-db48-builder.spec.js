"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const path_1 = require("path");
const team_analysis_db48_builder_1 = require("./team-analysis-db48-builder");
const team_analysis_db48_validator_1 = require("./team-analysis-db48-validator");
const evidence = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "native-damage-mitigation-semantics.json"), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));
describe("database Team Analysis DB48 damage mitigation", () => {
    it("preserves runtime float32 input and aggregate clamp", () => { (0, assert_1.equal)((0, team_analysis_db48_builder_1.projectDb48DamageRate)(70).reductionContributionPercentPoints, 30); (0, assert_1.equal)((0, team_analysis_db48_builder_1.projectDb48DamageRate)(-5).reductionContributionPercentPoints, 105); (0, assert_1.equal)((0, team_analysis_db48_builder_1.projectDb48DamageRate)(0).reductionContributionPercentPoints, 100); (0, assert_1.equal)((0, team_analysis_db48_builder_1.projectDb48DamageRate)("bad").status, "unknown"); (0, assert_1.equal)((0, team_analysis_db48_builder_1.aggregateDb48RemainingRate)([70, 80]), 50); (0, assert_1.equal)((0, team_analysis_db48_builder_1.aggregateDb48RemainingRate)([5, 5]), 0); (0, assert_1.equal)((0, team_analysis_db48_builder_1.aggregateDb48RemainingRate)([110]), 100); (0, assert_1.equal)((0, team_analysis_db48_builder_1.aggregateDb48RemainingRate)([70, "bad"]), null); });
    it("keeps the two native truncation orders distinct", () => { (0, assert_1.equal)((0, team_analysis_db48_builder_1.applyDb48PlayerSourceRate)(1, 50), 0); (0, assert_1.equal)((0, team_analysis_db48_builder_1.applyDb48EnemySourceRate)(1, 50), 1); });
    it("rejects semantic evidence mutations before ELF lookup", () => { for (const mutate of [(v) => v.sqliteBinding.eff_value1.callChangeParamOffset = 48, (v) => v.handlerBehavior.parametersNotRead = [], (v) => v.aggregateBehavior.clamp = [0, 99], (v) => v.consumerBehavior.enemySource.order = [], (v) => v.dispatch.raw = 14, (v) => v.directCalls[0].callVma += 4, (v) => v.efficacyInfoVtable.slots = [], (v) => v.unknowns = []]) {
        const value = clone(evidence);
        mutate(value);
        (0, assert_1.throws)(() => (0, team_analysis_db48_builder_1.validateDb48NativeEvidence)({}, value, evidence.sourceSha256), /DB48/);
    } });
    it("rejects payload identity and boundary mutations", () => { const rule = { efficacyType: 13, sourceEffectCount: 1, ignoredHandlerParameters: { status: "preserved_not_read_by_type_13_handler", rawEffValue2: 0, rawEffValue3: 0, rawCalculationOption: 2 }, consumers: { playerSource: { status: "supported", bucket: "player_source_intermediary_damage_after_defense_and_optional_guard", formula: "trunc_toward_zero(pre_minus_((100_minus_rate)_times_pre_div_100))", laterModifiersRemain: true }, enemySource: { status: "supported", bucket: "enemy_source_intermediary_damage_before_counter_resist_defense_and_guard", formula: "pre_minus_trunc_toward_zero(((100_minus_rate)_times_pre_div_100))", laterModifiersRemain: true }, attackKind: { status: "unknown", value: "unknown" }, finalHpApplication: { status: "unknown", value: "unknown" } }, independentDimensions: { condition: "independent", operation: "native_damage_rate_fold_not_skill_calc_option", target: "inherited_db35_db36", timing: "inherited_db47_independent", duration: "inherited_db37_independent", probability: "unknown", recurrence: "partial", reset: "unknown", stacking: "aggregate_order_proved_lifecycle_unknown" } }; (0, assert_1.equal)((0, team_analysis_db48_validator_1.hasDb48RuleIdentity)(rule, 1), true); (0, assert_1.equal)((0, team_analysis_db48_validator_1.hasDb48ConservativeBoundaries)(rule), true); for (const mutate of [(v) => v.efficacyType = 12, (v) => v.sourceEffectCount = 2]) {
        const value = clone(rule);
        mutate(value);
        (0, assert_1.equal)((0, team_analysis_db48_validator_1.hasDb48RuleIdentity)(value, 1), false);
    } for (const mutate of [(v) => v.ignoredHandlerParameters.status = "applied", (v) => v.consumers.attackKind = { status: "supported", value: "super" }, (v) => v.independentDimensions.probability = "supported"]) {
        const value = clone(rule);
        mutate(value);
        (0, assert_1.equal)((0, team_analysis_db48_validator_1.hasDb48ConservativeBoundaries)(value), false);
    } });
});
//# sourceMappingURL=team-analysis-db48-builder.spec.js.map