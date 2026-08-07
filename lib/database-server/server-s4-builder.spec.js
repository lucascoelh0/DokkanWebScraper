"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const server_s4_builder_1 = require("./server-s4-builder");
function observation() {
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
        const first = (0, server_s4_builder_1.buildServerS4Dataset)(observation()), second = (0, server_s4_builder_1.buildServerS4Dataset)(observation());
        (0, assert_1.deepEqual)(first, second);
        (0, assert_1.equal)((0, server_s4_builder_1.validateServerS4Dataset)(first).valid, true);
        (0, assert_1.equal)(first.e6Projection.unresolvedDeliveryReferenceCount, 5);
        (0, assert_1.equal)((0, server_s4_builder_1.buildServerS4Coverage)(first).deliveryJoinedReferenceCount, 0);
    });
    it("records local APK samples without authorizing network samples", () => {
        const dataset = (0, server_s4_builder_1.buildServerS4Dataset)(observation()), coverage = (0, server_s4_builder_1.buildServerS4Coverage)(dataset);
        (0, assert_1.equal)(coverage.baseApkSampleBytes, 10);
        (0, assert_1.equal)(coverage.networkRequestCount, 0);
        (0, assert_1.equal)(dataset.networkSampleGate.fullCatalogProjectedBytes, null);
    });
    it("keeps historical asset version out of current scope", () => {
        const dataset = (0, server_s4_builder_1.buildServerS4Dataset)(observation());
        (0, assert_1.equal)(dataset.versions.find(value => value.key === "historical_assets")?.scope, "historical_first_party_export_2026_06_28");
        (0, assert_1.equal)((0, server_s4_builder_1.buildServerS4Coverage)(dataset).currentAssetVersionCount, 0);
    });
    it("rejects delivery promotion and ungated collection", () => {
        const dataset = (0, server_s4_builder_1.buildServerS4Dataset)(observation());
        dataset.e6Projection.remoteManifestJoinedReferenceCount = 1;
        dataset.networkSampleGate.performedRequestCount = 1;
        const validation = (0, server_s4_builder_1.validateServerS4Dataset)(dataset);
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.equal)(validation.referenceDeliverySeparationPreserved, false);
        (0, assert_1.equal)(validation.noUngatedNetworkCollection, false);
    });
    it("rejects duplicate lineage and unsafe container paths", () => {
        const dataset = (0, server_s4_builder_1.buildServerS4Dataset)(observation());
        dataset.sourceLineage[1] = { ...dataset.sourceLineage[0] };
        dataset.nativeContainerCandidates[0].containerKey = "../secret.cpk";
        const validation = (0, server_s4_builder_1.validateServerS4Dataset)(dataset);
        (0, assert_1.equal)(validation.failures.includes("source lineage"), true);
        (0, assert_1.equal)(validation.failures.includes("container candidate domain"), true);
    });
    it("requires exact sources, manifests and version scopes", () => {
        const dataset = (0, server_s4_builder_1.buildServerS4Dataset)(observation());
        dataset.deliverySources[0].status = "supported";
        dataset.manifestCandidates[0].status = "supported";
        dataset.versions.splice(0, 1);
        const validation = (0, server_s4_builder_1.validateServerS4Dataset)(dataset);
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.equal)(validation.failures.includes("delivery source gate"), true);
        (0, assert_1.equal)(validation.failures.includes("manifest evidence promotion"), true);
        (0, assert_1.equal)(validation.versionScopesPreserved, false);
    });
});
//# sourceMappingURL=server-s4-builder.spec.js.map