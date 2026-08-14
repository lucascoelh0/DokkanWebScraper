import { TaxonomyProjectionLineage } from "./taxonomy-projection-contract";

export const TAXONOMY_PROJECTION_DELIVERY_SCHEMA_VERSION = 1 as const;
export const TAXONOMY_PROJECTION_DELIVERY_CONTRACT_VERSION = "1.0.0" as const;
export const TAXONOMY_PROJECTION_DELIVERY_NAMESPACE = "database-characters-k36-taxonomy-projection-delivery-v1" as const;
export const TAXONOMY_PROJECTION_DELIVERY_RECEIPT = "database-characters-k36-taxonomy-projection-delivery-receipt.json" as const;
export const TAXONOMY_PROJECTION_DELIVERY_MARKER = ".database-characters-k36-taxonomy-projection-delivery-ready.json" as const;
export const TAXONOMY_PROJECTION_DELIVERY_MAX_BYTES = 512 * 1024;
export const TAXONOMY_PROJECTION_DELIVERY_MAX_METADATA_BYTES = 64 * 1024;
export const TAXONOMY_PROJECTION_DELIVERY_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const TAXONOMY_PROJECTION_DELIVERY_MAX_ERROR_LENGTH = 512;
export const TAXONOMY_PROJECTION_DELIVERY_MAX_EXAMPLES = 5;

export type TaxonomyProjectionDeliveryArtifactKind = "payload" | "coverage" | "validation" | "manifest";

export interface TaxonomyProjectionDeliveryInventoryEntry {
    kind: TaxonomyProjectionDeliveryArtifactKind;
    fileName: string;
    sha256: string;
    sizeBytes: number;
}

export interface TaxonomyProjectionDeliveryReceipt {
    schemaVersion: typeof TAXONOMY_PROJECTION_DELIVERY_SCHEMA_VERSION;
    contract: "dokkan-database-character-taxonomy-projection-delivery-k36";
    contractVersion: typeof TAXONOMY_PROJECTION_DELIVERY_CONTRACT_VERSION;
    releaseId: string;
    generatedAt: string;
    datasetVersion: string;
    mode: "explicit_opt_in_offline_local_only";
    source: {
        k35: {
            contract: "dokkan-database-character-taxonomy-projection-manifest";
            contractVersion: string;
            manifestSha256: string;
            manifestSizeBytes: number;
            payloadSha256: string;
            payloadSizeBytes: number;
            rawSha256: string;
            rawSizeBytes: number;
            coverageSha256: string;
            coverageSizeBytes: number;
            validationSha256: string;
            validationSizeBytes: number;
            lineage: TaxonomyProjectionLineage;
            sourceBoundValidation: "GO";
            k32Revalidated: true;
            k34RevalidatedInProcess: true;
            exactArtifactBytesMatched: true;
        };
    };
    inventory: {
        closed: true;
        artifactCount: 4;
        entries: TaxonomyProjectionDeliveryInventoryEntry[];
    };
    budget: {
        maximumReleaseBytes: number;
        maximumMetadataFileBytes: number;
        artifactBytes: number;
        withinLocalLimit: true;
        rssLimitBytesExclusive: number;
    };
    checks: {
        contentAddressedDirectory: true;
        sourceBoundK35Required: true;
        sourceRootsExplicit: true;
        exactK35BytesOnly: true;
        twoConstructionByteIdentical: true;
        markerWrittenLast: true;
        noNetworkCodeInvoked: true;
    };
    readiness: {
        offlineLocalMaterialization: "GO";
        offlineSourceBoundValidation: "GO";
        network: "NO-GO";
        fetch: "NO-GO";
        wranglerOrS3: "NO-GO";
        publisher: "NO-GO";
        r2: "NO-GO";
        android: "NO-GO";
        consumer: "NO-GO";
        characterArray: "NO-GO";
        applyOrOverlay: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
    };
    deliveryState: "STOPPED_LOCAL_ONLY";
}

export interface TaxonomyProjectionDeliveryMarkerFile {
    sha256: string;
    sizeBytes: number;
}

export interface TaxonomyProjectionDeliveryMarker {
    schemaVersion: typeof TAXONOMY_PROJECTION_DELIVERY_SCHEMA_VERSION;
    contract: "dokkan-database-character-taxonomy-projection-delivery-ready-k36";
    contractVersion: typeof TAXONOMY_PROJECTION_DELIVERY_CONTRACT_VERSION;
    releaseId: string;
    receiptFile: typeof TAXONOMY_PROJECTION_DELIVERY_RECEIPT;
    files: Record<string, TaxonomyProjectionDeliveryMarkerFile>;
    inventory: {
        closed: true;
        expectedNames: string[];
        markerWrittenLast: true;
    };
    budget: {
        maximumReleaseBytes: number;
        accountedBytesBeforeMarker: number;
        markerMaximumBytes: number;
    };
    readiness: TaxonomyProjectionDeliveryReceipt["readiness"];
    deliveryState: "STOPPED_LOCAL_ONLY";
}
