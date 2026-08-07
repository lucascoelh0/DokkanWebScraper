export type ServerS4Status = "supported" | "partial" | "unknown";

export interface ServerS4SourceLineage {
    key: "server_s0" | "events_e6" | "native_elf" | "historical_acquisition_metadata";
    path: string;
    sha256: string;
    sizeBytes: number;
    authority: "official_static" | "sqlite_first_party" | "historical_first_party_export";
}

export interface ServerS4Dataset {
    schemaVersion: 1;
    contract: "dokkan-server-asset-delivery";
    contractVersion: "0.5.0";
    generatedAt: string;
    generatedAtPolicy: "pinned_to_static_evidence_checkpoint";
    sourceSnapshotVersion: string;
    collectionMode: "local_static_inventory_no_network";
    sourceLineage: ServerS4SourceLineage[];
    versions: Array<{
        key: "current_apk" | "historical_database" | "historical_assets" | "historical_apk_export";
        value: string;
        status: ServerS4Status;
        scope: "current_s4_checkpoint" | "historical_first_party_export_2026_06_28";
        observedAt: string | null;
        boundary: string;
    }>;
    deliverySources: Array<{
        key: "official_client_assets" | "dokkaninfo_assets" | "dokkan_fyi_cdn";
        host: string;
        pathTemplate: string;
        sourceClass: "official_client" | "community_mirror";
        collectionGate: "discover_only" | "reference_only";
        status: ServerS4Status;
        hashSemantics: "unknown";
        boundary: string;
    }>;
    manifestCandidates: Array<{
        key: "official_client_assets_split" | "official_database_download";
        locator: string;
        status: ServerS4Status;
        capturedBytes: false;
        schemaStatus: "unknown" | "partial";
        entryHashStatus: "unknown";
        entrySizeStatus: "unknown";
        boundary: string;
    }>;
    nativeContainerCandidates: Array<{ containerKey: string; containsFormatPlaceholder: boolean; status: "partial"; boundary: "native_path_literal_without_manifest_entry_or_delivery_bytes" }>;
    baseApkInventory: {
        assetEntryCount: number;
        cpkContainerCount: number;
        representativeSamples: Array<{ entryPath: string; sizeBytes: number; compressedSizeBytes: number; sha256: string; status: "supported" }>;
        representativeSampleBytes: number;
        boundary: "bootstrap_apk_delivery_only_not_current_remote_asset_manifest";
    };
    e6Projection: {
        pathReferenceCount: number;
        numericReferenceCount: number;
        uniqueReferenceCount: number;
        bindingCount: number;
        directBaseApkPathCount: number;
        baseApkCandidateCount: number;
        remoteManifestJoinedReferenceCount: 0;
        unresolvedDeliveryReferenceCount: number;
        status: "unknown";
        boundary: "reference_identity_supported_delivery_relation_absent";
    };
    networkSampleGate: {
        projectedNetworkBytesBeforeBatch: 0;
        plannedRequestCount: 0;
        performedRequestCount: 0;
        downloadedBytes: 0;
        fullCatalogProjectedBytes: null;
        fullCatalogProjectionStatus: "unknown_no_manifest_sizes";
        decision: "no_go_sources_not_collection_eligible";
        boundary: string;
    };
}

export interface ServerS4Coverage {
    schemaVersion: 1;
    deliverySourceCount: number;
    manifestCandidateCount: number;
    nativeContainerCandidateCount: number;
    formatContainerCandidateCount: number;
    baseApkSampleCount: number;
    baseApkSampleBytes: number;
    e6UniqueReferenceCount: number;
    deliveryJoinedReferenceCount: 0;
    unresolvedDeliveryReferenceCount: number;
    currentAssetVersionCount: 0;
    capturedManifestCount: 0;
    networkRequestCount: 0;
    downloadedBytes: 0;
}

export interface ServerS4Validation {
    schemaVersion: 1;
    valid: boolean;
    deterministic: boolean;
    staticOnly: boolean;
    noUngatedNetworkCollection: boolean;
    versionScopesPreserved: boolean;
    referenceDeliverySeparationPreserved: boolean;
    failures: string[];
}

export interface ServerS4Manifest {
    schemaVersion: 1;
    contractVersion: "0.5.0";
    generatedAt: string;
    generatedAtPolicy: "pinned_to_static_evidence_checkpoint";
    fileName: "server-s4-asset-delivery.json";
    compression: "none";
    sha256: string;
    sizeBytes: number;
    sourceSnapshotVersion: string;
    sourceLineageAggregateSha256: string;
    coverage: { fileName: "server-s4-coverage.json"; sha256: string; sizeBytes: number };
    validation: { fileName: "server-s4-validation.json"; sha256: string; sizeBytes: number };
}

export interface ServerS4Observation {
    sourceSnapshotVersion: string;
    sourceLineage: ServerS4SourceLineage[];
    currentApkVersion: string;
    historicalMetadata: { exportedAt: string; dbVersion: string; assetVersion: string; apkVersion: string };
    nativeContainerKeys: string[];
    hasSplitManifestLiteral: boolean;
    e6: {
        pathAssetCount: number;
        numericAssetCount: number;
        bindingCount: number;
        directBaseApkPathCount: number;
        bundledCandidateCount: number;
        assetEntryCount: number;
        cpkContainerCount: number;
        samples: Array<{ apkEntryPath: string; sizeBytes: number; compressedSizeBytes: number; sha256: string; status: "supported" }>;
    };
}
