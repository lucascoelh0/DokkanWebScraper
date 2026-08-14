import { deepStrictEqual, equal, rejects, throws } from "assert";
import type { CharacterShadowInputs } from "./shadow-source";
import {
    assertCharacterStateProductScopeInputsUnchanged,
    evaluateCharacterStateProductScope,
    fingerprintCharacterStateProductScopeInputs,
} from "./state-product-scope";
import {
    parseCharacterStateProductScopeCli,
    runCharacterStateProductScopeAudit,
    serializeCharacterStateProductScopeReport,
} from "./state-product-scope-run";

function inputs(): CharacterShadowInputs {
    const state = (stateId: string, releaseState: "initial" | "eza" | "seza" | "unknown") => ({
        stateId, sourceStateKey: stateId, cardId: "1", releaseState, hardDuplicateGroupId: "1",
    });
    const comparison = (identity: "agreement" | "unjoinable") => ({
        identity,
        comparisonState: { stateKey: null, releaseState: null, availableAt: null, availableAtSnapshot: null, progressionStep: null, growthStepSource: null, selectionPolicy: "initial_state", comparable: false },
        agreementFields: [], representationGains: [], conflicts: [], unknownFields: [], externalFormIds: [],
    });
    return {
        k0: { cards: [{ cardId: "1", characterId: "1", recordKind: "collectable" }], states: [
            { stateId: "s1", cardId: "1", releaseState: "initial", evidenceStatus: "supported" },
            { stateId: "s2", cardId: "1", releaseState: "eza", evidenceStatus: "supported" },
            { stateId: "s3", cardId: "1", releaseState: "seza", evidenceStatus: "supported" },
            { stateId: "s4", cardId: "1", releaseState: "unknown", evidenceStatus: "unknown" },
        ] } as any,
        k1: {
            states: [state("s1", "initial"), state("s2", "eza"), state("s3", "seza"), state("s4", "unknown")],
            releaseStateTransitions: [
                { transitionId: "r1", sourceStateId: "s1", targetStateId: "s2", releaseState: "eza", evidenceStatus: "supported" },
                { transitionId: "r2", sourceStateId: "s2", targetStateId: "s3", releaseState: "seza", evidenceStatus: "supported" },
                { transitionId: "r3", sourceStateId: "s3", targetStateId: "s4", releaseState: "unknown", evidenceStatus: "unknown" },
                { transitionId: "r4", sourceStateId: "s1", targetStateId: "s2", releaseState: "eza", evidenceStatus: "partial" },
            ],
            awakeningTransitions: [
                { transitionId: "a1", kind: "z_awaken", sourceCardId: "1", targetCardId: "2", targetStatus: "supported" },
                { transitionId: "a2", kind: "dokkan_awaken", sourceCardId: "1", targetCardId: "3", targetStatus: "partial" },
                { transitionId: "a3", kind: "unknown", sourceCardId: "1", targetCardId: "4", targetStatus: "supported" },
            ],
            formTransitions: [
                { transitionId: "f1", kind: "transformation", channel: "passive", sourceCardId: "1", targetCardId: "2", sourceStateIds: ["s1"], stateBindingStatus: "supported" },
                { transitionId: "f2", kind: "giant_or_rage", channel: "active", sourceCardId: "1", targetCardId: "3", sourceStateIds: [], stateBindingStatus: "partial" },
                { transitionId: "f3", kind: "unknown", channel: "finish", sourceCardId: "1", targetCardId: "4", sourceStateIds: ["s1"], stateBindingStatus: "supported" },
            ],
        } as any,
        k2: { cards: [{ cardId: "1" }] } as any,
        k7: { cards: [
            { cardId: "1", recordKind: "collectable", production: comparison("agreement") },
            { cardId: "2", recordKind: "collectable", production: comparison("unjoinable") },
        ] } as any,
        sidecarIdentities: {
            k0: { sha256: "0".repeat(64), sizeBytes: 1 }, k1: { sha256: "1".repeat(64), sizeBytes: 2 },
            k2: { sha256: "2".repeat(64), sizeBytes: 3 }, k7: { sha256: "7".repeat(64), sizeBytes: 4 },
        },
        production: { characters: new Map([["1", {} as any]]), sha256: "p".repeat(64), sizeBytes: 5, topLevelCount: 1 },
        fyi: { characters: new Map([["1", {} as any]]), sha256: "f".repeat(64), sizeBytes: 6, topLevelCount: 1, generatedAt: "not-reported" },
    };
}

describe("database character K42 state product scope", () => {
    it("accepts only the exact opt-in and three explicit roots", async () => {
        await rejects(runCharacterStateProductScopeAudit({} as any), /explicit opt-in/);
        throws(() => parseCharacterStateProductScopeCli([]), /exactly one --opt-in-k42/);
        throws(() => parseCharacterStateProductScopeCli(["--opt-in-k42"]), /requires --sidecar-root/);
        throws(() => parseCharacterStateProductScopeCli(["--opt-in-k42", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--output", "x"]), /unsupported argument/);
        throws(() => parseCharacterStateProductScopeCli(["--opt-in-k42", "--opt-in-k42", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f"]), /exactly one --opt-in-k42/);
        deepStrictEqual(parseCharacterStateProductScopeCli(["--opt-in-k42", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f"]), {
            optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f",
        });
    });

    it("counts supported scope by release state, kind and channel", () => {
        const scope = evaluateCharacterStateProductScope(inputs());
        deepStrictEqual({ included: scope.states.included, excluded: scope.states.excluded }, { included: 3, excluded: 1 });
        deepStrictEqual({ included: scope.releaseTransitions.included, excluded: scope.releaseTransitions.excluded }, { included: 2, excluded: 2 });
        deepStrictEqual({ included: scope.awakeningTransitions.included, excluded: scope.awakeningTransitions.excluded }, { included: 1, excluded: 2 });
        deepStrictEqual({ included: scope.formTransitions.included, excluded: scope.formTransitions.excluded }, { included: 1, excluded: 2 });
        deepStrictEqual(scope.productionCoverage, { agreement: 1, unjoinable: 1, use: "coverage_only" });
        equal(scope.states.byReleaseState.eza.included, 1);
        equal(scope.releaseTransitions.byReleaseState.eza.excluded, 1);
        equal(scope.awakeningTransitions.byKind.unknown.included, 0);
        equal(scope.formTransitions.byChannel.passive.included, 1);
        equal(scope.formTransitions.byChannel.active.excluded, 1);
        const mismatch = inputs();
        mismatch.k0.states[1].evidenceStatus = "unknown";
        throws(() => evaluateCharacterStateProductScope(mismatch), /unsupported K0\/K1 state evidence combination/);
    });

    it("never includes unknown or partial evidence", () => {
        const scope = evaluateCharacterStateProductScope(inputs());
        equal(scope.states.byReleaseState.unknown.included, 0);
        equal(scope.releaseTransitions.byReleaseState.unknown.included, 0);
        equal(scope.awakeningTransitions.byKind.unknown.included, 0);
        equal(scope.formTransitions.byKind.unknown.included, 0);
        deepStrictEqual(scope.excludedStructuralIds, {
            stateIds: ["s4"], releaseTransitionIds: ["r3", "r4"], awakeningTransitionIds: ["a2", "a3"],
            formTransitionIds: ["f2", "f3"], limitPerScope: 5,
        });
    });

    it("detects structural reload drift even when byte identities are repeated", () => {
        const before = inputs();
        const after = inputs();
        equal(assertCharacterStateProductScopeInputsUnchanged(before, after), fingerprintCharacterStateProductScopeInputs(before));
        after.k1.states[0].releaseState = "unknown";
        throws(() => assertCharacterStateProductScopeInputsUnchanged(before, after), /structural source fingerprint changed/);
        const identityDrift = inputs();
        identityDrift.sidecarIdentities.k1.sha256 = "x".repeat(64);
        throws(() => assertCharacterStateProductScopeInputsUnchanged(before, identityDrift), /source identity changed/);
    });

    it("is deterministic, bounded, timestamp-free and does not expose source text", () => {
        const source = inputs();
        for (let index = 0; index < 8; index++) {
            source.k1.states.push({
                stateId: `unknown-${index}`, sourceStateKey: `private-text-${index}`, cardId: "1", releaseState: "unknown", hardDuplicateGroupId: "1",
            });
            source.k0.states.push({
                stateId: `unknown-${index}`, cardId: "1", releaseState: "unknown", evidenceStatus: "unknown",
            } as any);
        }
        const before = JSON.stringify(source);
        const first = evaluateCharacterStateProductScope(source);
        const second = evaluateCharacterStateProductScope(source);
        deepStrictEqual(first, second);
        equal(first.excludedStructuralIds.stateIds.length, 5);
        equal(JSON.stringify(source), before);
        const bytes = JSON.stringify(first);
        equal(bytes.includes("private-text"), false);
        equal(bytes.includes("generatedAt"), false);
        const serialized = serializeCharacterStateProductScopeReport({ scope: first } as any);
        equal(Buffer.byteLength(serialized) < 64 * 1024, true);
    });
});
