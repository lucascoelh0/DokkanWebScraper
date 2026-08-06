# Database-first Character / Team Analysis frontier

Status: experimental, non-production. Updated through DB28 (`0.27.0`) against snapshot `global-6.4.0-v338-2026-08-05`.

## Source identity and boundaries

- SQLite SHA-256: `3654eb7db9e18dfe4c238abd02bcc06a688ffa6f30aa1ad93fd108dcfeb78265`; size: 95,428,608 bytes.
- 232 tables exist; 36 tables and their declared columns are consumed read-only.
- Native runtime SHA-256: `7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a`.
- All artifacts remain ignored under `data/database-experiment/`. No production contract, Android code, R2 object, scraper, or production manifest is changed.

## Implemented first-party surface

| Area | Current first-party representation | Coverage / status |
|---|---|---|
| Cards and identity | card, character and unique-info IDs; collection membership; awakening families; form relations; release states | 5,759 cards; 5,344 collectable; 1,424 projected primary cards |
| Rarity, Type and Class | raw values plus confirmed mappings | N–LR; AGL/TEQ/INT/STR/PHY; unawakened/Super/Extreme |
| Stats and dates | raw initial/max stats, levels, costs and release timestamps with row provenance | all 5,759 card rows joined |
| Categories and links | ID-based joins and localized labels | represented without name-based identity |
| Leader skills | sets, rows, structured target/efficacy values and localized text kept separately | 10,654 release states; efficacy `82` confirmed, remaining numeric families conservative |
| Passive skills | sets → relations → skills → causalities; raw timing, target, turn, once, probability and efficacy fields | 1,571 passive states; 14,301 rules |
| Passive effects | typed effect atoms with raw numeric fields and provenance | 12,946 rules have supported effects; 72 partial; 1,283 unknown |
| Passive conditions | compositional AST with AND/OR/NOT and typed predicates | 11,825 supported, 848 partial, 1,628 unknown after DB11 |
| Selectors | category, class/type masks, Ki Sphere and partial name tokens | 131/136 DB5 projections supported; type-41 name dictionary unavailable |
| Combat-history conditions | attacks evaded/performed/received and guard are structurally retained; the former type-40 Super-Attack label is corrected by DB25 | 132 type-40 occurrences are partial native context predicates; recurrence and calculation bucket remain unknown |
| Native runtime predicates | attacks evaded and appearance-turn upper/lower bounds | types 43/51/55: 901 occurrences, 103 unique causalities, all projected |
| Native attack context | complementary predicates over byte 1 of caller-supplied `AdditionalParam` | types 40/56: 152 occurrences, 70 states; attack kind/direction/scope unknown and dynamic proof required |
| Super Attack categories | first-party category IDs, raw bit attributes and localized labels; native causality mask intersection | type 49: 83 occurrences, 34 states, 7 unique causalities; 83/83 selectors supported, activation partial |
| Target HP conditions | native enemy floating HP thresholds and runtime-selected player/enemy integer intervals | types 17/18/33: 59 occurrences, 25 states; metrics/parameters/comparators supported, activation partial |
| Revival activation history | native per-record activation counter, ability-owner and party predicates, pure/back current-record scopes and polarity | types 47/54: 70 occurrences, 20 states; 70/70 structural predicates supported, reset window/timing partial |
| Counter payloads | native `CounterBehavior` registration with resist rate, damage increase and battle-script ID | efficacy 120: 50 rules, 38 states, 150/150 payload fields supported; activation remains partial |
| Attack channels | Super, Ultra, Unit and EX rows, raw effects/conditions and source IDs | 12,429 / 1,255 / 186 / 20 attacks |
| Active / Standby / Finish | sets, skills, causalities, raw turns/limits and joins | 494 / 28 / 56 cards |
| Forms | transformations, giant/rage and reversible exchange relations | 359 / 139 / 60 relations |

EZA coverage is 4,855 confirmed states and SEZA coverage is 37. Nineteen future release states and three globally unknown release states remain explicitly separated; projected primary states contain no unknown release state.

## Confirmed, partial and unknown enums

Confirmed card enums:

- rarity `0..5` → N/R/SR/SSR/UR/LR;
- element ones digit `0..4` → AGL/TEQ/INT/STR/PHY;
- element band `0x` → unawakened, `1x` → Super, `2x` → Extreme;
- attack style strings `Normal`, `Hyper`, `Condition`, `Extra` → Super, Ultra, Unit, EX.

Confirmed passive efficacy types currently implemented: `1, 2, 3, 4, 5, 9, 13, 16, 18, 20, 48, 51, 67, 68, 76, 78, 81, 90, 91, 96, 98, 101`, plus the scoped efficacy-`120` counter payload. Type 120 proves `eff_value1 → resistDamageRate`, `eff_value2 → increaseDamagePercent`, and `eff_value3 → battleScriptNo`; it does not yet prove activation or damage-calculation behavior. Some numeric types have both mapped and unknown rows because their parameters or subfamilies are not universally proved.

Confirmed condition families include the earlier SQLite projections for causality types `1, 2, 5, 15, 16, 19, 24, 25, 30, 38, 42`, selector masks from type `46`, and native-backed runtime types `43, 51, 55`. Type `49` has a supported Super Attack category selector backed by `special_categories.raw_attribute` and the native bitmask consumer. Types `17/18/33` have supported target-HP metrics, parameters and inclusive comparators, with runtime scope/gates kept explicit. Types `47/54` have supported revival-activation counter predicates: ability-owner pure-current record for 47, and deck indices 0–6 across pure/back current records for 54, whose `cau_val1` zero/nonzero value selects any/none. These families remain partial at activation/history level. Types `40` and `56` have partial native predicates over `AdditionalParam` byte 1, but their attack kind, direction and scope are unknown. Type `3` remains partial (1,262 occurrences). Type `41` preserves 602 name tokens but lacks a first-party dictionary. Remaining numeric causalities stay raw/unknown even when the native dispatch slot has been identified.

No enum is promoted solely from a symbol name, localized description, parser parity, or statistical correlation.

## Parity frontier

- DB15 established 309 comparable aligned rule pairs.
- DB17 proved the normal appearance lifecycle and three scoped facts: entry counter minimum one, non-negated `>= 1` tautology, and `<= 1` equivalence to `== 1` under the stated lifecycle precondition.
- DB22 reprojected all 309 current rules from the original AST, normalized 195 tautologies, and changed 179 parity views.
- Exact/partial/divergent pairs improved from `89/1/219` to `149/1/159`.
- Residual occurrences fell from 395 after DB18 to 207 after DB22: 46 database-side and 161 current-side across 160 pairs.
- DB23 classifies those 207 occurrences into 23 patterns. The largest is 109 current-only direct `turn_from_entry <= N` predicates.

DB20 found `passive_skills.turn` numerically equal to the parser upper bound in 112 of 120 aligned cases and different in 8. DB21 proved row loading and relevant runtime timing APIs but no field-to-runtime linkage. `turn`, `is_once`, start point, unit, inclusivity and efficacy dependencies therefore remain unknown; the correlation is not a promotion.

DB24 followed efficacy type 120 through SQLite column literals, `PassiveSkill` offsets, runtime value materialization, `CallChangeParam`, the counter handler and named `CounterBehavior` getters. It resolves 50 rules across 38 states without parser evidence. Timing type 6, the handler gate, conditions, probability application, target behavior, bucket, duration, recurrence and battle-script behavior remain unknown, so all counter records are partial.

DB25 corrected an earlier experimental overclaim. DB4/DB11 had projected 132 type-40 occurrences as `super_attacks_performed` using only row-join evidence. Static runtime evidence proves only that type 40 tests bit 0 of `AdditionalParam` byte 1; type 56 tests whether the same byte is zero. DB25 emits 152 conservative correction records across 70 states, keeps attack kind/direction/scope unknown, and specifies the dynamic capture matrix required to resolve them. It makes zero semantic promotions.

DB26 moved to a statically provable, product-relevant subdomain. It ties `skill_causalities.cau_val1` for type 49 to the low-8-bit `CardSpecial::Category::Attribute`, proves the mask intersection in the native handler, and joins the structured `special_categories` dictionary. The current mask values 1/2/4 identify Ki Blast, Unarmed and Physical. All 83 selectors resolve; event direction, role, timing, recurrence and calculation bucket remain unknown.

DB27 resolves target-HP payloads for 59 occurrences. Types 17/18 calculate selected-enemy floating HP percentage and apply inclusive `>=`/`<=` thresholds from `cau_val1`. Type 33 applies inclusive `[cau_val1,cau_val2]` to a runtime-selected player/enemy integer HP percentage. Its helper's exact zero behavior, fractional normalization windows and nearest-ties-away rounding are pinned; no generic maximum clamp is claimed. The selection flag's semantic enum name, timing, recurrence and bucket remain unknown.

DB28 resolves 70 revival-history occurrences. The counter identity is backed by an increment writer reached after the available-revival efficacy/view callback, a revival-availability reader and a dedicated reset writer over the same `InGameCharaData +0x268` field. Type 47 tests the ability owner's pure-current record count with `> 0`; type 54 scans deck indices 0–6 across pure-current and back-current records, with `cau_val1 == 0` requiring any positive count and nonzero requiring none. The current snapshot uses only zero polarity. The reset trigger/history window, timing, recurrence, bucket and overflow behavior remain unknown.

## Product readiness

Already useful for Team Builder:

- stable card/form/release identity and duplicate grouping;
- categories, links, Class and Type;
- leader-skill structured targets/values where the efficacy family is proved;
- broad passive effect typing;
- supported team/rotation selectors and supported boolean conditions;
- scoped appearance-turn and attacks-evaded conditions;
- raw attack/Active/Standby/Finish/form relations for future state transitions.
- lossless counter payloads suitable for future simulation once activation and damage-order semantics are proved.
- structured Ki Blast/Unarmed/Physical compatibility for future nullification and attack-category analysis, without yet asserting activation.
- enemy/player HP scenario predicates with exact inclusive bounds and preserved runtime-selection boundary.
- revival-history predicates for the ability owner and whole party, including transformed/back current records and conservative reset-window handling.

Still required for trustworthy rotations, support and combat calculation:

- activation timing and calculation buckets for the major passive efficacy families;
- recurrence, accumulation, reset, expiry and once-only runtime semantics;
- target/sub-target semantics not yet tied to runtime behavior;
- final-blow, counter, nullification, attack-break and remaining combat-event causalities;
- exact revival-counter reset trigger/history window before long-lived simulations can expire or carry this state automatically;
- a dynamic mapping of the attack-context byte to normal/Super and outgoing/incoming events before types 40/56 can drive activation;
- damage formulas, rounding/order, ATK/DEF phase buckets and damage-received mitigation order;
- Super/Ultra/Unit/EX efficacy semantics beyond the lossless row model;
- boss/event structured mechanics, which belong to the next independent domain after Character/Team Analysis.

## Gap routing

SQLite-resolvable candidates:

- high-frequency unknown efficacy rows whose parameters form stable relational subfamilies;
- remaining structured target and sub-target joins;
- the structured `special_categories` dictionary is now resolved; remaining attack-category gaps concern activation context rather than identity;
- category/name dictionaries if a first-party table or asset join can be located;
- state-transition relations already represented by Active, Standby, Finish and passive skills.

ELF/runtime-resolvable candidates:

- efficacy dispatch handlers and parameter reads;
- execution timing and calculation-phase consumers;
- recurrence/counter/reset storage and mutation;
- call sites of `resetActivateRevivalSkillCount` to delimit the native revival-history window;
- target-mask evaluation;
- attack-event, counter, nullification and break handlers.
- writers of the caller-supplied attack-context `AdditionalParam` and their call-site event direction.

Dynamic execution required:

- behavior whose handler is inlined or whose DB field-to-object offset cannot be established statically;
- exact calculation ordering/rounding when static call graphs remain ambiguous;
- reset/expiry behavior dependent on battle transitions not observable from SQLite or a bounded ELF slice.
- type-40/type-56 action-kind and event-direction semantics, using the DB25 four-case capture matrix.

Other distributions/domains:

- localized name-token dictionary if absent from the Global SQLite/runtime assets;
- general art pipeline;
- banners/API;
- event/boss catalog and mechanics.

## Return on recent investigation and recommendation

DB17–DB22 produced material value: three scoped native promotions, 195 sound AST simplifications, 60 additional exact pairs, and a reduction of 188 residual occurrences. DB20–DB21 also prevented a high-correlation but false universal interpretation of `passive_skills.turn`. DB23 itself is diagnostic and establishes a clean parity frontier. DB24 then moved to combat semantics and promoted one high-impact efficacy family, resolving all 150 counter payload fields in the 50 in-scope rules while preserving every activation uncertainty. DB25 delivered negative but material value: it removed false precision from 132 rules and established a reproducible dynamic boundary rather than entrenching a parser-shaped label. DB26 resolved 83/83 structured Super Attack category selectors through a direct SQLite-to-runtime field path, DB27 resolved another 59 target-HP conditions with exact comparator and HP-rate calculation boundaries, and DB28 resolves 70 revival-history predicates through a concrete increment/read/reset chain rather than symbol naming alone.

Recommendation: continue database-first mapping. The next useful target is efficacy 111's statically visible attack-break payload/gate, followed by other structured causality selectors or high-volume combat efficacy payloads and shared calculation-timing/target consumers. Do not infer timing type 6 or attack direction from category/counter correlations alone. Integration into production remains **NO-GO** until calculation timing/recurrence and the highest-impact unknown efficacy/target families are either proved or explicitly isolated behind optional unknown-safe enrichment.
