export type EventsE1EntityKind = "area" | "chapter" | "db_story_group" | "z_battle_stage" | "budokai" | "origin_series" | "origin_episode" | "origin_page" | "sd_map" | "sd_pack";

export interface EventsE1RawArea { id: number; type: string; category: number; chapter_id: number | null; db_story_id: number | null; name: string; event_priority: number | null; all_clear_bonus_stones: number; first_released_at: string | null; mission_difficulty: number | null }
export interface EventsE1RawChapter { id: number; name: string; open_at: string | null }
export interface EventsE1RawChapterProperty { id: number; chapter_id: number; start_at: string | null }
export interface EventsE1RawDbStory { id: number; name: string; priority: number }
export interface EventsE1RawZBattle { id: number; type: string; priority: number; related_z_battle_stage_id: number | null; start_at: string | null; end_at: string | null; eventkagi_start_at: string | null; eventkagi_end_at: string | null; enable_battle_auto: number }
export interface EventsE1RawZBattleView { id: number; z_battle_stage_id: number; enemy_name: string; enemy_nickname: string; enemy_resource_id: number }
export interface EventsE1RawBudokai { id: number; name: string; description: string; start_at: string; end_at: string; collecting_end_at: string; result_end_at: string; enable_battle_auto: number }
export interface EventsE1RawOriginSeries { id: number; name: string; priority: number }
export interface EventsE1RawOriginEpisode { id: number; origin_series_id: number; name: string; priority: number }
export interface EventsE1RawOriginPage { id: number; origin_episode_id: number; page_number: number }
export interface EventsE1RawSdMap { id: number }
export interface EventsE1RawSdPack { id: number; name: string; description: string }

export interface EventsE1Observation {
    areas: EventsE1RawArea[];
    chapters: EventsE1RawChapter[];
    chapterProperties: EventsE1RawChapterProperty[];
    dbStories: EventsE1RawDbStory[];
    zBattleStages: EventsE1RawZBattle[];
    zBattleStageViews: EventsE1RawZBattleView[];
    budokais: EventsE1RawBudokai[];
    originSeries: EventsE1RawOriginSeries[];
    originEpisodes: EventsE1RawOriginEpisode[];
    originPages: EventsE1RawOriginPage[];
    sdMaps: EventsE1RawSdMap[];
    sdPacks: EventsE1RawSdPack[];
    opaqueRootFamilies: Array<{ family: "rmbattle"; sourceTable: "rmbattle_missions"; sourceColumn: "rmbattle_id"; ids: number[]; sourceRowCount: number; missingRootTable: true }>;
    unrootedCandidateTables: Array<{ table: string; rowCount: number }>;
}

export interface EventsE1CatalogEntity {
    identity: { kind: EventsE1EntityKind; id: string };
    status: "supported" | "partial";
    sources: Array<{ table: string; rowId: string }>;
    rawType?: string;
    rawCategory?: number;
    presentation?: { title?: string; description?: string; role: "entity_title" | "enemy_display_not_event_title" | "missing"; locale: "snapshot_embedded_unverified" };
    order?: number;
    relations: Array<{ kind: "chapter" | "db_story_group" | "related_z_battle_stage" | "origin_series" | "origin_episode"; targetKind: EventsE1EntityKind; targetId: string; status: "supported" }>;
    staticRelease?: { firstReleasedAt: string | null; source: "areas.first_released_at" };
    rawAttributes: Record<string, string | number | boolean | null>;
}

export interface EventsE1AvailabilityHint {
    identity: { entityKind: EventsE1EntityKind; entityId: string; sourceTable: "chapters" | "chapter_properties" | "z_battle_stages" | "budokais"; sourceRowId: string };
    status: "partial";
    values: Record<string, string | null>;
    boundary: "database_embedded_schedule_hint_not_server_current_availability";
}

export interface EventsE1OpaqueRootFamily {
    family: "rmbattle";
    status: "partial";
    identities: string[];
    source: { table: "rmbattle_missions"; column: "rmbattle_id"; rowCount: number };
    missing: ["root_table", "title", "schedule", "topology"];
}

export interface EventsE1Dataset {
    schemaVersion: 1;
    contract: "dokkan-events-database-first-catalog";
    contractVersion: "0.2.0";
    generatedAt: string;
    generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes";
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    sourceE0: { contractVersion: "0.1.0"; sha256: string };
    identityPolicy: "table_domain_plus_numeric_id_names_never_identity";
    catalog: EventsE1CatalogEntity[];
    availabilityHints: EventsE1AvailabilityHint[];
    opaqueRootFamilies: EventsE1OpaqueRootFamily[];
    unrootedCandidateTables: Array<{ table: string; rowCount: number; status: "unknown" }>;
}

export interface EventsE1Coverage {
    schemaVersion: 1;
    entityCount: number;
    countsByKind: Record<EventsE1EntityKind, number>;
    supportedEntityCount: number;
    partialEntityCount: number;
    relationshipCount: number;
    availabilityHintCount: number;
    opaqueRootIdentityCount: number;
    unrootedCandidateRowCount: number;
    presentationMissingCount: number;
}

export interface EventsE1Validation { schemaVersion: 1; valid: boolean; entityCount: number; losslessIdentityCount: number; losslessRelationshipCount: number; availabilityHintCount: number; failures: string[] }
export interface EventsE1Manifest { schemaVersion: 1; contractVersion: "0.2.0"; generatedAt: string; generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes"; sourceSnapshotVersion: string; fileName: "events-e1-catalog.json"; compression: "none"; sha256: string; sizeBytes: number; entityCount: number; sourceDatabaseSha256: string; sourceE0Sha256: string; coverage: { fileName: "events-e1-coverage.json"; sha256: string; sizeBytes: number }; validation: { fileName: "events-e1-validation.json"; sha256: string; sizeBytes: number } }
