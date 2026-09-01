export const CORE_GAME_DB_TABLES = [
    "active_skill_sets",
    "active_skills",
    "card_active_skills",
    "card_awakening_routes",
    "card_card_categories",
    "card_categories",
    "card_finish_skill_set_relations",
    "card_unique_info_set_relations",
    "card_unique_infos",
    "card_specials",
    "card_standby_skill_set_relations",
    "cards",
    "finish_skill_sets",
    "finish_skills",
    "leader_skill_sets",
    "leader_skills",
    "link_skills",
    "optimal_awakening_growths",
    "passive_skill_set_relations",
    "passive_skill_sets",
    "passive_skills",
    "skill_causalities",
    "special_sets",
    "standby_skill_set_finish_skill_set_relations",
    "standby_skills",
    "standby_skill_sets",
    "ultimate_specials",
] as const;

export const SUPER_ATTACK_EFFECT_GAME_DB_TABLES = [
    "specials",
] as const;

export const SUPER_ATTACK_CATEGORY_GAME_DB_TABLES = [
    "special_views",
    "special_categories",
] as const;

export const DOKKAN_FIELD_SIDECAR_TABLES = [
    "dokkan_fields",
    "dokkan_field_efficacy_sets",
    "dokkan_field_efficacies",
    "dokkan_field_active_skill_set_relations",
    "dokkan_field_passive_skill_relations",
] as const;

export const SUPPORT_MEMORY_GAME_DB_TABLES = [
    "mission_categories",
    "mission_rewards",
    "missions",
    "sub_target_type_sets",
    "sub_target_types",
    "support_films",
    "support_memories",
    "support_memory_enhancement_items",
    "support_memory_enhancement_levels",
    "support_memory_enhancement_require_items",
    "support_memory_skills",
] as const;

export const FIRST_PARTY_EXPORT_GAME_DB_TABLES = [
    ...CORE_GAME_DB_TABLES,
    ...SUPER_ATTACK_EFFECT_GAME_DB_TABLES,
    ...SUPER_ATTACK_CATEGORY_GAME_DB_TABLES,
    ...DOKKAN_FIELD_SIDECAR_TABLES,
    ...SUPPORT_MEMORY_GAME_DB_TABLES,
] as const;
