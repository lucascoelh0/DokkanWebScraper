"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const leader_native_semantics_contract_1 = require("./leader-native-semantics-contract");
const leader_target_semantics_contract_1 = require("./leader-target-semantics-contract");
const leader_target_semantics_source_1 = require("./leader-target-semantics-source");
const leader_target_semantics_1 = require("./leader-target-semantics");
const leader_target_semantics_run_1 = require("./leader-target-semantics-run");
function native() {
    return {
        k50: { nativeSha256: leader_native_semantics_contract_1.CHARACTER_LEADER_NATIVE_PIN.elfSha256, nativeSizeBytes: leader_native_semantics_contract_1.CHARACTER_LEADER_NATIVE_PIN.elfSizeBytes, evidenceSha256: leader_native_semantics_contract_1.CHARACTER_LEADER_NATIVE_PIN.evidenceSha256, codeRegionCount: 8, dispatchEntryCount: 15, constructorColumnCount: 7, type82DispatchBound: true, battleFactoryFieldTransferBound: true },
        targetDispatchEvidenceSha256: leader_target_semantics_contract_1.CHARACTER_LEADER_TARGET_PIN.targetDispatchEvidenceSha256,
        subTargetEvidenceSha256: leader_target_semantics_contract_1.CHARACTER_LEADER_TARGET_PIN.subTargetEvidenceSha256,
        targetCodeRegionCount: 20, subTargetCodeRegionCount: 19, leaderRuntimeBridgeCodeRegionCount: 5,
        leaderRuntimeBridgeVtableBindingCount: 4, leaderRuntimeBridgeCallSiteCount: 4,
        targetTypesBound: true, subTargetTypesBound: true, leaderRuntimeBridgeBound: true,
    };
}
function pinnedScope() {
    const pin = leader_target_semantics_contract_1.CHARACTER_LEADER_TARGET_PIN;
    return {
        type82Rows: pin.type82Rows, type82References: pin.type82References, referencesWithSet: pin.referencesWithSet,
        referencesWithoutSet: pin.referencesWithoutSet, distinctNonzeroSets: pin.distinctNonzeroSets, targetRows: pin.targetRows,
        targetOccurrences: pin.targetOccurrences, includeCategoryRows: pin.includeCategoryRows, excludeCategoryRows: pin.excludeCategoryRows,
        unsupportedTargetRows: 0,
        targetTypeRows: [
            { raw: 2, rows: pin.teamAlliesRows, scope: "team_allies" },
            { raw: 12, rows: pin.superClassAlliesRows, scope: "super_class_allies" },
            { raw: 13, rows: pin.extremeClassAlliesRows, scope: "extreme_class_allies" },
        ],
    };
}
describe("database character K51 native leader target semantics", () => {
    it("fails closed unless exact opt-in, roots, native path and GC are supplied", async () => {
        await (0, assert_1.rejects)((0, leader_target_semantics_run_1.runCharacterLeaderTargetSemanticsAudit)({}), /explicit opt-in/);
        (0, assert_1.throws)(() => (0, leader_target_semantics_run_1.parseCharacterLeaderTargetSemanticsCli)([]), /exactly one --opt-in-k51/);
        (0, assert_1.throws)(() => (0, leader_target_semantics_run_1.parseCharacterLeaderTargetSemanticsCli)(["--opt-in-k51"]), /--sidecar-root/);
        const args = ["--opt-in-k51", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "43", "--k46-root", "46", "--k48-root", "48", "--native-runtime", "n"];
        (0, assert_1.deepStrictEqual)((0, leader_target_semantics_run_1.parseCharacterLeaderTargetSemanticsCli)(args), { optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "43", k46Root: "46", k48Root: "48", nativeRuntime: "n" });
        (0, assert_1.throws)(() => (0, leader_target_semantics_run_1.parseCharacterLeaderTargetSemanticsCli)([...args, "--output-root", "o"]), /unsupported argument/);
        const saved = global.gc;
        try {
            global.gc = undefined;
            await (0, assert_1.rejects)((0, leader_target_semantics_run_1.runCharacterLeaderTargetSemanticsAudit)((0, leader_target_semantics_run_1.parseCharacterLeaderTargetSemanticsCli)(args)), /--expose-gc/);
        }
        finally {
            global.gc = saved;
        }
    });
    it("compacts only structural sub-target values and rejects malformed rows", () => {
        const raw = [
            { provenance: { table: "sub_target_types", rowId: "t1", columns: [] }, values: { sub_target_type_set_id: 7, target_value_type: 1, target_value: 42, name: "must not survive" } },
            { provenance: { table: "leader_skills", rowId: "e", columns: [] }, values: {} },
        ];
        const compact = (0, leader_target_semantics_source_1.compactLeaderTargetRawRows)(raw);
        (0, assert_1.deepStrictEqual)(compact, [{ rowId: "t1", targetSetId: "7", valueType: 1, valueId: "42" }]);
        (0, assert_1.ok)(!JSON.stringify(compact).includes("must not survive"));
        (0, assert_1.throws)(() => (0, leader_target_semantics_source_1.compactLeaderTargetRawRows)([{ ...raw[0], values: { ...raw[0].values, target_value_type: "opaque" } }]), /target value type/);
    });
    it("joins target rows to type82 effects and keeps raw target enums separate", () => {
        const k3 = { identity: {}, effects: [
                { rowId: "e2", efficacyType: 82, subTargetTypeSetId: "7", targetType: 2 },
                { rowId: "e12", efficacyType: 82, subTargetTypeSetId: "0", targetType: 12 },
                { rowId: "e13", efficacyType: 82, subTargetTypeSetId: null, targetType: 13 },
            ] };
        const k48 = { identity: {}, effects: [
                { effectRowId: "e2", targetSetId: "7", targetRowIds: ["t1", "t2"] },
                { effectRowId: "e12", targetSetId: "0", targetRowIds: [] },
                { effectRowId: "e13", targetSetId: null, targetRowIds: [] },
            ] };
        const targets = { identity: {}, rows: [{ rowId: "t1", targetSetId: "7", valueType: 1, valueId: "42" }, { rowId: "t2", targetSetId: "7", valueType: 2, valueId: "9" }] };
        const scope = (0, leader_target_semantics_1.evaluateCharacterLeaderTargetSemantics)(k48, k3, targets);
        (0, assert_1.equal)(scope.type82Rows, 3);
        (0, assert_1.equal)(scope.referencesWithSet, 1);
        (0, assert_1.equal)(scope.referencesWithoutSet, 2);
        (0, assert_1.equal)(scope.targetOccurrences, 2);
        (0, assert_1.equal)(scope.includeCategoryRows, 1);
        (0, assert_1.equal)(scope.excludeCategoryRows, 1);
        (0, assert_1.equal)(scope.unsupportedTargetRows, 0);
        (0, assert_1.throws)(() => (0, leader_target_semantics_1.evaluateCharacterLeaderTargetSemantics)({ ...k48, effects: [{ ...k48.effects[0], targetSetId: "8" }] }, k3, targets), /target-set join/);
    });
    it("pins the real corpus and emits only an unauthorized bounded report from the public factory", () => {
        const scope = pinnedScope();
        (0, leader_target_semantics_1.assertPinnedCharacterLeaderTargetSemantics)(scope, native());
        (0, assert_1.throws)(() => (0, leader_target_semantics_1.assertPinnedCharacterLeaderTargetSemantics)({ ...scope, unsupportedTargetRows: 1 }, native()), /unsupported rows/);
        const first = (0, leader_target_semantics_1.buildCharacterLeaderTargetSemanticsReport)({}, {}, "a".repeat(64), native(), scope);
        const second = (0, leader_target_semantics_1.buildCharacterLeaderTargetSemanticsReport)({}, {}, "a".repeat(64), native(), scope);
        (0, assert_1.deepStrictEqual)(first, second);
        const encoded = `${JSON.stringify(first, null, 2)}\n`;
        (0, assert_1.ok)(Buffer.byteLength(encoded) < leader_target_semantics_contract_1.CHARACTER_LEADER_TARGET_SEMANTICS_REPORT_LIMIT_BYTES);
        (0, assert_1.ok)(!encoded.includes("generatedAt"));
        (0, assert_1.equal)(first.readiness.leaderTargetSemantics, "NOT_EXECUTED");
        (0, assert_1.equal)(first.readiness.causalityBehavior, "NO-GO");
        (0, assert_1.equal)(first.readiness.productProjection, "NO-GO");
    });
    it("detects K3-target and native evidence drift", () => {
        const id = { artifactSha256: "a".repeat(64), targetInputFingerprintSha256: "b".repeat(64) };
        (0, leader_target_semantics_source_1.assertLeaderTargetK3Stable)(id, { ...id });
        (0, assert_1.throws)(() => (0, leader_target_semantics_source_1.assertLeaderTargetK3Stable)(id, { ...id, targetInputFingerprintSha256: "c".repeat(64) }), /changed/);
        (0, leader_target_semantics_source_1.assertLeaderTargetNativeStable)(native(), native());
        (0, assert_1.throws)(() => (0, leader_target_semantics_source_1.assertLeaderTargetNativeStable)(native(), { ...native(), leaderRuntimeBridgeBound: false }), /changed/);
    });
});
//# sourceMappingURL=leader-target-semantics.spec.js.map