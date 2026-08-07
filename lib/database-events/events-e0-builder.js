"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEventsE0Coverage = exports.buildEventsE0Dataset = exports.eventsE0SchemaSha256 = exports.classifyEventsE0Table = void 0;
const crypto_1 = require("crypto");
const SUPPORTED_TABLES = new Map([
    ["areas", { families: ["area_catalog"], role: "event_or_area_identity" }],
    ["quests", { families: ["quest_topology"], role: "stage_identity" }],
    ["sugoroku_maps", { families: ["quest_topology"], role: "level_or_difficulty_identity" }],
    ["sugoroku_map_enemy_informations", { families: ["quest_encounter"], role: "serialized_battle_round_enemy_topology" }],
    ["sugoroku_map_boss_drop_items", { families: ["quest_rewards"], role: "boss_drop_reference" }],
    ["cards", { families: ["shared_card_catalog"], role: "enemy_card_reference_target" }],
    ["enemy_skills", { families: ["enemy_mechanics"], role: "enemy_skill_reference_target" }],
    ["enemy_round_skill_sets", { families: ["enemy_mechanics"], role: "round_skill_set_identity" }],
    ["enemy_round_skill_set_relations", { families: ["enemy_mechanics"], role: "round_skill_set_relation" }],
    ["enemy_round_skills", { families: ["enemy_mechanics"], role: "round_skill_reference_target" }],
    ["origin_series", { families: ["origin_battle"], role: "series_identity" }],
    ["origin_episodes", { families: ["origin_battle"], role: "episode_identity" }],
    ["origin_pages", { families: ["origin_battle"], role: "page_identity" }],
    ["origin_battles", { families: ["origin_battle"], role: "battle_identity" }],
    ["origin_battle_enemy_informations", { families: ["origin_battle"], role: "serialized_battle_round_enemy_topology" }],
    ["origin_battle_passive_skill_set_relations", { families: ["origin_battle"], role: "battle_card_passive_override" }],
    ["z_battle_stages", { families: ["z_battle"], role: "z_battle_stage_identity" }],
    ["z_battle_enemies", { families: ["z_battle"], role: "z_battle_enemy_range" }],
    ["z_battle_check_points", { families: ["z_battle"], role: "z_battle_checkpoint" }],
    ["z_battle_stage_views", { families: ["z_battle"], role: "z_battle_stage_view" }],
    ["z_battle_first_reward_level_ranges", { families: ["z_battle"], role: "z_battle_first_reward_range" }],
]);
const PARTIAL_EXACT = new Map([
    ["area_conditions", { families: ["area_catalog"], role: "candidate_area_requirement" }],
    ["area_recommends", { families: ["area_catalog"], role: "candidate_rank_recommendation" }],
    ["area_tabs", { families: ["area_catalog"], role: "candidate_client_grouping" }],
    ["chapters", { families: ["main_area"], role: "candidate_hierarchy" }],
    ["chapter_properties", { families: ["main_area"], role: "candidate_hierarchy_properties" }],
    ["db_stories", { families: ["db_story"], role: "candidate_story_group" }],
    ["quest_category_bonuses", { families: ["quest_rules"], role: "candidate_category_bonus" }],
    ["quest_category_bonus_groups", { families: ["quest_rules"], role: "candidate_bonus_presentation" }],
    ["quest_category_bonus_rarity_tables", { families: ["quest_rules"], role: "candidate_bonus_scaling" }],
    ["quest_drop_item_views", { families: ["quest_rewards"], role: "candidate_drop_presentation" }],
    ["battle_params", { families: ["enemy_stats"], role: "candidate_battle_parameter_curve" }],
    ["enemy_ai_conditions", { families: ["enemy_mechanics"], role: "candidate_enemy_ai_rule" }],
    ["forced_scripts", { families: ["quest_rules"], role: "candidate_battle_script" }],
    ["level_bgs", { families: ["asset_reference"], role: "candidate_battle_background" }],
    ["score_benefits", { families: ["score_mode"], role: "candidate_score_rule" }],
    ["special_bonuses", { families: ["score_mode"], role: "candidate_special_bonus" }],
    ["genkai_gimmick_sub_categories", { families: ["score_mode"], role: "candidate_gimmick_taxonomy" }],
]);
function partialPrefix(name) {
    if (name.startsWith("z_battle_"))
        return { families: ["z_battle"], role: "candidate_z_battle_structure" };
    if (name.startsWith("budokai_") || name === "budokais")
        return { families: ["budokai"], role: "candidate_budokai_structure" };
    if (name.startsWith("rmbattle_"))
        return { families: ["rmbattle"], role: "candidate_rmbattle_structure" };
    if (name.startsWith("sd_"))
        return { families: ["sd_mode"], role: "candidate_sd_structure" };
    if (name.startsWith("mission_") || name === "missions")
        return { families: ["mission_reference"], role: "candidate_mission_join" };
    if (name.startsWith("bgm_") || name.startsWith("jukebox_") || name === "sound_effect_offsets")
        return { families: ["asset_reference"], role: "candidate_audio_reference" };
    if (name.endsWith("_items") || name === "support_memories" || name === "support_films")
        return { families: ["item_reference"], role: "candidate_item_catalog_target" };
    return undefined;
}
function classifyEventsE0Table(name) {
    const supported = SUPPORTED_TABLES.get(name);
    if (supported)
        return { status: "supported", ...supported, basis: "validated_structural_join" };
    const partial = PARTIAL_EXACT.get(name) ?? partialPrefix(name);
    if (partial)
        return { status: "partial", ...partial, basis: "bounded_schema_candidate" };
    return { status: "unknown", families: [], role: "not_yet_classified_for_events", basis: "not_yet_classified" };
}
exports.classifyEventsE0Table = classifyEventsE0Table;
function eventsE0SchemaSha256(observation) {
    const canonical = observation.tables
        .map(table => ({ name: table.name, columns: table.columns.map(column => column.name) }))
        .sort((left, right) => left.name.localeCompare(right.name));
    return (0, crypto_1.createHash)("sha256").update(JSON.stringify(canonical)).digest("hex");
}
exports.eventsE0SchemaSha256 = eventsE0SchemaSha256;
function buildEventsE0Dataset(options) {
    const tables = [...options.observation.tables]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(table => ({ ...table, domain: classifyEventsE0Table(table.name) }));
    return {
        schemaVersion: 1,
        contract: "dokkan-events-database-first-inventory",
        contractVersion: "0.1.0",
        generatedAt: options.generatedAt,
        generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes",
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabase: {
            ...options.sourceDatabase,
            schemaSha256: eventsE0SchemaSha256(options.observation),
            tableCount: options.observation.tableCount,
            readOnly: true,
        },
        identityPolicy: "numeric_structural_ids_only_names_and_text_are_presentation",
        scheduleBoundary: "static_catalog_fields_are_separate_from_server_availability",
        tables,
        relationships: [...options.observation.relationships].sort((a, b) => a.key.localeCompare(b.key)),
        areaFamilies: [...options.observation.areaFamilies].sort((a, b) => a.rawAreaType.localeCompare(b.rawAreaType) || a.rawCategory - b.rawCategory),
        encounters: [...options.observation.encounters].sort((a, b) => a.sourceTable.localeCompare(b.sourceTable)),
    };
}
exports.buildEventsE0Dataset = buildEventsE0Dataset;
function buildEventsE0Coverage(dataset) {
    const tableStatusCounts = { supported: 0, partial: 0, unknown: 0 };
    for (const table of dataset.tables)
        tableStatusCounts[table.domain.status]++;
    return {
        schemaVersion: 1,
        tableCount: dataset.tables.length,
        tableStatusCounts,
        declaredForeignKeyCount: dataset.tables.reduce((sum, table) => sum + table.declaredForeignKeys.length, 0),
        declaredPrimaryKeyCount: dataset.tables.reduce((sum, table) => sum + table.columns.filter(column => column.primaryKeyOrdinal > 0).length, 0),
        validatedRelationshipCount: dataset.relationships.filter(value => value.danglingNonNullCount === 0).length,
        danglingNonNullRelationshipCount: dataset.relationships.reduce((sum, value) => sum + value.danglingNonNullCount, 0),
        rawAreaFamilyCount: dataset.areaFamilies.length,
        areaCount: dataset.areaFamilies.reduce((sum, value) => sum + value.areaCount, 0),
        questCount: dataset.areaFamilies.reduce((sum, value) => sum + value.questCount, 0),
        mapCount: dataset.areaFamilies.reduce((sum, value) => sum + value.mapCount, 0),
        encounterSourceCount: dataset.encounters.length,
        encounterCount: dataset.encounters.reduce((sum, value) => sum + value.sourceCount, 0),
        roundCount: dataset.encounters.reduce((sum, value) => sum + value.roundCount, 0),
        enemyCount: dataset.encounters.reduce((sum, value) => sum + value.enemyCount, 0),
    };
}
exports.buildEventsE0Coverage = buildEventsE0Coverage;
//# sourceMappingURL=events-e0-builder.js.map