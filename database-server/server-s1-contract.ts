import { ServerHttpReceipt } from "./server-readonly-http";

export type ServerS1EvidenceStatus = "supported" | "partial" | "unknown";
export type ServerS1AvailabilityState = "active" | "future" | "ended" | "unknown";

export interface ServerS1TimeValue {
    raw: string;
    normalizedInstant?: string;
    timezone: { status: "supported"; kind: "explicit_offset"; offset: string } | { status: "unknown"; missing: "explicit_timezone" };
}

export interface ServerS1Period {
    startsAt?: ServerS1TimeValue;
    endsAt?: ServerS1TimeValue;
}

export interface ServerS1ScheduleRecord {
    identity: { sourceFamily: string; rootId: string };
    source: "dokkaninfo_community_shadow";
    status: "partial";
    presentation?: { title?: string; imagePath?: string; locale: "source_embedded_unverified" };
    period: ServerS1Period;
    sourceReportedAvailability?: "listed_by_source";
    calculatedAvailability: { state: ServerS1AvailabilityState; asOf: string; status: "partial" | "unknown"; basis: string[] };
    staticIdentityJoin: { status: "unknown"; boundary: "join_deferred_to_s2" };
    provenance: { receiptSha256: string };
}

export interface ServerS1BannerRecord {
    identity: { kind: "gasha"; id: string };
    source: "dokkan_fyi_community_shadow";
    status: "partial";
    categoryMemberships: Array<{ id: string; label: string; status: "partial"; boundary: "query_filter_membership_not_official_currency_semantics" }>;
    presentation?: { title?: string; description?: string; bannerUrl?: string; locale: "source_embedded_unverified" };
    period: ServerS1Period;
    sourceReportedAvailability: "active_query_result";
    calculatedAvailability: { state: ServerS1AvailabilityState; asOf: string; status: "partial" | "unknown"; basis: string[] };
    featuredCharacters: { status: "partial"; entries: Array<{ ordinal: number; entryCharacterId?: string; payloadCharacterId?: string; canonicalId?: string; baseCharacterId?: string; boundary: "community_structural_ids_not_official_featured_relation" }> } | { status: "unknown"; missing: "detail_fetch_or_featured_field" };
    currency: { status: "unknown"; missing: "official_currency_or_ticket_identity" };
    stepsAndRates: { status: "unknown"; missing: "s1_does_not_promote_commercial_or_probability_semantics" };
    provenance: { summaryReceiptSha256s: string[]; detailReceiptSha256?: string };
}

export interface ServerS1CaptureFailure {
    source: "dokkan_fyi" | "dokkaninfo";
    requestKey: string;
    attemptedAt: string;
    message: string;
}

export interface ServerS1Dataset {
    schemaVersion: 1;
    contract: "dokkan-server-schedule-and-banners";
    contractVersion: "0.2.0";
    generatedAt: string;
    generatedAtPolicy: "derived_from_latest_successful_fetch_time";
    sourceSnapshotVersion: string;
    sourceS0: { contractVersion: "0.1.0"; sha256: string; endpointKeys: ["fyi-active-summons", "fyi-summon-detail"] };
    authority: { role: "community_shadow_only"; officialDynamicAuthorityCount: 0; sqliteStaticAuthorityPreserved: true };
    collection: { method: "GET"; concurrency: 1; minimumIntervalMs: number; maximumResponseBytes: number; maximumAggregateBytes: number; fetchedBytes: number; receipts: ServerHttpReceipt[]; failures: ServerS1CaptureFailure[] };
    schedules: ServerS1ScheduleRecord[];
    banners: ServerS1BannerRecord[];
    maintenance: { status: "unknown"; missing: "credential_free_structured_current_maintenance_source" };
    boundaries: Array<{ key: string; status: "partial" | "unknown"; reason: string }>;
}

export interface ServerS1Coverage {
    schemaVersion: 1;
    attemptedRequestCount: number;
    successfulRequestCount: number;
    failedRequestCount: number;
    fetchedBytes: number;
    scheduleCount: number;
    bannerCount: number;
    featuredCharacterReferenceCount: number;
    explicitTimezoneValueCount: number;
    unknownTimezoneValueCount: number;
    availabilityCounts: Record<ServerS1AvailabilityState, number>;
    officialDynamicAuthorityCount: 0;
}

export interface ServerS1Validation { schemaVersion: 1; valid: boolean; exactProjection: boolean; getOnly: boolean; structuralIdentityOnly: boolean; authorityBoundaryPreserved: boolean; failures: string[] }
export interface ServerS1Manifest { schemaVersion: 1; contractVersion: "0.2.0"; generatedAt: string; fileName: "server-s1-schedule-banners.json"; compression: "none"; sha256: string; sizeBytes: number; sourceS0Sha256: string; coverage: { fileName: "server-s1-coverage.json"; sha256: string; sizeBytes: number }; validation: { fileName: "server-s1-validation.json"; sha256: string; sizeBytes: number } }
