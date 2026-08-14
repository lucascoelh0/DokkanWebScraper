import { TaxonomyProjectionLineage } from "./taxonomy-projection-contract";
import { TaxonomyProjectionDeliveryArtifactKind } from "./taxonomy-projection-delivery-contract";

export const TAXONOMY_PROJECTION_OBJECT_PLAN_SCHEMA_VERSION = 1 as const;
export const TAXONOMY_PROJECTION_OBJECT_PLAN_CONTRACT_VERSION = "1.0.0" as const;
export const TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE = "database-characters-k37-taxonomy-projection-object-plan-v1" as const;
export const TAXONOMY_PROJECTION_REMOTE_NAMESPACE = "database-characters/taxonomy-projection/v1" as const;
export const TAXONOMY_PROJECTION_OBJECT_PLAN_FILE = "database-characters-k37-taxonomy-projection-object-plan.json" as const;
export const TAXONOMY_PROJECTION_REMOTE_MANIFEST_CANDIDATE_FILE = "database-characters-k37-taxonomy-projection-remote-manifest-candidate.json" as const;
export const TAXONOMY_PROJECTION_OBJECT_PLAN_RECEIPT = "database-characters-k37-taxonomy-projection-object-plan-stopped-receipt.json" as const;
export const TAXONOMY_PROJECTION_OBJECT_PLAN_MARKER = ".database-characters-k37-taxonomy-projection-object-plan-ready.json" as const;
export const TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY = `${TAXONOMY_PROJECTION_REMOTE_NAMESPACE}/manifest.json` as const;
export const TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES = 50_000_000;
export const TAXONOMY_PROJECTION_OBJECT_PLAN_BUCKET_CEILING_BYTES = 10_000_000_000;
export const TAXONOMY_PROJECTION_OBJECT_PLAN_MANIFEST_RESERVATION_BYTES = 64 * 1024;
export const TAXONOMY_PROJECTION_OBJECT_PLAN_LOCAL_BUNDLE_MAX_BYTES = 256 * 1024;
export const TAXONOMY_PROJECTION_OBJECT_PLAN_MAX_METADATA_BYTES = 64 * 1024;
export const TAXONOMY_PROJECTION_OBJECT_PLAN_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
export const TAXONOMY_PROJECTION_OBJECT_PLAN_MAX_ERROR_LENGTH = 512;

export interface TaxonomyProjectionRemoteObject {
    kind: TaxonomyProjectionDeliveryArtifactKind;
    sourceFileName: string;
    objectKey: string;
    sha256: string;
    sizeBytes: number;
    cacheControl: "public, max-age=31536000, immutable";
    contentAddressed: true;
    remoteHashProofRequiredBeforeReuse: true;
}

export interface TaxonomyProjectionObjectPlanSource {
    k36: {
        contract: "dokkan-database-character-taxonomy-projection-delivery-k36";
        contractVersion: string;
        releaseId: string;
        receiptSha256: string;
        receiptSizeBytes: number;
        markerSha256: string;
        markerSizeBytes: number;
        sourceBoundValidation: "GO";
    };
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
    };
}

export interface TaxonomyProjectionRemoteManifestCandidate {
    schemaVersion: typeof TAXONOMY_PROJECTION_OBJECT_PLAN_SCHEMA_VERSION;
    contract: "dokkan-database-character-taxonomy-projection-remote-manifest-candidate-k37";
    contractVersion: typeof TAXONOMY_PROJECTION_OBJECT_PLAN_CONTRACT_VERSION;
    generatedAt: string;
    datasetVersion: string;
    releaseId: string;
    source: TaxonomyProjectionObjectPlanSource;
    inventory: {
        closed: true;
        artifactCount: 4;
        objects: TaxonomyProjectionRemoteObject[];
    };
    cacheControl: "no-store";
    state: "MUTABLE_REMOTE_MANIFEST_CANDIDATE_ONLY";
    readiness: {
        consumer: "NO-GO";
        authority: "NO-GO";
        publication: "NO-GO";
        production: "NO-GO";
    };
}

export interface TaxonomyProjectionObjectPlan {
    schemaVersion: typeof TAXONOMY_PROJECTION_OBJECT_PLAN_SCHEMA_VERSION;
    contract: "dokkan-database-character-taxonomy-projection-object-plan-k37";
    contractVersion: typeof TAXONOMY_PROJECTION_OBJECT_PLAN_CONTRACT_VERSION;
    generatedAt: string;
    datasetVersion: string;
    planId: string;
    mode: "explicit_opt_in_offline_local_only";
    source: TaxonomyProjectionObjectPlanSource;
    remoteNamespace: typeof TAXONOMY_PROJECTION_REMOTE_NAMESPACE;
    objects: TaxonomyProjectionRemoteObject[];
    mutableManifest: {
        localFileName: typeof TAXONOMY_PROJECTION_REMOTE_MANIFEST_CANDIDATE_FILE;
        objectKey: typeof TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY;
        sha256: string;
        sizeBytes: number;
        cacheControl: "no-store";
        state: "CANDIDATE_ONLY";
    };
    budget: {
        namespaceLimitBytes: number;
        immutableObjectBytes: number;
        mutableManifestReservationBytes: number;
        worstCaseNewBytes: number;
        withinNamespaceLimit: true;
        bucketCeilingBytes: number;
        remoteBucketBytes: "UNKNOWN";
        projectedBucketBytes: "UNKNOWN";
        withinBucketCeiling: "UNKNOWN";
        remotePreflightRequired: true;
    };
    checks: {
        sourceBoundK36Required: true;
        sourceRootsExplicit: true;
        exactK35ArtifactCount: 4;
        immutableKeysContentAddressed: true;
        immutableCacheOnlyForContentAddressedObjects: true;
        mutableManifestNoStore: true;
        noNetworkCodeInvoked: true;
    };
    readiness: {
        localObjectPlan: "GO";
        remoteInventory: "NO-GO";
        remotePreflight: "NO-GO";
        publication: "NO-GO";
        r2: "NO-GO";
        android: "NO-GO";
        consumer: "NO-GO";
        characterArray: "NO-GO";
        applyOrOverlay: "NO-GO";
        authority: "NO-GO";
        production: "NO-GO";
    };
}

export interface TaxonomyProjectionObjectPlanReceipt {
    schemaVersion: typeof TAXONOMY_PROJECTION_OBJECT_PLAN_SCHEMA_VERSION;
    contract: "dokkan-database-character-taxonomy-projection-object-plan-stopped-receipt-k37";
    contractVersion: typeof TAXONOMY_PROJECTION_OBJECT_PLAN_CONTRACT_VERSION;
    generatedAt: string;
    planId: string;
    k36ReleaseId: string;
    planSha256: string;
    planSizeBytes: number;
    manifestCandidateSha256: string;
    manifestCandidateSizeBytes: number;
    checks: {
        k36SourceBoundBeforePlan: true;
        k36SourceBoundAfterPlan: true;
        sourceUnchanged: true;
        twoConstructionByteIdentical: true;
        closedLocalInventory: true;
        createOnly: true;
        markerWrittenLast: true;
        localNamespaceBudgetWithinLimit: true;
        remoteBucketBudgetAwaitingPreflight: true;
        noNetworkCodeInvoked: true;
        noRemoteRead: true;
        noRemoteMutation: true;
    };
    readiness: TaxonomyProjectionObjectPlan["readiness"];
    state: "STOPPED_BEFORE_REMOTE_PREFLIGHT";
}

export interface TaxonomyProjectionObjectPlanMarker {
    schemaVersion: typeof TAXONOMY_PROJECTION_OBJECT_PLAN_SCHEMA_VERSION;
    contract: "dokkan-database-character-taxonomy-projection-object-plan-ready-k37";
    contractVersion: typeof TAXONOMY_PROJECTION_OBJECT_PLAN_CONTRACT_VERSION;
    planId: string;
    files: Record<string, { sha256: string; sizeBytes: number }>;
    inventory: {
        closed: true;
        expectedNames: string[];
        markerWrittenLast: true;
    };
    readiness: TaxonomyProjectionObjectPlan["readiness"];
    state: "STOPPED_BEFORE_REMOTE_PREFLIGHT";
}
