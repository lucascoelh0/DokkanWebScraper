# First-party Stage candidate

## Scope

`run:game-db-stage-candidate` builds a local, non-production Stage dataset from
one exact Global game SQLite export. The previous Dokkan.fyi payload is optional
and comparison-only; no field from it enters the candidate. The command does
not acquire authenticated API data, publish R2 objects, or change Android.

The candidate consumes the structural area/quest/map/encounter tables, enemy
skills and round-skill sets, drop and category-bonus tables, mission relations,
and the Z-Battle topology, escalation and reward tables. It writes:

- `stage-details.json`, a readable audit artifact;
- `stage-details.json.gz`, the compact deterministic transport candidate;
- `stage-first-party-audit.json`, including authority limits and unresolved
  relations; and
- `candidate-manifest.json`, binding every output by size and SHA-256.

## Supported joins

- `areas.id -> quests.area_id -> sugoroku_maps.quest_id` reconstructs 5,391
  bound quest levels. Maps with no quest ID remain counted as unbound and are
  not silently attached to a quest.
- `sugoroku_map_enemy_informations.sugoroku_map_id` preserves battle, round and
  enemy order. Every card, enemy skill, round-skill set and round skill must
  resolve or generation fails.
- Enemy-skill relations preserve affected category, Link Skill, optimal-
  awakening category and Passive Skill Set IDs. Official cut-in phrases and
  voice asset IDs are joined structurally.
- The map row supplies stamina, required keys, Rank EXP, Zeni, BGM/background
  identifiers, puzzle-color weights and `link_skill_lv_up_prob_rate`.
- Quest/area rows supply release/navigation metadata, clear rewards,
  automation flags, Chapter/Story joins and official asset paths.
- Boss-drop rows, drop-preview rows and category-bonus rows are retained with
  their exact item/category IDs. Unknown drop probability or quantity is
  explicitly unknown rather than inferred.
- Z-Battle rows preserve base HP/ATK/DEF ranges, escalation curves, card/skill
  escalation IDs, thresholds, checkpoints, stamina/key costs and first/repeat
  reward item rows.

## Support Memory relation

Mission `conditions` JSON is interpreted only through structured numeric keys:
`sugoroku_map_ids` and `mission_ids`. Mission-owned `area_id` and
`z_battle_stage_id` are separate target kinds. Dependencies are followed
recursively with cycle and missing-target failures.

The same resolver feeds both datasets:

- Stage entries expose the Support Memories whose reward missions refer to the
  stage;
- the Stage dataset exposes all unique Memory-to-stage/area/Z-Battle relations;
  and
- each Support Memory acquisition source exposes its forward official Stage
  relations.

There is no localized-text or regex fallback. Memories with no specific Stage
relation remain valid—for example, the five default elemental memories in the
current snapshot.

## Authority boundary

The normal quest database does **not** contain final runtime enemy HP, ATK or
DEF. Player-card catalog stats are not enemy stats and are never substituted.
Normal enemies therefore carry `unavailable-in-game-db` plus the exact missing
dimensions. Exact values require a separately proven official briefing/start
API contract or a proven native formula.

Z-Battle base stats and escalation rows are first-party, but their application
formula, precedence and runtime modifiers are not yet proven. They remain
`raw-z-battle-base`; the candidate does not claim computed final values.

Difficulty labels and several raw efficacy values also remain untranslated
until first-party presentation or mechanic semantics are proven. Structured
IDs and official descriptions are preserved without inventing labels.

## Current real snapshot

Global snapshot `1787900894` (SQLite SHA-256
`571efa97333bf4fc74a983d24cc5dd9d56c5246a56606e445ff48edfdc0d9feb`)
produces 5,391 quest levels, 13,925 ordered enemy positions, 5,390 referenced
enemy skills, 234 Z-Battles, 932 checkpoints and 5,503 first-reward levels.
It produces 481 unique Support Memory relations covering 52 memories; the
forward Support Memory projection and inverse Stage projection have identical
relation keys.

The formatted JSON is 47,887,747 bytes. The deterministic compact gzip is
979,470 bytes and expands to 26,775,174 compact JSON bytes. Android should
consume a gzip-aware, staged/on-demand contract before this lane is enabled;
loading the complete object graph during startup is not an accepted production
design.
