"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEventsE8Registry = void 0;
const events_e8_builder_1 = require("./events-e8-builder");
function validateEventsE8Registry(registry, options) {
    const failures = [];
    if (registry.schemaVersion !== 1 || registry.contract !== "dokkan-events-database-first-sidecars" || registry.contractVersion !== "0.9.0" || registry.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes")
        failures.push("contract identity");
    const rebuilt = (0, events_e8_builder_1.buildEventsE8Registry)({ sidecars: options.sidecars, sourceAnchors: options.sourceAnchors, generatedAt: registry.generatedAt, sourceSnapshotVersion: registry.sourceSnapshotVersion, sourceDatabaseSha256: registry.sourceDatabaseSha256, refreshProfile: options.refreshProfile, refreshProfileSha256: options.refreshProfileSha256 }), exactProjection = JSON.stringify(registry) === JSON.stringify(rebuilt);
    if (!exactProjection)
        failures.push("exact projection");
    const allPayloadHashesValid = options.payloadHashesValid, allCoverageHashesValid = options.coverageHashesValid, allValidationHashesValid = options.validationHashesValid;
    if (!allPayloadHashesValid)
        failures.push("payload identity");
    if (!allCoverageHashesValid)
        failures.push("coverage identity");
    if (!allValidationHashesValid)
        failures.push("validation identity");
    const allSourceValidationsGreen = registry.sidecars.every(value => value.validation.value.valid === true && (value.gate === 1 || value.validation.value.exactProjection === true));
    if (!allSourceValidationsGreen)
        failures.push("source validation");
    const byGate = new Map(registry.sidecars.map(value => [value.gate, value])), chain = (gate, key, expected) => byGate.get(gate)?.lineage[key] === expected;
    const lineageChainValid = registry.sidecars.length === 6 && new Set(registry.sidecars.map(value => value.key)).size === 6 && registry.sidecars.every(value => value.lineage.sourceDatabaseSha256 === registry.sourceDatabaseSha256) && chain(1, "sourceE0Sha256", registry.sourceAnchors.inventory.sha256) && chain(2, "sourceE1Sha256", byGate.get(1)?.payload.sha256 ?? "") && chain(3, "sourceE2Sha256", byGate.get(2)?.payload.sha256 ?? "") && chain(4, "sourceE3Sha256", byGate.get(3)?.payload.sha256 ?? "") && chain(4, "sourceE2Sha256", byGate.get(2)?.payload.sha256 ?? "") && chain(4, "sourceElfSha256", registry.sourceAnchors.elf.sha256) && chain(4, "nativeEvidenceSha256", registry.sourceAnchors.elf.nativeEvidenceSha256) && chain(5, "sourceE4Sha256", byGate.get(4)?.payload.sha256 ?? "") && chain(5, "sourceE2Sha256", byGate.get(2)?.payload.sha256 ?? "") && chain(5, "sourceE1Sha256", byGate.get(1)?.payload.sha256 ?? "") && chain(6, "sourceE5Sha256", byGate.get(5)?.payload.sha256 ?? "") && chain(6, "sourceApkSha256", registry.sourceAnchors.apk.sha256) && chain(6, "apkBaselineSha256", registry.sourceAnchors.apk.apkBaselineSha256);
    if (!lineageChainValid)
        failures.push("lineage chain");
    const roles = new Set(options.refreshProfile.baselineFiles.map(value => value.role)), exactRoles = roles.size === 4 && ["e0_inventory", "e3_goldens", "e4_native_evidence", "e6_apk"].every(value => roles.has(value)), e6Baseline = options.refreshProfile.baselineFiles.find(value => value.role === "e6_apk");
    const refreshProfileValid = options.refreshProfile.schemaVersion === 1 && options.refreshProfile.contractVersion === "0.9.0" && options.refreshProfile.baselineFiles.length === 4 && exactRoles && registry.refreshProfile.sha256 === options.refreshProfileSha256 && options.refreshProfile.requiredSources.database.sha256 === registry.sourceDatabaseSha256 && options.refreshProfile.requiredSources.elf.sha256 === registry.sourceAnchors.elf.sha256 && options.refreshProfile.requiredSources.elf.sizeBytes === registry.sourceAnchors.elf.sizeBytes && options.refreshProfile.requiredSources.apk.sha256 === registry.sourceAnchors.apk.sha256 && options.refreshProfile.requiredSources.apk.sizeBytes === registry.sourceAnchors.apk.sizeBytes && e6Baseline !== undefined && registry.sourceAnchors.apk.apkBaselineSha256 === e6Baseline.sha256;
    if (!refreshProfileValid)
        failures.push("refresh profile");
    if (registry.sidecars.some(value => value.gate > 1 && (typeof value.coverage.counts.danglingIdCount !== "number" || !Number.isFinite(value.coverage.counts.danglingIdCount))))
        failures.push("dangling coverage contract");
    if (!registry.delivery.optional || registry.delivery.defaultPipelineEnabled || registry.delivery.productionReplacement || registry.delivery.r2Published || registry.delivery.androidConsumed)
        failures.push("delivery boundary");
    return { schemaVersion: 1, valid: failures.length === 0, exactProjection, allPayloadHashesValid, allCoverageHashesValid, allValidationHashesValid, allSourceValidationsGreen, lineageChainValid, refreshProfileValid, failures };
}
exports.validateEventsE8Registry = validateEventsE8Registry;
//# sourceMappingURL=events-e8-validator.js.map