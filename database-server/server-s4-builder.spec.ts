import { deepEqual, equal } from "assert";
import { buildServerS4Coverage, buildServerS4Dataset, validateServerS4Dataset } from "./server-s4-builder";
import { ServerS4Observation } from "./server-s4-contract";

function observation(): ServerS4Observation {
    return {
        sourceSnapshotVersion: "snapshot",
        sourceLineage: [
            { key: "server_s0", path: "s0", sha256: "a".repeat(64), sizeBytes: 1, authority: "official_static" },
            { key: "events_e6", path: "e6", sha256: "b".repeat(64), sizeBytes: 1, authority: "sqlite_first_party" },
            { key: "native_elf", path: "elf", sha256: "c".repeat(64), sizeBytes: 1, authority: "official_static" },
            { key: "historical_acquisition_metadata", path: "metadata", sha256: "d".repeat(64), sizeBytes: 1, authority: "historical_first_party_export" },
        ],
        currentApkVersion: "6.4.0-v338",
        historicalMetadata: { exportedAt: "2026-06-28T00:00:00.000Z", dbVersion: "1", assetVersion: "2", apkVersion: "6.2.5-hash" },
        nativeContainerKeys: ["event/icon.cpk", "character/%05d.cpk"], hasSplitManifestLiteral: true,
        e6: { pathAssetCount: 2, numericAssetCount: 3, bindingCount: 10, directBaseApkPathCount: 0, bundledCandidateCount: 0, assetEntryCount: 5, cpkContainerCount: 2, samples: [{ apkEntryPath: "assets/a.cpk", sizeBytes: 10, compressedSizeBytes: 8, sha256: "e".repeat(64), status: "supported" }] },
    };
}

describe("server S4 asset delivery", () => {
    it("is deterministic and keeps every E6 reference unresolved", () => {
        const first = buildServerS4Dataset(observation()), second = buildServerS4Dataset(observation());
        deepEqual(first, second);
        equal(validateServerS4Dataset(first).valid, true);
        equal(first.e6Projection.unresolvedDeliveryReferenceCount, 5);
        equal(buildServerS4Coverage(first).deliveryJoinedReferenceCount, 0);
    });

    it("records local APK samples without authorizing network samples", () => {
        const dataset = buildServerS4Dataset(observation()), coverage = buildServerS4Coverage(dataset);
        equal(coverage.baseApkSampleBytes, 10);
        equal(coverage.networkRequestCount, 0);
        equal(dataset.networkSampleGate.fullCatalogProjectedBytes, null);
    });

    it("keeps historical asset version out of current scope", () => {
        const dataset = buildServerS4Dataset(observation());
        equal(dataset.versions.find(value => value.key === "historical_assets")?.scope, "historical_first_party_export_2026_06_28");
        equal(buildServerS4Coverage(dataset).currentAssetVersionCount, 0);
    });

    it("rejects delivery promotion and ungated collection", () => {
        const dataset = buildServerS4Dataset(observation());
        (dataset.e6Projection as any).remoteManifestJoinedReferenceCount = 1;
        (dataset.networkSampleGate as any).performedRequestCount = 1;
        const validation = validateServerS4Dataset(dataset);
        equal(validation.valid, false);
        equal(validation.referenceDeliverySeparationPreserved, false);
        equal(validation.noUngatedNetworkCollection, false);
    });

    it("rejects duplicate lineage and unsafe container paths", () => {
        const dataset = buildServerS4Dataset(observation());
        dataset.sourceLineage[1] = { ...dataset.sourceLineage[0] };
        dataset.nativeContainerCandidates[0].containerKey = "../secret.cpk";
        const validation = validateServerS4Dataset(dataset);
        equal(validation.failures.includes("source lineage"), true);
        equal(validation.failures.includes("container candidate domain"), true);
    });

    it("requires exact sources, manifests and version scopes", () => {
        const dataset = buildServerS4Dataset(observation());
        dataset.deliverySources[0].status = "supported";
        dataset.manifestCandidates[0].status = "supported";
        dataset.versions.splice(0, 1);
        const validation = validateServerS4Dataset(dataset);
        equal(validation.valid, false);
        equal(validation.failures.includes("delivery source gate"), true);
        equal(validation.failures.includes("manifest evidence promotion"), true);
        equal(validation.versionScopesPreserved, false);
    });
});
