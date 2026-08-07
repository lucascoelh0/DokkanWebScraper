"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseCharacterParityDataset = void 0;
const parity_builder_1 = require("./parity-builder");
const parity_contract_1 = require("./parity-contract");
function validateDatabaseCharacterParityDataset(dataset, coverage) {
    const failures = [];
    const recomputed = (0, parity_builder_1.buildDatabaseCharacterParityCoverage)(dataset);
    if (JSON.stringify(coverage) !== JSON.stringify(recomputed))
        failures.push("coverage mismatch");
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-database-characters-shadow-parity" || dataset.contractVersion !== "1.1.0")
        failures.push("contract identity");
    if (!dataset.policy.structuralIdsOnly || dataset.policy.textJoin || dataset.policy.productionModified || dataset.policy.externalParserAuthoritative || !dataset.policy.incomparableDomainsBecomeUnknown)
        failures.push("policy");
    if (coverage.cardCount !== 5759 || coverage.productionJoinedCount + coverage.productionUnjoinableCount !== coverage.cardCount || coverage.fyiJoinedCount + coverage.fyiUnjoinableCount !== coverage.cardCount || coverage.duplicateCardIdentityCount)
        failures.push("cardinality");
    const actualAuditIds = dataset.historicalAudits.map(item => item.issue).sort();
    const expectedAuditIds = [...parity_contract_1.CHARACTER_PARITY_AUDIT_ISSUES].sort();
    if (coverage.historicalAuditCount !== expectedAuditIds.length || coverage.duplicateHistoricalAuditCount || JSON.stringify(actualAuditIds) !== JSON.stringify(expectedAuditIds))
        failures.push("historical audit inventory");
    const expectedAudits = (0, parity_builder_1.buildHistoricalAudits)(dataset.cards, dataset.teamAnalysisClassificationCounts);
    if (JSON.stringify(dataset.historicalAudits) !== JSON.stringify(expectedAudits))
        failures.push("historical audit derivation");
    const expectedUpstream = {
        k1: { artifactSha256: parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k1.artifactSha256, coverageSha256: parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k1.coverageSha256 },
        k2: { artifactSha256: parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k2.artifactSha256, coverageSha256: parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k2.coverageSha256 },
        k3: { artifactSha256: parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k3.artifactSha256, coverageSha256: parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k3.coverageSha256 },
        k6: { artifactSha256: parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k6.artifactSha256, coverageSha256: parity_contract_1.CHARACTER_PARITY_UPSTREAM_PROFILE.k6.coverageSha256 },
    };
    if (JSON.stringify(dataset.source.upstreamSidecars) !== JSON.stringify(expectedUpstream))
        failures.push("upstream sidecar lineage");
    const allowed = new Set(["agreement", "representation_gain", "confirmed_conflict", "unknown", "unjoinable"]);
    if (dataset.historicalAudits.some(item => !allowed.has(item.classification) || !item.issue || !item.basis || item.sourceSidecars.length === 0))
        failures.push("historical audit shape");
    if (Object.values(dataset.teamAnalysisClassificationCounts).reduce((sum, value) => sum + value, 0) !== dataset.source.c3Shadow.ruleCount)
        failures.push("C3 lineage");
    for (const card of dataset.cards) {
        for (const [source, parity] of [["production", card.production], ["fyi", card.fyi]]) {
            const expectedPolicy = source === "production" ? "initial_state" : "highest_released_progression_at_external_snapshot";
            if (parity.comparisonState.selectionPolicy !== expectedPolicy)
                failures.push(`state policy ${source}:${card.cardId}`);
            if (parity.comparisonState.comparable !== Boolean(parity.comparisonState.stateKey))
                failures.push(`state provenance ${source}:${card.cardId}`);
            if (source === "production" && parity.comparisonState.comparable && parity.comparisonState.releaseState !== "initial")
                failures.push(`production non-initial state ${card.cardId}`);
            const fyiCutoff = dataset.source.fyiCharacters.generatedAt.replace("T", " ").replace("Z", "");
            if (source === "fyi" && parity.comparisonState.comparable && (parity.comparisonState.availableAtSnapshot !== true || !parity.comparisonState.availableAt || parity.comparisonState.availableAt > fyiCutoff))
                failures.push(`FYI unavailable state ${card.cardId}`);
            if ((parity.comparisonState.progressionStep ?? 0) > 0 && !parity.comparisonState.growthStepSource)
                failures.push(`growth provenance ${source}:${card.cardId}`);
            if (parity.conflicts.some(conflict => conflict.field === "form_target_set" || (conflict.field === "characterClass" && conflict.databaseValue === "unawakened")))
                failures.push(`incomparable conflict ${source}:${card.cardId}`);
            if (source === "fyi" && parity.comparisonState.releaseState !== "initial" && parity.conflicts.some(conflict => ["maxLevelHP", "maxLevelAttack", "maxDefence"].includes(conflict.field)))
                failures.push(`incomparable FYI max stat ${card.cardId}`);
        }
    }
    return { schemaVersion: 1, valid: failures.length === 0, failures: [...new Set(failures)] };
}
exports.validateDatabaseCharacterParityDataset = validateDatabaseCharacterParityDataset;
//# sourceMappingURL=parity-validator.js.map