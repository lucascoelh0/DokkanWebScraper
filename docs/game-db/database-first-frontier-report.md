# Database-first Character / Team Analysis frontier

Status: experimental, non-production. Updated through DB23 (`0.22.0`) against snapshot `global-6.4.0-v338-2026-08-05`.

## Source identity and boundaries

- SQLite SHA-256: `3654eb7db9e18dfe4c238abd02bcc06a688ffa6f30aa1ad93fd108dcfeb78265`; size: 95,428,608 bytes.
- 232 tables exist; 35 tables and their declared columns are consumed read-only.
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
| Combat-history conditions | attacks evaded/performed/received, guard and Super Attacks performed are structurally retained | 303 predicates; recurrence and calculation bucket remain unknown |
| Native runtime predicates | attacks evaded and appearance-turn upper/lower bounds | types 43/51/55: 901 occurrences, 103 unique causalities, all projected |
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

Confirmed passive efficacy types currently implemented: `1, 2, 3, 4, 5, 9, 13, 16, 18, 20, 48, 51, 67, 68, 76, 78, 81, 90, 91, 96, 98, 101`. Some numeric types have both mapped and unknown rows because their parameters or subfamilies are not universally proved.

Confirmed condition families include the earlier SQLite projections for causality types `1, 2, 5, 15, 16, 19, 24, 25, 30, 38, 42`, selector masks from type `46`, and native-backed runtime types `43, 51, 55`. Type `3` remains partial (1,262 occurrences). Type `41` preserves 602 name tokens but lacks a first-party dictionary. Remaining numeric causalities stay raw/unknown even when the native dispatch slot has been identified.

No enum is promoted solely from a symbol name, localized description, parser parity, or statistical correlation.

## Parity frontier

- DB15 established 309 comparable aligned rule pairs.
- DB17 proved the normal appearance lifecycle and three scoped facts: entry counter minimum one, non-negated `>= 1` tautology, and `<= 1` equivalence to `== 1` under the stated lifecycle precondition.
- DB22 reprojected all 309 current rules from the original AST, normalized 195 tautologies, and changed 179 parity views.
- Exact/partial/divergent pairs improved from `89/1/219` to `149/1/159`.
- Residual occurrences fell from 395 after DB18 to 207 after DB22: 46 database-side and 161 current-side across 160 pairs.
- DB23 classifies those 207 occurrences into 23 patterns. The largest is 109 current-only direct `turn_from_entry <= N` predicates.

DB20 found `passive_skills.turn` numerically equal to the parser upper bound in 112 of 120 aligned cases and different in 8. DB21 proved row loading and relevant runtime timing APIs but no field-to-runtime linkage. `turn`, `is_once`, start point, unit, inclusivity and efficacy dependencies therefore remain unknown; the correlation is not a promotion.

## Product readiness

Already useful for Team Builder:

- stable card/form/release identity and duplicate grouping;
- categories, links, Class and Type;
- leader-skill structured targets/values where the efficacy family is proved;
- broad passive effect typing;
- supported team/rotation selectors and supported boolean conditions;
- scoped appearance-turn and attacks-evaded conditions;
- raw attack/Active/Standby/Finish/form relations for future state transitions.

Still required for trustworthy rotations, support and combat calculation:

- activation timing and calculation buckets for the major passive efficacy families;
- recurrence, accumulation, reset, expiry and once-only runtime semantics;
- target/sub-target semantics not yet tied to runtime behavior;
- final-blow, counter, nullification, attack-break and remaining combat-event causalities;
- damage formulas, rounding/order, ATK/DEF phase buckets and damage-received mitigation order;
- Super/Ultra/Unit/EX efficacy semantics beyond the lossless row model;
- boss/event structured mechanics, which belong to the next independent domain after Character/Team Analysis.

## Gap routing

SQLite-resolvable candidates:

- high-frequency unknown efficacy rows whose parameters form stable relational subfamilies;
- remaining structured target and sub-target joins;
- category/name dictionaries if a first-party table or asset join can be located;
- state-transition relations already represented by Active, Standby, Finish and passive skills.

ELF/runtime-resolvable candidates:

- efficacy dispatch handlers and parameter reads;
- execution timing and calculation-phase consumers;
- recurrence/counter/reset storage and mutation;
- target-mask evaluation;
- attack-event, counter, nullification and break handlers.

Dynamic execution required:

- behavior whose handler is inlined or whose DB field-to-object offset cannot be established statically;
- exact calculation ordering/rounding when static call graphs remain ambiguous;
- reset/expiry behavior dependent on battle transitions not observable from SQLite or a bounded ELF slice.

Other distributions/domains:

- localized name-token dictionary if absent from the Global SQLite/runtime assets;
- general art pipeline;
- banners/API;
- event/boss catalog and mechanics.

## Return on recent investigation and recommendation

DB17–DB22 produced material value: three scoped native promotions, 195 sound AST simplifications, 60 additional exact pairs, and a reduction of 188 residual occurrences. DB20–DB21 also prevented a high-correlation but false universal interpretation of `passive_skills.turn`. DB23 itself is diagnostic and establishes a clean frontier.

Recommendation: continue database-first mapping, but move away from appearance-turn parity refinement. Prioritize high-frequency efficacy timing/calculation-bucket families and remaining native combat-event causalities. Integration into production remains **NO-GO** until calculation timing/recurrence and the highest-impact unknown efficacy/target families are either proved or explicitly isolated behind optional unknown-safe enrichment.
