import argparse
import collections
import json
from pathlib import Path
import sqlite3
import sys


def quote(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def relation(connection, key, from_table, from_column, to_table, to_column):
    ft, fc, tt, tc = map(quote, (from_table, from_column, to_table, to_column))
    row = connection.execute(f"""
        SELECT COUNT(*) source_count,
               SUM(CASE WHEN f.{fc} IS NOT NULL THEN 1 ELSE 0 END) non_null_count,
               SUM(CASE WHEN f.{fc} IS NOT NULL AND t.{tc} IS NOT NULL THEN 1 ELSE 0 END) joined_count
        FROM {ft} f LEFT JOIN {tt} t ON t.{tc} = f.{fc}
    """).fetchone()
    non_null = row[1] or 0
    joined = row[2] or 0
    return {
        "key": key,
        "fromTable": from_table,
        "fromColumn": from_column,
        "toTable": to_table,
        "toColumn": to_column,
        "sourceRowCount": row[0],
        "nonNullSourceCount": non_null,
        "joinedSourceCount": joined,
        "danglingNonNullCount": non_null - joined,
    }


def encounter_observation(connection, table, id_column):
    source_count = parsed_count = battle_count = round_count = enemy_count = 0
    shapes, battle_shapes, round_shapes, enemy_shapes = set(), set(), set(), set()
    display_types = collections.Counter()
    card_ids, enemy_skill_ids, round_skill_set_ids = set(), set(), set()
    for source_id, raw in connection.execute(f"SELECT {quote(id_column)}, enemy_info FROM {quote(table)} ORDER BY {quote(id_column)}"):
        source_count += 1
        value = json.loads(raw)
        parsed_count += 1
        shapes.add(tuple(sorted(value.keys())))
        display_types[str(value.get("display_type"))] += 1
        for battle in value.get("battles") or []:
            battle_count += 1
            battle_shapes.add(tuple(sorted(battle.keys())))
            for round_value in battle.get("rounds") or []:
                round_count += 1
                round_shapes.add(tuple(sorted(round_value.keys())))
                for enemy in round_value.get("enemies") or []:
                    enemy_count += 1
                    enemy_shapes.add(tuple(sorted(enemy.keys())))
                    if enemy.get("card_id") is not None:
                        card_ids.add(enemy["card_id"])
                    enemy_skill_ids.update(enemy.get("enemy_skill_ids") or [])
                    if enemy.get("enemy_round_skill_set_id") is not None:
                        round_skill_set_ids.add(enemy["enemy_round_skill_set_id"])

    def joined_count(table_name, ids):
        if not ids:
            return 0
        placeholders = ",".join("?" for _ in ids)
        return connection.execute(f"SELECT COUNT(*) FROM {quote(table_name)} WHERE id IN ({placeholders})", tuple(ids)).fetchone()[0]

    return {
        "sourceTable": table,
        "sourceCount": source_count,
        "parsedCount": parsed_count,
        "topLevelShapes": [list(value) for value in sorted(shapes)],
        "battleShapes": [list(value) for value in sorted(battle_shapes)],
        "roundShapes": [list(value) for value in sorted(round_shapes)],
        "enemyShapes": [list(value) for value in sorted(enemy_shapes)],
        "displayTypeCounts": dict(sorted(display_types.items())),
        "battleCount": battle_count,
        "roundCount": round_count,
        "enemyCount": enemy_count,
        "uniqueCardIdCount": len(card_ids),
        "joinedCardIdCount": joined_count("cards", card_ids),
        "uniqueEnemySkillIdCount": len(enemy_skill_ids),
        "joinedEnemySkillIdCount": joined_count("enemy_skills", enemy_skill_ids),
        "uniqueEnemyRoundSkillSetIdCount": len(round_skill_set_ids),
        "joinedEnemyRoundSkillSetIdCount": joined_count("enemy_round_skill_sets", round_skill_set_ids),
    }


def inspect(connection):
    tables = []
    for (name,) in connection.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"):
        columns = []
        for column in connection.execute(f"PRAGMA table_info({quote(name)})"):
            columns.append({"name": column[1], "declaredType": column[2], "notNull": bool(column[3]), "primaryKeyOrdinal": column[5]})
        foreign_keys = []
        for foreign_key in connection.execute(f"PRAGMA foreign_key_list({quote(name)})"):
            foreign_keys.append({"id": foreign_key[0], "sequence": foreign_key[1], "targetTable": foreign_key[2], "fromColumn": foreign_key[3], "toColumn": foreign_key[4]})
        row_count = connection.execute(f"SELECT COUNT(*) FROM {quote(name)}").fetchone()[0]
        tables.append({"name": name, "rowCount": row_count, "columns": columns, "declaredForeignKeys": foreign_keys})
    relationships = [
        relation(connection, "quest_area", "quests", "area_id", "areas", "id"),
        relation(connection, "map_quest", "sugoroku_maps", "quest_id", "quests", "id"),
        relation(connection, "map_encounter", "sugoroku_map_enemy_informations", "sugoroku_map_id", "sugoroku_maps", "id"),
        relation(connection, "boss_drop_map", "sugoroku_map_boss_drop_items", "sugoroku_map_id", "sugoroku_maps", "id"),
        relation(connection, "boss_drop_quest", "sugoroku_map_boss_drop_items", "quest_id", "quests", "id"),
        relation(connection, "z_enemy_stage", "z_battle_enemies", "z_battle_stage_id", "z_battle_stages", "id"),
        relation(connection, "z_checkpoint_stage", "z_battle_check_points", "z_battle_stage_id", "z_battle_stages", "id"),
        relation(connection, "z_view_stage", "z_battle_stage_views", "z_battle_stage_id", "z_battle_stages", "id"),
        relation(connection, "z_first_reward_range_stage", "z_battle_first_reward_level_ranges", "z_battle_stage_id", "z_battle_stages", "id"),
        relation(connection, "origin_enemy_battle", "origin_battle_enemy_informations", "origin_battle_id", "origin_battles", "id"),
    ]
    area_families = []
    for row in connection.execute("""
        SELECT a.type, a.category, COUNT(DISTINCT a.id), COUNT(DISTINCT q.id), COUNT(DISTINCT m.id),
               COUNT(DISTINCT CASE WHEN e.sugoroku_map_id IS NOT NULL THEN m.id END)
        FROM areas a
        LEFT JOIN quests q ON q.area_id = a.id
        LEFT JOIN sugoroku_maps m ON m.quest_id = q.id
        LEFT JOIN sugoroku_map_enemy_informations e ON e.sugoroku_map_id = m.id
        GROUP BY a.type, a.category ORDER BY a.type, a.category
    """):
        area_families.append({"rawAreaType": row[0], "rawCategory": row[1], "areaCount": row[2], "questCount": row[3], "mapCount": row[4], "encounterMapCount": row[5]})
    return {
        "tableCount": len(tables),
        "tables": tables,
        "relationships": relationships,
        "areaFamilies": area_families,
        "encounters": [
            encounter_observation(connection, "sugoroku_map_enemy_informations", "sugoroku_map_id"),
            encounter_observation(connection, "origin_battle_enemy_informations", "origin_battle_id"),
        ],
    }


def selected_rows(connection, table, columns, order_by="id"):
    selected = ",".join(quote(column) for column in columns)
    return [dict(zip(columns, row)) for row in connection.execute(f"SELECT {selected} FROM {quote(table)} ORDER BY {quote(order_by)}")]


def selected_rows_by_ids(connection, table, columns, ids, id_column="id"):
    if not ids:
        return []
    selected = ",".join(quote(column) for column in columns)
    placeholders = ",".join("?" for _ in ids)
    order = quote(id_column) if id_column == "id" or "id" not in columns else f"{quote(id_column)},{quote('id')}"
    sql = f"SELECT {selected} FROM {quote(table)} WHERE {quote(id_column)} IN ({placeholders}) ORDER BY {order}"
    return [dict(zip(columns, row)) for row in connection.execute(sql, tuple(sorted(ids)))]


def parsed_encounters(connection, table, id_column):
    result, card_ids, skill_ids, round_set_ids = [], set(), set(), set()
    for source_id, raw in connection.execute(f"SELECT {quote(id_column)}, enemy_info FROM {quote(table)} ORDER BY {quote(id_column)}"):
        value = json.loads(raw)
        battles = []
        for battle_index, battle in enumerate(value.get("battles") or []):
            rounds = []
            for round_index, round_value in enumerate(battle.get("rounds") or []):
                enemies = []
                for enemy_index, enemy in enumerate(round_value.get("enemies") or []):
                    card_id = enemy.get("card_id")
                    enemy_skill_ids = enemy.get("enemy_skill_ids") or []
                    round_set_id = enemy.get("enemy_round_skill_set_id")
                    if card_id is not None:
                        card_ids.add(card_id)
                    skill_ids.update(enemy_skill_ids)
                    if round_set_id is not None:
                        round_set_ids.add(round_set_id)
                    enemies.append({
                        "position": enemy_index,
                        "cardId": card_id,
                        "enemySkillIds": enemy_skill_ids,
                        "enemyRoundSkillSetId": round_set_id,
                    })
                rounds.append({"position": round_index, "roundNoRaw": round_value.get("round_no"), "commentRaw": round_value.get("comment"), "enemies": enemies})
            battles.append({"position": battle_index, "rounds": rounds})
        result.append({"sourceId": source_id, "displayTypeRaw": value.get("display_type"), "battles": battles})
    return result, card_ids, skill_ids, round_set_ids


def encounters(connection):
    quest, quest_cards, quest_skills, quest_round_sets = parsed_encounters(connection, "sugoroku_map_enemy_informations", "sugoroku_map_id")
    origin, origin_cards, origin_skills, origin_round_sets = parsed_encounters(connection, "origin_battle_enemy_informations", "origin_battle_id")
    z_card_rows = selected_rows(connection, "z_battle_enemy_card_escalations", ["id", "escalation_type", "level", "card_id"])
    z_skill_rows = selected_rows(connection, "z_battle_enemy_skill_escalations", ["id", "escalation_type", "level", "enemy_skill_id"])
    card_ids = quest_cards | origin_cards | {row["card_id"] for row in z_card_rows}
    skill_ids = quest_skills | origin_skills | {row["enemy_skill_id"] for row in z_skill_rows}
    round_set_ids = quest_round_sets | origin_round_sets
    card_columns = ["id", "character_id", "card_unique_info_id", "resource_id", "rarity", "element", "lv_max", "hp_init", "hp_max", "atk_init", "atk_max", "def_init", "def_max"]
    cards = selected_rows_by_ids(connection, "cards", card_columns, card_ids)
    character_ids = {row["character_id"] for row in cards}
    characters = selected_rows_by_ids(connection, "characters", ["id", "race", "sex", "size"], character_ids)
    enemy_skill_columns = ["id", "exec_timing_type", "turn", "is_once", "probability", "causality_conditions", "target_type", "target_value1", "target_value2", "target_value3", "sub_target_type_set_id", "efficacy_type", "eff_value1", "eff_value2", "eff_value3", "efficacy_values", "calc_option"]
    round_relations = selected_rows_by_ids(connection, "enemy_round_skill_set_relations", ["id", "enemy_round_skill_set_id", "enemy_round_skill_id"], round_set_ids, "enemy_round_skill_set_id")
    round_skill_ids = {row["enemy_round_skill_id"] for row in round_relations}
    round_skill_columns = ["id", "exec_timing_type", "calc_option", "turn", "probability", "causality_conditions", "target_type", "target_value1", "target_value2", "target_value3", "sub_target_type_set_id", "efficacy_type", "eff_value1", "eff_value2", "eff_value3", "is_eternal"]
    return {
        "questEncounters": quest,
        "originEncounters": origin,
        "referencedCards": cards,
        "referencedCharacters": characters,
        "referencedEnemySkills": selected_rows_by_ids(connection, "enemy_skills", enemy_skill_columns, skill_ids),
        "referencedRoundSkillSets": selected_rows_by_ids(connection, "enemy_round_skill_sets", ["id", "effect_description", "cancel_description"], round_set_ids),
        "referencedRoundSkillSetRelations": round_relations,
        "referencedRoundSkills": selected_rows_by_ids(connection, "enemy_round_skills", round_skill_columns, round_skill_ids),
        "zBattleEnemies": selected_rows(connection, "z_battle_enemies", ["id", "z_battle_stage_id", "ordinal_num", "start_level", "end_level", "base_hp", "base_attack", "base_defence", "hp_escalation_type", "attack_escalation_type", "defence_escalation_type", "special_attack_escalation_type", "card_escalation_type", "performance_escalation_type", "skill_escalation_type"]),
        "zBattleCardEscalations": z_card_rows,
        "zBattleSkillEscalations": z_skill_rows,
        "zBattleStatusEscalations": selected_rows(connection, "z_battle_enemy_status_escalations", ["id", "escalation_type", "level", "escalation_value"]),
        "zBattlePowerupThresholds": selected_rows(connection, "z_battle_powerup_thresholds", ["id", "z_battle_stage_id", "hp", "atk", "def", "special_atk"]),
        "sdStageEnemyReferences": selected_rows(connection, "sd_stages", ["id", "sd_enemy_table_id"]),
    }


def catalog(connection):
    return {
        "areas": selected_rows(connection, "areas", ["id", "type", "category", "chapter_id", "db_story_id", "name", "event_priority", "all_clear_bonus_stones", "first_released_at", "mission_difficulty"]),
        "chapters": selected_rows(connection, "chapters", ["id", "name", "open_at"]),
        "chapterProperties": selected_rows(connection, "chapter_properties", ["id", "chapter_id", "start_at"]),
        "dbStories": selected_rows(connection, "db_stories", ["id", "name", "priority"]),
        "zBattleStages": selected_rows(connection, "z_battle_stages", ["id", "type", "priority", "related_z_battle_stage_id", "start_at", "end_at", "eventkagi_start_at", "eventkagi_end_at", "enable_battle_auto"]),
        "zBattleStageViews": selected_rows(connection, "z_battle_stage_views", ["id", "z_battle_stage_id", "enemy_name", "enemy_nickname", "enemy_resource_id"], "z_battle_stage_id"),
        "budokais": selected_rows(connection, "budokais", ["id", "name", "description", "start_at", "end_at", "collecting_end_at", "result_end_at", "enable_battle_auto"]),
        "originSeries": selected_rows(connection, "origin_series", ["id", "name", "priority"]),
        "originEpisodes": selected_rows(connection, "origin_episodes", ["id", "origin_series_id", "name", "priority"]),
        "originPages": selected_rows(connection, "origin_pages", ["id", "origin_episode_id", "page_number"]),
        "sdMaps": selected_rows(connection, "sd_maps", ["id"]),
        "sdPacks": selected_rows(connection, "sd_packs", ["id", "name", "description"]),
        "opaqueRootFamilies": [
            {
                "family": "rmbattle",
                "sourceTable": "rmbattle_missions",
                "sourceColumn": "rmbattle_id",
                "ids": [row[0] for row in connection.execute("SELECT DISTINCT rmbattle_id FROM rmbattle_missions ORDER BY rmbattle_id")],
                "sourceRowCount": connection.execute("SELECT COUNT(*) FROM rmbattle_missions").fetchone()[0],
                "missingRootTable": True,
            }
        ],
        "unrootedCandidateTables": [
            {"table": name, "rowCount": connection.execute(f"SELECT COUNT(*) FROM {quote(name)}").fetchone()[0]}
            for name in ["score_benefits", "special_bonuses", "genkai_gimmick_sub_categories", "rmbattle_missions"]
        ],
    }


def topology(connection):
    return {
        "quests": selected_rows(connection, "quests", ["id", "area_id", "name", "prev_quest_id", "any_clear_bonus_stones", "all_clear_bonus_stones", "visit_count_max", "interval_reset_visited_days", "can_ignore_difficulty_order", "limitation_announcement_id", "boostable", "start_at", "enable_sugoroku_auto", "enable_battle_auto", "enemy_info_display_type"]),
        "maps": selected_rows(connection, "sugoroku_maps", ["id", "quest_id", "difficulty", "act", "eventkagi_num", "user_exp", "zeni", "is_cpu_only", "link_skill_lv_up_prob_rate", "sugoroku_map_reward_group_id", "cpu_friend_list_id"]),
        "areaConditions": selected_rows(connection, "area_conditions", ["id", "area_id", "type", "conditions", "comment"]),
        "zBattleStages": selected_rows(connection, "z_battle_stages", ["id", "unlock_conditions"]),
        "zBattleEnemyRanges": selected_rows(connection, "z_battle_enemies", ["id", "z_battle_stage_id", "ordinal_num", "start_level", "end_level"]),
        "zBattleCheckPoints": selected_rows(connection, "z_battle_check_points", ["id", "z_battle_stage_id", "level", "act", "eventkagi_num"]),
        "zBattleRewardLevelAnchors": selected_rows(connection, "z_battle_first_reward_level_ranges", ["id", "z_battle_stage_id", "level"]),
        "originBattles": selected_rows(connection, "origin_battles", ["id", "origin_spot_id", "first_clear_bonus_stones", "act", "user_exp", "zeni", "link_skill_lv_up_prob_rate", "enable_battle_auto", "unlock_mission_ids", "limitation_announcement_id"]),
        "sdMaps": selected_rows(connection, "sd_maps", ["id"]),
        "sdArenas": selected_rows(connection, "sd_arenas", ["id", "sd_map_id", "position_x", "position_y", "symbol_item_type", "symbol_item_id"]),
        "sdStages": selected_rows(connection, "sd_stages", ["id", "sd_arena_id", "sd_enemy_table_id", "respawn_minutes", "position_x", "position_y"]),
    }


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["inventory", "catalog", "topology", "encounters"])
    parser.add_argument("--database", required=True)
    args = parser.parse_args()
    uri = Path(args.database).resolve().as_uri() + "?mode=ro&immutable=1"
    connection = sqlite3.connect(uri, uri=True)
    connection.execute("PRAGMA query_only=ON")
    try:
        value = inspect(connection) if args.command == "inventory" else catalog(connection) if args.command == "catalog" else topology(connection) if args.command == "topology" else encounters(connection)
        json.dump(value, sys.stdout, ensure_ascii=False, separators=(",", ":"))
    finally:
        connection.close()


if __name__ == "__main__":
    main()
