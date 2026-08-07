import { DatabaseCharacterStateGraphCoverage, DatabaseCharacterStateGraphDataset, DatabaseCharacterStateGraphValidation } from "./state-graph-contract";

export function validateDatabaseCharacterStateGraphDataset(dataset: DatabaseCharacterStateGraphDataset, coverage: DatabaseCharacterStateGraphCoverage): DatabaseCharacterStateGraphValidation {
    const failures: string[] = [];
    if (dataset.policy.numericIdProximityInference !== false) failures.push("numeric ID inference is forbidden");
    if (coverage.stateCount !== 10_654) failures.push("state reconstruction changed");
    if (coverage.releaseStateTransitionCounts.eza !== 4_855 || coverage.releaseStateTransitionCounts.seza !== 37 || coverage.releaseStateTransitionCounts.unknown !== 3) failures.push("release-state progression changed");
    const expectedAwakenings = { z_awaken: 1487, dokkan_awaken: 1244, eza: 4142, seza: 34, unknown: 0 };
    for (const [kind, count] of Object.entries(expectedAwakenings)) if (coverage.awakeningTransitionCounts[kind as keyof typeof expectedAwakenings] !== count) failures.push(`${kind} route count changed`);
    if (coverage.formTransitionCounts.transformation !== 359 || coverage.formTransitionCounts.giant_or_rage !== 139 || coverage.formTransitionCounts.reversible_exchange !== 60 || coverage.formTransitionCounts.unknown !== 0) failures.push("form relation counts changed");
    if (coverage.formChannelCounts.passive !== 374 || coverage.formChannelCounts.active !== 140 || coverage.formChannelCounts.standby !== 28 || coverage.formChannelCounts.finish !== 16) failures.push("form channel counts changed");
    if (coverage.duplicateTransitionIdentityCount !== 0) failures.push("duplicate transition identity");
    if (coverage.duplicateStateIdentityCount !== 0) failures.push("duplicate state identity");
    if (JSON.stringify(coverage.danglingAwakeningTargetIds) !== JSON.stringify(["1010611", "1010621"])) failures.push("awakening target frontier changed");
    if (dataset.awakeningTransitions.some(item => item.kind === "z_awaken" && item.cardIdentityPolicy !== "collapse_z_awakened_ui_duplicate")) failures.push("Z-Awakening UI policy changed");
    if (dataset.awakeningTransitions.some(item => item.kind === "dokkan_awaken" && item.cardIdentityPolicy !== "preserve_distinct_card_identity")) failures.push("Dokkan Awakening card identity was collapsed");
    const knownStateIds = new Set(dataset.states.map(item => item.stateId));
    if (dataset.releaseStateTransitions.some(item => !knownStateIds.has(item.sourceStateId) || !knownStateIds.has(item.targetStateId) || !item.targetStateId.endsWith(`growth:${item.growthRowId}`))) failures.push("release-state endpoint binding is invalid");
    const releaseByTargetState = new Map(dataset.releaseStateTransitions.map(item => [item.targetStateId, item]));
    if (dataset.awakeningTransitions.some(item => {
        if (item.kind !== "eza" && item.kind !== "seza") return false;
        const step = Number(item.route.optimalAwakeningStep);
        const candidates = dataset.states.filter(state => state.cardId === item.sourceCardId && state.growthStep === step && state.releaseState === item.kind);
        const release = item.targetStateId ? releaseByTargetState.get(item.targetStateId) : undefined;
        return item.sourceCardId !== item.targetCardId || !item.sourceStateId || !item.targetStateId
            || !knownStateIds.has(item.sourceStateId) || candidates.length !== 1 || candidates[0].stateId !== item.targetStateId
            || !release || !release.routeRowIds.includes(item.route.rowId);
    })) failures.push("optimal route exact growth binding is invalid");
    return { schemaVersion: 1, valid: failures.length === 0, stateCount: dataset.states.length, transitionCount: dataset.releaseStateTransitions.length + dataset.awakeningTransitions.length + dataset.formTransitions.length, failures };
}
