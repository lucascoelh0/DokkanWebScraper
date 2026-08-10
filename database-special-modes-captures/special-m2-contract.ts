import { SpecialSourceSpan } from "./special-m1-contract";
export type SpecialEvidenceStatus = "supported" | "partial" | "unknown";
export type SpecialM2FactValue = number | boolean | string | null | number[] | string[];
export interface SpecialM2Fact { key: string; field: string; value: SpecialM2FactValue; status: "supported" | "partial"; sourceSpan: SpecialSourceSpan; authority: "captured_allowlisted_product_field"; semanticBoundary: string }
export interface SpecialM2Announcement { announcementId: number; sourceSpan: SpecialSourceSpan; referencedAssetPaths: Array<{ path: string; sourceSpan: SpecialSourceSpan }>; identityPolicy: "numeric_announcement_id_only_text_excluded" }
export interface SpecialM2Asset { path: string; status: number; mimeType: string; sizeBytes: number; sha256: string; sourceSpan: SpecialSourceSpan; associationBoundary: "exact_path_observed_not_event_or_gameplay_identity" }
export interface SpecialM2Dataset {
    schemaVersion: 1;
    contract: "dokkan-special-modes-burst-offline-observation";
    contractVersion: "0.3.0";
    generatedAt: string;
    generatedAtPolicy: "inherits_m0_capture_timestamp";
    collectionMode: "offline_local_har_no_requests_no_replay";
    defaultEnabled: false;
    productionMutation: false;
    replayCapability: false;
    identityPolicy: "numeric_structural_ids_only_file_name_quest_name_and_text_not_identity";
    m0ArtifactSha256: string;
    m0ArtifactSizeBytes: number;
    briefing: { sourceSpan: SpecialSourceSpan; questId: number; queryKeyNames: string[]; genkaiBattleId: number; scheduleId: number; factCount: number; familyEvidence: "explicit_genkai_battle_object" };
    facts: SpecialM2Fact[];
    startObservation: { sourceSpan: SpecialSourceSpan; method: "POST"; normalizedPath: "/quests/:id/sugoroku_maps/start"; questId: number; status: number; requestDisposition: "opaque_sign_omitted"; responseDisposition: "opaque_sign_omitted"; configurationStatus: "unknown"; replayCapability: false };
    announcements: SpecialM2Announcement[];
    assets: SpecialM2Asset[];
    omitted: Array<{ jsonPointer: string; reason: "account_value" | "presentation_text" | "opaque_signature" }>;
    zstandard: { observedBodyCount: 0; decodeAttempted: false; dictionaryIdentityStatus: "not_applicable_no_zstd_body" };
}
export interface SpecialM2Validation { schemaVersion: 1; valid: boolean; factCount: number; supportedCount: number; partialCount: number; gimmickIdentityCount: number; conditionIdentityCount: number; announcementCount: number; assetCount: number; failures: string[] }
