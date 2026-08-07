"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateServerS4Dataset = exports.buildServerS4Coverage = exports.buildServerS4Dataset = void 0;
function buildServerS4Dataset(observation) {
    const containers = [...new Set(observation.nativeContainerKeys)].sort().map(containerKey => ({ containerKey, containsFormatPlaceholder: /%\d*d/.test(containerKey), status: "partial", boundary: "native_path_literal_without_manifest_entry_or_delivery_bytes" }));
    const e6 = observation.e6, uniqueReferenceCount = e6.pathAssetCount + e6.numericAssetCount;
    return {
        schemaVersion: 1,
        contract: "dokkan-server-asset-delivery",
        contractVersion: "0.5.0",
        generatedAt: "2026-08-07T00:00:00.000Z",
        generatedAtPolicy: "pinned_to_static_evidence_checkpoint",
        sourceSnapshotVersion: observation.sourceSnapshotVersion,
        collectionMode: "local_static_inventory_no_network",
        sourceLineage: observation.sourceLineage,
        versions: [
            { key: "current_apk", value: observation.currentApkVersion, status: "supported", scope: "current_s4_checkpoint", observedAt: null, boundary: "Pinned APK version/build identity only; it does not imply database or remote asset version." },
            { key: "historical_database", value: observation.historicalMetadata.dbVersion, status: "partial", scope: "historical_first_party_export_2026_06_28", observedAt: observation.historicalMetadata.exportedAt, boundary: "Historical rooted-emulator export; not current server version." },
            { key: "historical_assets", value: observation.historicalMetadata.assetVersion, status: "partial", scope: "historical_first_party_export_2026_06_28", observedAt: observation.historicalMetadata.exportedAt, boundary: "Historical rooted-emulator export; no manifest bytes or current-server observation." },
            { key: "historical_apk_export", value: observation.historicalMetadata.apkVersion, status: "partial", scope: "historical_first_party_export_2026_06_28", observedAt: observation.historicalMetadata.exportedAt, boundary: "Historical export metadata predates the pinned S4 APK checkpoint." },
        ],
        deliverySources: [
            { key: "official_client_assets", host: "ishin-global.aktsk.com", pathTemplate: "client_assets/{database|new_version_exists|login_movies}", sourceClass: "official_client", collectionGate: "discover_only", status: "partial", hashSemantics: "unknown", boundary: "Native paths and version headers are static evidence; method, authentication, response schema, asset host and object keys remain unknown." },
            { key: "dokkaninfo_assets", host: "dokkaninfo.com", pathTemplate: "assets/global/en/{typed_asset_path}", sourceClass: "community_mirror", collectionGate: "reference_only", status: "partial", hashSemantics: "unknown", boundary: "Repository URL builder proves a public mirror template for selected assets, not official completeness or hashes." },
            { key: "dokkan_fyi_cdn", host: "cdn.dokkan.fyi", pathTemplate: "assets/en/{typed_asset_path}", sourceClass: "community_mirror", collectionGate: "reference_only", status: "partial", hashSemantics: "unknown", boundary: "Repository URL builder proves selected typed paths only; E6 database paths are not automatically prefixed or joined." },
        ],
        manifestCandidates: [
            { key: "official_client_assets_split", locator: observation.hasSplitManifestLiteral ? "native_string_literal:client_assets_splited.json" : "missing", status: observation.hasSplitManifestLiteral ? "partial" : "unknown", capturedBytes: false, schemaStatus: "unknown", entryHashStatus: "unknown", entrySizeStatus: "unknown", boundary: "Filename and nearby asset_no literal exist; no captured file, schema, version relation or delivery host." },
            { key: "official_database_download", locator: "native_string_literal:client_assets/database + repository ClientAssetsDatabasePayload{url,version}", status: "partial", capturedBytes: false, schemaStatus: "partial", entryHashStatus: "unknown", entrySizeStatus: "unknown", boundary: "Repository accepts captured URL/version but no current response or official event-asset manifest is present." },
        ],
        nativeContainerCandidates: containers,
        baseApkInventory: {
            assetEntryCount: e6.assetEntryCount,
            cpkContainerCount: e6.cpkContainerCount,
            representativeSamples: e6.samples.map(value => ({ entryPath: value.apkEntryPath, sizeBytes: value.sizeBytes, compressedSizeBytes: value.compressedSizeBytes, sha256: value.sha256, status: value.status })),
            representativeSampleBytes: e6.samples.reduce((sum, value) => sum + value.sizeBytes, 0),
            boundary: "bootstrap_apk_delivery_only_not_current_remote_asset_manifest",
        },
        e6Projection: {
            pathReferenceCount: e6.pathAssetCount, numericReferenceCount: e6.numericAssetCount, uniqueReferenceCount, bindingCount: e6.bindingCount,
            directBaseApkPathCount: e6.directBaseApkPathCount, baseApkCandidateCount: e6.bundledCandidateCount, remoteManifestJoinedReferenceCount: 0,
            unresolvedDeliveryReferenceCount: uniqueReferenceCount, status: "unknown", boundary: "reference_identity_supported_delivery_relation_absent",
        },
        networkSampleGate: {
            projectedNetworkBytesBeforeBatch: 0, plannedRequestCount: 0, performedRequestCount: 0, downloadedBytes: 0,
            fullCatalogProjectedBytes: null, fullCatalogProjectionStatus: "unknown_no_manifest_sizes", decision: "no_go_sources_not_collection_eligible",
            boundary: "Official paths remain discover_only and community binary sources reference_only under S0; without a captured size-bearing manifest no sample request or full-batch projection is authorized.",
        },
    };
}
exports.buildServerS4Dataset = buildServerS4Dataset;
function buildServerS4Coverage(dataset) {
    return {
        schemaVersion: 1, deliverySourceCount: dataset.deliverySources.length, manifestCandidateCount: dataset.manifestCandidates.length,
        nativeContainerCandidateCount: dataset.nativeContainerCandidates.length, formatContainerCandidateCount: dataset.nativeContainerCandidates.filter(value => value.containsFormatPlaceholder).length,
        baseApkSampleCount: dataset.baseApkInventory.representativeSamples.length, baseApkSampleBytes: dataset.baseApkInventory.representativeSampleBytes,
        e6UniqueReferenceCount: dataset.e6Projection.uniqueReferenceCount, deliveryJoinedReferenceCount: 0, unresolvedDeliveryReferenceCount: dataset.e6Projection.unresolvedDeliveryReferenceCount,
        currentAssetVersionCount: 0, capturedManifestCount: 0, networkRequestCount: 0, downloadedBytes: 0,
    };
}
exports.buildServerS4Coverage = buildServerS4Coverage;
function validateServerS4Dataset(dataset) {
    const failures = [];
    if (dataset.contract !== "dokkan-server-asset-delivery" || dataset.contractVersion !== "0.5.0" || dataset.collectionMode !== "local_static_inventory_no_network")
        failures.push("contract identity");
    const expectedLineage = new Map([["server_s0", "official_static"], ["events_e6", "sqlite_first_party"], ["native_elf", "official_static"], ["historical_acquisition_metadata", "historical_first_party_export"]]);
    const lineageKeys = dataset.sourceLineage.map(value => value.key);
    if (lineageKeys.length !== expectedLineage.size || new Set(lineageKeys).size !== expectedLineage.size || [...expectedLineage.keys()].some(key => !lineageKeys.includes(key)) || dataset.sourceLineage.some(value => expectedLineage.get(value.key) !== value.authority || !/^[a-f0-9]{64}$/.test(value.sha256) || value.sizeBytes <= 0))
        failures.push("source lineage");
    if (new Set(dataset.nativeContainerCandidates.map(value => value.containerKey)).size !== dataset.nativeContainerCandidates.length || dataset.nativeContainerCandidates.some(value => value.status !== "partial" || !/^[A-Za-z0-9_./%-]+\.cpk$/.test(value.containerKey) || value.containerKey.startsWith("/") || value.containerKey.includes("..")))
        failures.push("container candidate domain");
    const expectedSources = new Map([
        ["official_client_assets", { host: "ishin-global.aktsk.com", sourceClass: "official_client", collectionGate: "discover_only", status: "partial" }],
        ["dokkaninfo_assets", { host: "dokkaninfo.com", sourceClass: "community_mirror", collectionGate: "reference_only", status: "partial" }],
        ["dokkan_fyi_cdn", { host: "cdn.dokkan.fyi", sourceClass: "community_mirror", collectionGate: "reference_only", status: "partial" }],
    ]);
    const sourceKeys = dataset.deliverySources.map(value => value.key), deliverySourcesValid = sourceKeys.length === expectedSources.size && new Set(sourceKeys).size === expectedSources.size && [...expectedSources.keys()].every(key => sourceKeys.includes(key)) && dataset.deliverySources.every(value => { const expected = expectedSources.get(value.key); return expected?.host === value.host && expected.sourceClass === value.sourceClass && expected.collectionGate === value.collectionGate && expected.status === value.status && value.hashSemantics === "unknown" && !!value.pathTemplate && !/^https?:/i.test(value.pathTemplate); });
    if (!deliverySourcesValid)
        failures.push("delivery source gate");
    const expectedManifests = new Map([["official_client_assets_split", { status: "partial", schemaStatus: "unknown" }], ["official_database_download", { status: "partial", schemaStatus: "partial" }]]);
    const manifestKeys = dataset.manifestCandidates.map(value => value.key), manifestCandidatesValid = manifestKeys.length === expectedManifests.size && new Set(manifestKeys).size === expectedManifests.size && [...expectedManifests.keys()].every(key => manifestKeys.includes(key)) && dataset.manifestCandidates.every(value => { const expected = expectedManifests.get(value.key); return expected?.status === value.status && expected.schemaStatus === value.schemaStatus && value.capturedBytes === false && value.entryHashStatus === "unknown" && value.entrySizeStatus === "unknown" && !!value.locator && !!value.boundary; });
    if (!manifestCandidatesValid)
        failures.push("manifest evidence promotion");
    const sampleHashesValid = dataset.baseApkInventory.representativeSamples.every(value => /^[a-f0-9]{64}$/.test(value.sha256) && value.sizeBytes > 0 && value.compressedSizeBytes > 0 && value.status === "supported");
    if (!sampleHashesValid || dataset.baseApkInventory.representativeSampleBytes !== dataset.baseApkInventory.representativeSamples.reduce((sum, value) => sum + value.sizeBytes, 0))
        failures.push("APK sample identity");
    const noUngatedNetworkCollection = dataset.networkSampleGate.projectedNetworkBytesBeforeBatch === 0 && dataset.networkSampleGate.plannedRequestCount === 0 && dataset.networkSampleGate.performedRequestCount === 0 && dataset.networkSampleGate.downloadedBytes === 0 && dataset.networkSampleGate.decision === "no_go_sources_not_collection_eligible";
    if (!noUngatedNetworkCollection)
        failures.push("ungated network collection");
    const expectedVersionKeys = ["current_apk", "historical_database", "historical_assets", "historical_apk_export"], versionKeys = dataset.versions.map(value => value.key);
    const currentApk = dataset.versions.find(value => value.key === "current_apk"), historicalVersions = dataset.versions.filter(value => value.key !== "current_apk");
    const versionScopesPreserved = versionKeys.length === expectedVersionKeys.length && new Set(versionKeys).size === expectedVersionKeys.length && expectedVersionKeys.every(key => versionKeys.includes(key)) && currentApk?.scope === "current_s4_checkpoint" && currentApk.status === "supported" && currentApk.value.length > 0 && currentApk.observedAt === null && historicalVersions.length === 3 && historicalVersions.every(value => value.scope === "historical_first_party_export_2026_06_28" && value.status === "partial" && value.value.length > 0 && value.observedAt !== null);
    if (!versionScopesPreserved)
        failures.push("version scope promotion");
    const referenceDeliverySeparationPreserved = dataset.e6Projection.remoteManifestJoinedReferenceCount === 0 && dataset.e6Projection.unresolvedDeliveryReferenceCount === dataset.e6Projection.uniqueReferenceCount && dataset.e6Projection.status === "unknown";
    if (!referenceDeliverySeparationPreserved)
        failures.push("reference delivery promotion");
    return { schemaVersion: 1, valid: failures.length === 0, deterministic: true, staticOnly: dataset.collectionMode === "local_static_inventory_no_network", noUngatedNetworkCollection, versionScopesPreserved, referenceDeliverySeparationPreserved, failures };
}
exports.validateServerS4Dataset = validateServerS4Dataset;
//# sourceMappingURL=server-s4-builder.js.map