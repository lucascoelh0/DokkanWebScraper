import { DatabaseCharacterIdentityCoverage, DatabaseCharacterIdentityDataset, DatabaseCharacterIdentityValidation } from "./identity-contract";

export function validateDatabaseCharacterIdentityDataset(
    dataset: DatabaseCharacterIdentityDataset,
    coverage: DatabaseCharacterIdentityCoverage,
): DatabaseCharacterIdentityValidation {
    const failures: string[] = [];
    if (dataset.schemaVersion !== 1 || dataset.contractVersion !== "1.0.0") failures.push("unsupported identity contract");
    if (dataset.identityPolicy.presentationTextAsJoinKey !== false) failures.push("presentation text cannot be a join key");
    if (coverage.cardCount !== dataset.cards.length || coverage.stateCount !== dataset.states.length) failures.push("coverage counts differ from payload");
    if (coverage.cardCount !== 5_759) failures.push(`expected 5759 DB1 cards, got ${coverage.cardCount}`);
    if (coverage.collectableCardCount !== 5_344 || coverage.formCardCount !== 415) failures.push("DB1 collectable/form reconstruction changed");
    if (coverage.stateCount !== 10_654) failures.push(`expected 10654 DB1 states, got ${coverage.stateCount}`);
    if (coverage.releaseStateCounts.initial !== 5_759 || coverage.releaseStateCounts.eza !== 4_855
        || coverage.releaseStateCounts.seza !== 37 || coverage.releaseStateCounts.unknown !== 3) failures.push("DB1 release-state reconstruction changed");
    if (coverage.projectedPrimaryCardCount !== 1_424) failures.push("projected primary reconstruction changed");
    if (coverage.duplicateCardIdentityCount !== 0 || coverage.duplicateStateIdentityCount !== 0) failures.push("duplicate structural identity");
    const knownCards = new Set(dataset.cards.map(card => card.cardId));
    const knownCharacters = new Set(dataset.characters.map(character => character.characterId));
    for (const card of dataset.cards) {
        if (card.source.rowId !== card.cardId) failures.push(`card ${card.cardId} does not reconstruct its source row`);
        if (!knownCharacters.has(card.characterId)) failures.push(`card ${card.cardId} has dangling character ${card.characterId}`);
    }
    for (const state of dataset.states) if (!knownCards.has(state.cardId) || state.formId !== state.cardId) failures.push(`state ${state.stateId} has invalid card/form identity`);
    for (const relation of dataset.relations) {
        if (relation.rowCount !== relation.assignments.length) failures.push(`relation ${relation.relation} assignment count mismatch`);
        if (relation.assignments.some(item => !item.assignmentId || !item.source.table || !item.source.rowId || item.source.columns.length === 0)) failures.push(`relation ${relation.relation} lost provenance`);
        if (relation.status === "supported" && relation.assignments.some(item => item.status !== "supported")) failures.push(`relation ${relation.relation} is fail-open`);
    }
    return {
        schemaVersion: 1,
        valid: failures.length === 0,
        cardCount: dataset.cards.length,
        stateCount: dataset.states.length,
        losslessSourceIdentityCount: dataset.cards.filter(card => card.source.rowId === card.cardId).length,
        failures,
    };
}
