import { equal, throws } from "assert";
import { readFileSync } from "fs";
import { resolve } from "path";
import { applyDb50CounterResistance, decodeDb50BlTarget, doesDb50RateSetFlag, hasDb50JoinIdentity, hasDb50PayloadIdentity, selectDb50Counter, validateDb50Evidence } from "./team-analysis-db50-builder";
import { hasDb50ConservativeBoundaries } from "./team-analysis-db50-validator";

const evidence = JSON.parse(readFileSync(resolve(__dirname, "..", "..", "database-experiment", "native-counter-consumer-semantics.json"), "utf8"));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const source = { efficacyType: 120, payload: { resistDamageRate: { sqliteColumn: "eff_value1", nativeField: "resistDamageRate", status: "supported", runtimeInteger: 59 }, increaseDamagePercent: { sqliteColumn: "eff_value2", nativeField: "increaseDamagePercent", status: "supported", runtimeInteger: 200 }, battleScriptNo: { sqliteColumn: "eff_value3", nativeField: "battleScriptNo", status: "supported", runtimeInteger: 13 } } } as any;

describe("database Team Analysis DB50 counter consumer", () => {
    it("selects the greatest resist rate and preserves first-in-order ties", () => {
        const candidates = [{ id: "low", resistDamageRate: 30 }, { id: "first-high", resistDamageRate: 80 }, { id: "tie", resistDamageRate: 80 }];
        equal(selectDb50Counter(candidates)?.id, "first-high");
        equal(selectDb50Counter(candidates.slice().reverse())?.id, "tie");
        equal(selectDb50Counter([]), null);
    });
    it("applies signed truncation toward zero without an invented clamp", () => {
        equal(applyDb50CounterResistance(101, 59), 42);
        equal(applyDb50CounterResistance(-101, 59), -42);
        equal(applyDb50CounterResistance(0, 59), 0);
        equal(applyDb50CounterResistance(101, 100), 0);
        equal(applyDb50CounterResistance(100, 101), -1);
        equal(doesDb50RateSetFlag(0), false);
        equal(doesDb50RateSetFlag(59), false);
        equal(doesDb50RateSetFlag(100), true);
    });
    it("decodes every recorded BL destination and rejects mutated linkage", () => {
        for (const call of evidence.directCalls) {
            const bytes = Buffer.from(call.callHex, "hex");
            equal(decodeDb50BlTarget(bytes, call.callVma), call.pltVma);
            equal(decodeDb50BlTarget(bytes, call.callVma + 4) === call.pltVma, false);
            const opcodeMutation = Buffer.from(bytes); opcodeMutation[3] = 0; equal(decodeDb50BlTarget(opcodeMutation, call.callVma), null);
        }
    });
    it("rejects semantic evidence mutations before ELF lookup", () => {
        for (const mutate of [(value: any) => value.registrationGate.callChangeParamOffset = 8, (value: any) => value.normalSelection.ranking = "last", (value: any) => value.preference.order = "normal_then_dodge", (value: any) => value.damageConsumer.bucket = "after_guard", (value: any) => value.damageConsumer.rateAbove99SetsFlag = false, (value: any) => value.codeRegions.pop(), (value: any) => value.directCalls[0].callVma += 4, (value: any) => value.directCalls[0].pltVma += 4, (value: any) => value.directCalls[0].relocation.addend = 4, (value: any) => value.unknowns = []]) {
            const mutated = clone(evidence); mutate(mutated); throws(() => validateDb50Evidence({} as any, mutated, evidence.sourceSha256), /DB50/);
        }
    });
    it("rejects invalid payload identity", () => {
        equal(hasDb50PayloadIdentity(source), true);
        for (const mutate of [(value: any) => value.efficacyType = 119, (value: any) => value.payload.resistDamageRate.status = "unknown", (value: any) => value.payload.resistDamageRate.runtimeInteger = 59.5, (value: any) => value.payload.increaseDamagePercent.sqliteColumn = "eff_value3", (value: any) => delete value.payload.battleScriptNo.runtimeInteger]) {
            const mutated = clone(source); mutate(mutated); equal(hasDb50PayloadIdentity(mutated), false);
        }
    });
    it("rejects inherited join identity mutations", () => {
        const values = [{ passiveSkillId: "42", effectCount: 1 }, { passiveSkillId: "42", effectCount: 1 }];
        equal(hasDb50JoinIdentity("42", 1, ...values), true);
        for (let index = 0; index < values.length; index++) {
            const idMutation = clone(values); idMutation[index].passiveSkillId = "43"; equal(hasDb50JoinIdentity("42", 1, ...idMutation), false);
            const countMutation = clone(values); countMutation[index].effectCount = 2; equal(hasDb50JoinIdentity("42", 1, ...countMutation), false);
        }
    });
    it("keeps activation and final HP boundaries unknown", () => {
        const projection = { registrationGate: { status: "supported", callChangeParamOffset: 4, registerWhenZero: true, nonzeroBehavior: "skip_registration", fieldSemantic: "unknown" }, selection: { status: "supported", filters: ["efficacy_type_120", "deck_index_input"], ranking: "highest_resist_damage_rate", tieBehavior: "first_in_efficacy_info_order", preference: "efficacy_128_dodge_then_efficacy_120_normal", callerBoolean: "unknown", externalActivation: "unknown" }, damage: { status: "supported", bucket: "enemy_source_after_efficacy_13_before_defense_and_guard", formula: "pre_minus_trunc_toward_zero(pre_times_resist_damage_rate_div_100)", rateAbove99SetsFlag: true, finalHpApplication: "unknown" }, simulationStatus: "partial" } as any;
        equal(hasDb50ConservativeBoundaries(projection), true);
        for (const mutate of [(value: any) => value.registrationGate.fieldSemantic = "counter_enabled", (value: any) => value.selection.callerBoolean = "is_super", (value: any) => value.selection.externalActivation = "on_hit", (value: any) => value.damage.finalHpApplication = "supported", (value: any) => value.simulationStatus = "supported"]) {
            const mutated = clone(projection); mutate(mutated); equal(hasDb50ConservativeBoundaries(mutated), false);
        }
    });
});
