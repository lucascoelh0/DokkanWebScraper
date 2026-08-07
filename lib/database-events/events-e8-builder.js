"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEventsE8Coverage = exports.buildEventsE8RefreshReceipt = exports.buildEventsE8Registry = void 0;
function buildEventsE8Registry(options) {
    return {
        schemaVersion: 1, contract: "dokkan-events-database-first-sidecars", contractVersion: "0.9.0", generatedAt: options.generatedAt, generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes", sourceSnapshotVersion: options.sourceSnapshotVersion, sourceDatabaseSha256: options.sourceDatabaseSha256, refreshProfile: { profileId: options.refreshProfile.profileId, sha256: options.refreshProfileSha256 }, sourceAnchors: options.sourceAnchors,
        delivery: { optional: true, defaultPipelineEnabled: false, productionReplacement: false, r2Published: false, androidConsumed: false },
        sidecars: [...options.sidecars].sort((a, b) => a.gate - b.gate),
    };
}
exports.buildEventsE8Registry = buildEventsE8Registry;
function buildEventsE8RefreshReceipt(registry) {
    return { schemaVersion: 1, contract: "dokkan-events-database-first-refresh-receipt", contractVersion: "0.9.0", generatedAt: registry.generatedAt, sourceSnapshotVersion: registry.sourceSnapshotVersion, sourceDatabaseSha256: registry.sourceDatabaseSha256, refreshProfileSha256: registry.refreshProfile.sha256, executionPolicy: "focused_sequential_isolated_processes", gateOrder: ["E0", "E1", "E2", "E3", "E4", "E5", "E6", "E8"], refreshedSidecars: registry.sidecars.map(value => ({ key: value.key, sha256: value.payload.sha256, sizeBytes: value.payload.sizeBytes })), result: "validated_optional_artifacts" };
}
exports.buildEventsE8RefreshReceipt = buildEventsE8RefreshReceipt;
function dangling(sidecar) { const value = sidecar.coverage.counts.danglingIdCount; if (sidecar.gate === 1)
    return 0; if (typeof value !== "number" || !Number.isFinite(value))
    throw Error(`E8 incompatible danglingIdCount ${sidecar.key}`); return value; }
function buildEventsE8Coverage(registry) {
    const payloadBytesBySidecar = {}, sourceCoverage = {};
    let invalidValidationCount = 0, danglingIdCount = 0;
    for (const sidecar of registry.sidecars) {
        payloadBytesBySidecar[sidecar.key] = sidecar.payload.sizeBytes;
        sourceCoverage[sidecar.key] = sidecar.coverage.counts;
        invalidValidationCount += Number(sidecar.validation.value.valid !== true);
        danglingIdCount += dangling(sidecar);
    }
    return { schemaVersion: 1, sidecarCount: registry.sidecars.length, totalPayloadBytes: registry.sidecars.reduce((sum, value) => sum + value.payload.sizeBytes, 0), payloadBytesBySidecar, sourceCoverage, invalidValidationCount, danglingIdCount };
}
exports.buildEventsE8Coverage = buildEventsE8Coverage;
//# sourceMappingURL=events-e8-builder.js.map