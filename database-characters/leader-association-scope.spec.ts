import { deepStrictEqual, equal, ok, rejects, throws } from "assert";
import type { SourcedRow } from "../database-experiment/contract";
import {
    CHARACTER_LEADER_ASSOCIATION_SCOPE_PIN,
    CHARACTER_LEADER_ASSOCIATION_SCOPE_REPORT_LIMIT_BYTES,
    CharacterLeaderAssociationK3Identity,
    CharacterLeaderAssociationK3Source,
    CharacterLeaderAssociationK46Identity,
    CharacterLeaderAssociationK46Source,
    CharacterLeaderAssociationScopeEvaluation,
} from "./leader-association-scope-contract";
import {
    assertLeaderAssociationK3Stable,
    assertLeaderAssociationK46Stable,
    compactLeaderAssociationRawRows,
} from "./leader-association-scope-source";
import {
    assertPinnedCharacterLeaderAssociationScope,
    buildCharacterLeaderAssociationScopeReport,
    evaluateCharacterLeaderAssociationScope,
} from "./leader-association-scope";
import {
    parseCharacterLeaderAssociationScopeCli,
    runCharacterLeaderAssociationScopeAudit,
} from "./leader-association-scope-run";
import { CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS } from "./leader-scope-contract";

function k3Identity(): CharacterLeaderAssociationK3Identity {
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
function k46Identity(): CharacterLeaderAssociationK46Identity {
    return {
        manifestSha256: "8".repeat(64), payloadSha256: "9".repeat(64), rawSha256: "a".repeat(64), stateFingerprintSha256: "b".repeat(64),
        k43: {
            manifestSha256: "c".repeat(64), payloadSha256: "d".repeat(64), rawSha256: "e".repeat(64),
            k42SourceFingerprintSha256: "f".repeat(64), stateFingerprintSha256: "0".repeat(64),
        },
        k3: baseK3Identity(),
    };
}
function sources(): { k46: CharacterLeaderAssociationK46Source; k3: CharacterLeaderAssociationK3Source } {
    const state = {
        stateId: "card-state:1:initial", sourceStateKey: "source:1", cardId: "1", releaseState: "initial" as const,
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
            states: [{ ...state, effectRowIds: [...state.effectRowIds], flattenedTargetRowIds: [...state.flattenedTargetRowIds] }, ...CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS.map((stateId, index) => ({
                stateId, sourceStateKey: `unknown:${index}`, cardId: "1010900", releaseState: "unknown" as const,
                effectRowIds: [], flattenedTargetRowIds: [],
            }))],
            effects: [{ rowId: "e1", targetSetId: "set-a" }, { rowId: "e2", targetSetId: "set-a" }, { rowId: "e3", targetSetId: null }],
            targets: [{ rowId: "t1", targetSetId: "set-a" }, { rowId: "t2", targetSetId: "set-a" }],
        },
    };
}
function pinnedEvaluation(): CharacterLeaderAssociationScopeEvaluation {
    return {
        ...CHARACTER_LEADER_ASSOCIATION_SCOPE_PIN,
        samples: { repeatedStateIds: ["card-state:1:initial"], repeatedTargetSetIds: ["set-a"], effectsWithoutTargetSetIds: [], limitPerKind: 5 },
    };
}

describe("database character K47 leader effect-target association scope", () => {
    it("fails closed unless the exact opt-in and five roots are supplied", async () => {
        await rejects(runCharacterLeaderAssociationScopeAudit({} as any), /explicit opt-in/);
        throws(() => parseCharacterLeaderAssociationScopeCli([]), /exactly one --opt-in-k47/);
        throws(() => parseCharacterLeaderAssociationScopeCli(["--opt-in-k47"]), /--sidecar-root/);
        throws(() => parseCharacterLeaderAssociationScopeCli([
            "--opt-in-k47", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k43", "--k46-root", "k46", "--output-root", "o",
        ]), /unsupported argument/);
        deepStrictEqual(parseCharacterLeaderAssociationScopeCli([
            "--opt-in-k47", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k43", "--k46-root", "k46",
        ]), { optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "k43", k46Root: "k46" });
        const savedGc = (global as any).gc;
        try {
            (global as any).gc = undefined;
            await rejects(runCharacterLeaderAssociationScopeAudit({ optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "k43", k46Root: "k46" }), /--expose-gc/);
        } finally { (global as any).gc = savedGc; }
    });

    it("reconstructs effect target sets in effect order and explains repeated flattened target refs", () => {
        const source = sources();
        const evaluation = evaluateCharacterLeaderAssociationScope(source.k46, source.k3);
        equal(evaluation.states, 1); equal(evaluation.effectAssociations, 3); equal(evaluation.flattenedTargetReferences, 4);
        equal(evaluation.uniqueTargetReferencesWithinState, 2); equal(evaluation.repeatedFlattenedTargetReferences, 2);
        equal(evaluation.repetitionsFromRepeatedTargetSetExpansion, 2); equal(evaluation.flattenedTargetMismatchStates, 0);
        deepStrictEqual(evaluation.samples.repeatedStateIds, ["card-state:1:initial"]);
        deepStrictEqual(evaluation.samples.repeatedTargetSetIds, ["set-a"]);
        deepStrictEqual(evaluation.samples.effectsWithoutTargetSetIds, ["e3"]);
    });

    it("rejects multiplicity-policy or source joins and records missing raw-row proof", () => {
        let source = sources();
        source.k46.policy.referencesDeduplicated = true as any;
        throws(() => evaluateCharacterLeaderAssociationScope(source.k46, source.k3), /multiplicity boundary/);
        source = sources(); source.k46.states[0].flattenedTargetRowIds = ["t2", "t1", "t1", "t2"];
        throws(() => evaluateCharacterLeaderAssociationScope(source.k46, source.k3), /exact state join mismatch/);
        source = sources(); source.k3.effects = source.k3.effects.filter(row => row.rowId !== "e1");
        const missing = evaluateCharacterLeaderAssociationScope(source.k46, source.k3);
        equal(missing.missingEffectRows, 1); equal(missing.flattenedTargetMismatchStates, 1);
    });

    it("compacts only raw structural join IDs and rejects ambiguous row identities", () => {
        const row = (table: string, rowId: string, targetSet: number | null): SourcedRow => ({
            provenance: { table, rowId, columns: ["sub_target_type_set_id", "name", "target_value"] },
            values: { sub_target_type_set_id: targetSet, name: "presentation must not survive", target_value: 999 },
        });
        const compact = compactLeaderAssociationRawRows([
            row("leader_skills", "e1", 9), row("sub_target_types", "t1", 9), row("cards", "ignored", 9),
        ]);
        deepStrictEqual(compact, { effects: [{ rowId: "e1", targetSetId: "9" }], targets: [{ rowId: "t1", targetSetId: "9" }] });
        const encoded = JSON.stringify(compact);
        ok(!encoded.includes("presentation")); ok(!encoded.includes("target_value")); ok(!encoded.includes("999"));
        throws(() => compactLeaderAssociationRawRows([row("leader_skills", "e1", 9), row("leader_skills", "e1", 10)]), /duplicate leader_skills/);
        throws(() => compactLeaderAssociationRawRows([row("sub_target_types", "t1", null)]), /missing target row set ID/);
    });

    it("pins the full structural proof and emits a deterministic bounded timestamp-free report", () => {
        const evaluation = pinnedEvaluation();
        assertPinnedCharacterLeaderAssociationScope(evaluation);
        throws(() => assertPinnedCharacterLeaderAssociationScope({ ...evaluation, repeatedFlattenedTargetReferences: 12_719 }), /repeated target references pin changed/);
        const first = buildCharacterLeaderAssociationScopeReport(k46Identity(), k3Identity(), evaluation);
        const second = buildCharacterLeaderAssociationScopeReport(k46Identity(), k3Identity(), evaluation);
        deepStrictEqual(first, second);
        const encoded = `${JSON.stringify(first, null, 2)}\n`;
        ok(Buffer.byteLength(encoded) < CHARACTER_LEADER_ASSOCIATION_SCOPE_REPORT_LIMIT_BYTES);
        ok(!encoded.includes("generatedAt")); ok(!encoded.includes('"rawRows":')); ok(!encoded.includes('"target_value":'));
        equal(first.policy.repetitionsExplainedByRepeatedTargetSetExpansion, true);
        equal(first.readiness.structuralAssociationScope, "NOT_EXECUTED"); equal(first.readiness.nextStructuralIdAssociationProjection, "NOT_EXECUTED");
        equal(first.inputIntegrity.k46SourceBoundBefore, "NOT_EXECUTED"); equal(first.inputIntegrity.k3AssociationFingerprintStable, false);
        equal(first.readiness.semanticAssociation, "NO-GO"); equal(first.readiness.productProjection, "NO-GO");
    });

    it("detects K3 association and K46 artifact fingerprint drift", () => {
        assertLeaderAssociationK3Stable(k3Identity(), k3Identity()); assertLeaderAssociationK46Stable(k46Identity(), k46Identity());
        throws(() => assertLeaderAssociationK3Stable(k3Identity(), { ...k3Identity(), associationInputFingerprintSha256: "f".repeat(64) }), /changed/);
        throws(() => assertLeaderAssociationK46Stable(k46Identity(), { ...k46Identity(), stateFingerprintSha256: "f".repeat(64) }), /changed/);
    });
});
