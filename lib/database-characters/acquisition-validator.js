"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseCharacterAcquisitionDataset = void 0;
const acquisition_builder_1 = require("./acquisition-builder");
function validateDatabaseCharacterAcquisitionDataset(dataset, coverage) {
    const failures = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-database-characters-acquisition" || dataset.contractVersion !== "1.0.0")
        failures.push("contract identity");
    if (!dataset.policy.schedulesExcluded || dataset.policy.textUsedForF2pClassification || !dataset.policy.stageDropDoesNotProveF2p || !dataset.policy.derivedTrainingNeverFirstParty || !dataset.policy.summonDataAbsent)
        failures.push("policy boundary");
    const recomputed = (0, acquisition_builder_1.buildDatabaseCharacterAcquisitionCoverage)(dataset);
    if (JSON.stringify(coverage) !== JSON.stringify(recomputed))
        failures.push("coverage mismatch");
    if (coverage.cardCount !== 5759 || coverage.assertedF2pCount || coverage.assertedSummonableCount || coverage.unmarkedDerivedTrainingCandidateCount || coverage.missingQuestJoinCount || coverage.duplicateDropIdentityCount || coverage.duplicateRawRowIdentityCount || coverage.duplicateCardIdentityCount)
        failures.push("cardinality, provenance or join");
    const rawKeys = new Set(dataset.rawRows.map(row => `${row.provenance.table}:${row.provenance.rowId}`)), cardIds = new Set(dataset.cards.map(card => card.cardId));
    for (const card of dataset.cards) {
        if (card.f2p.classification !== "unknown" || card.summonability !== "unknown_no_first_party_relation_in_snapshot" || card.trainingPartnerCandidates.some(candidate => candidate.evidence !== "derived_same_card_unique_info_id" || !cardIds.has(candidate.cardId) || candidate.cardId === card.cardId))
            failures.push(`classification/derived candidate ${card.cardId}`);
        if (card.f2p.evidence.length !== card.stageDrops.length)
            failures.push(`drop evidence ${card.cardId}`);
        if (card.reversibleExchangePartners.some(partner => !cardIds.has(partner.targetCardId) || !partner.source.table || !partner.source.rowId || partner.source.columns.length === 0))
            failures.push(`exchange provenance ${card.cardId}`);
    }
    const refs = [...dataset.cards.flatMap(card => [...card.collectionEntries, ...card.stageDrops.flatMap(drop => [drop.source, ...(drop.quest ? [drop.quest] : [])])]), ...dataset.unjoinedCardDropReferences.flatMap(drop => [drop.source, ...(drop.quest ? [drop.quest] : [])])];
    if (refs.some(value => !rawKeys.has(`${value.table}:${value.rowId}`)))
        failures.push("unbacked raw reference");
    if (dataset.unjoinedCardDropReferences.some(drop => cardIds.has(drop.cardId)))
        failures.push("misclassified unjoined drop");
    if (dataset.rawRows.some(row => ["start_at", "end_at", "open_at", "close_at"].some(field => Object.prototype.hasOwnProperty.call(row.values, field))))
        failures.push("schedule field leaked");
    return { schemaVersion: 1, valid: failures.length === 0, failures: [...new Set(failures)] };
}
exports.validateDatabaseCharacterAcquisitionDataset = validateDatabaseCharacterAcquisitionDataset;
//# sourceMappingURL=acquisition-validator.js.map