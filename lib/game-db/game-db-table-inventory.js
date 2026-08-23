"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIRST_PARTY_EXPORT_GAME_DB_TABLES = exports.DOKKAN_FIELD_SIDECAR_TABLES = exports.SUPER_ATTACK_EFFECT_GAME_DB_TABLES = exports.CORE_GAME_DB_TABLES = void 0;
exports.CORE_GAME_DB_TABLES = [
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
];
exports.SUPER_ATTACK_EFFECT_GAME_DB_TABLES = [
    "specials",
];
exports.DOKKAN_FIELD_SIDECAR_TABLES = [
    "dokkan_fields",
    "dokkan_field_efficacy_sets",
    "dokkan_field_efficacies",
    "dokkan_field_active_skill_set_relations",
    "dokkan_field_passive_skill_relations",
];
exports.FIRST_PARTY_EXPORT_GAME_DB_TABLES = [
    ...exports.CORE_GAME_DB_TABLES,
    ...exports.SUPER_ATTACK_EFFECT_GAME_DB_TABLES,
    ...exports.DOKKAN_FIELD_SIDECAR_TABLES,
];
//# sourceMappingURL=game-db-table-inventory.js.map