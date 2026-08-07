"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseCharacterReadinessDataset = void 0;
const readiness_builder_1 = require("./readiness-builder");
const readiness_contract_1 = require("./readiness-contract");
function validateDatabaseCharacterReadinessDataset(dataset, coverage) {
    const failures = [];
    const expected = (0, readiness_builder_1.buildDatabaseCharacterReadinessDataset)();
    const recomputed = (0, readiness_builder_1.buildDatabaseCharacterReadinessCoverage)(dataset);
    if (JSON.stringify(dataset) !== JSON.stringify(expected))
        failures.push("readiness evidence or decision changed");
    if (JSON.stringify(coverage) !== JSON.stringify(recomputed))
        failures.push("coverage mismatch");
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-database-character-readiness" || dataset.contractVersion !== "1.0.0" || dataset.status !== "infrastructure_ready_consumers_disabled")
        failures.push("contract identity");
    const actualIds = dataset.decisions.map(decision => decision.id);
    if (actualIds.join(",") !== readiness_contract_1.CHARACTER_READINESS_DECISION_IDS.join(",") || coverage.duplicateDecisionCount || coverage.decisionCount !== 14 || coverage.goCount !== 2 || coverage.noGoCount !== 12)
        failures.push("decision inventory");
    if (dataset.decisions.some(decision => decision.decision === "NO-GO" && decision.prerequisites.length === 0))
        failures.push("NO-GO prerequisite");
    if (coverage.confirmedConflictCardCount !== 2 || coverage.confirmedConflictFieldCount !== 4 || coverage.projectedSidecarCount !== 8 || coverage.projectedCompressedBytes !== 10166877)
        failures.push("evidence cardinality");
    if (Object.values(dataset.policy).some(Boolean))
        failures.push("activation policy");
    return { schemaVersion: 1, valid: failures.length === 0, failures };
}
exports.validateDatabaseCharacterReadinessDataset = validateDatabaseCharacterReadinessDataset;
//# sourceMappingURL=readiness-validator.js.map