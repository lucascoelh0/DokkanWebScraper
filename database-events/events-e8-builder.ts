import { EventsE8Coverage, EventsE8RefreshProfile, EventsE8RefreshReceipt, EventsE8Registry, EventsE8SidecarInput } from "./events-e8-contract";

export function buildEventsE8Registry(options: { sidecars: EventsE8SidecarInput[]; sourceAnchors: EventsE8Registry["sourceAnchors"]; generatedAt: string; sourceSnapshotVersion: string; sourceDatabaseSha256: string; refreshProfile: EventsE8RefreshProfile; refreshProfileSha256: string }): EventsE8Registry {
    return {
        schemaVersion: 1, contract: "dokkan-events-database-first-sidecars", contractVersion: "0.9.0", generatedAt: options.generatedAt, generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes", sourceSnapshotVersion: options.sourceSnapshotVersion, sourceDatabaseSha256: options.sourceDatabaseSha256, refreshProfile: { profileId: options.refreshProfile.profileId, sha256: options.refreshProfileSha256 }, sourceAnchors: options.sourceAnchors,
        delivery: { optional: true, defaultPipelineEnabled: false, productionReplacement: false, r2Published: false, androidConsumed: false },
        sidecars: [...options.sidecars].sort((a, b) => a.gate - b.gate),
    };
}

export function buildEventsE8RefreshReceipt(registry: EventsE8Registry): EventsE8RefreshReceipt {
    return { schemaVersion: 1, contract: "dokkan-events-database-first-refresh-receipt", contractVersion: "0.9.0", generatedAt: registry.generatedAt, sourceSnapshotVersion: registry.sourceSnapshotVersion, sourceDatabaseSha256: registry.sourceDatabaseSha256, refreshProfileSha256: registry.refreshProfile.sha256, executionPolicy: "focused_sequential_isolated_processes", gateOrder: ["E0", "E1", "E2", "E3", "E4", "E5", "E6", "E8"], refreshedSidecars: registry.sidecars.map(value => ({ key: value.key, sha256: value.payload.sha256, sizeBytes: value.payload.sizeBytes })), result: "validated_optional_artifacts" };
}

function dangling(sidecar: EventsE8SidecarInput): number { const value = sidecar.coverage.counts.danglingIdCount; if (sidecar.gate === 1) return 0; if (typeof value !== "number" || !Number.isFinite(value)) throw Error(`E8 incompatible danglingIdCount ${sidecar.key}`); return value; }
export function buildEventsE8Coverage(registry: EventsE8Registry): EventsE8Coverage {
    const payloadBytesBySidecar = {} as EventsE8Coverage["payloadBytesBySidecar"], sourceCoverage = {} as EventsE8Coverage["sourceCoverage"];
    let invalidValidationCount = 0, danglingIdCount = 0;
    for (const sidecar of registry.sidecars) { payloadBytesBySidecar[sidecar.key] = sidecar.payload.sizeBytes; sourceCoverage[sidecar.key] = sidecar.coverage.counts; invalidValidationCount += Number(sidecar.validation.value.valid !== true); danglingIdCount += dangling(sidecar); }
    return { schemaVersion: 1, sidecarCount: registry.sidecars.length, totalPayloadBytes: registry.sidecars.reduce((sum, value) => sum + value.payload.sizeBytes, 0), payloadBytesBySidecar, sourceCoverage, invalidValidationCount, danglingIdCount };
}
