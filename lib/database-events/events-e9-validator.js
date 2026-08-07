"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEventsE9Dataset = void 0;
const events_e9_builder_1 = require("./events-e9-builder");
function validateEventsE9Dataset(dataset, sources) {
    const failures = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-events-database-first-readiness" || dataset.contractVersion !== "1.0.0" || dataset.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes")
        failures.push("contract identity");
    const rebuilt = (0, events_e9_builder_1.buildEventsE9Dataset)(sources), exactProjection = JSON.stringify(dataset) === JSON.stringify(rebuilt);
    if (!exactProjection)
        failures.push("exact projection");
    const expectedGateOrder = ["E0", "E1", "E2", "E3", "E4", "E5", "E6", "E8"], sidecarByGate = new Map(sources.e8.sidecars.map(value => [`E${value.gate}`, value.payload])), expectedGateFiles = new Map([["E0", sources.e8.sourceAnchors.inventory.fileName], ...[1, 2, 3, 4, 5, 6].map(gate => [`E${gate}`, sidecarByGate.get(`E${gate}`).fileName]), ["E8", "events-sidecars.json"]]), expectedHashes = new Map([["E0", sources.e8.sourceAnchors.inventory.sha256], ...[1, 2, 3, 4, 5, 6].map(gate => [`E${gate}`, sidecarByGate.get(`E${gate}`).sha256]), ["E8", sources.e8Sha256]]), expectedArtifacts = new Map([...expectedGateOrder.map(gate => [expectedGateFiles.get(gate), expectedHashes.get(gate)]), ["events-e8-coverage.json", sources.e8Artifacts.coverageSha256], ["events-e8-validation.json", sources.e8Artifacts.validationSha256], ["events-e8-refresh-receipt.json", sources.e8Artifacts.receiptSha256], ["events-e8-manifest.json", sources.e8Artifacts.manifestSha256]]);
    const comparedArtifactsValid = sources.refreshEvidence.comparedArtifactCount === 12 && sources.refreshEvidence.comparedArtifacts.length === 12 && new Set(sources.refreshEvidence.comparedArtifacts.map(value => value.fileName)).size === 12 && sources.refreshEvidence.comparedArtifacts.every(value => value.beforeSha256 === value.afterSha256 && value.beforeSha256 === expectedArtifacts.get(value.fileName)) && [...expectedArtifacts].every(([fileName]) => sources.refreshEvidence.comparedArtifacts.some(value => value.fileName === fileName));
    const refreshEvidenceValid = sources.refreshEvidence.schemaVersion === 1 && sources.refreshEvidence.profileId === sources.e8.sourceSnapshotVersion && sources.refreshEvidence.refreshProfileSha256 === sources.e8.refreshProfile.sha256 && sources.refreshEvidence.sourceDatabaseSha256 === sources.e8.sourceDatabaseSha256 && sources.refreshEvidence.fullRefreshByteIdentical && comparedArtifactsValid && sources.refreshEvidence.gates.length === expectedGateOrder.length && sources.refreshEvidence.gates.every((value, index) => value.gate === expectedGateOrder[index] && value.payloadFileName === expectedGateFiles.get(value.gate) && value.payloadSha256 === expectedHashes.get(value.gate) && value.peakWorkingSetBytes > 0 && value.peakWorkingSetBytes < sources.refreshEvidence.memoryLimitBytes) && sources.refreshEvidence.observedMaxPeakWorkingSetBytes === Math.max(...sources.refreshEvidence.gates.map(value => value.peakWorkingSetBytes)) && sources.refreshEvidence.observedMaxPeakWorkingSetBytes < sources.refreshEvidence.memoryLimitBytes && sources.refreshEvidence.memoryLimitBytes <= 1024 * 1024 * 1024;
    const sourceEvidenceValid = refreshEvidenceValid && dataset.sourceRefreshEvidence.sha256 === sources.refreshEvidenceSha256 && sources.e7.sourceSnapshotVersion === sources.e8.sourceSnapshotVersion && sources.e7.sourceDatabaseSha256 === sources.e8.sourceDatabaseSha256 && sources.e7Coverage.confirmedConflictCount === 0 && sources.e8Coverage.invalidValidationCount === 0 && sources.e8Coverage.danglingIdCount === 0 && sources.e8.delivery.optional && !sources.e8.delivery.defaultPipelineEnabled;
    if (!sourceEvidenceValid)
        failures.push("source evidence");
    const expectedGo = new Set(["merge_disabled_infrastructure", "pinned_optional_generation"]), ids = new Set(dataset.decisions.map(value => value.id)), decisionPolicyValid = dataset.decisions.length === 8 && ids.size === 8 && dataset.decisions.every(value => value.status === (expectedGo.has(value.id) ? "GO" : "NO_GO")) && dataset.checkpoint.stopReason === "E0_E9_COMPLETE" && !dataset.checkpoint.productionChanged && !dataset.checkpoint.androidChanged && !dataset.checkpoint.r2Published;
    if (!decisionPolicyValid)
        failures.push("decision policy");
    if (dataset.decisions.some(value => value.status === "NO_GO" && value.exitConditions.length === 0) || dataset.remainingBoundaries.length === 0)
        failures.push("actionable blockers");
    return { schemaVersion: 1, valid: failures.length === 0, exactProjection, sourceEvidenceValid, decisionPolicyValid, failures };
}
exports.validateEventsE9Dataset = validateEventsE9Dataset;
//# sourceMappingURL=events-e9-validator.js.map