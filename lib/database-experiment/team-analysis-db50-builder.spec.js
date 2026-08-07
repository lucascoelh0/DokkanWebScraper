"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const path_1 = require("path");
const team_analysis_db50_builder_1 = require("./team-analysis-db50-builder");
const team_analysis_db50_validator_1 = require("./team-analysis-db50-validator");
const evidence = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "native-counter-consumer-semantics.json"), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));
const source = { efficacyType: 120, payload: { resistDamageRate: { sqliteColumn: "eff_value1", nativeField: "resistDamageRate", status: "supported", runtimeInteger: 59 }, increaseDamagePercent: { sqliteColumn: "eff_value2", nativeField: "increaseDamagePercent", status: "supported", runtimeInteger: 200 }, battleScriptNo: { sqliteColumn: "eff_value3", nativeField: "battleScriptNo", status: "supported", runtimeInteger: 13 } } };
describe("database Team Analysis DB50 counter consumer", () => {
    it("selects the greatest resist rate and preserves first-in-order ties", () => {
        const candidates = [{ id: "low", resistDamageRate: 30 }, { id: "first-high", resistDamageRate: 80 }, { id: "tie", resistDamageRate: 80 }];
        (0, assert_1.equal)((0, team_analysis_db50_builder_1.selectDb50Counter)(candidates)?.id, "first-high");
        (0, assert_1.equal)((0, team_analysis_db50_builder_1.selectDb50Counter)(candidates.slice().reverse())?.id, "tie");
        (0, assert_1.equal)((0, team_analysis_db50_builder_1.selectDb50Counter)([]), null);
    });
    it("applies signed truncation toward zero without an invented clamp", () => {
        (0, assert_1.equal)((0, team_analysis_db50_builder_1.applyDb50CounterResistance)(101, 59), 42);
        (0, assert_1.equal)((0, team_analysis_db50_builder_1.applyDb50CounterResistance)(-101, 59), -42);
        (0, assert_1.equal)((0, team_analysis_db50_builder_1.applyDb50CounterResistance)(0, 59), 0);
        (0, assert_1.equal)((0, team_analysis_db50_builder_1.applyDb50CounterResistance)(101, 100), 0);
        (0, assert_1.equal)((0, team_analysis_db50_builder_1.applyDb50CounterResistance)(100, 101), -1);
        (0, assert_1.equal)((0, team_analysis_db50_builder_1.doesDb50RateSetFlag)(0), false);
        (0, assert_1.equal)((0, team_analysis_db50_builder_1.doesDb50RateSetFlag)(59), false);
        (0, assert_1.equal)((0, team_analysis_db50_builder_1.doesDb50RateSetFlag)(100), true);
    });
    it("decodes every recorded BL destination and rejects mutated linkage", () => {
        for (const call of evidence.directCalls) {
            const bytes = Buffer.from(call.callHex, "hex");
            (0, assert_1.equal)((0, team_analysis_db50_builder_1.decodeDb50BlTarget)(bytes, call.callVma), call.pltVma);
            (0, assert_1.equal)((0, team_analysis_db50_builder_1.decodeDb50BlTarget)(bytes, call.callVma + 4) === call.pltVma, false);
            const opcodeMutation = Buffer.from(bytes);
            opcodeMutation[3] = 0;
            (0, assert_1.equal)((0, team_analysis_db50_builder_1.decodeDb50BlTarget)(opcodeMutation, call.callVma), null);
        }
    });
    it("rejects semantic evidence mutations before ELF lookup", () => {
        for (const mutate of [(value) => value.registrationGate.callChangeParamOffset = 8, (value) => value.normalSelection.ranking = "last", (value) => value.preference.order = "normal_then_dodge", (value) => value.damageConsumer.bucket = "after_guard", (value) => value.damageConsumer.rateAbove99SetsFlag = false, (value) => value.codeRegions.pop(), (value) => value.directCalls[0].callVma += 4, (value) => value.directCalls[0].pltVma += 4, (value) => value.directCalls[0].relocation.addend = 4, (value) => value.unknowns = []]) {
            const mutated = clone(evidence);
            mutate(mutated);
            (0, assert_1.throws)(() => (0, team_analysis_db50_builder_1.validateDb50Evidence)({}, mutated, evidence.sourceSha256), /DB50/);
        }
    });
    it("rejects invalid payload identity", () => {
        (0, assert_1.equal)((0, team_analysis_db50_builder_1.hasDb50PayloadIdentity)(source), true);
        for (const mutate of [(value) => value.efficacyType = 119, (value) => value.payload.resistDamageRate.status = "unknown", (value) => value.payload.resistDamageRate.runtimeInteger = 59.5, (value) => value.payload.increaseDamagePercent.sqliteColumn = "eff_value3", (value) => delete value.payload.battleScriptNo.runtimeInteger]) {
            const mutated = clone(source);
            mutate(mutated);
            (0, assert_1.equal)((0, team_analysis_db50_builder_1.hasDb50PayloadIdentity)(mutated), false);
        }
    });
    it("rejects inherited join identity mutations", () => {
        const values = [{ passiveSkillId: "42", effectCount: 1 }, { passiveSkillId: "42", effectCount: 1 }];
        (0, assert_1.equal)((0, team_analysis_db50_builder_1.hasDb50JoinIdentity)("42", 1, ...values), true);
        for (let index = 0; index < values.length; index++) {
            const idMutation = clone(values);
            idMutation[index].passiveSkillId = "43";
            (0, assert_1.equal)((0, team_analysis_db50_builder_1.hasDb50JoinIdentity)("42", 1, ...idMutation), false);
            const countMutation = clone(values);
            countMutation[index].effectCount = 2;
            (0, assert_1.equal)((0, team_analysis_db50_builder_1.hasDb50JoinIdentity)("42", 1, ...countMutation), false);
        }
    });
    it("keeps activation and final HP boundaries unknown", () => {
        const projection = { registrationGate: { status: "supported", callChangeParamOffset: 4, registerWhenZero: true, nonzeroBehavior: "skip_registration", fieldSemantic: "unknown" }, selection: { status: "supported", filters: ["efficacy_type_120", "deck_index_input"], ranking: "highest_resist_damage_rate", tieBehavior: "first_in_efficacy_info_order", preference: "efficacy_128_dodge_then_efficacy_120_normal", callerBoolean: "unknown", externalActivation: "unknown" }, damage: { status: "supported", bucket: "enemy_source_after_efficacy_13_before_defense_and_guard", formula: "pre_minus_trunc_toward_zero(pre_times_resist_damage_rate_div_100)", rateAbove99SetsFlag: true, finalHpApplication: "unknown" }, simulationStatus: "partial" };
        (0, assert_1.equal)((0, team_analysis_db50_validator_1.hasDb50ConservativeBoundaries)(projection), true);
        for (const mutate of [(value) => value.registrationGate.fieldSemantic = "counter_enabled", (value) => value.selection.callerBoolean = "is_super", (value) => value.selection.externalActivation = "on_hit", (value) => value.damage.finalHpApplication = "supported", (value) => value.simulationStatus = "supported"]) {
            const mutated = clone(projection);
            mutate(mutated);
            (0, assert_1.equal)((0, team_analysis_db50_validator_1.hasDb50ConservativeBoundaries)(mutated), false);
        }
    });
});
//# sourceMappingURL=team-analysis-db50-builder.spec.js.map