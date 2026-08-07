# Database-first events frontier

Status: E0–E4 complete (`0.5.0`); experimental, optional and non-production.

## Source identity

- Snapshot: `global-6.4.0-v338-2026-08-05`.
- Decrypted SQLite SHA-256: `3654eb7db9e18dfe4c238abd02bcc06a688ffa6f30aa1ad93fd108dcfeb78265`.
- SQLite size: 95,428,608 bytes; schema: 232 tables, SHA-256 `36a162820ad3617037a52108d7d5e435dcd26b6beaae2f4fea9bd9dda7392940`.
- Native ELF is not consumed by E0. Its pinned identity remains available only for a later bounded ambiguity.
- The database is opened read-only with `query_only=ON` and `immutable=1`; source identity is checked before and after the focused run.

## E0 identity frontier

The primary relational spine is numeric and structural: `areas.id → quests.area_id → sugoroku_maps.quest_id`. Every non-null map quest reference joins; 146 retained map rows have a null `quest_id` and are not promoted into stage topology. Quest encounters use `sugoroku_map_enemy_informations.sugoroku_map_id`, whose JSON has one stable top-level shape (`battles`, `display_type`). Nested arrays preserve battle order, round number and enemy order. Enemy references join through numeric `cards.id`, `enemy_skills.id` and `enemy_round_skill_sets.id`.

Z-Battles use an independent structural spine rooted at `z_battle_stages.id`. The `origin_*` tables form another independent series/episode/page/battle topology and reuse the same serialized encounter shape. No SQLite table declares a foreign key, so every relationship is validated explicitly rather than trusted from table or column names.

Area `type` and numeric `category` remain raw identities in E0. Product labels such as Story, Growth, Challenge or Limited are not assigned from localized names. Static catalog fields and database-embedded date fields are kept separate from server-provided availability/schedule.

## E0 coverage

- All 232 tables, 231 declared primary keys, declared columns and row counts are inventoried; only SQLite's internal `sqlite_sequence` lacks a declared primary key, and the database declares zero foreign keys.
- Table evidence status: 21 `supported`, 86 `partial`, 125 `unknown`.
- Ten bounded relationships reconstruct with zero dangling non-null references.
- Relational catalog: 674 areas, 3,101 quests and 5,320 maps joined to quests. Another 146 retained maps have a null `quest_id` and stay outside the promoted topology.
- Quest encounter serialization: 5,304 sources, 6,548 battles, 9,377 rounds and 13,769 enemy positions. All 5,228 unique card IDs, 5,312 unique enemy-skill IDs and 31 unique round-skill-set IDs join.
- Origin encounter serialization: 52 sources/battles, 94 rounds and 113 enemy positions. All 109 unique card IDs and 169 unique enemy-skill IDs join.
- Independent Z-Battle surface: 233 stages, 253 enemy ranges, 930 checkpoints and 233 stage views; the four bounded stage joins have no dangling ID.

Raw area-family volumes deliberately retain the source enums:

| Raw area type | Raw category | Areas | Quests | Joined maps | Encounter maps |
|---|---:|---:|---:|---:|---:|
| `Area::DbStory` | `9000` | 27 | 217 | 428 | 428 |
| `Area::EventArea` | `0` | 1 | 1 | 3 | 2 |
| `Area::EventArea` | `1` | 6 | 27 | 31 | 31 |
| `Area::EventArea` | `2` | 90 | 289 | 379 | 369 |
| `Area::EventArea` | `3` | 2 | 2 | 6 | 6 |
| `Area::EventArea` | `4` | 43 | 48 | 54 | 54 |
| `Area::EventArea` | `5` | 29 | 45 | 65 | 65 |
| `Area::EventArea` | `6` | 16 | 23 | 51 | 51 |
| `Area::EventArea` | `7` | 97 | 708 | 1,491 | 1,486 |
| `Area::EventArea` | `8` | 3 | 51 | 52 | 52 |
| `Area::EventArea` | `9` | 19 | 73 | 113 | 113 |
| `Area::EventArea` | `10` | 122 | 220 | 425 | 425 |
| `Area::EventArea` | `11` | 13 | 45 | 45 | 45 |
| `Area::EventArea` | `12` | 40 | 174 | 327 | 327 |
| `Area::EventArea` | `13` | 2 | 2 | 2 | 2 |
| `Area::EventArea` | `14` | 1 | 3 | 3 | 3 |
| `Area::EventArea` | `15` | 1 | 3 | 3 | 3 |
| `Area::EventArea` | `16` | 1 | 1 | 1 | 1 |
| `Area::EventArea` | `18` | 1 | 1 | 1 | 1 |
| `Area::EventArea` | `20` | 107 | 852 | 914 | 914 |
| `Area::EventArea` | `21` | 7 | 7 | 7 | 7 |
| `Area::EventArea` | `23` | 1 | 1 | 1 | 1 |
| `Area::EventArea` | `24` | 1 | 1 | 1 | 1 |
| `Area::EventArea` | `27` | 1 | 1 | 1 | 1 |
| `Area::MainArea` | `0` | 42 | 305 | 915 | 915 |
| `Area::TutorialArea` | `0` | 1 | 1 | 1 | 1 |

## E0 deterministic artifacts

`generatedAt` is deliberately pinned to the source snapshot timestamp rather than wall-clock time; the contract records this policy explicitly so reproducibility is not confused with a live run timestamp. The ignored inventory is 378,986 bytes, SHA-256 `ec6e8752eca9704cd1d5ed89a75c6144cf056562c74ced77eb0ef1b78503d004`. Coverage is 468 bytes, SHA-256 `bc700540ee2e90a7753305420120757b81bf79b3d52c6f89a26e3183c5271249`; validation is 174 bytes, SHA-256 `d9de43941059bab6fafbe18d4c4a1093b06adc34910e816211d9223b42c32142`. Two focused generations are byte-identical, manifest size/hash checks pass, full table reconstruction is 232/232 and peak working set is 329,887,744 bytes.

## Gate boundary

E0 creates no productive event payload and does not consume scraped pages. It labels validated structural tables as `supported`, schema-only candidates as `partial`, and everything not yet classified for the event domain as `unknown`. E1 promotes only catalog semantics backed by those structural consumers or joins.

## E1 catalog frontier

E1 projects 1,178 structurally identified catalog entities from ten table domains: 674 areas, 7 chapters, 4 DB-story groups, 233 Z-Battle stages, 63 Budokai records, 2 origin series, 3 origin episodes, 13 origin pages, 48 `sd` maps and 131 `sd` packs. Identity is always `table-domain + numeric ID`; embedded names and descriptions are presentation with locale explicitly unverified. Per-entity source table/row provenance is retained, including both stage and view rows for Z-Battle.

All 113 catalog relations join without dangling IDs: area→chapter, area→DB-story group, related Z-Battle stage, origin episode→series and origin page→episode. Numeric area categories and raw Z-Battle types remain unlabeled. Z-Battle rows are `partial` because the database view provides enemy display text rather than an event title. Origin pages and `sd` maps are also `partial` because no title is present. Overall status is 753 supported and 425 partial, with 61 missing presentations.

Availability is a separate 310-record channel. Chapter open/start values, Z-Battle start/end/key windows and Budokai phase dates are marked only as `database_embedded_schedule_hint_not_server_current_availability`; they never decide whether an event is currently playable. `areas.first_released_at` remains static release metadata rather than schedule.

The snapshot contains 98 distinct `rmbattle_id` values across 2,174 mission rows but no `rmbattles` root table, so those identities remain an opaque `partial` family without title, schedule or topology. `score_benefits` (706 rows), `special_bonuses` (19), `genkai_gimmick_sub_categories` (22) and the RMBattle mission rows remain unrooted candidates. No product label such as Virtual Clash, Burst Mode or Dokkan Frontier is assigned from table names alone.

The ignored E1 catalog is 952,729 bytes, SHA-256 `567f54e09bb63427e972bf94e785bdacc92d69370c0ce5d09ef0d56a0d2c3100`. Coverage is 512 bytes, SHA-256 `cae7cd60a624daa8f7a35dbd2a59f5a42f0d7b40ba7a6a4982df031d167ef5c6`; validation is 184 bytes, SHA-256 `01ce7bea0676df42ff69c54e6f3cc985ce293dd33e2b9371775e803401abb45e`. The payload is pinned to E0 SHA-256 `ec6e8752eca9704cd1d5ed89a75c6144cf056562c74ced77eb0ef1b78503d004` and the same SQLite identity. Its focused peak working set is 335,581,184 bytes.

## E2 topology frontier

The traditional topology is 674 area roots → 3,101 quest stages → 5,320 joined map/level records. Every quest has at least one level, 1,183 previous-quest references join, and deep-link keys use only area, quest and map IDs. Raw difficulty values remain numeric and unlabeled: `0/1/2/3/4/5` occur `1,217/773/1,912/890/225/303` times. ACT, event-key count, rank EXP, Zeni, attempt caps/reset days, auto/boost flags and nullable first-clear fields are preserved without defaults. Another 146 historical map rows have null `quest_id`; they remain lossless `unknown` records and receive no synthetic stage.

Fourteen area requirements retain their raw type, JSON conditions and comments as `partial`; names and comments do not establish mechanics. Quest `start_at` remains a schedule hint rather than current availability.

Z-Battle uses an independent 233-stage topology with 253 enemy level ranges, 930 cost checkpoints and 5,492 reward-level anchors. Every source row joins its structural stage. All current enemy ranges have a null `end_level`, so E2 preserves the open bound instead of inventing a maximum. Unlock JSON stays `partial` pending semantic validation.

The `origin_battles` table supplies 52 cost/rule records, but its 52 `origin_spot_id` values have no root table and no proved page join; they remain partial non-traditional battles. The `sd` topology reconstructs 48 maps → 231 arenas → 1,169 stages without dangling IDs, while its product-family label and `sd_enemy_table_id` target remain unknown. Budokai and RMBattle roots explicitly report missing stage/server-runtime topology rather than adopting quest semantics.

The ignored E2 topology is 8,039,874 bytes, SHA-256 `682acb6d0c8ca87cb9fb413fc25de1c68a64ddcc3c9c516561d6c458bb5c93cd`. Coverage is 512 bytes, SHA-256 `8771a018dcc6b51981f9060c1ab59093711653ee6b941e510dc1443d5d32997e`; validation is 193 bytes, SHA-256 `d410c5f7980b84cfdc549ecc50e796288a598fbfba930b9d58189b05b6601103`. It is pinned to E1 SHA-256 `567f54e09bb63427e972bf94e785bdacc92d69370c0ce5d09ef0d56a0d2c3100`; exact projection and all bounded joins pass with peak working set 385,429,504 bytes.

## E3 encounter frontier

E3 reconstructs every serialized quest and Origin encounter without flattening its arrays: 5,304 quest encounter rows contain 6,548 battles, 9,377 rounds and 13,769 ordered enemy positions; 52 Origin rows contain 113 enemy positions. Array ordinal, source `round_no`, nullable comment, display type, card ID, ordered skill IDs and nullable round-skill-set ID are separate fields. Quest encounter topology is supported. Origin remains partial because E2 still has no `origin_spot` root or catalog-page join.

The union of quest, Origin and Z-Battle references reaches 6,005 cards, 1,133 master-character rows and 9,117 enemy skills. Every card joins `cards.id`, every card's `character_id` joins `characters.id`, and every enemy-skill reference joins `enemy_skills.id`. The payload retains card resource IDs and the card catalog's raw classification/stat columns, but marks their enemy-runtime application `unknown`: player-card `hp_init/hp_max`, ATK and DEF columns are not promoted to enemy stats. The 31 referenced round-skill sets reconstruct through 121 relation rows to 111 round skills with no dangling ID. Skill parameters are lossless raw records whose mechanic meaning is deferred to E4.

Z-Battle remains an independent range model: 253 enemy ranges retain base HP/ATK/DEF fields, seven raw escalation-type IDs, 1,220 card escalation rows, 5,206 skill escalation rows and 6,061 unique status-curve points. Curves are stored once by escalation-type identity and referenced from ranges, avoiding redundant copies. Base fields and curve points are `partial`; units, formula, precedence and runtime modifiers are explicitly unknown. The 233 power-up threshold rows are also raw/partial. No Z formula is applied.

All 1,169 `sd_stages.sd_enemy_table_id` values are preserved, but the snapshot has no matching SD enemy-table target. They therefore remain opaque partial references rather than synthetic encounters. RMBattle and Budokai also retain their E2 non-traditional boundaries.

The ignored E3 encounter payload is 21,606,761 bytes, SHA-256 `4e29d3f119292f260c3fc82c888530df69ea549d9ed75eb4a5c1edfaadfa15f4`. Coverage is 639 bytes, SHA-256 `52913e8d06a95398fb1d8853a725589fb5e6c77db1f6723ca261e6dbfcfd4308`; validation is 182 bytes, SHA-256 `255fb1d67467155f28572c5f2dd7939caed08679fdd2c74d82c361ecb2e18008`; six repository-pinned representative goldens are 1,084 bytes, SHA-256 `403ca6835f3d93935673f6aac275895b58d0809cf351d835fe429dda1759480e`. E3 is pinned to E2 SHA-256 `682acb6d0c8ca87cb9fb413fc25de1c68a64ddcc3c9c516561d6c458bb5c93cd`. Exact reconstruction covers 5,356 source encounter rows, 13,882 enemy positions and 45,290 validated join edges with zero dangling IDs. Two generations are byte-identical; peak working set is 448,815,104 bytes.

## E4 mechanics frontier

E4 inventories all 9,117 referenced enemy-skill rules and 111 referenced round-skill rules by their raw efficacy types: 30 enemy types and 10 round types. Timing, turn, once-only flag, probability, causality JSON, target fields, efficacy values and calculation option remain lossless in E3 and are counted again through E4 lineage; no product mechanic is assigned from an enum, column name or localized description.

Four relational mechanic surfaces are structurally supported while their effect direction and magnitude remain partial: 1,504 enemy-skill→card-category rows, 247 enemy-skill→link-skill rows, 52 enemy-skill→optimal-awakening-category rows and 620 enemy-skill→passive-skill-set rows. All 2,423 source relations and both endpoints reconstruct. Every referenced skill has raw `sub_target_type_set_id = 0`; no positive set is promoted or treated as a dangling identity.

Quest category bonuses contribute 962 raw rules joined to category and rarity-table IDs. Three historical rows point at absent quests `367001`–`367003`; they are preserved with unknown quest binding rather than treated as current stages. Origin heat-up structure reconstructs 51 sets referenced by 52 battles, 140 threshold entries and 16 raw effect rows. Group/threshold order is structural; gauge units, effects and runtime application remain unknown. All 4,726 `enemy_ai_conditions` rows remain unbound because no encounter/card consumer is proved.

One high-impact native ambiguity was bounded to the 697 referenced `enemy_skills.efficacy_type = 10` rows. The pinned ELF contains `EnemySkillUtil::convertEfficacyType`, whose table maps enemy raw type 10 to generic type 94; generic dispatch slot 94 relocates to `callChangeInvalidateStunFunc`. A scan of the 42,387,476-byte `.text` region found no direct branch-with-link call that closes the runtime chain from the enemy row through the converter to that handler. The investigation therefore stopped at its declared abandonment condition. Evidence status is partial and semantic promotion is zero. Passive DB0–DB50 meanings are not reused across the enemy-skill table boundary.

Of nine requested mechanic families, four are partial and five unknown; none is supported for runtime simulation. Category/link membership, round topology, raw countdown/condition fields and the bounded status-immunity mapping provide representation gain. Damage reduction, guard/type interaction, dodge/nullification/attack break, Super Attack AI, locks/sealing/rotations/fields and effect formulas remain outside the supported frontier. Beneficial-character derivation and damage calculation are not implemented.

The ignored E4 mechanics payload is 3,473,577 bytes, SHA-256 `63bd000293123ed8bfec315c124d49d50014f9ff9ab0f1220727d75dbdbcdcaf`. Coverage is 653 bytes, SHA-256 `2328591ffac0a0dd43be8ffb9d79504580c48947a8977b3603a5c29c6bf510ce`; validation is 183 bytes, SHA-256 `46fcd18385e4903ed76d948de262147b52f33bfc9215b047f11b42de72e1ded1`. The canonical native evidence SHA-256 is `af048e03c860efc435310609c1989d49c6fd140c8f62f1a676dc3e2621b7c842`, pinned to ELF SHA-256 `7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a`. Exact projection, zero unintended dangling IDs and native evidence validation pass; two generations are byte-identical and peak working set is 623,247,360 bytes.
