import argparse
import hashlib
import json
from pathlib import Path
import sqlite3
import sys


def load(path):
    with Path(path).open("r", encoding="utf-8") as stream:
        return json.load(stream)


def canonical_sha(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")).hexdigest()


def ids(rows):
    return sorted({str(value) for value in rows}, key=lambda value: (len(value), value))


def unique_projection(key, side, projection):
    result = {}
    duplicates = []
    for row in projection:
        identity = str(row[0])
        if identity in result:
            duplicates.append(identity)
        result[identity] = list(row)
    if duplicates:
        raise ValueError(f"duplicate {side} identities in {key}: {ids(duplicates)[:20]}")
    return result


def facet(key, legacy_projection, first_party_projection, join=True, comparable=True, boundary=None, first_party_only_classification="representation_gain"):
    legacy = unique_projection(key, "legacy", legacy_projection)
    first_party = unique_projection(key, "first-party", first_party_projection)
    shared = sorted(set(legacy) & set(first_party), key=lambda value: (len(value), value))
    agreements = [value for value in shared if legacy[value] == first_party[value]]
    conflicts = [{"id": value, "legacy": legacy[value], "firstParty": first_party[value]} for value in shared if legacy[value] != first_party[value]]
    legacy_shared = [legacy[value] for value in shared]
    first_party_shared = [first_party[value] for value in shared]
    return {
        "key": key,
        "structuralJoin": join,
        "comparable": comparable,
        "boundary": boundary,
        "firstPartyOnlyClassification": first_party_only_classification,
        "legacyCount": len(legacy),
        "firstPartyCount": len(first_party),
        "joinedCount": len(shared),
        "agreementCount": len(agreements),
        "conflictCount": len(conflicts),
        "legacyProjectionSha256": canonical_sha(legacy_shared),
        "firstPartyProjectionSha256": canonical_sha(first_party_shared),
        "legacyOnlyIds": ids(set(legacy) - set(first_party)),
        "firstPartyOnlyIds": ids(set(first_party) - set(legacy)),
        "conflicts": conflicts,
    }


def identity_facet(key, legacy_ids, first_party_ids, boundary=None):
    return facet(key, [[str(value)] for value in legacy_ids], [[str(value)] for value in first_party_ids], boundary=boundary)


def rows(connection, table, columns, where="", parameters=()):
    selected = ",".join('"' + column.replace('"', '""') + '"' for column in columns)
    query = f'SELECT {selected} FROM "{table}" {where}'
    return [dict(zip(columns, row)) for row in connection.execute(query, parameters)]


def flatten_stages(payload, quest_story):
    areas = [area for chapter in payload["chapters"] for area in chapter["areas"]] if quest_story else payload["areas"]
    quests = [quest for area in areas for quest in area["quests"]]
    stages = [stage for quest in quests for stage in quest["stages"]]
    return areas, quests, stages


def map_projection(stages):
    return [[str(stage["id"]), str(stage["questId"]), int(stage["stamina"]), int(stage["requiredKeys"]), int(stage["rankExp"]), int(stage["zeni"]), float(stage["linkSkillLevelUpRate"])] for stage in stages]


def database_map_projection(database_maps):
    return [[str(row["id"]), str(row["quest_id"]), int(row["act"]), int(row["eventkagi_num"]), int(row["user_exp"]), int(row["zeni"]), float(row["link_skill_lv_up_prob_rate"])] for row in database_maps]


def z_observations(payload):
    battles = payload["battles"]
    phases = [phase for battle in battles for phase in battle["phases"]]
    enemies = [enemy for phase in phases for enemy in phase["enemies"]]
    cards = [entry for enemy in enemies for entry in enemy["cardEscalations"]]
    skills = [entry for enemy in enemies for entry in enemy["skillEscalations"]]
    status = []
    for enemy in enemies:
        for field in ("hpEscalations", "attackEscalations", "defenceEscalations"):
            status.extend(enemy[field])
    return battles, phases, enemies, cards, skills, status


def source_summary(name, payload):
    declared = {key: value for key, value in payload.items() if key.endswith("Count") or key == "count"}
    return {"name": name, "generatedAt": payload.get("generatedAt"), "source": payload.get("source"), "declaredCounts": declared}


def inspect(options):
    quest = load(options.quest_story)
    event = load(options.event_stages)
    catalog = load(options.stage_catalog)
    details = load(options.stage_details)
    z_battles = load(options.z_battles)
    frontier_series = load(options.frontier_series)
    frontier_chapters = load(options.frontier_chapters)
    event_rewards = load(options.event_rewards)
    event_missions = load(options.event_missions)

    connection = sqlite3.connect(f"file:{Path(options.database).as_posix()}?mode=ro", uri=True)
    connection.execute("PRAGMA query_only = ON")
    area_rows = rows(connection, "areas", ["id", "type"])
    quest_rows = rows(connection, "quests", ["id", "area_id"])
    map_rows = rows(connection, "sugoroku_maps", ["id", "quest_id", "act", "eventkagi_num", "user_exp", "zeni", "link_skill_lv_up_prob_rate"])
    z_stage_rows = rows(connection, "z_battle_stages", ["id"])
    z_enemy_rows = rows(connection, "z_battle_enemies", ["id", "z_battle_stage_id", "base_hp", "base_attack", "base_defence"])
    z_card_rows = rows(connection, "z_battle_enemy_card_escalations", ["id", "level", "card_id"])
    z_skill_rows = rows(connection, "z_battle_enemy_skill_escalations", ["id", "level", "enemy_skill_id"])
    z_status_rows = rows(connection, "z_battle_enemy_status_escalations", ["id", "level", "escalation_value"])
    origin_series_rows = rows(connection, "origin_series", ["id"])
    origin_episode_rows = rows(connection, "origin_episodes", ["id", "origin_series_id"])
    origin_page_rows = rows(connection, "origin_pages", ["id", "origin_episode_id", "page_number"])
    origin_battle_rows = rows(connection, "origin_battles", ["id", "act", "user_exp", "zeni", "link_skill_lv_up_prob_rate", "enable_battle_auto"])
    mission_category_rows = rows(connection, "mission_categories", ["id"])
    mission_rows = rows(connection, "missions", ["id", "mission_category_id", "area_id", "z_battle_stage_id", "origin_episode_id", "origin_battle_id"])
    mission_reward_rows = rows(connection, "mission_rewards", ["id", "mission_id", "item_id", "item_type", "quantity"])
    connection.close()

    database_quest_ids = {str(value["id"]) for value in quest_rows}
    bound_map_rows = [value for value in map_rows if str(value["quest_id"]) in database_quest_ids]
    unbound_map_rows = [value for value in map_rows if str(value["quest_id"]) not in database_quest_ids]

    quest_areas, quest_quests, quest_stages = flatten_stages(quest, True)
    event_areas, event_quests, event_stages = flatten_stages(event, False)
    main_area_ids = {str(row["id"]) for row in area_rows if row["type"] == "Area::MainArea"}
    main_quest_ids = {str(row["id"]) for row in quest_rows if str(row["area_id"]) in main_area_ids}
    main_map_rows = [row for row in map_rows if str(row["quest_id"]) in main_quest_ids]

    z_roots, z_phases, z_enemies, z_cards, z_skills, z_status = z_observations(z_battles)
    frontier_chapter_values = frontier_chapters["chapters"]
    frontier_pages = [page for chapter in frontier_chapter_values for page in chapter["pages"]]
    frontier_nodes = [node for page in frontier_pages for node in page["nodes"]]
    event_mission_categories = event_missions["categories"]
    legacy_missions = [mission for category in event_mission_categories for mission in category["missions"]]
    legacy_mission_rewards = [reward for mission in legacy_missions for reward in mission["rewards"]]

    facets = []
    facets.append(identity_facet("quest_story.area_identity", [area["id"] for area in quest_areas], main_area_ids))
    facets.append(facet("quest_story.quest_area", [[str(value["id"]), str(value["areaId"])] for value in quest_quests], [[str(value["id"]), str(value["area_id"])] for value in quest_rows if str(value["id"]) in main_quest_ids]))
    facets.append(facet("quest_story.level_fields", map_projection(quest_stages), database_map_projection(main_map_rows)))
    facets.append(facet("event_stages.quest_area", [[str(value["id"]), str(value["areaId"])] for value in event_quests], [[str(value["id"]), str(value["area_id"])] for value in quest_rows if str(value["id"]) in {str(item["id"]) for item in event_quests}], boundary="legacy_event_listing_has_no_total_family_scope"))
    event_map_db = [row for row in map_rows if str(row["id"]) in {str(item["id"]) for item in event_stages}]
    facets.append(facet("event_stages.level_fields", map_projection(event_stages), database_map_projection(event_map_db), boundary="legacy_event_listing_has_no_total_family_scope"))
    facets.append(facet("stage_details.level_fields", [[str(value["id"]), str(value["questId"]), int(value["stamina"]), int(value["requiredKeys"]), int(value["rankExp"]), int(value["zeni"]), float(value["linkSkillLevelUpRate"])] for value in details["entries"]], database_map_projection(bound_map_rows)))

    expected_group_keys = ([f"quest-story-chapter:{value['id']}" for value in quest["chapters"]] + [f"quest-story-area:{value['id']}" for value in quest_areas] + [f"event-area:{value['id']}" for value in event_areas] + [f"z-battle:{value['id']}" for value in z_roots])
    expected_entry_keys = ([f"quest-stage:{value['id']}" for value in quest_stages] + [f"event-stage:{value['id']}" for value in event_stages] + [f"z-battle-level:{battle['id']}:{phase['id']}:{level['level']}" for battle in z_roots for phase in battle["phases"] for level in phase["levels"]] + [f"z-battle-checkpoint:{battle['id']}:{phase['id']}:{checkpoint['level']}" for battle in z_roots for phase in battle["phases"] for checkpoint in phase["rewardCheckpoints"]])
    facets.append(identity_facet("stage_catalog.derived_groups", [value["key"] for value in catalog["groups"]], expected_group_keys))
    facets.append(identity_facet("stage_catalog.derived_entries", [value["key"] for value in catalog["entries"]], expected_entry_keys))

    facets.append(identity_facet("z_battles.root_identity", [value["id"] for value in z_roots], [value["id"] for value in z_stage_rows if str(value["id"]) in {str(root["id"]) for root in z_roots}]))
    facets.append(identity_facet("z_battles.phase_identity", [value["id"] for value in z_phases], [value["id"] for value in z_stage_rows]))
    facets.append(facet("z_battles.enemy_base_stats", [[str(value["id"]), str(next(phase["id"] for phase in z_phases if value in phase["enemies"])), int(value["baseHp"]), int(value["baseAttack"]), int(value["baseDefence"])] for value in z_enemies], [[str(value["id"]), str(value["z_battle_stage_id"]), int(value["base_hp"]), int(value["base_attack"]), int(value["base_defence"])] for value in z_enemy_rows]))
    facets.append(facet("z_battles.card_escalations", [[str(value["id"]), int(value["level"]), str(value["card"]["id"])] for value in z_cards], [[str(value["id"]), int(value["level"]), str(value["card_id"])] for value in z_card_rows]))
    facets.append(facet("z_battles.skill_escalations", [[str(value["id"]), int(value["level"]), str(value["skill"]["id"])] for value in z_skills], [[str(value["id"]), int(value["level"]), str(value["enemy_skill_id"])] for value in z_skill_rows]))
    facets.append(facet("z_battles.status_escalations", [[str(value["id"]), int(value["level"]), int(value["value"])] for value in z_status], [[str(value["id"]), int(value["level"]), int(value["escalation_value"])] for value in z_status_rows]))

    facets.append(identity_facet("frontier.series_identity", [value["id"] for value in frontier_series["series"]], [value["id"] for value in origin_series_rows]))
    facets.append(facet("frontier.episode_series", [[str(value["id"]), str(value["seriesId"])] for value in frontier_chapter_values], [[str(value["id"]), str(value["origin_series_id"])] for value in origin_episode_rows]))
    facets.append(facet("frontier.page_episode", [[str(value["id"]), str(chapter["id"]), int(value["pageNumber"])] for chapter in frontier_chapter_values for value in chapter["pages"]], [[str(value["id"]), str(value["origin_episode_id"]), int(value["page_number"])] for value in origin_page_rows]))
    facets.append(facet("frontier.node_fields", [[str(value["id"]), int(value["stamina"]), int(value["userExp"]), int(value["zeni"]), float(value["linkSkillLevelUpRate"]), int(bool(value["autoEnabled"]))] for value in frontier_nodes], [[str(value["id"]), int(value["act"]), int(value["user_exp"]), int(value["zeni"]), float(value["link_skill_lv_up_prob_rate"]), int(value["enable_battle_auto"])] for value in origin_battle_rows]))

    event_type_targets = {"bonus": "area", "challenge": "area", "dbstories": "area", "growth": "area", "limited": "area", "quest": "area", "story": "area", "zbattle": "z_battle_stage", "dokkanfrontier": "origin_series", "sdbattle": None}
    area_id_set = {str(value["id"]) for value in area_rows}
    z_id_set = {str(value["id"]) for value in z_stage_rows}
    origin_series_id_set = {str(value["id"]) for value in origin_series_rows}
    bound_map_id_set = {str(value["id"]) for value in bound_map_rows}
    event_family_counts = {}
    joined_event_map_ids = set()
    origin_episode_ids = {str(value["id"]) for value in origin_episode_rows}
    for event_value in event_rewards["events"]:
        family = event_value["type"]
        event_family_counts.setdefault(family, {"eventCount": 0, "joinedRootCount": 0, "stageCount": 0, "joinedStageCount": 0, "rootTarget": event_type_targets.get(family)})
        summary = event_family_counts[family]
        summary["eventCount"] += 1
        root_id = str(event_value["id"])
        target = event_type_targets.get(family)
        target_ids = area_id_set if target == "area" else z_id_set if target == "z_battle_stage" else origin_series_id_set if target == "origin_series" else set()
        summary["joinedRootCount"] += int(root_id in target_ids)
        for stage in event_value["stages"]:
            stage_id = str(stage["id"])
            summary["stageCount"] += 1
            joined = stage_id in origin_episode_ids if family == "dokkanfrontier" else stage_id in bound_map_id_set
            summary["joinedStageCount"] += int(joined)
            if family != "dokkanfrontier" and joined:
                joined_event_map_ids.add(stage_id)

    event_area_root_ids = {str(value["id"]) for value in event_rewards["events"] if event_type_targets.get(value["type"]) == "area"}
    event_quest_ids = {str(value["id"]) for value in quest_rows if str(value["area_id"]) in event_area_root_ids}
    event_bound_map_rows = [value for value in bound_map_rows if str(value["quest_id"]) in event_quest_ids]
    facets.append(identity_facet("event_rewards.stage_identity", joined_event_map_ids, [value["id"] for value in event_bound_map_rows]))
    facets.append(facet("event_missions.category_identity", [[str(value["id"])] for value in event_mission_categories], [[str(value["id"])] for value in mission_category_rows], boundary="legacy_mission_listing_has_no_total_event_category_scope", first_party_only_classification="unknown"))
    legacy_mission_ids = {str(value["id"]) for value in legacy_missions}
    legacy_reward_ids = {str(value["id"]) for value in legacy_mission_rewards}
    facets.append(facet("event_missions.mission_category", [[str(value["id"]), str(value["categoryId"])] for value in legacy_missions], [[str(value["id"]), str(value["mission_category_id"])] for value in mission_rows if str(value["id"]) in legacy_mission_ids]))
    facets.append(facet("event_missions.reward_fields", [[str(value["id"]), str(value["missionId"]), str(value["itemId"]), str(value["itemType"]), int(value["quantity"])] for value in legacy_mission_rewards], [[str(value["id"]), str(value["mission_id"]), str(value["item_id"]), str(value["item_type"]), int(value["quantity"])] for value in mission_reward_rows if str(value["id"]) in legacy_reward_ids]))
    linked_mission_ids = {str(value["id"]) for value in mission_rows if any(value[column] is not None for column in ("area_id", "z_battle_stage_id", "origin_episode_id", "origin_battle_id"))}

    cache_names = sorted(path.stem for path in Path(options.event_cache).glob("*.json"))
    expected_cache_names = sorted(f"{value['type']}-{value['id']}" for value in event_rewards["events"])
    return {
        "sources": [
            source_summary("quest-story-stages", quest), source_summary("event-stages", event), source_summary("stage-catalog", catalog), source_summary("stage-details", details), source_summary("z-battles", z_battles), source_summary("dokkan-frontier-series", frontier_series), source_summary("dokkan-frontier-chapters", frontier_chapters), source_summary("event-rewards", event_rewards), source_summary("event-missions", event_missions),
        ],
        "facets": facets,
        "eventFamilies": [{"family": key, **event_family_counts[key]} for key in sorted(event_family_counts)],
        "eventRewardRows": sum(len(value["rewards"]) for value in event_rewards["events"]),
        "eventRewardRowJoinBoundary": "derived_text_key_is_not_a_first_party_row_identifier",
        "eventCache": {"expectedCount": len(expected_cache_names), "observedCount": len(cache_names), "expectedProjectionSha256": canonical_sha(expected_cache_names), "observedProjectionSha256": canonical_sha(cache_names), "missing": ids(set(expected_cache_names) - set(cache_names)), "unexpected": ids(set(cache_names) - set(expected_cache_names))},
        "legacyMissionCount": len(legacy_mission_ids),
        "linkedLegacyMissionCount": len(legacy_mission_ids & linked_mission_ids),
        "unlinkedLegacyMissionIds": ids(legacy_mission_ids - linked_mission_ids),
        "firstPartyLinkedMissionCount": len(linked_mission_ids),
        "firstPartyLinkedMissionOnlyIds": ids(linked_mission_ids - legacy_mission_ids),
        "unknownSurfaces": [
            {"key": "stage_details.enemy_runtime_stats", "legacyCount": sum(len(value.get("enemies", [])) for value in details["entries"]), "reason": "first_party_encounter_contract_has_no_proven_runtime_stat_units"},
            {"key": "z_battles.mechanic_labels", "legacyCount": len(z_skills), "reason": "shadow_text_and_numeric_effect_labels_are_not_identity_or_semantic_authority"},
            {"key": "first_party.unbound_quest_maps", "legacyCount": len(unbound_map_rows), "reason": "map_rows_reference_quest_ids_absent_from_the_pinned_quest_table"},
        ],
        "unjoinableSurfaces": [
            {"key": "event_rewards.reward_rows", "legacyCount": sum(len(value["rewards"]) for value in event_rewards["events"]), "reason": "derived_text_key_is_not_a_first_party_row_identifier"},
            {"key": "event_rewards.sdbattle_roots", "legacyCount": event_family_counts.get("sdbattle", {}).get("eventCount", 0), "reason": "no_proven_first_party_root_join"},
            {"key": "event_missions.event_relation", "legacyCount": len({str(value["id"]) for value in legacy_missions} - linked_mission_ids), "reason": "mission_identity_joins_but_no_structural_event_or_stage_target_is_present"},
        ],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    parser.add_argument("--quest-story", required=True)
    parser.add_argument("--event-stages", required=True)
    parser.add_argument("--stage-catalog", required=True)
    parser.add_argument("--stage-details", required=True)
    parser.add_argument("--z-battles", required=True)
    parser.add_argument("--frontier-series", required=True)
    parser.add_argument("--frontier-chapters", required=True)
    parser.add_argument("--event-rewards", required=True)
    parser.add_argument("--event-missions", required=True)
    parser.add_argument("--event-cache", required=True)
    arguments = parser.parse_args()
    json.dump(inspect(arguments), sys.stdout, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


if __name__ == "__main__":
    main()
