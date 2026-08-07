export type EventsE7Classification = "agreement" | "representation_gain" | "confirmed_conflict" | "unknown" | "unjoinable";

export interface EventsE7RawFacet {
    key: string;
    structuralJoin: boolean;
    comparable: boolean;
    boundary: string | null;
    firstPartyOnlyClassification: "representation_gain" | "unknown";
    legacyCount: number;
    firstPartyCount: number;
    joinedCount: number;
    agreementCount: number;
    conflictCount: number;
    legacyProjectionSha256: string;
    firstPartyProjectionSha256: string;
    legacyOnlyIds: string[];
    firstPartyOnlyIds: string[];
    conflicts: Array<{ id: string; legacy: unknown[]; firstParty: unknown[] }>;
}

export interface EventsE7Observation {
    sources: Array<{ name: string; generatedAt: string; source: string; declaredCounts: Record<string, number> }>;
    facets: EventsE7RawFacet[];
    eventFamilies: Array<{ family: string; eventCount: number; joinedRootCount: number; stageCount: number; joinedStageCount: number; rootTarget: string | null }>;
    eventRewardRows: number;
    eventRewardRowJoinBoundary: string;
    eventCache: { expectedCount: number; observedCount: number; expectedProjectionSha256: string; observedProjectionSha256: string; missing: string[]; unexpected: string[] };
    legacyMissionCount: number;
    linkedLegacyMissionCount: number;
    unlinkedLegacyMissionIds: string[];
    firstPartyLinkedMissionCount: number;
    firstPartyLinkedMissionOnlyIds: string[];
    unknownSurfaces: Array<{ key: string; legacyCount: number; reason: string }>;
    unjoinableSurfaces: Array<{ key: string; legacyCount: number; reason: string }>;
}

export interface EventsE7SourceLineage {
    name: string;
    fileName: string;
    sha256: string;
    sizeBytes: number;
    generatedAt: string;
    source: string;
    declaredCounts: Record<string, number>;
}

export interface EventsE7Comparison {
    key: string;
    classification: EventsE7Classification;
    legacyCount: number;
    firstPartyCount: number | null;
    joinedCount: number | null;
    agreementCount: number | null;
    conflictCount: number | null;
    legacyProjectionSha256: string | null;
    firstPartyProjectionSha256: string | null;
    idEvidence: { count: number; sha256: string; samples: string[] } | null;
    boundary: string | null;
}

export interface EventsE7Dataset {
    schemaVersion: 1;
    contract: "dokkan-events-database-first-shadow-parity";
    contractVersion: "0.8.0";
    generatedAt: string;
    generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes";
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    sourceE6: { contractVersion: "0.7.0"; sha256: string };
    implementationBaselineSha256: string;
    legacySources: EventsE7SourceLineage[];
    implementationEvidence: Array<{ fileName: string; sha256: string; sizeBytes: number }>;
    comparisons: EventsE7Comparison[];
    eventFamilies: Array<{ family: string; rootTarget: string | null; eventCount: number; joinedRootCount: number; rootClassification: EventsE7Classification; stageCount: number; joinedStageCount: number; stageClassification: EventsE7Classification }>;
    paginationAudits: Array<{ dataset: string; status: "supported" | "partial" | "unknown"; evidenceFile: string; strategy: string; artifactBoundary: string }>;
    confirmedConflicts: Array<{ comparisonKey: string; id: string; legacy: unknown[]; firstParty: unknown[] }>;
    authorityBoundary: { legacyRole: "shadow_parity_only"; textJoinAllowed: false; staticCatalogAvailabilityStatus: "unknown_server_schedule_required"; productionMutation: false };
}

export interface EventsE7Coverage { schemaVersion: 1; comparisonCount: number; byClassification: Record<EventsE7Classification, number>; legacySourceCount: number; eventFamilyCount: number; confirmedConflictCount: number; cacheExpectedCount: number; cacheObservedCount: number; cacheMismatchCount: number; paginationByStatus: Record<"supported" | "partial" | "unknown", number> }
export interface EventsE7Validation { schemaVersion: 1; valid: boolean; exactProjection: boolean; exclusiveClassifications: boolean; lineageValid: boolean; failures: string[] }
export interface EventsE7ImplementationBaseline { schemaVersion: 1; files: Array<{ fileName: string; sha256: string; paginationClaim: string }> }
export interface EventsE7Manifest { schemaVersion: 1; contractVersion: "0.8.0"; generatedAt: string; generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes"; sourceSnapshotVersion: string; fileName: "events-e7-shadow-parity.json"; compression: "none"; sha256: string; sizeBytes: number; sourceDatabaseSha256: string; sourceE6Sha256: string; legacySourceAggregateSha256: string; implementationBaselineSha256: string; coverage: { fileName: "events-e7-coverage.json"; sha256: string; sizeBytes: number }; validation: { fileName: "events-e7-validation.json"; sha256: string; sizeBytes: number } }
