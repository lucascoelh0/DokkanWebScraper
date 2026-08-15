"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const leader_association_scope_contract_1 = require("./leader-association-scope-contract");
const leader_association_scope_source_1 = require("./leader-association-scope-source");
const leader_association_scope_1 = require("./leader-association-scope");
const leader_association_scope_run_1 = require("./leader-association-scope-run");
const leader_scope_contract_1 = require("./leader-scope-contract");
function k3Identity() {
    return {
        profileId: "character-refresh-pinned-v1", snapshotVersion: "snapshot-v1",
        manifest: { sha256: "1".repeat(64), sizeBytes: 1 },
        artifact: { sha256: "2".repeat(64), sizeBytes: 2, uncompressedSizeBytes: 3, uncompressedSha256: "3".repeat(64) },
        coverage: { sha256: "4".repeat(64), sizeBytes: 4 }, validation: { sha256: "5".repeat(64), sizeBytes: 5 },
        associationInputFingerprintSha256: "7".repeat(64),
    };
}
function baseK3Identity() {
    const { associationInputFingerprintSha256: _association, ...base } = k3Identity();
    return { ...base, compactFingerprintSha256: "6".repeat(64) };
}
function k46Identity() {
    return {
        manifestSha256: "8".repeat(64), payloadSha256: "9".repeat(64), rawSha256: "a".repeat(64), stateFingerprintSha256: "b".repeat(64),
        k43: {
            manifestSha256: "c".repeat(64), payloadSha256: "d".repeat(64), rawSha256: "e".repeat(64),
            k42SourceFingerprintSha256: "f".repeat(64), stateFingerprintSha256: "0".repeat(64),
        },
        k3: baseK3Identity(),
    };
}
function sources() {
    const state = {
        stateId: "card-state:1:initial", sourceStateKey: "source:1", cardId: "1", releaseState: "initial",
        effectRowIds: ["e1", "e2", "e3"], flattenedTargetRowIds: ["t1", "t2", "t1", "t2"],
    };
    return {
        k46: {
            identity: k46Identity(), states: [state],
            policy: { sourceReferenceOrderAndMultiplicityPreserved: true, referencesDeduplicated: false, effectTargetAssociationsSelected: false },
            coverage: { states: 1, effects: 3, targets: 4, repeatedEffects: 0, repeatedTargets: 2 },
        },
        k3: {
            identity: k3Identity(),
            states: [{ ...state, effectRowIds: [...state.effectRowIds], flattenedTargetRowIds: [...state.flattenedTargetRowIds] }, ...leader_scope_contract_1.CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS.map((stateId, index) => ({
                    stateId, sourceStateKey: `unknown:${index}`, cardId: "1010900", releaseState: "unknown",
                    effectRowIds: [], flattenedTargetRowIds: [],
                }))],
            effects: [{ rowId: "e1", targetSetId: "set-a" }, { rowId: "e2", targetSetId: "set-a" }, { rowId: "e3", targetSetId: null }],
            targets: [{ rowId: "t1", targetSetId: "set-a" }, { rowId: "t2", targetSetId: "set-a" }],
        },
    };
}
function pinnedEvaluation() {
    return {
        ...leader_association_scope_contract_1.CHARACTER_LEADER_ASSOCIATION_SCOPE_PIN,
        samples: { repeatedStateIds: ["card-state:1:initial"], repeatedTargetSetIds: ["set-a"], effectsWithoutTargetSetIds: [], limitPerKind: 5 },
    };
}
describe("database character K47 leader effect-target association scope", () => {
    it("fails closed unless the exact opt-in and five roots are supplied", async () => {
        await (0, assert_1.rejects)((0, leader_association_scope_run_1.runCharacterLeaderAssociationScopeAudit)({}), /explicit opt-in/);
        (0, assert_1.throws)(() => (0, leader_association_scope_run_1.parseCharacterLeaderAssociationScopeCli)([]), /exactly one --opt-in-k47/);
        (0, assert_1.throws)(() => (0, leader_association_scope_run_1.parseCharacterLeaderAssociationScopeCli)(["--opt-in-k47"]), /--sidecar-root/);
        (0, assert_1.throws)(() => (0, leader_association_scope_run_1.parseCharacterLeaderAssociationScopeCli)([
            "--opt-in-k47", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k43", "--k46-root", "k46", "--output-root", "o",
        ]), /unsupported argument/);
        (0, assert_1.deepStrictEqual)((0, leader_association_scope_run_1.parseCharacterLeaderAssociationScopeCli)([
            "--opt-in-k47", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k43", "--k46-root", "k46",
        ]), { optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "k43", k46Root: "k46" });
        const savedGc = global.gc;
        try {
            global.gc = undefined;
            await (0, assert_1.rejects)((0, leader_association_scope_run_1.runCharacterLeaderAssociationScopeAudit)({ optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "k43", k46Root: "k46" }), /--expose-gc/);
        }
        finally {
            global.gc = savedGc;
        }
    });
    it("reconstructs effect target sets in effect order and explains repeated flattened target refs", () => {
        const source = sources();
        const evaluation = (0, leader_association_scope_1.evaluateCharacterLeaderAssociationScope)(source.k46, source.k3);
        (0, assert_1.equal)(evaluation.states, 1);
        (0, assert_1.equal)(evaluation.effectAssociations, 3);
        (0, assert_1.equal)(evaluation.flattenedTargetReferences, 4);
        (0, assert_1.equal)(evaluation.uniqueTargetReferencesWithinState, 2);
        (0, assert_1.equal)(evaluation.repeatedFlattenedTargetReferences, 2);
        (0, assert_1.equal)(evaluation.repetitionsFromRepeatedTargetSetExpansion, 2);
        (0, assert_1.equal)(evaluation.flattenedTargetMismatchStates, 0);
        (0, assert_1.deepStrictEqual)(evaluation.samples.repeatedStateIds, ["card-state:1:initial"]);
        (0, assert_1.deepStrictEqual)(evaluation.samples.repeatedTargetSetIds, ["set-a"]);
        (0, assert_1.deepStrictEqual)(evaluation.samples.effectsWithoutTargetSetIds, ["e3"]);
    });
    it("rejects multiplicity-policy or source joins and records missing raw-row proof", () => {
        let source = sources();
        source.k46.policy.referencesDeduplicated = true;
        (0, assert_1.throws)(() => (0, leader_association_scope_1.evaluateCharacterLeaderAssociationScope)(source.k46, source.k3), /multiplicity boundary/);
        source = sources();
        source.k46.states[0].flattenedTargetRowIds = ["t2", "t1", "t1", "t2"];
        (0, assert_1.throws)(() => (0, leader_association_scope_1.evaluateCharacterLeaderAssociationScope)(source.k46, source.k3), /exact state join mismatch/);
        source = sources();
        source.k3.effects = source.k3.effects.filter(row => row.rowId !== "e1");
        const missing = (0, leader_association_scope_1.evaluateCharacterLeaderAssociationScope)(source.k46, source.k3);
        (0, assert_1.equal)(missing.missingEffectRows, 1);
        (0, assert_1.equal)(missing.flattenedTargetMismatchStates, 1);
    });
    it("compacts only raw structural join IDs and rejects ambiguous row identities", () => {
        const row = (table, rowId, targetSet) => ({
            provenance: { table, rowId, columns: ["sub_target_type_set_id", "name", "target_value"] },
            values: { sub_target_type_set_id: targetSet, name: "presentation must not survive", target_value: 999 },
        });
        const compact = (0, leader_association_scope_source_1.compactLeaderAssociationRawRows)([
            row("leader_skills", "e1", 9), row("sub_target_types", "t1", 9), row("cards", "ignored", 9),
        ]);
        (0, assert_1.deepStrictEqual)(compact, { effects: [{ rowId: "e1", targetSetId: "9" }], targets: [{ rowId: "t1", targetSetId: "9" }] });
        const encoded = JSON.stringify(compact);
        (0, assert_1.ok)(!encoded.includes("presentation"));
        (0, assert_1.ok)(!encoded.includes("target_value"));
        (0, assert_1.ok)(!encoded.includes("999"));
        (0, assert_1.throws)(() => (0, leader_association_scope_source_1.compactLeaderAssociationRawRows)([row("leader_skills", "e1", 9), row("leader_skills", "e1", 10)]), /duplicate leader_skills/);
        (0, assert_1.throws)(() => (0, leader_association_scope_source_1.compactLeaderAssociationRawRows)([row("sub_target_types", "t1", null)]), /missing target row set ID/);
    });
    it("pins the full structural proof and emits a deterministic bounded timestamp-free report", () => {
        const evaluation = pinnedEvaluation();
        (0, leader_association_scope_1.assertPinnedCharacterLeaderAssociationScope)(evaluation);
        (0, assert_1.throws)(() => (0, leader_association_scope_1.assertPinnedCharacterLeaderAssociationScope)({ ...evaluation, repeatedFlattenedTargetReferences: 12719 }), /repeated target references pin changed/);
        const first = (0, leader_association_scope_1.buildCharacterLeaderAssociationScopeReport)(k46Identity(), k3Identity(), evaluation);
        const second = (0, leader_association_scope_1.buildCharacterLeaderAssociationScopeReport)(k46Identity(), k3Identity(), evaluation);
        (0, assert_1.deepStrictEqual)(first, second);
        const encoded = `${JSON.stringify(first, null, 2)}\n`;
        (0, assert_1.ok)(Buffer.byteLength(encoded) < leader_association_scope_contract_1.CHARACTER_LEADER_ASSOCIATION_SCOPE_REPORT_LIMIT_BYTES);
        (0, assert_1.ok)(!encoded.includes("generatedAt"));
        (0, assert_1.ok)(!encoded.includes('"rawRows":'));
        (0, assert_1.ok)(!encoded.includes('"target_value":'));
        (0, assert_1.equal)(first.policy.repetitionsExplainedByRepeatedTargetSetExpansion, true);
        (0, assert_1.equal)(first.readiness.structuralAssociationScope, "NOT_EXECUTED");
        (0, assert_1.equal)(first.readiness.nextStructuralIdAssociationProjection, "NOT_EXECUTED");
        (0, assert_1.equal)(first.inputIntegrity.k46SourceBoundBefore, "NOT_EXECUTED");
        (0, assert_1.equal)(first.inputIntegrity.k3AssociationFingerprintStable, false);
        (0, assert_1.equal)(first.readiness.semanticAssociation, "NO-GO");
        (0, assert_1.equal)(first.readiness.productProjection, "NO-GO");
    });
    it("detects K3 association and K46 artifact fingerprint drift", () => {
        (0, leader_association_scope_source_1.assertLeaderAssociationK3Stable)(k3Identity(), k3Identity());
        (0, leader_association_scope_source_1.assertLeaderAssociationK46Stable)(k46Identity(), k46Identity());
        (0, assert_1.throws)(() => (0, leader_association_scope_source_1.assertLeaderAssociationK3Stable)(k3Identity(), { ...k3Identity(), associationInputFingerprintSha256: "f".repeat(64) }), /changed/);
        (0, assert_1.throws)(() => (0, leader_association_scope_source_1.assertLeaderAssociationK46Stable)(k46Identity(), { ...k46Identity(), stateFingerprintSha256: "f".repeat(64) }), /changed/);
    });
});
//# sourceMappingURL=leader-association-scope.spec.js.map