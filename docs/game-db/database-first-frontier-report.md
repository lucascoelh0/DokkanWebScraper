# Database-first Character / Team Analysis frontier

Status: experimental, non-production. Updated through DB34 (`0.33.0`) against snapshot `global-6.4.0-v338-2026-08-05`.

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
| Attack break | native per-enemy marker, marker multiplicity and ordered eligible-action selection | efficacy 111: 36 rules, 29 states, 35 passive IDs; 36/36 effects supported, lifecycle/timing partial |
| Efficacy removal | exact category/deck/SkillType/skill-ID removal selector plus conditional target and unconditional source status inactivation | efficacy 110: 367 rules, 172 states; raw selector behavior supported, all scheduling partial |
| Calculation operation | native `SkillCalcOption` dispatch, handler formulas, operand use, clamps and `float32` arithmetic | values 0–4 supported; 14,301 rules / 18,078 effects / 1,571 states projected, with timing, unit and bucket independent |
| Execution timing | SQLite-to-runtime field chain, equality filter, turn-sequence and player-attack-setup call sites | value 1 = native turn start; value 4 = player attack setup; 10,891 rules / 14,306 effects / 1,498 states supported, other values unknown |
| Basic ATK/DEF buckets | efficacy types 1–3, stat operands, timing-filtered former/latter consumers and double-precision difference accumulator | 5,612 rules / 9,239 stat applications / 5,466 passive IDs / 1,384 states; all applications retain partial target/lifecycle semantics |
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

Confirmed passive efficacy types currently implemented: `1, 2, 3, 4, 5, 9, 13, 16, 18, 20, 48, 51, 67, 68, 76, 78, 81, 90, 91, 96, 98, 101`, plus scoped efficacy-`110` removal, efficacy-`111` attack-break and efficacy-`120` counter behavior. Type 110 proves the exact four-field removal selector and status mutations, while SkillType/category names and scheduling remain unknown. Type 111 proves a parameterless per-enemy marker and first-N eligible current-action selection; its structured target enum, activation and lifecycle remain unknown. Type 120 proves `eff_value1 → resistDamageRate`, `eff_value2 → increaseDamagePercent`, and `eff_value3 → battleScriptNo`; it does not yet prove activation or damage-calculation behavior. Some numeric types have both mapped and unknown rows because their parameters or subfamilies are not universally proved.

Confirmed `SkillCalcOption` values are `0 → lhs + rhs`, `1 → max(lhs - rhs, 0)`, `2 → lhs + lhs × rhs / 100`, `3 → max(lhs - lhs × rhs / 100, 0)` and `4 → rhs` with `lhs` ignored. Native single-precision rounding is preserved at each arithmetic step. The enum proof is limited to operation: it does not imply unit, target, execution timing, calculation bucket, duration, recurrence or stacking. Values outside `0..4` remain unknown even though positive out-of-range native dispatch currently falls back to addition, because negative values index before the table and neither behavior defines an enum member.

Confirmed passive execution timing: `exec_timing_type = 1` selects the native turn-start execution event. Its supported sequence is after character appearance and reversible-result fixation and before support-memory and potential-skill execution. `exec_timing_type = 4` selects execution while `PlayerAttackDamageAndActionBank::setup` assembles a player-attack setup result; three call variants preserve raw skill-category/type selectors `(0,2)`, `(0,11)` and `(1,10)`. The label is deliberately `player_attack_setup`, not legacy `when_attacking` or `before_attacking`, and does not assert that the attack has executed or landed. Observed values `3, 5, 6, 7, 9, 11, 12, 14, 15` remain unknown. Neither supported timing implies a calculation bucket or settles `turn`, `is_once`, duration, recurrence or stacking.

Confirmed basic-stat buckets: efficacy `1` reads `eff_value1` into ATK, efficacy `2` reads `eff_value1` into DEF, and efficacy `3` reads `eff_value1` into ATK plus `eff_value2` into DEF. The native former-passive-stat consumer selects timings `1, 3, 11, 15, 18`; the latter-passive-stat consumer selects `4, 5, 6, 7, 9, 14`. These bucket identities do not promote unknown execution-event labels. For this consumer, calc options `0/1/4` use stat-point operands and `2/3` use percentage points of the current stat. Modifiers materialize through `float32`, accumulation is in `double`, flat changes truncate toward zero, negative percentage multipliers floor at zero, and the last assignment in efficacy-list order wins. Cross-bucket ordering, target selection and lifecycle dimensions remain unknown; timing `12` is not assigned to either bucket and future rows outside the proved groups remain lossless with bucket `unknown`.

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

DB29 resolves all 36 efficacy-111 rules across 29 states and 35 passive IDs. The handler registers an `AbilityEfficacyInfo` marker keyed by runtime enemy index. `AbilityManager::getAttackBreakingActions` counts matching markers and selects the first N eligible actions in current native order; the selection path does not consume `eff_value1..3`, which are all zero in this snapshot. Eligibility remains deliberately raw at action offsets 8 and 44. Structured target values 3/4, timing values 4/5, calculation options 0/2, probability application, exact expiry/removal and efficacy-112 invalidation remain unknown, so the operation is supported while full records are partial.

DB30 resolves the behavior of all 367 efficacy-110 rules across 172 states. `eff_value1..3` are proved as raw SkillType, skill-ID and removal-category selectors. Native removal requires equality of category, selected deck index, SkillType and skill ID, then conditionally writes raw zero to the matching target status and unconditionally to the source status. Raw source target type 16 selects an alternate runtime deck index. The 353 SkillType-2 occurrences have reproducible `passive_skills` ID candidates but remain partial because the numeric enum name is not independently proved; the 14 SkillType-15 targets remain unknown. Timing values 1/4/5/7, calculation options 0/2, recurrence and probability order are preserved raw.

DB31 follows `passive_skills.calc_option` from the SQLite column literal through the row constructor's runtime field at offset `0x48`, then through the five-slot `AbilityCalcFunc` dispatch table and every handler implementation. All 14,301 projected rules and 18,078 effects have a supported operation; this snapshot uses values 0, 2 and 3, while synthetic goldens cover all five proved values, out-of-domain unknowns, invalid payloads, signs, zero, saturation, assignment and native `float32` rounding. The legacy contract has no explicit operation field, so there is no directly comparable semantic conflict and the difference is recorded as a representation gap rather than parser agreement.

DB32 closes the former DB21 field-linkage gap for execution timing without reinterpreting `passive_skills.turn`. It follows `exec_timing_type` from `PassiveSkill +0x38` through `CreateAbilityStatus +0x14` to `AbilityStatus +0x08`; the execution manager reads it through the passive-status vtable and requires equality with the requested timing. Two bounded turn-start paths pass literal value 1. This promotes 9,061 rules and 11,809 effects across 1,449 states. The parser has 5,299 aggregate start-of-turn effects, but lacks a first-party rule identity for direct conflict measurement, so no agreement or conflict is claimed.

DB33 follows timing value 4 to exactly three native calls inside `PlayerAttackDamageAndActionBank::setup`. The calls execute raw category/SkillType variants `(0,2)`, `(0,11)` and `(1,10)` and feed their returned values into the setup result. Exhaustiveness for projected passive rows is independently proved: every native caller of the public passive creator passes category 0, its vtable forwards that value, the shared creator writes SkillType 2 for every `AbilityStatusPassive`, and the base constructor/vtable getters carry `(0,2)` to the equality filter used by the first setup call. Controller callers establish regular, extra and counter-attack setup paths; one bounded sequence consumes the setup result in `TrySpecialAttackAll` only after the timing-4 calls. This promotes another 1,830 rules and 2,497 effects across 827 states, raising combined known timing coverage to 10,891/14,301 rules. The parser has 1,807 aggregate `when_attacking` effects, but there is neither first-party rule identity nor native label equivalence, so no agreement or conflict is claimed.

DB34 follows efficacy types 1–3 through the native ATK/DEF handlers and their timing-filtered stat consumers. It assigns 5,612 rules and 9,239 stat applications to the former/latter passive-stat buckets, covering 5,466 passive IDs and 1,384 states. It also proves the consumer-specific stat unit, double-precision accumulation, truncation, negative-multiplier floor and assignment order. DB13 yields 1,901 diagnostic exact-effect alignments. Four latter-bucket rows align to legacy `passive_start_of_turn`, but the alignment does not prove rule identity, so they remain candidate conflicts and the confirmed conflict count is zero.

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
- attack-break capacity per enemy and native ordered multiplicity, without inventing scheduling or expiry semantics.
- exact efficacy-removal dependencies and candidate target-rule links, without scheduling them or naming raw SkillType/category enums.
- exact native calculation operations for all projected passive rules, independently of their still-unknown unit, timing and bucket.
- native turn-start scheduling for 9,061 passive rules, independently of their calculation bucket and recurrence.
- bounded player-attack setup scheduling for another 1,830 rules, including regular, extra and counter setup paths, without conflating setup with attack execution or hit resolution.
- native former/latter ATK/DEF buckets for 5,612 basic-stat rules, including the consumer-specific unit and arithmetic boundary, without inventing targets or lifecycle semantics.

Still required for trustworthy rotations, support and combat calculation:

- activation timing and calculation buckets for passive efficacy families beyond basic ATK/DEF;
- recurrence, accumulation, reset, expiry and once-only runtime semantics;
- target/sub-target semantics not yet tied to runtime behavior;
- final-blow, counter execution, nullification and remaining combat-event causalities;
- exact attack-break activation timing, expiry/removal predicate and efficacy-112 invalidation interaction;
- activation timing and recurrence for efficacy-110 before removal dependencies can expire effects automatically;
- exact revival-counter reset trigger/history window before long-lived simulations can expire or carry this state automatically;
- a dynamic mapping of the attack-context byte to normal/Super and outgoing/incoming events before types 40/56 can drive activation;
- cross-bucket ATK/DEF formula order, final stat assembly, damage formulas and damage-received mitigation order;
- consumers that establish how each proved calculation operation is assigned to Ki or other units and phase buckets;
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
- attack-event, counter and nullification handlers, plus attack-break lifecycle/invalidation consumers.
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

DB17–DB22 produced material value: three scoped native promotions, 195 sound AST simplifications, 60 additional exact pairs, and a reduction of 188 residual occurrences. DB20–DB21 also prevented a high-correlation but false universal interpretation of `passive_skills.turn`. DB23 itself is diagnostic and establishes a clean parity frontier. DB24 then moved to combat semantics and promoted one high-impact efficacy family, resolving all 150 counter payload fields in the 50 in-scope rules while preserving every activation uncertainty. DB25 delivered negative but material value: it removed false precision from 132 rules and established a reproducible dynamic boundary rather than entrenching a parser-shaped label. DB26 resolved 83/83 structured Super Attack category selectors through a direct SQLite-to-runtime field path, DB27 resolved another 59 target-HP conditions with exact comparator and HP-rate calculation boundaries, DB28 resolves 70 revival-history predicates through a concrete increment/read/reset chain rather than symbol naming alone, DB29 resolves all 36 attack-break effects with native enemy scoping and multiplicity, DB30 resolves 367 native removal operations while keeping the attractive but unproved SkillType-2 name only as a partial ID candidate, DB31 promotes the shared operation enum across all 14,301 projected passive rules without conflating it with unit or scheduling, DB32 schedules 9,061 of those rules at a precisely bounded native turn-start event, DB33 adds 1,830 rules at a bounded player-attack setup event without adopting parser labels, and DB34 assigns 5,612 basic ATK/DEF rules to native former/latter stat buckets with their exact consumer arithmetic.

Recommendation: continue database-first mapping. DB34 closes the highest-volume basic ATK/DEF bucket family, so the next highest-return target is the structured target/sub-target dispatch shared across efficacy handlers; lifecycle semantics (duration, recurrence, reset and expiry) follow once target scope is bounded. Integration into production remains **NO-GO** until remaining calculation buckets/recurrence and the highest-impact unknown efficacy/target families are either proved or explicitly isolated behind optional unknown-safe enrichment.
