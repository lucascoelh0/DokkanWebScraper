export interface SpecialSourceSpan { captureId: "burst-mode-2026-08-10" | "pettan-not-live-2026-08-10"; entryIndex: number; jsonPointer: string }
export interface SpecialM1PackIndexObservation { sourceSpan: SpecialSourceSpan; status: number; packCount: number; packIds: number[]; mapIds: number[]; authority: "capture_time_product_observation_not_universal_availability" }
export interface SpecialM1Operation { sourceSpan: SpecialSourceSpan; method: "POST" | "PUT"; normalizedPath: "/sd/packs/open" | "/sd/tutorial/finish_opening" | "/sd/tutorial"; status: number; requestShape: string[]; responseShape: string[]; accountValuesOmitted: true; replayCapability: false; authority: "observed_shape_only_no_effect_or_reward_authority" }
export interface SpecialM1Announcement { announcementId: number; sourceSpan: SpecialSourceSpan; referencedAssetPaths: Array<{ path: string; sourceSpan: SpecialSourceSpan }>; identityPolicy: "numeric_announcement_id_only_text_excluded" }
export interface SpecialM1Asset { path: string; status: number; mimeType: string; sizeBytes: number; sha256: string; sourceSpan: SpecialSourceSpan; associationBoundary: "exact_path_observed_not_series_map_or_gameplay_identity" }
export interface SpecialM1Dataset {
    schemaVersion: 1;
    contract: "dokkan-special-modes-pettan-offline-observation";
    contractVersion: "0.2.0";
    generatedAt: string;
    generatedAtPolicy: "inherits_m0_capture_timestamp";
    collectionMode: "offline_local_har_no_requests_no_replay";
    defaultEnabled: false;
    productionMutation: false;
    replayCapability: false;
    captureState: "pettan_not_live";
    valuePolicy: "global_structural_ids_and_shapes_only_account_values_excluded";
    m0ArtifactSha256: string;
    m0ArtifactSizeBytes: number;
    packIndexObservations: SpecialM1PackIndexObservation[];
    operations: SpecialM1Operation[];
    announcements: SpecialM1Announcement[];
    assets: SpecialM1Asset[];
    topologyEvidence: { seriesIds: number[]; mapIds: number[]; arenaIds: number[]; stageIds: number[]; status: "unknown"; boundary: "no_active_pack_or_topology_payload_observed" };
    battleEvidence: { observedRouteCount: 0; status: "unknown"; boundary: "no_pettan_battle_route_observed_event_inactive_no_battle_inferred" };
    availability: { emptyPackIndexObservationCount: number; inference: "unknown"; boundary: "empty_capture_time_list_does_not_prove_universal_inactivity" };
}
export interface SpecialM1Validation { schemaVersion: 1; valid: boolean; packIndexObservationCount: number; observedPackCount: number; operationCount: number; announcementCount: number; assetCount: number; battleRouteCount: number; failures: string[] }
