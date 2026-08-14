import type { CharacterStructuralSidecarManifest } from "./structural-sidecar-contract";

export const CHARACTER_STRUCTURAL_SHADOW_CONTRACT_VERSION = "1.0.0" as const;
export const CHARACTER_STRUCTURAL_SHADOW_EXAMPLE_LIMIT = 5 as const;
export const CHARACTER_STRUCTURAL_SHADOW_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;

export type CharacterStructuralShadowDimension = "characterClass" | "categories" | "links";
export type CharacterStructuralShadowRecordKind = "top_level" | "transformation";
export type CharacterStructuralClassClassification = "agreement" | "representation_mismatch" | "unknown";
export type CharacterStructuralCollectionClassification =
    | "ordered_agreement"
    | "same_multiset_different_order"
    | "different_representation"
    | "unknown";

export interface CharacterStructuralShadowValueSummary {
    kind: "scalar" | "ordered_collection";
    elementCount: number;
    orderedSha256: string | null;
    scalarValue: string | null;
}

export interface CharacterStructuralShadowExample {
    cardId: string;
    recordKind: CharacterStructuralShadowRecordKind;
    productivePath: string;
    releaseStateBinding: "unavailable";
    classification: CharacterStructuralClassClassification | CharacterStructuralCollectionClassification;
    k32: CharacterStructuralShadowValueSummary;
    productive: CharacterStructuralShadowValueSummary;
}

export interface CharacterStructuralClassAggregate {
    exclusive: Record<CharacterStructuralClassClassification, number>;
    nonExclusiveDiagnostics: {
        sidecarStatusNotSupported: number;
        productiveFieldAbsent: number;
        productiveRepresentationUnsupported: number;
    };
    examples: CharacterStructuralShadowExample[];
}

export interface CharacterStructuralCollectionAggregate {
    exclusive: Record<CharacterStructuralCollectionClassification, number>;
    nonExclusiveDiagnostics: {
        sidecarStatusNotSupported: number;
        emptyContainerAbsenceUnproved: number;
        absentContainerUnproved: number;
        assignmentOrEntryStatusNotSupported: number;
        presentationLabelUnresolved: number;
        productiveFieldAbsent: number;
        productiveValueNotStringArray: number;
    };
    examples: CharacterStructuralShadowExample[];
}

export interface CharacterStructuralShadowEvaluation {
    inventory: {
        sidecarRecords: number;
        productiveTopLevelRecords: number;
        productiveRecordsIncludingTransformations: number;
        comparableCardIds: number;
        sidecarCardIdsWithoutProductiveRecord: number;
        productiveCardIdsOutsideSidecar: number;
    };
    dimensions: {
        characterClass: CharacterStructuralClassAggregate;
        categories: CharacterStructuralCollectionAggregate;
        links: CharacterStructuralCollectionAggregate;
    };
    nonExclusiveDiagnostics: {
        label: "non_exclusive";
        productiveTopLevelComparableRecords: number;
        productiveTransformationComparableRecords: number;
        productiveComparableRecordsWithEzaPrefixedFields: number;
        productiveComparableRecordsWithSezaPrefixedFields: number;
        releaseStateBindingUnavailable: number;
        confirmedConflictCount: 0;
        zeroConfirmedConflictEstablishesCompleteness: false;
    };
}

export interface CharacterStructuralShadowReport {
    schemaVersion: 1;
    contract: "dokkan-database-character-structural-shadow-report";
    contractVersion: typeof CHARACTER_STRUCTURAL_SHADOW_CONTRACT_VERSION;
    generatedAt: string;
    mode: "offline_explicit_opt_in_shadow";
    sources: {
        k32: {
            contract: CharacterStructuralSidecarManifest["contract"];
            contractVersion: CharacterStructuralSidecarManifest["contractVersion"];
            datasetVersion: string;
            payloadSha256: string;
            payloadSizeBytes: number;
            uncompressedSha256: string;
            uncompressedSizeBytes: number;
            recordCount: number;
            k2SnapshotVersion: string;
            k2PayloadSha256: string;
        };
        productiveCharacters: {
            contract: "Character[]";
            datasetVersion: string;
            manifestFile: string;
            manifestSha256: string;
            manifestSizeBytes: number;
            payloadFile: string;
            payloadSha256: string;
            payloadSizeBytes: number;
            uncompressedSizeBytes: number;
            topLevelCount: number;
        };
    };
    policy: {
        explicitOptIn: true;
        offlineOnly: true;
        reportOnly: true;
        joinKey: "cardId";
        namesOrLabelsAsJoinKeys: false;
        productiveStateBinding: "unavailable";
        stateInferredFromEzaOrSezaFields: false;
        presentationLabelsUsedOnlyForComparison: true;
        orderPreserved: true;
        assignmentsDeduplicated: false;
        assignmentsCanonicalized: false;
        activeLinksComputed: false;
        sharedLinksComputed: false;
        authoritySelected: false;
        effectiveValuesChanged: false;
        characterArrayReturned: false;
        artifactWritten: false;
        exampleLimitPerDimension: typeof CHARACTER_STRUCTURAL_SHADOW_EXAMPLE_LIMIT;
        rssLimitBytesExclusive: number;
    };
    inventory: CharacterStructuralShadowEvaluation["inventory"];
    dimensions: CharacterStructuralShadowEvaluation["dimensions"];
    nonExclusiveDiagnostics: CharacterStructuralShadowEvaluation["nonExclusiveDiagnostics"];
    inputIntegrity: {
        k32ValidatedOnlyBySourceBoundApi: true;
        k32SourceBoundStatus: "GO";
        k32SourceRootsRevalidatedBeforeAndAfter: true;
        k32ExactArtifactBytesMatched: true;
        productiveManifestAndPayloadPinned: true;
        productiveContainedPaths: true;
        productiveRegularNonLinkSingleLinkHandleSnapshots: true;
        productiveDecompressionBoundedToPinnedSize: true;
        productiveSnapshotRevalidatedBeforeAndAfter: true;
        inputsNotMutated: true;
        doubleEvaluationByteIdentical: true;
        rssStayedBelowLimit: true;
    };
    readiness: {
        offlineShadowConsumer: "GO";
        stateLineage: "NO-GO";
        authorityPromotion: "NO-GO";
        apply: "NO-GO";
        production: "NO-GO";
        publisher: "NO-GO";
        r2: "NO-GO";
        android: "NO-GO";
        fyiRemoval: "NO-GO";
        dokkanInfoRemoval: "NO-GO";
    };
}
