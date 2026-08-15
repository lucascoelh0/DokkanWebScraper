"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const leader_native_semantics_contract_1 = require("./leader-native-semantics-contract");
const leader_native_semantics_source_1 = require("./leader-native-semantics-source");
const leader_native_semantics_1 = require("./leader-native-semantics");
const leader_native_semantics_run_1 = require("./leader-native-semantics-run");
const masks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 24, 25, 26, 31, 32, 64, 4096, 8192, 16384, 32768, 65536, 126976, 131072, 262144, 524288, 1048576, 2097152, 4063232];
const modifiers = [10, 20, 22, 25, 30, 33, 35, 40, 41, 44, 50, 55, 59, 60, 66, 70, 77, 80, 88, 90, 99, 100, 110, 120, 130, 140, 150, 160, 170, 177, 180, 190, 200, 220, 2000, 2500];
function proof() {
    return {
        nativeSha256: leader_native_semantics_contract_1.CHARACTER_LEADER_NATIVE_PIN.elfSha256, nativeSizeBytes: leader_native_semantics_contract_1.CHARACTER_LEADER_NATIVE_PIN.elfSizeBytes,
        evidenceSha256: leader_native_semantics_contract_1.CHARACTER_LEADER_NATIVE_PIN.evidenceSha256, codeRegionCount: 8,
        dispatchEntryCount: leader_native_semantics_contract_1.CHARACTER_LEADER_NATIVE_PIN.dispatchEntries, constructorColumnCount: 7,
        type82DispatchBound: true, battleFactoryFieldTransferBound: true,
    };
}
function sources() {
    const effects = Array.from({ length: leader_native_semantics_contract_1.CHARACTER_LEADER_NATIVE_PIN.type82Rows }, (_, index) => ({
        rowId: `e${index}`, leaderSkillSetId: "set", efficacyType: 82,
        efficacyVector: [masks[index % masks.length], modifiers[index % modifiers.length], 0], calcOption: index < 4 ? 0 : 2,
        targetType: [2, 12, 13][index % 3], subTargetTypeSetId: index % 2 ? "targets" : null,
        causalitySerializedShapeSha256: index < 17 ? `${index}`.padStart(64, "0") : null,
        execTimingType: 1, descriptionCorrelatedToVectorPosition1: index >= 4,
    }));
    const references = Array.from({ length: leader_native_semantics_contract_1.CHARACTER_LEADER_NATIVE_PIN.type82References }, (_, index) => ({ effectRowId: `e${index % effects.length}`, targetSetId: null }));
    return {
        k3: { identity: {}, effects },
        k48: {
            identity: {},
            states: [{ stateId: "state", sourceStateKey: "source", cardId: "1", releaseState: "initial", leaderSetRowId: "set", effects: references }],
            policy: { structuralIdsOnly: true, sourceOrderAndMultiplicityPreserved: true, semanticAssociationSelected: false },
            coverage: { states: 1, effectReferences: references.length, targetReferences: 0, repeatedTargetReferences: 0 },
        },
    };
}
describe("database character K50 native leader semantics", () => {
    it("fails closed unless the exact opt-in, roots, native path and GC are supplied", async () => {
        await (0, assert_1.rejects)((0, leader_native_semantics_run_1.runCharacterLeaderNativeSemanticsAudit)({}), /explicit opt-in/);
        (0, assert_1.throws)(() => (0, leader_native_semantics_run_1.parseCharacterLeaderNativeSemanticsCli)([]), /exactly one --opt-in-k50/);
        (0, assert_1.throws)(() => (0, leader_native_semantics_run_1.parseCharacterLeaderNativeSemanticsCli)(["--opt-in-k50"]), /--sidecar-root/);
        (0, assert_1.throws)(() => (0, leader_native_semantics_run_1.parseCharacterLeaderNativeSemanticsCli)(["--opt-in-k50", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "43", "--k46-root", "46", "--k48-root", "48", "--native-runtime", "n", "--output-root", "o"]), /unsupported argument/);
        (0, assert_1.deepStrictEqual)((0, leader_native_semantics_run_1.parseCharacterLeaderNativeSemanticsCli)(["--opt-in-k50", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "43", "--k46-root", "46", "--k48-root", "48", "--native-runtime", "n"]), { optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "43", k46Root: "46", k48Root: "48", nativeRuntime: "n" });
        const saved = global.gc;
        try {
            global.gc = undefined;
            await (0, assert_1.rejects)((0, leader_native_semantics_run_1.runCharacterLeaderNativeSemanticsAudit)({ optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "43", k46Root: "46", k48Root: "48", nativeRuntime: "n" }), /--expose-gc/);
        }
        finally {
            global.gc = saved;
        }
    });
    it("pins the complete type82 corpus and separates flat from proportional values", () => {
        const source = sources(), scope = (0, leader_native_semantics_1.evaluateCharacterLeaderNativeSemantics)(source.k48, source.k3);
        (0, leader_native_semantics_1.assertPinnedCharacterLeaderNativeSemantics)(scope, proof());
        (0, assert_1.equal)(scope.flatRows, 4);
        (0, assert_1.equal)(scope.proportionalRows, 3849);
        (0, assert_1.equal)(scope.invalidRows, 0);
        (0, assert_1.deepStrictEqual)(scope.targetTypeDomain, [2, 12, 13]);
        (0, assert_1.equal)(scope.maskDomain.length, 38);
        (0, assert_1.equal)(scope.modifierDomain.length, 36);
    });
    it("fails closed on corpus, association, vector, calculation or native-proof drift", () => {
        let source = sources();
        source.k3.effects[0].calcOption = 3;
        let scope = (0, leader_native_semantics_1.evaluateCharacterLeaderNativeSemantics)(source.k48, source.k3);
        (0, assert_1.throws)(() => (0, leader_native_semantics_1.assertPinnedCharacterLeaderNativeSemantics)(scope, proof()), /flat rows|invalid rows/);
        source = sources();
        source.k3.effects[0].efficacyVector[2] = 1;
        scope = (0, leader_native_semantics_1.evaluateCharacterLeaderNativeSemantics)(source.k48, source.k3);
        (0, assert_1.throws)(() => (0, leader_native_semantics_1.assertPinnedCharacterLeaderNativeSemantics)(scope, proof()), /ignored-position rows/);
        source = sources();
        source.k48.policy.semanticAssociationSelected = true;
        (0, assert_1.throws)(() => (0, leader_native_semantics_1.evaluateCharacterLeaderNativeSemantics)(source.k48, source.k3), /structural association/);
        const valid = sources();
        scope = (0, leader_native_semantics_1.evaluateCharacterLeaderNativeSemantics)(valid.k48, valid.k3);
        (0, assert_1.throws)(() => (0, leader_native_semantics_1.assertPinnedCharacterLeaderNativeSemantics)(scope, { ...proof(), type82DispatchBound: false }), /native proof/);
    });
    it("builds deterministic bounded evidence without authorizing unresolved semantics", () => {
        const source = sources(), scope = (0, leader_native_semantics_1.evaluateCharacterLeaderNativeSemantics)(source.k48, source.k3);
        const first = (0, leader_native_semantics_1.buildCharacterLeaderNativeSemanticsReport)({}, {}, proof(), scope);
        const second = (0, leader_native_semantics_1.buildCharacterLeaderNativeSemanticsReport)({}, {}, proof(), scope);
        (0, assert_1.deepStrictEqual)(first, second);
        const encoded = `${JSON.stringify(first, null, 2)}\n`;
        (0, assert_1.ok)(Buffer.byteLength(encoded) < leader_native_semantics_contract_1.CHARACTER_LEADER_NATIVE_SEMANTICS_REPORT_LIMIT_BYTES);
        (0, assert_1.ok)(!encoded.includes("generatedAt"));
        (0, assert_1.equal)(first.readiness.nativeLeaderSemantics, "NOT_EXECUTED");
        (0, assert_1.equal)(first.readiness.targetTypeNames, "NO-GO");
        (0, assert_1.equal)(first.readiness.causalityBehavior, "NO-GO");
        (0, assert_1.equal)(first.readiness.productProjection, "NO-GO");
        (0, assert_1.equal)(first.policy.productAuthoritySelected, false);
        (0, assert_1.equal)(first.semantics.calcOption2, "proportional_percent_divided_by_100");
    });
    it("detects native identity or proof drift across the audit", () => {
        (0, leader_native_semantics_source_1.assertCharacterLeaderNativeProofStable)(proof(), proof());
        (0, assert_1.throws)(() => (0, leader_native_semantics_source_1.assertCharacterLeaderNativeProofStable)(proof(), { ...proof(), nativeSha256: "0".repeat(64) }), /changed during audit/);
    });
});
//# sourceMappingURL=leader-native-semantics.spec.js.map