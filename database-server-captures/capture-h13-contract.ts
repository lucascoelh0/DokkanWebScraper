export type CaptureH13Classification = "agreement" | "temporal_change" | "representation_mismatch" | "coverage_gap" | "unknown" | "confirmed_conflict";

export interface CaptureH13Counts {
    agreement: number;
    temporal_change: number;
    representation_mismatch: number;
    coverage_gap: number;
    unknown: number;
    confirmed_conflict: number;
}

export interface CaptureH13Period {
    openAt: number | null;
    endAt: number | null;
    captureId: string;
    entryIndex: number;
    observedAt: string;
}

export interface CaptureH13Dimension {
    endpoint: "/gashas/:id/featured_cards" | "/gashas/:id/rates";
    jsonCoordinate: "$.gasha_items[].card_id" | "$.steps[].gasha_rates.featured_card_ids[]" | "$.steps[].gasha_rates.normal_card_ids[]" | "$.steps[].special_gashas[].featured_card_ids[]" | "$.steps[].special_gashas[].normal_card_ids[]";
    step: number | null;
    rateId: number | null;
    rarity: string | null;
    rarityApplicability: "not_applicable_to_card_id_pool_coordinates";
    specialGashaId: number | null;
}

export interface CaptureH13Observation extends CaptureH13Dimension {
    side: "h4_baseline" | "h10_observed";
    captureId: string;
    entryIndex: number;
    observedAt: string;
    httpStatus: 200;
    gashaId: number;
    field: "card_id" | "featured_card_ids" | "normal_card_ids";
    value: number;
    period: CaptureH13Period | null;
    captureStructuralFingerprint: string;
    captureSourceIdentityFingerprint: string;
}

export interface CaptureH13LegacyBaseline {
    key: string;
    gashaId: number;
    h10Field: "card_id" | "featured_card_ids" | "normal_card_ids";
    h4Fields: string[];
    unionValues: number[];
    provenance: Array<{ factId: string; provenance: CaptureProductFactProvenance; }>;
}

export interface CaptureH13FactAudit {
    auditKey: string;
    gashaId: number;
    endpoint: string;
    field: "card_id" | "featured_card_ids" | "normal_card_ids";
    observedValue: number;
    legacyBaselineKey: string;
    legacyUnionContainsObservedValue: false;
    classification: CaptureH13Classification;
    classificationReason: string;
    canonicalDimensions: Array<CaptureH13Dimension & { canonicalDimensionId: string; }>;
    baselineDimensionValues: number[];
    baselineObservations: CaptureH13Observation[];
    observedProvenance: CaptureH13Observation[];
}

export interface CaptureH13Dataset {
    schemaVersion: 1;
    contract: "dokkan-official-capture-gasha-conflict-audit";
    contractVersion: "0.14.0";
    generatedAt: string;
    generatedAtPolicy: "inherits_h10_capture_timestamp";
    collectionMode: "offline_pinned_har_audit_no_requests_no_replay";
    productionMutation: false;
    defaultEnabled: false;
    authority: "corrective_shadow_classification_only";
    sourceLockSha256: string;
    legacyUniqueConflictFactCount: 627;
    legacyNonExclusiveConflictCellCount: 1254;
    uniqueFactCount: 627;
    uniqueCounts: CaptureH13Counts;
    legacyBaselines: CaptureH13LegacyBaseline[];
    facts: CaptureH13FactAudit[];
}

export interface CaptureH13Validation {
    schemaVersion: 1;
    valid: boolean;
    uniqueFactCount: number;
    uniqueCounts: CaptureH13Counts;
    confirmedConflictCount: number;
    failures: string[];
}
import { CaptureProductFactProvenance } from "./capture-product-contract";
