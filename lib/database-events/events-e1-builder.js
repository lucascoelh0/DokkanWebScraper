"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEventsE1Coverage = exports.buildEventsE1Dataset = void 0;
const id = (value) => String(value);
const source = (table, rowId) => [{ table, rowId: id(rowId) }];
const title = (value, role = "entity_title") => value ? { title: value, role, locale: "snapshot_embedded_unverified" } : { role: "missing", locale: "snapshot_embedded_unverified" };
const sortEntities = (a, b) => a.identity.kind.localeCompare(b.identity.kind) || a.identity.id.localeCompare(b.identity.id, "en", { numeric: true });
function buildEventsE1Dataset(options) {
    const o = options.observation, catalog = [], availabilityHints = [];
    for (const row of o.areas)
        catalog.push({ identity: { kind: "area", id: id(row.id) }, status: "supported", sources: source("areas", row.id), rawType: row.type, rawCategory: row.category, presentation: title(row.name), order: row.event_priority ?? undefined, relations: [row.chapter_id === null ? undefined : { kind: "chapter", targetKind: "chapter", targetId: id(row.chapter_id), status: "supported" }, row.db_story_id === null ? undefined : { kind: "db_story_group", targetKind: "db_story_group", targetId: id(row.db_story_id), status: "supported" }].filter((value) => value !== undefined), staticRelease: { firstReleasedAt: row.first_released_at, source: "areas.first_released_at" }, rawAttributes: { allClearBonusStones: row.all_clear_bonus_stones, missionDifficulty: row.mission_difficulty } });
    for (const row of o.chapters) {
        catalog.push({ identity: { kind: "chapter", id: id(row.id) }, status: "supported", sources: source("chapters", row.id), presentation: title(row.name), relations: [], rawAttributes: {} });
        availabilityHints.push({ identity: { entityKind: "chapter", entityId: id(row.id), sourceTable: "chapters", sourceRowId: id(row.id) }, status: "partial", values: { openAt: row.open_at }, boundary: "database_embedded_schedule_hint_not_server_current_availability" });
    }
    for (const row of o.chapterProperties)
        availabilityHints.push({ identity: { entityKind: "chapter", entityId: id(row.chapter_id), sourceTable: "chapter_properties", sourceRowId: id(row.id) }, status: "partial", values: { startAt: row.start_at }, boundary: "database_embedded_schedule_hint_not_server_current_availability" });
    for (const row of o.dbStories)
        catalog.push({ identity: { kind: "db_story_group", id: id(row.id) }, status: "supported", sources: source("db_stories", row.id), presentation: title(row.name), order: row.priority, relations: [], rawAttributes: {} });
    const zViews = new Map(o.zBattleStageViews.map(row => [row.z_battle_stage_id, row]));
    for (const row of o.zBattleStages) {
        const view = zViews.get(row.id);
        catalog.push({ identity: { kind: "z_battle_stage", id: id(row.id) }, status: "partial", sources: [...source("z_battle_stages", row.id), ...(view ? source("z_battle_stage_views", view.id) : [])], rawType: row.type, presentation: view ? { title: view.enemy_name, description: view.enemy_nickname, role: "enemy_display_not_event_title", locale: "snapshot_embedded_unverified" } : title(undefined), order: row.priority, relations: row.related_z_battle_stage_id === null ? [] : [{ kind: "related_z_battle_stage", targetKind: "z_battle_stage", targetId: id(row.related_z_battle_stage_id), status: "supported" }], rawAttributes: { enableBattleAuto: row.enable_battle_auto !== 0, enemyResourceId: view?.enemy_resource_id ?? null } });
        availabilityHints.push({ identity: { entityKind: "z_battle_stage", entityId: id(row.id), sourceTable: "z_battle_stages", sourceRowId: id(row.id) }, status: "partial", values: { startAt: row.start_at, endAt: row.end_at, eventKeyStartAt: row.eventkagi_start_at, eventKeyEndAt: row.eventkagi_end_at }, boundary: "database_embedded_schedule_hint_not_server_current_availability" });
    }
    for (const row of o.budokais) {
        catalog.push({ identity: { kind: "budokai", id: id(row.id) }, status: "supported", sources: source("budokais", row.id), presentation: { title: row.name, description: row.description, role: "entity_title", locale: "snapshot_embedded_unverified" }, relations: [], rawAttributes: { enableBattleAuto: row.enable_battle_auto !== 0 } });
        availabilityHints.push({ identity: { entityKind: "budokai", entityId: id(row.id), sourceTable: "budokais", sourceRowId: id(row.id) }, status: "partial", values: { startAt: row.start_at, endAt: row.end_at, collectingEndAt: row.collecting_end_at, resultEndAt: row.result_end_at }, boundary: "database_embedded_schedule_hint_not_server_current_availability" });
    }
    for (const row of o.originSeries)
        catalog.push({ identity: { kind: "origin_series", id: id(row.id) }, status: "supported", sources: source("origin_series", row.id), presentation: title(row.name), order: row.priority, relations: [], rawAttributes: {} });
    for (const row of o.originEpisodes)
        catalog.push({ identity: { kind: "origin_episode", id: id(row.id) }, status: "supported", sources: source("origin_episodes", row.id), presentation: title(row.name), order: row.priority, relations: [{ kind: "origin_series", targetKind: "origin_series", targetId: id(row.origin_series_id), status: "supported" }], rawAttributes: {} });
    for (const row of o.originPages)
        catalog.push({ identity: { kind: "origin_page", id: id(row.id) }, status: "partial", sources: source("origin_pages", row.id), relations: [{ kind: "origin_episode", targetKind: "origin_episode", targetId: id(row.origin_episode_id), status: "supported" }], order: row.page_number, rawAttributes: { pageNumber: row.page_number } });
    for (const row of o.sdMaps)
        catalog.push({ identity: { kind: "sd_map", id: id(row.id) }, status: "partial", sources: source("sd_maps", row.id), presentation: title(undefined), relations: [], rawAttributes: {} });
    for (const row of o.sdPacks)
        catalog.push({ identity: { kind: "sd_pack", id: id(row.id) }, status: "partial", sources: source("sd_packs", row.id), presentation: { title: row.name, description: row.description, role: "entity_title", locale: "snapshot_embedded_unverified" }, relations: [], rawAttributes: {} });
    return { schemaVersion: 1, contract: "dokkan-events-database-first-catalog", contractVersion: "0.2.0", generatedAt: options.generatedAt, generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes", sourceSnapshotVersion: options.sourceSnapshotVersion, sourceDatabaseSha256: options.sourceDatabaseSha256, sourceE0: { contractVersion: "0.1.0", sha256: options.sourceE0Sha256 }, identityPolicy: "table_domain_plus_numeric_id_names_never_identity", catalog: catalog.sort(sortEntities), availabilityHints: availabilityHints.sort((a, b) => a.identity.entityKind.localeCompare(b.identity.entityKind) || a.identity.entityId.localeCompare(b.identity.entityId, "en", { numeric: true }) || a.identity.sourceTable.localeCompare(b.identity.sourceTable)), opaqueRootFamilies: o.opaqueRootFamilies.map(value => ({ family: value.family, status: "partial", identities: value.ids.map(id), source: { table: value.sourceTable, column: value.sourceColumn, rowCount: value.sourceRowCount }, missing: ["root_table", "title", "schedule", "topology"] })).sort((a, b) => a.family.localeCompare(b.family)), unrootedCandidateTables: o.unrootedCandidateTables.map(value => ({ ...value, status: "unknown" })).sort((a, b) => a.table.localeCompare(b.table)) };
}
exports.buildEventsE1Dataset = buildEventsE1Dataset;
function buildEventsE1Coverage(dataset) {
    const kinds = ["area", "chapter", "db_story_group", "z_battle_stage", "budokai", "origin_series", "origin_episode", "origin_page", "sd_map", "sd_pack"], countsByKind = {};
    for (const kind of kinds)
        countsByKind[kind] = dataset.catalog.filter(value => value.identity.kind === kind).length;
    return { schemaVersion: 1, entityCount: dataset.catalog.length, countsByKind, supportedEntityCount: dataset.catalog.filter(value => value.status === "supported").length, partialEntityCount: dataset.catalog.filter(value => value.status === "partial").length, relationshipCount: dataset.catalog.reduce((sum, value) => sum + value.relations.length, 0), availabilityHintCount: dataset.availabilityHints.length, opaqueRootIdentityCount: dataset.opaqueRootFamilies.reduce((sum, value) => sum + value.identities.length, 0), unrootedCandidateRowCount: dataset.unrootedCandidateTables.reduce((sum, value) => sum + value.rowCount, 0), presentationMissingCount: dataset.catalog.filter(value => !value.presentation || value.presentation.role === "missing").length };
}
exports.buildEventsE1Coverage = buildEventsE1Coverage;
//# sourceMappingURL=events-e1-builder.js.map