"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseCharacterProgressionDataset = void 0;
function validateDatabaseCharacterProgressionDataset(dataset, coverage) {
    const failures = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-database-characters-progression" || dataset.contractVersion !== "1.0.0")
        failures.push("contract identity");
    if (!dataset.policy.playerStatsNeverUsedAsEnemyStats || dataset.policy.combatCalculationImplemented || dataset.policy.potentialSemanticsPromoted || dataset.policy.equipmentLimitationSemanticsPromoted || !dataset.policy.saAndLeaderMechanicsOwnedByK3)
        failures.push("policy boundary");
    if (coverage.cardCount !== 5759 || coverage.stateCount !== 10654 || coverage.ezaStateCount !== 4855 || coverage.sezaStateCount !== 37 || coverage.unknownStateCount !== 3)
        failures.push("DB1 cardinality");
    if (coverage.missingAwakeningSetCount || coverage.missingAwakeningItemCount || coverage.missingCardGrowthProfileCount || coverage.missingOptimalAwakeningGrowthProfileCount || coverage.missingExperienceProfileCount || coverage.missingPotentialBoardCount || coverage.potentialBoardWithoutSquaresCount || coverage.danglingPotentialSquareRelationCount || coverage.danglingPotentialSquareEventCount || coverage.danglingPotentialSquareConditionSetCount || coverage.danglingPotentialConditionRelationCount || coverage.danglingEquipmentSkillItemCount || coverage.danglingEquipmentPotentialSkillCount || coverage.danglingPotentialSkillLevelCount || coverage.missingEquipmentLimitationSetCount || coverage.orphanEquipmentLimitationSetCount || coverage.duplicateRawRowIdentityCount || coverage.duplicateCardIdentityCount)
        failures.push("dangling or duplicate structural identity");
    if (dataset.cards.some(card => card.statDomains.enemyRuntime !== "not_in_contract" || card.statDomains.displayed !== "unknown" || card.statDomains.calculatedCombat !== "not_projected" || card.states.some(state => state.statOverride !== "unknown_not_present_in_source_contract")))
        failures.push("stat domain leakage");
    const rawKeys = new Set(dataset.rawRows.map(row => `${row.provenance.table}:${row.provenance.rowId}`));
    const refs = [];
    for (const card of dataset.cards) {
        refs.push(...card.growthProfile.cardGrowthRows, ...card.growthProfile.optimalAwakeningGrowthRows, ...card.experienceProfile.rows, ...card.potential.squareRows, ...(card.potential.board ? [card.potential.board] : []));
        for (const state of card.states)
            if (state.growthStep)
                refs.push(state.growthStep);
        for (const route of card.awakeningRequirements) {
            refs.push(route.route, ...(route.set ? [route.set] : []));
            for (const requirement of route.requirements)
                refs.push(requirement.row, ...(requirement.item ? [requirement.item] : []));
        }
    }
    for (const orb of dataset.equipmentSkillOrbs)
        refs.push(orb.row, ...orb.limitationRows, ...orb.skillRows);
    if (refs.some(value => !rawKeys.has(`${value.table}:${value.rowId}`)))
        failures.push("unbacked raw reference");
    return { schemaVersion: 1, valid: failures.length === 0, failures };
}
exports.validateDatabaseCharacterProgressionDataset = validateDatabaseCharacterProgressionDataset;
//# sourceMappingURL=progression-validator.js.map