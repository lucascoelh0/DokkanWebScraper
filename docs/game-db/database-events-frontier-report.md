# Database-first events frontier

Status: E0–E9 complete (`1.0.0`); experimental, optional and non-production.

## Source identity

- Snapshot: `global-6.4.0-v338-2026-08-05`.
- Decrypted SQLite SHA-256: `3654eb7db9e18dfe4c238abd02bcc06a688ffa6f30aa1ad93fd108dcfeb78265`.
- SQLite size: 95,428,608 bytes; schema: 232 tables, SHA-256 `36a162820ad3617037a52108d7d5e435dcd26b6beaae2f4fea9bd9dda7392940`.
- Native ELF is not consumed by E0–E3 or E5. E4 consumed its pinned identity only for one bounded ambiguity documented below.
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

## E5 rewards, costs and requirements frontier

E5 reconstructs 107,699 first-party reward rows without using scraped text as authority. Quest maps contribute 15,254 boss-drop rows; every row joins both its numeric map and quest IDs. The source supplies a raw `drop_type` but no quantity or chance column, so quantity, chance and repeatability remain explicitly unknown. The 362 quest drop-view rows are retained separately as partial previews with 2,243 preview item positions across quest and linked mission-category views; they are never treated as authoritative drop rates.

Z-Battle rewards are normalized rather than duplicated per level: 5,492 level anchors reference 5,066 reward-set IDs containing 22,225 first-reward rows, while 930 checkpoints reference 906 normal-reward groups and 1,463 tables/reward rows. Stage, level, group and main-reward IDs are preserved independently. The first-reward family label establishes grouping only; runtime claim frequency remains partial. Normal-reward repeatability is unknown.

The standard mission slice includes only the 7,944 missions structurally linked to an area, Z-Battle stage, Origin episode or Origin battle, plus their 13,734 reward rows. Raw target values and conditions are preserved, and database dates remain schedule hints rather than server availability. World Tournament contributes 5,234 mission rewards, 41,664 ranking gifts and 2,609 box-ranking rewards. Another 5,516 reward rows join the 98 opaque RMBattle roots from E1. Historical World Tournament rows include 79 missions and 20 ranking gift sets whose `budokai_id` has no current root, plus nine box ranges whose ranking root is absent; all 108 bindings and the 36 rewards under the orphan ranges are retained as `unknown`, not silently dropped or counted as current dangling IDs.

E5 validates item identity as the pair of the first-party raw item type and numeric ID. Eighteen raw item types join every referenced ID to a catalog target, covering cards, awakening items/medals, training/support/potential/treasure/equipment items, ACT and event-key items, link-level items, support memories and films, enhancement items, skins, stickers, wallpapers, achievements, special items and SD packs. This yields 97,683 supported item references. Five raw types have no item catalog target in the snapshot—point currencies, Dragon Balls, status-capacity extensions and jukebox tracks—so 12,259 references remain `unknown`; their IDs are preserved without invented joins.

Quest/map reward-group IDs and Origin reward-set IDs have no target table in the snapshot and stay partial. `dot_character_lv_rewards` has 1,400 rows but no proved event/stage consumer and remains an unbound unknown surface. Costs are referenced losslessly from E2 for all quest levels, Z-Battle checkpoints and Origin battles; area requirement source IDs and raw mission requirements remain separate from rewards. No catalog is duplicated beyond referenced identity sets, no reward chance is inferred, and no server schedule is synthesized.

The ignored E5 payload is 77,316,994 bytes, SHA-256 `c2739eda27146de7e8ea16735ceb1f625878615ab8be601534a5dc28950902bf`. Coverage is 626 bytes, SHA-256 `6e73d03755e9aa651e8ce795428cfe4ffe39e4f75f81580f015057d643a57585`; validation is 159 bytes, SHA-256 `3209b07b42a9fbfbda2fa64ee6041f0beb4a3c740a3ffd76084df01b90f0990d`. The payload is pinned to E4 SHA-256 `63bd000293123ed8bfec315c124d49d50014f9ff9ab0f1220727d75dbdbcdcaf`, E2 SHA-256 `682acb6d0c8ca87cb9fb413fc25de1c68a64ddcc3c9c516561d6c458bb5c93cd` and E1 SHA-256 `567f54e09bb63427e972bf94e785bdacc92d69370c0ce5d09ef0d56a0d2c3100`. Exact projection, zero unintended dangling IDs, source-before/source-after identity and two byte-identical generations pass. Peak working set was 824,152,064 bytes, below the 1 GiB gate limit but high enough that E8 must split delivery payloads and avoid cumulative in-memory assembly.

## E6 asset-reference frontier

E6 creates stable keys for 2,691 unique first-party database paths and 6,208 unique numeric asset references, with 41,198 lossless source bindings. Bindings cover event/list/banner images, linked mission-category icons, Origin series/episode banners and page backgrounds, quest/Origin BGM IDs, battle and SD background IDs, start/finish/World Tournament script IDs, Z-Battle enemy resource IDs and 4,444 non-null resource IDs on cards referenced by E3 encounters. Asset identity is a hash of the exact database path or a typed numeric domain plus raw ID; entity names and localized text are never keys.

Reference identity and binary delivery are separate. None of the 2,691 database paths is literally present as a file entry in the pinned base APK. Adding a conventional `assets/` prefix is tested only as a candidate and never proves delivery; this snapshot produced zero path-prefix or BGM filename candidates. Delivery remains `unknown_requires_downloaded_container_or_endpoint`: paths may require downloaded CPK containers or an external endpoint, but this snapshot has no validated runtime asset manifest that proves which. Numeric BGM/background/script/resource references are partial for the same reason.

The base APK is 98,799,013 bytes, SHA-256 `a51ba758e0555e0a756aa4f20278e6bec25ba6b0c7dcdcd0f4372e0fad159bc0`. It contains 779 ZIP entries and 122 directly extractable files below `assets/`, including 73 CPK containers, 12 ACB banks and 5 AWB banks. These base entries are available as container/file bytes; their internal CPK members are not enumerated or copied by this gate. Event-specific binaries remain absent as exact entries and endpoint/container lineage is unknown.

Seven representative APK entries totaling 6,508,096 bytes are pinned and rehashed on every focused run:

| APK entry | Size | SHA-256 |
|---|---:|---|
| `assets/database.db` | 535,552 | `667e554a9cfb8c4765f05a1d85f0fdf707ade61562b50e3e5cd98ac52f997ba3` |
| `assets/bgm/bgm_009.acb` | 5,440 | `b7d6212b5273900f2b96d8d08e0598f84476a6954f6a2bb3d6d82c88f0cd09cc` |
| `assets/bgm/bgm_009.awb` | 1,892,384 | `708bd306d23fe769ba2050996b5ec2bf293d00b46b829ec6c91c37acc8817895` |
| `assets/layout/en/image/mypage.cpk` | 598,240 | `d382dbaf7320600529a5faadd900576085f56a9de8698ffda0fdfa41512daab2` |
| `assets/outgame/effect/myp_11000.cpk` | 3,355,088 | `2f429f8210741d88fc5f3d58b8ba93bd94ac51ed62f0edf4a23c0f120a66f425` |
| `assets/character/card/0000000.cpk` | 88,416 | `8e1ca5ce2ed1e7f2e1590d1da92d5fe2aa000764dbc8851270636421030d08d5` |
| `assets/ingame/battle/character/00000.cpk` | 32,976 | `e82e7c4932201064fecba93973338ba58ef1d86f9310572ec806991d1752e115` |

The eight `unused_asset_paths` patterns are retained verbatim as unknown evidence; the table name is not used to infer download, exclusion or availability semantics. Referenced enemy-card IDs and linked mission-category IDs are exported independently from their joined target rows, and the validator compares both sets so a missing target cannot disappear during projection. The ignored E6 payload is 14,041,784 bytes, SHA-256 `b7eca431b9b3dea6b8fb901ed8d7204ca56b300e5320dfa91e7649731da9da9e`. Coverage is 611 bytes, SHA-256 `a3bba27c3d777b0b0578e9c5d908b97e46ded9bbe3528dc3f097a6fd68d53756`; validation is 154 bytes, SHA-256 `b0675b1ac91aee9cb5bef0061daad52bb5598eb1172fcf93f52d7775ed41cceb`. The APK baseline SHA-256 is `d8be48a04696dfb5831fcc73e2eb90c78d585fd4c5013c90c3997ee781d8c029`, and E6 is pinned to E5 SHA-256 `c2739eda27146de7e8ea16735ceb1f625878615ab8be601534a5dc28950902bf`. Exact projection, sample hashes, 41,198 source bindings, zero dangling structural references and two byte-identical generations pass. Peak working set was 403,050,496 bytes.

## E7 shadow-parity frontier

E7 compares nine pinned scraper artifacts and the 898-file DokkanInfo cache only through explicit structural IDs. The ten source lineages retain generated timestamps, declared counts, byte sizes and SHA-256; the aggregate lineage SHA-256 is `54c71ba94a9adc7cd9ff0a7023e9bce2b6bbb65a992e4c5351a319fa52db55c4`. Five scraper implementation files are fingerprinted as pagination evidence and checked against a fail-closed baseline, SHA-256 `795c40ecead102e2d9f950138e87636b5e268d0bc746cb75e3212e7912ae608d`; a code change requires re-auditing the claim. Duplicate structural IDs are rejected before projection. No scraper is executed, no source text becomes authority and no production artifact is changed.

Quest Story agrees for all 41 areas, 301 quests and 903 map/level projections, including area/quest relations, ACT, key cost, rank EXP, Zeni and link-level rate. The first-party `MainArea` family adds 1 area, 4 quests and 12 maps. The pinned event-stage listing agrees for all 147 quest relations and 186 level projections, but its total family scope is not claimed. Stage details agree for all 1,477 map projections; another 3,843 structurally bound first-party maps provide representation gain. The 146 map rows without a joined quest remain an explicit unknown first-party surface. The derived stage catalog reconstructs exactly: 235 groups and 7,600 entry keys.

All 177 Z-Battle roots and 205 scraped phases join. The database adds 28 phase IDs. Base stats agree for all 222 scraped enemies, with 31 additional first-party enemies. Card escalations agree `1,119/1,119` with 101 additional first-party rows; skill escalations agree `4,565/4,565` with 641 additional rows; unique status points agree `4,070/4,070` with 1,991 additional rows. This is field parity only. Scraper labels and descriptions for mechanics stay `unknown` and do not promote E4 semantics.

Dokkan Frontier agrees for 1 series, 1 episode, 8 pages and 35 node/battle field projections. The database adds 1 series, 2 episodes, 5 pages and 17 battles. The `origin_battles.id` value provides field identity for the 35 pinned nodes, but it does not remove E2's missing `origin_spot` topology boundary.

The DokkanInfo event artifact accounts for 898 event roots and its output keys exactly match all 898 cache basenames. All area-backed families join by root ID: Bonus `87/87`, Challenge `106/106`, Dragon Ball Stories `27/27`, Growth `203/203`, Limited `16/16`, Quest `42/42` and Story `187/187`. Z-Battle roots join `203/203`; Dokkan Frontier series roots join `2/2`. The 25 DokkanInfo `sdbattle` roots have no proved first-party series root and remain `unjoinable`. S2 subsequently identifies that family as Pettan/Sticker Battle, not Super Battle Road; SBR and ESBR are challenge roots 710/720 and already join SQLite areas and quest levels by numeric IDs. Across traditional event stages, all 5,299 unique map IDs join. Restricting the first-party comparison universe to quests under those structurally joined event roots adds 8 map IDs; maps elsewhere in the database are not counted as event representation gain. E7 classifies all 40,345 normalized reward records as `unjoinable` because their row-like number is retained only in a derived key and E7 deliberately does not parse it. S3 later pins that key-builder implementation, but finds that it did not distinguish `payload.id` from a synthetic DOM-index fallback and did not record pre-deduplication counts. It therefore keeps 17,829 structural matches as partial candidates and 22,516 records unjoinable; no historical record is promoted to agreement or confirmed conflict.

Event Missions agrees for all 463 category identities, 5,456 mission/category relations and 9,541 reward projections, including reward ID, mission ID, item ID/type and quantity. Another 846 database mission-category identities are present, but the legacy listing has no proved total event-category scope, so that surplus is `unknown`, not representation gain. Of the 5,456 legacy missions, the agreement subset contains only the 5,277 with an explicit first-party event/stage target; the other 179 join as mission identities but form a separate `unjoinable` relation set with hashed ID evidence. The full first-party linked slice contains 7,944 missions, adding 2,667 structurally linked identities.

The result has 46 exclusive comparison records: 24 `agreement`, 15 `representation_gain`, zero `confirmed_conflict`, 4 `unknown` and 3 `unjoinable`. Zero conflicts means no production discrepancy was hidden or repaired; it does not establish remote completeness. Pagination is supported only for local cache/output set accounting. Last-page iteration for event stages, Z-Battles and event missions is `partial` because the artifacts do not pin response pagination metadata or optional limits. Quest Story, Dokkan Frontier and DokkanInfo event indexes remain `unknown` for total remote coverage.

The ignored E7 payload is 38,021 bytes, SHA-256 `5fe6d4f819138f1ef96bc70854a1ea26d40c5526c0337db958bca71bf4a56d7f`. Coverage is 453 bytes, SHA-256 `bad5d9f92f103c2ab7d9b684a6c285aadaa8788148df9958dd654e4e6c6f5746`; validation is 147 bytes, SHA-256 `5f2a578d8db9010f8c208387f6826c68731b946885fb6e64d804a63b4083c0fe`. E7 is pinned to E6 SHA-256 `b7eca431b9b3dea6b8fb901ed8d7204ca56b300e5320dfa91e7649731da9da9e` and the same SQLite snapshot. Exact projection, projection hashes, set accounting, source-before/source-after identity and two byte-identical generations pass. Peak working set was 335,511,552 bytes.

## E8 optional sidecars and focused refresh

E8 treats the stabilized E1–E6 payloads as six independently downloadable sidecars rather than assembling another cumulative JSON graph: event catalog, stage topology, encounters, boss/stage mechanics, rewards and asset references. Their combined payload size is 125,431,719 bytes, but the registry only references each immutable payload, coverage and validation artifact by file name, contract version, byte size and SHA-256. The split is 952,729 / 8,039,874 / 21,606,761 / 3,473,577 / 77,316,994 / 14,041,784 bytes respectively. Cross-sidecar lineage is validated through the complete E1→E2→E3/E4→E5→E6 dependency chain; all source validations are green and aggregate dangling IDs are zero.

Delivery state is part of the contract: sidecars are optional, the default pipeline is disabled, production replacement is false, R2 publication is false and Android consumption is false. The registry is additive metadata over ignored experimental artifacts; it copies no SQLite, ELF, APK, image or extracted asset and changes no productive dataset or manifest.

The focused refresh runner executes E0, E1, E2, E3, E4, E5, E6 and E8 sequentially in isolated child processes. It fingerprints database, ELF and APK before any output directory is created, verifies them against an explicit refresh profile, verifies four profile-owned semantic baselines by SHA-256, and fingerprints all three external sources again after the run. A future snapshot must supply a new profile and compatible E0 inventory baseline, E3 representative goldens, E4 bounded native evidence and E6 APK baseline. Passing a new database with the old profile fails before writing; downstream gates accept explicit baseline paths and cannot silently fall back to the repository's old semantics during a focused refresh.

One full refresh into a separate ignored output directory reproduced E0–E6 and every E8 artifact byte-for-byte. Its final isolated per-gate peak working sets were E0 413,962,240; E1 421,298,176; E2 432,951,296; E3 470,843,392; E4 646,746,112; E5 847,204,352; E6 424,292,352; E8 404,852,736 bytes. The maximum remains below 1 GiB; no generation or test ran concurrently.

The refresh profile is 1,320 bytes, SHA-256 `15a33d16724c5dd7f3aaab1e7db3d6e4d695422a665e08693f9e18d9e95b7778`. The ignored registry is 14,750 bytes, SHA-256 `05ebfd1bab51d4b7562ee3b7cc878c87bfda76736266dc3ebb63933c5e8a3f1a`; coverage is 4,593 bytes, SHA-256 `b24c971b4790c6e599a98d7f14afcbd56073c930f90bcca72e0e3c325d764c08`; validation is 287 bytes, SHA-256 `1c38a22450a56ffaea301b388476a545900bbf6adfa39f23ff6fa196a5b606dd`; the deterministic refresh receipt is 1,567 bytes, SHA-256 `44254e4a72fb215019c1ac5c3d94642691fc50231c6017d5e9cd494117424f16`. The E8 manifest itself is SHA-256 `76d1793d66ab53885ceef26da7c96b7cb456da35167ec83d06aa8cf843e799e2`. Two package generations are byte-identical, and the independent full refresh matches the existing artifacts byte-for-byte.

## E9 readiness checkpoint

E9 is a deterministic decision contract over the validated E7 parity evidence and E8 sidecar registry. It does not execute any approved or rejected action. Readiness is intentionally asymmetric: infrastructure that remains disabled and generation pinned to an audited profile are ready; production replacement and consumers that require missing server, runtime, asset-delivery, Android or product authority are not.

| Decision | Status | Binding reason |
|---|---|---|
| Merge disabled infrastructure | **GO** | Contracts are additive/optional, lineage and validators fail closed, and default generation/production mutation remain off. This is readiness only; no merge was performed. |
| Pinned optional generation | **GO** | The focused profile pins DB/ELF/APK and semantic baselines, all artifacts reproduced byte-for-byte, and peak memory stayed below 1 GiB. Each new snapshot requires an explicit compatible profile. |
| Replace scraped datasets | **NO-GO** | Remote completeness and current server availability are not proved; reward rows and Pettan series roots contain unjoinable surfaces; consumer migration parity has not run. |
| Publish R2 | **NO-GO** | Publication was not authorized, and no publisher dry-run, projected-byte report, stable-key plan or cache policy exists for these sidecars. |
| Android shadow consumption | **NO-GO** | Android is unchanged/out of scope and optional/missing/old-cache compatibility has not been integration tested. |
| Event/stage screens | **NO-GO** | Current availability, locale/presentation coverage and event-asset delivery are incomplete, and no UI/product contract exists. |
| Beneficial-character calculation | **NO-GO** | Requested runtime mechanic semantics have zero supported families; category/link relations alone are insufficient and no product algorithm was defined. |
| Boss/damage simulation | **NO-GO** | Runtime stat scaling, units, precedence, guard/type/damage/AI mechanics and the full combat contract remain incomplete and out of scope. |

The remaining boundaries require a different authority rather than more low-return table-name inference: server API for current availability, Ultimate Clash/Burst/Pettan roots and reward identity; an explicit legacy-source contract for remote totals; runtime consumer proof for enemy stats/formulas and boss mechanics; a download manifest or endpoint for event assets; Android integration for shadow consumption; and product decisions for screens and beneficial-character rules. Dynamic capture, Android, R2 and production replacement were not attempted.

The ignored E9 readiness payload is 6,347 bytes, SHA-256 `f7a111572485e0c55758a186d753e40eebf59f2de4c262c192a5ad5cf0cf781c`. Coverage is 202 bytes, SHA-256 `b75da2d23daf6dea0dc0a0edf16c939616f23ab0c7457de6d21fa53bfbc99950`; validation is 149 bytes, SHA-256 `193a416c65e837fe1a76cbf17800908b842492458629eb3e2876811d9cb7cb6a`. It is pinned to E7 SHA-256 `5fe6d4f819138f1ef96bc70854a1ea26d40c5526c0337db958bca71bf4a56d7f`, E8 registry SHA-256 `05ebfd1bab51d4b7562ee3b7cc878c87bfda76736266dc3ebb63933c5e8a3f1a` and refresh-evidence SHA-256 `4bc74227999830503a57d297aad5684711979a94b0d41fb5b33286b30bd93a12`. The validator proves all 12 named before/after artifact pairs against current E0–E8 hashes, the exact gate order and every recorded peak. Exact projection, source evidence and decision-policy validation pass; two generations are byte-identical and the E9 peak working set was 242,884,608 bytes. E0–E9 are complete, making this the campaign's natural checkpoint.
