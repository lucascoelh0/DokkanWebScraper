import { deepStrictEqual, equal, ok, rejects, throws } from "assert";
import type { SourcedRow } from "../database-experiment/contract";
import { CHARACTER_LEADER_NATIVE_PIN } from "./leader-native-semantics-contract";
import {
    CHARACTER_LEADER_TARGET_PIN, CHARACTER_LEADER_TARGET_SEMANTICS_REPORT_LIMIT_BYTES,
    CharacterLeaderTargetEvaluation, CharacterLeaderTargetNativeProof,
} from "./leader-target-semantics-contract";
import { assertLeaderTargetK3Stable, assertLeaderTargetNativeStable, compactLeaderTargetRawRows } from "./leader-target-semantics-source";
import { assertPinnedCharacterLeaderTargetSemantics, buildCharacterLeaderTargetSemanticsReport, evaluateCharacterLeaderTargetSemantics } from "./leader-target-semantics";
import { parseCharacterLeaderTargetSemanticsCli, runCharacterLeaderTargetSemanticsAudit } from "./leader-target-semantics-run";

function native(): CharacterLeaderTargetNativeProof {
    return {
        k50: { nativeSha256: CHARACTER_LEADER_NATIVE_PIN.elfSha256, nativeSizeBytes: CHARACTER_LEADER_NATIVE_PIN.elfSizeBytes, evidenceSha256: CHARACTER_LEADER_NATIVE_PIN.evidenceSha256, codeRegionCount: 8, dispatchEntryCount: 15, constructorColumnCount: 7, type82DispatchBound: true, battleFactoryFieldTransferBound: true },
        targetDispatchEvidenceSha256: CHARACTER_LEADER_TARGET_PIN.targetDispatchEvidenceSha256,
        subTargetEvidenceSha256: CHARACTER_LEADER_TARGET_PIN.subTargetEvidenceSha256,
        targetCodeRegionCount: 20, subTargetCodeRegionCount: 19, leaderRuntimeBridgeCodeRegionCount: 5,
        leaderRuntimeBridgeVtableBindingCount: 4, leaderRuntimeBridgeCallSiteCount: 4,
        targetTypesBound: true, subTargetTypesBound: true, leaderRuntimeBridgeBound: true,
    };
}
function pinnedScope(): CharacterLeaderTargetEvaluation {
    const pin = CHARACTER_LEADER_TARGET_PIN;
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
        await rejects(runCharacterLeaderTargetSemanticsAudit({} as any), /explicit opt-in/);
        throws(() => parseCharacterLeaderTargetSemanticsCli([]), /exactly one --opt-in-k51/);
        throws(() => parseCharacterLeaderTargetSemanticsCli(["--opt-in-k51"]), /--sidecar-root/);
        const args = ["--opt-in-k51", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "43", "--k46-root", "46", "--k48-root", "48", "--native-runtime", "n"];
        deepStrictEqual(parseCharacterLeaderTargetSemanticsCli(args), { optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "43", k46Root: "46", k48Root: "48", nativeRuntime: "n" });
        throws(() => parseCharacterLeaderTargetSemanticsCli([...args, "--output-root", "o"]), /unsupported argument/);
        const saved = (global as any).gc; try { (global as any).gc = undefined; await rejects(runCharacterLeaderTargetSemanticsAudit(parseCharacterLeaderTargetSemanticsCli(args)), /--expose-gc/); } finally { (global as any).gc = saved; }
    });
    it("compacts only structural sub-target values and rejects malformed rows", () => {
        const raw: SourcedRow[] = [
            { provenance: { table: "sub_target_types", rowId: "t1", columns: [] }, values: { sub_target_type_set_id: 7, target_value_type: 1, target_value: 42, name: "must not survive" } },
            { provenance: { table: "leader_skills", rowId: "e", columns: [] }, values: {} },
        ];
        const compact = compactLeaderTargetRawRows(raw); deepStrictEqual(compact, [{ rowId: "t1", targetSetId: "7", valueType: 1, valueId: "42" }]);
        ok(!JSON.stringify(compact).includes("must not survive"));
        throws(() => compactLeaderTargetRawRows([{ ...raw[0], values: { ...raw[0].values, target_value_type: "opaque" } }]), /target value type/);
    });
    it("joins target rows to type82 effects and keeps raw target enums separate", () => {
        const k3: any = { identity: {}, effects: [
            { rowId: "e2", efficacyType: 82, subTargetTypeSetId: "7", targetType: 2 },
            { rowId: "e12", efficacyType: 82, subTargetTypeSetId: "0", targetType: 12 },
            { rowId: "e13", efficacyType: 82, subTargetTypeSetId: null, targetType: 13 },
        ] };
        const k48: any = { identity: {}, effects: [
            { effectRowId: "e2", targetSetId: "7", targetRowIds: ["t1", "t2"] },
            { effectRowId: "e12", targetSetId: "0", targetRowIds: [] },
            { effectRowId: "e13", targetSetId: null, targetRowIds: [] },
        ] };
        const targets: any = { identity: {}, rows: [{ rowId: "t1", targetSetId: "7", valueType: 1, valueId: "42" }, { rowId: "t2", targetSetId: "7", valueType: 2, valueId: "9" }] };
        const scope = evaluateCharacterLeaderTargetSemantics(k48, k3, targets);
        equal(scope.type82Rows, 3); equal(scope.referencesWithSet, 1); equal(scope.referencesWithoutSet, 2); equal(scope.targetOccurrences, 2);
        equal(scope.includeCategoryRows, 1); equal(scope.excludeCategoryRows, 1); equal(scope.unsupportedTargetRows, 0);
        throws(() => evaluateCharacterLeaderTargetSemantics({ ...k48, effects: [{ ...k48.effects[0], targetSetId: "8" }] }, k3, targets), /target-set join/);
    });
    it("pins the real corpus and emits only an unauthorized bounded report from the public factory", () => {
        const scope = pinnedScope(); assertPinnedCharacterLeaderTargetSemantics(scope, native());
        throws(() => assertPinnedCharacterLeaderTargetSemantics({ ...scope, unsupportedTargetRows: 1 }, native()), /unsupported rows/);
        const first = buildCharacterLeaderTargetSemanticsReport({} as any, {} as any, "a".repeat(64), native(), scope);
        const second = buildCharacterLeaderTargetSemanticsReport({} as any, {} as any, "a".repeat(64), native(), scope);
        deepStrictEqual(first, second); const encoded = `${JSON.stringify(first, null, 2)}\n`; ok(Buffer.byteLength(encoded) < CHARACTER_LEADER_TARGET_SEMANTICS_REPORT_LIMIT_BYTES); ok(!encoded.includes("generatedAt"));
        equal(first.readiness.leaderTargetSemantics, "NOT_EXECUTED"); equal(first.readiness.causalityBehavior, "NO-GO"); equal(first.readiness.productProjection, "NO-GO");
    });
    it("detects K3-target and native evidence drift", () => {
        const id = { artifactSha256: "a".repeat(64), targetInputFingerprintSha256: "b".repeat(64) };
        assertLeaderTargetK3Stable(id, { ...id }); throws(() => assertLeaderTargetK3Stable(id, { ...id, targetInputFingerprintSha256: "c".repeat(64) }), /changed/);
        assertLeaderTargetNativeStable(native(), native()); throws(() => assertLeaderTargetNativeStable(native(), { ...native(), leaderRuntimeBridgeBound: false }), /changed/);
    });
});
