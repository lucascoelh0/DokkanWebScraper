import { createHash } from "crypto";
import type { CharacterShadowInputs } from "./shadow-source";
import {
    CHARACTER_STATE_PRODUCT_SCOPE_PIN,
    CHARACTER_STATE_PRODUCT_SCOPE_SAMPLE_LIMIT,
    CharacterStateProductScopeEvaluation,
    CharacterStateProductScopeSelectionCount,
} from "./state-product-scope-contract";
import type { CharacterAwakeningKind, CharacterFormKind } from "./state-graph-contract";

const selection = (): CharacterStateProductScopeSelectionCount => ({ included: 0, excluded: 0 });
const structuralIdOrder = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

function accept(
    total: CharacterStateProductScopeSelectionCount,
    grouped: CharacterStateProductScopeSelectionCount,
    included: boolean,
): void {
    const key: keyof CharacterStateProductScopeSelectionCount = included ? "included" : "excluded";
    total[key]++;
    grouped[key]++;
}

function increment(count: CharacterStateProductScopeSelectionCount, included: boolean): void {
    const key: keyof CharacterStateProductScopeSelectionCount = included ? "included" : "excluded";
    count[key]++;
}

function unique(values: readonly string[], label: string): void {
    if (new Set(values).size !== values.length) throw new Error(`K42 duplicate ${label}`);
}

function limited(values: string[]): string[] {
    return values.sort(structuralIdOrder).slice(0, CHARACTER_STATE_PRODUCT_SCOPE_SAMPLE_LIMIT);
}

/**
 * Computes only the supported structural scope. It never reads presentation
 * fields, returns Character[], or selects an effective product value.
 */
export function evaluateCharacterStateProductScope(inputs: CharacterShadowInputs): CharacterStateProductScopeEvaluation {
    const graph = inputs?.k1;
    if (!graph || !Array.isArray(graph.states) || !Array.isArray(graph.releaseStateTransitions)
        || !Array.isArray(graph.awakeningTransitions) || !Array.isArray(graph.formTransitions)) {
        throw new Error("K42 malformed K1 state graph");
    }
    if (!inputs.k7 || !Array.isArray(inputs.k7.cards)) throw new Error("K42 malformed K7 coverage");

    unique(graph.states.map(item => item.stateId), "state identity");
    unique(graph.releaseStateTransitions.map(item => item.transitionId), "release transition identity");
    unique(graph.awakeningTransitions.map(item => item.transitionId), "awakening transition identity");
    unique(graph.formTransitions.map(item => item.transitionId), "form transition identity");
    unique(inputs.k7.cards.map(item => item.cardId), "K7 card identity");
    if (!Array.isArray(inputs.k0?.states) || inputs.k0.states.length !== graph.states.length) {
        throw new Error("K42 K0/K1 state cardinality mismatch");
    }
    const k0States = new Map(inputs.k0.states.map(item => [item.stateId, item]));
    if (k0States.size !== inputs.k0.states.length) throw new Error("K42 duplicate K0 state identity");

    const states = {
        ...selection(),
        byReleaseState: { initial: selection(), eza: selection(), seza: selection(), unknown: selection() },
    };
    const releaseTransitions = {
        ...selection(),
        byReleaseState: { eza: selection(), seza: selection(), unknown: selection() },
    };
    const awakeningTransitions = {
        ...selection(),
        byKind: {
            z_awaken: selection(), dokkan_awaken: selection(), eza: selection(), seza: selection(), unknown: selection(),
        } as Record<CharacterAwakeningKind, CharacterStateProductScopeSelectionCount>,
    };
    const formTransitions = {
        ...selection(),
        byKind: {
            transformation: selection(), giant_or_rage: selection(), reversible_exchange: selection(), unknown: selection(),
        } as Record<CharacterFormKind, CharacterStateProductScopeSelectionCount>,
        byChannel: { passive: selection(), active: selection(), standby: selection(), finish: selection() },
    };
    const excludedStateIds: string[] = [];
    const excludedReleaseIds: string[] = [];
    const excludedAwakeningIds: string[] = [];
    const excludedFormIds: string[] = [];

    for (const state of graph.states) {
        const k0State = k0States.get(state.stateId);
        if (!k0State || k0State.cardId !== state.cardId || k0State.releaseState !== state.releaseState) {
            throw new Error(`K42 K0/K1 state identity mismatch ${state.stateId}`);
        }
        const included = k0State.evidenceStatus === "supported"
            && (state.releaseState === "initial" || state.releaseState === "eza" || state.releaseState === "seza");
        if (!included && (k0State.evidenceStatus !== "unknown" || state.releaseState !== "unknown")) {
            throw new Error(`K42 unsupported K0/K1 state evidence combination ${state.stateId}`);
        }
        accept(states, states.byReleaseState[state.releaseState], included);
        if (!included) excludedStateIds.push(state.stateId);
    }
    for (const transition of graph.releaseStateTransitions) {
        const included = transition.evidenceStatus === "supported"
            && (transition.releaseState === "eza" || transition.releaseState === "seza");
        accept(releaseTransitions, releaseTransitions.byReleaseState[transition.releaseState], included);
        if (!included) excludedReleaseIds.push(transition.transitionId);
    }
    for (const transition of graph.awakeningTransitions) {
        const included = transition.targetStatus === "supported" && transition.kind !== "unknown";
        accept(awakeningTransitions, awakeningTransitions.byKind[transition.kind], included);
        if (!included) excludedAwakeningIds.push(transition.transitionId);
    }
    for (const transition of graph.formTransitions) {
        const included = transition.stateBindingStatus === "supported" && transition.kind !== "unknown";
        accept(formTransitions, formTransitions.byKind[transition.kind], included);
        increment(formTransitions.byChannel[transition.channel], included);
        if (!included) excludedFormIds.push(transition.transitionId);
    }

    let agreement = 0;
    let unjoinable = 0;
    for (const card of inputs.k7.cards) {
        if (card.production.identity === "agreement") agreement++;
        else if (card.production.identity === "unjoinable") unjoinable++;
        else throw new Error(`K42 unsupported K7 production identity ${card.cardId}`);
    }

    return {
        states,
        releaseTransitions,
        awakeningTransitions,
        formTransitions,
        productionCoverage: { agreement, unjoinable, use: "coverage_only" },
        excludedStructuralIds: {
            stateIds: limited(excludedStateIds),
            releaseTransitionIds: limited(excludedReleaseIds),
            awakeningTransitionIds: limited(excludedAwakeningIds),
            formTransitionIds: limited(excludedFormIds),
            limitPerScope: CHARACTER_STATE_PRODUCT_SCOPE_SAMPLE_LIMIT,
        },
    };
}

export const evaluateStateProductScope = evaluateCharacterStateProductScope;

export function assertCharacterStateProductScopePins(scope: CharacterStateProductScopeEvaluation): void {
    const comparisons: Array<[string, CharacterStateProductScopeSelectionCount, CharacterStateProductScopeSelectionCount]> = [
        ["states", scope.states, CHARACTER_STATE_PRODUCT_SCOPE_PIN.states],
        ["release transitions", scope.releaseTransitions, CHARACTER_STATE_PRODUCT_SCOPE_PIN.releaseTransitions],
        ["awakening transitions", scope.awakeningTransitions, CHARACTER_STATE_PRODUCT_SCOPE_PIN.awakeningTransitions],
        ["form transitions", scope.formTransitions, CHARACTER_STATE_PRODUCT_SCOPE_PIN.formTransitions],
    ];
    for (const [label, actual, expected] of comparisons) {
        if (actual.included !== expected.included || actual.excluded !== expected.excluded) {
            throw new Error(`K42 ${label} pin changed`);
        }
    }
    if (scope.productionCoverage.agreement !== CHARACTER_STATE_PRODUCT_SCOPE_PIN.productionCoverage.agreement
        || scope.productionCoverage.unjoinable !== CHARACTER_STATE_PRODUCT_SCOPE_PIN.productionCoverage.unjoinable) {
        throw new Error("K42 K7 production coverage pin changed");
    }
}

function structuralFingerprintValue(inputs: CharacterShadowInputs): unknown {
    const sortedKeys = (values: Iterable<string>) => [...values].sort(structuralIdOrder);
    return {
        identities: inputs.sidecarIdentities,
        production: { sha256: inputs.production.sha256, sizeBytes: inputs.production.sizeBytes, ids: sortedKeys(inputs.production.characters.keys()) },
        fyi: { sha256: inputs.fyi.sha256, sizeBytes: inputs.fyi.sizeBytes, ids: sortedKeys(inputs.fyi.characters.keys()) },
        k0: {
            cards: inputs.k0.cards.map(item => [item.cardId, item.characterId, item.recordKind]),
            states: inputs.k0.states.map(item => [item.stateId, item.cardId, item.releaseState, item.evidenceStatus]),
        },
        k1: {
            states: inputs.k1.states.map(item => [item.stateId, item.cardId, item.releaseState]),
            releaseTransitions: inputs.k1.releaseStateTransitions.map(item => [item.transitionId, item.sourceStateId, item.targetStateId, item.releaseState, item.evidenceStatus]),
            awakeningTransitions: inputs.k1.awakeningTransitions.map(item => [item.transitionId, item.kind, item.sourceCardId, item.targetCardId, item.sourceStateId ?? null, item.targetStateId ?? null, item.targetStatus]),
            formTransitions: inputs.k1.formTransitions.map(item => [item.transitionId, item.kind, item.channel, item.sourceCardId, item.targetCardId, item.sourceStateIds, item.stateBindingStatus]),
        },
        k2CardIds: inputs.k2.cards.map(item => item.cardId),
        k7Production: inputs.k7.cards.map(item => [item.cardId, item.recordKind, item.production.identity]),
    };
}

export function fingerprintCharacterStateProductScopeInputs(inputs: CharacterShadowInputs): string {
    return createHash("sha256").update(JSON.stringify(structuralFingerprintValue(inputs)), "utf8").digest("hex");
}

export function assertCharacterStateProductScopeInputsUnchanged(
    before: CharacterShadowInputs,
    after: CharacterShadowInputs,
): string {
    if (JSON.stringify(before.sidecarIdentities) !== JSON.stringify(after.sidecarIdentities)
        || before.production.sha256 !== after.production.sha256 || before.production.sizeBytes !== after.production.sizeBytes
        || before.fyi.sha256 !== after.fyi.sha256 || before.fyi.sizeBytes !== after.fyi.sizeBytes) {
        throw new Error("K42 source identity changed after evaluation");
    }
    const beforeFingerprint = fingerprintCharacterStateProductScopeInputs(before);
    const afterFingerprint = fingerprintCharacterStateProductScopeInputs(after);
    if (beforeFingerprint !== afterFingerprint) throw new Error("K42 structural source fingerprint changed after evaluation");
    return beforeFingerprint;
}
