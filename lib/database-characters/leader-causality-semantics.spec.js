"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const leader_causality_semantics_contract_1 = require("./leader-causality-semantics-contract");
const leader_causality_semantics_source_1 = require("./leader-causality-semantics-source");
const leader_causality_semantics_run_1 = require("./leader-causality-semantics-run");
const leader_causality_semantics_1 = require("./leader-causality-semantics");
const row = (table, rowId, values) => ({ values, provenance: { table, rowId, columns: Object.keys(values) } });
const args = [
    "--opt-in-k52", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "43",
    "--k46-root", "46", "--k48-root", "48", "--native-runtime", "elf", "--database", "db",
];
describe("K52 leader causality semantics", () => {
    it("accepts only positive scalar IDs and exact binary ampersand expressions", () => {
        (0, assert_1.equal)((0, leader_causality_semantics_source_1.parseLeaderCausalityExpression)(196), 196);
        (0, assert_1.deepStrictEqual)((0, leader_causality_semantics_source_1.parseLeaderCausalityExpression)(["&", 3591, 3592]), ["&", 3591, 3592]);
        for (const invalid of [0, -1, ["|", 1, 2], ["&", 1, 2, 3], ["&", 1, "2"], { id: 1 }]) {
            (0, assert_1.throws)(() => (0, leader_causality_semantics_source_1.parseLeaderCausalityExpression)(invalid), /unsupported causality expression/);
        }
    });
    it("compacts only structural compiled conditions and discloses missing K3 causality rows", () => {
        const compacted = (0, leader_causality_semantics_source_1.compactLeaderCausalityRawRows)([
            row("leader_skills", "a", { efficacy_type: 82, causality_conditions: JSON.stringify({ source: "ignored text", compiled: 196 }) }),
            row("leader_skills", "b", { efficacy_type: 82, causality_conditions: JSON.stringify({ source: "ignored text", compiled: ["&", 3591, 3592] }) }),
            row("leader_skills", "c", { efficacy_type: 82, causality_conditions: null }),
            row("leader_skills", "d", { efficacy_type: 77, causality_conditions: JSON.stringify({ compiled: 197 }) }),
            row("skill_causalities", "196", {}),
        ]);
        (0, assert_1.deepStrictEqual)(compacted.effects, [{ rowId: "a", expression: 196 }, { rowId: "b", expression: ["&", 3591, 3592] }]);
        (0, assert_1.deepStrictEqual)(compacted.missingReferencedRowIds, ["3591", "3592"]);
        (0, assert_1.equal)(JSON.stringify(compacted).includes("ignored text"), false);
    });
    it("fails closed on malformed serialized conditions and duplicate effect rows", () => {
        (0, assert_1.throws)(() => (0, leader_causality_semantics_source_1.compactLeaderCausalityRawRows)([row("leader_skills", "a", { efficacy_type: 82, causality_conditions: "{" })]), /malformed causality JSON/);
        (0, assert_1.throws)(() => (0, leader_causality_semantics_source_1.compactLeaderCausalityRawRows)([
            row("leader_skills", "a", { efficacy_type: 82, causality_conditions: JSON.stringify({ compiled: 196 }) }),
            row("leader_skills", "a", { efficacy_type: 82, causality_conditions: JSON.stringify({ compiled: 197 }) }),
        ]), /duplicate leader effect/);
    });
    it("joins K48 effect references to separately supplied database tuples", () => {
        const k3 = {
            identity: { causalityInputFingerprintSha256: "x" },
            effects: [{ rowId: "a", expression: 196 }, { rowId: "b", expression: ["&", 3591, 3592] }],
            missingReferencedRowIds: ["196", "3591", "3592"],
        };
        const k48 = { states: [{ effects: [{ effectRowId: "a" }, { effectRowId: "a" }, { effectRowId: "b" }] }] };
        const database = { rows: [
                { id: "196", causalityType: 35, cauVal1: 126976, cauVal2: 0, cauVal3: 0 },
                { id: "3591", causalityType: 35, cauVal1: 96, cauVal2: 0, cauVal3: 0 },
                { id: "3592", causalityType: 35, cauVal1: 31, cauVal2: 0, cauVal3: 0 },
            ] };
        const scope = (0, leader_causality_semantics_1.evaluateCharacterLeaderCausalitySemantics)(k48, k3, database);
        (0, assert_1.equal)(scope.type82NonNullRows, 2);
        (0, assert_1.equal)(scope.k48References, 3);
        (0, assert_1.equal)(scope.scalarExpressions, 1);
        (0, assert_1.equal)(scope.conjunctionExpressions, 1);
        (0, assert_1.equal)(scope.leafOccurrences, 3);
        (0, assert_1.equal)(scope.missingK48EffectRows, 0);
        (0, assert_1.deepStrictEqual)(scope.idOccurrences, { "196": 1, "3591": 1, "3592": 1 });
    });
    it("detects final K48 target-association drift that value identity omits", () => {
        const before = { identity: { same: true }, effects: [{ effectRowId: "a", targetSetId: "7", targetRowIds: ["1", "2"] }] };
        (0, leader_causality_semantics_source_1.assertLeaderCausalityK48TargetStable)(before, JSON.parse(JSON.stringify(before)));
        const changed = JSON.parse(JSON.stringify(before));
        changed.effects[0].targetRowIds[1] = "3";
        (0, assert_1.throws)(() => (0, leader_causality_semantics_source_1.assertLeaderCausalityK48TargetStable)(before, changed), /target associations changed/);
    });
    it("keeps direct report construction non-authoritative and bounded", () => {
        const report = (0, leader_causality_semantics_1.buildCharacterLeaderCausalitySemanticsReport)({}, {}, { descriptorBoundReadOnly: true }, {
            elfSha256: leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_PIN.nativeSha256, elfSizeBytes: leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_PIN.nativeSizeBytes,
            evidenceSha256: leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_PIN.nativeEvidenceSha256, evidenceSizeBytes: leader_causality_semantics_contract_1.CHARACTER_LEADER_CAUSALITY_PIN.nativeEvidenceSizeBytes,
            codeRegionCount: 7, exactCallCount: 7, executionChainBound: true, type35DispatchBound: true, onlyCauVal1Read: true,
            bitRangeInclusive: [0, 31], humanBitNamesBound: false, partySelectionContextBound: false, lifecycleBound: false, stackingBound: false,
        }, {});
        (0, assert_1.equal)(report.readiness.leaderCausalityStructuralSemantics, "NOT_EXECUTED");
        (0, assert_1.equal)(report.readiness.authority, "NO-GO");
        (0, assert_1.equal)(report.policy.sourceTextIncluded, false);
    });
    it("requires one opt-in, all explicit values, and no duplicate or loose arguments", () => {
        (0, assert_1.equal)((0, leader_causality_semantics_run_1.parseCharacterLeaderCausalitySemanticsCli)(args).database, "db");
        (0, assert_1.throws)(() => (0, leader_causality_semantics_run_1.parseCharacterLeaderCausalitySemanticsCli)(args.slice(1)), /exactly one/);
        (0, assert_1.throws)(() => (0, leader_causality_semantics_run_1.parseCharacterLeaderCausalitySemanticsCli)([...args, "loose"]), /unsupported argument/);
        (0, assert_1.throws)(() => (0, leader_causality_semantics_run_1.parseCharacterLeaderCausalitySemanticsCli)([...args, "--database", "again"]), /duplicate --database/);
        (0, assert_1.throws)(() => (0, leader_causality_semantics_run_1.parseCharacterLeaderCausalitySemanticsCli)(args.slice(0, -1)), /missing value/);
    });
});
//# sourceMappingURL=leader-causality-semantics.spec.js.map