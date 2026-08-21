# Combat Rules Gate A8.1 audit

Date: 2026-08-04

Global snapshot: `db-1782367825/asset-1782367204`

Contract: Combat Rules schema `2`, rules `1.1.0`, evidence policy `2`

## Decision boundary

Gate A8.1 promotes source values and exact source-selection rules only when the
Global game database proves them. It does not promote the community calculation
formula, infer a coefficient from animation text, classify release rows as EZA
or SEZA without a first-party discriminator, or calculate an ATK stat.

The frozen CSV export used by Team Analysis does not contain the necessary
numeric mechanics tables. The audited first-party SQLite snapshot does contain
`special_sets`, `specials`, `special_bonuses`, `card_specials`, `cards`,
`optimal_awakening_growths`, `potential_skills`, and
`potential_skill_lv_values`. Provenance therefore distinguishes a direct
`first_party_game_db_table` claim from a structural join and from community
corroboration.

Consumption is also contractual: verified rules serialize `normative`,
corroborated/candidate rules serialize `explicit_assumption_required`, and
unresolved rules serialize `return_unknown`. A consumer cannot treat status as
decorative metadata. Direct table provenance requires an exact locator and
snapshot version. The fixture pins the audited SQLite bytes to SHA-256
`75c997e8efd5141ad00d6f5049c150b350bb6abb019dd88797bcb0fee59d0bec` and stores
the reproduction queries.

## Evidence matrix

| Rule | Channel | Candidate value/order | Source | Evidence | Status | Risk |
|---|---|---|---|---|---|---|
| Exact coefficient source | Super Attack | Join exact `special_set`; read `increase_rate` and `lv_bonus` | `card_specials`, `special_sets` | 19,142/19,142 exact joins; direct fields and pinned native constructor offsets | verified, normative | low |
| Canonical tier `increase_rate` | Super Attack | huge 100, extreme 120, supreme 150, immense 180, colossal 200, mega-colossal 250, destructive 100 | `special_sets` plus Ultimate Guide | Modal values, with first-party conflicts | candidate | high |
| Canonical tier `lv_bonus` | Super Attack | huge 10, extreme 15, supreme 20, immense 25, colossal 5, mega-colossal 10, destructive 10 | `special_sets` plus Ultimate Guide | Modal values, with first-party conflicts | candidate | high |
| Display coefficient progression | Super Attack | `increase_rate + max(skill_lv - 1, 0) * lv_bonus` | `special_sets`, `UserCard.skill_lv`, pinned native runtime | Constructor stores the two fields at `EfficacySet +116/+120`; runtime loads them together and uses MADD after subtracting one from the skill level | verified, normative | low |
| Final combat multiplier composition | Super Attack | Base term, runtime modifiers, special bonuses and rounding | pinned native runtime plus first-party inputs | The runtime adds `calcModifierSpecialAtkRate` after the verified level curve; the remaining composition and rounding boundaries are not closed | unresolved | high |
| Exact skill-level cap source | Super Attack | Read exact card or awakening-growth record | `cards`, `optimal_awakening_growths` | Direct caps and steps; no EZA/SEZA enum | verified, normative | low |
| Variant selection | Super Attack | Normal/Hyper/Condition/Extra/FullPower to Super/Ultra/Unit/EX | `card_specials` and Team Analysis | Source styles and Ki thresholds exist; semantic mapping incomplete | unresolved | high |
| Exact effect-row selection | Super Attack | Join all effect rows sharing the resolved Super Attack definition, then filter typed channel/target | `card_specials`, `specials` | Direct identity and one-to-many join | verified, normative | low |
| Action Break | Super Attack | Exact pair `Special::ExtraEfficacySpecial` + efficacy 111; one eligible current enemy action per executed marker | `card_specials`, `special_sets`, `specials`; pinned native runtime | Omega joins `17379 -> 7731 -> 1007731`; Special factory, active-status execution, efficacy dispatcher and marker consumer are pinned | partial native semantic; lifecycle dimensions unresolved | medium |
| Exact ATK/DEF raise source | Super Attack | efficacy 1 -> ATK/`eff_value1`; 2 -> DEF/`eff_value1`; 3 -> ATK+DEF/`eff_value1,2`; duration=`turn` | `specials` joined to `special_sets` | Direct fields and descriptions | verified, normative | low |
| Qualitative raise defaults | Super Attack | raise 30, greatly 50, massively 100; persistent ATK+DEF raise 20 | `specials`; Ultimate Guide | Canonical rows corroborate; explicit and mixed-stat exceptions exist | candidate | high |
| Hidden Potential SA Boost lookup | Super Attack | skill level x 5 percentage points | `potential_skills`, `potential_skill_lv_values`; Ultimate Guide | 50/50 rows match; first-party description excludes additional effects | verified, normative | medium |
| Hidden Potential SA Boost application bucket | Super Attack | Add to SA multiplier | Ultimate Guide | No first-party formula or reproduced in-game fixture | unresolved as part of progression formula | high |
| Permanent ATK stacking penalty | Super Attack | subtract persistent ATK raise before first contribution; later Supers accumulate | Ultimate Guide | Community-only behavior; no reproduced game fixture | candidate | high |
| Permanent ATK penalty exceptions | Super Attack | source rows 114, 288, 435 raise ATK by 67; guide claims penalty 50 | first-party numeric rows plus Ultimate Guide claim | Values direct, behavioral override unreproduced | candidate/unresolved | high |
| Special bonus application | Super Attack | threshold bonuses such as first-party values 20 and 30 | `card_specials`, `special_bonuses` | Values/thresholds direct; placement and addition unresolved | unresolved | high |
| Integer rounding | Super Attack | No asserted boundary | none sufficient | No executable formula or frame-by-frame fixture | unresolved | high |

Community documents remain corroboration. No community-only value became
normative.

### Super Attack level progression boundary

The pinned `native-special-attack-level-progression.json` evidence closes the
level-dependent coefficient shown for a Super Attack. The SQLite constructor
stores `special_sets.increase_rate` and `special_sets.lv_bonus` in adjacent
fields. `AbilityManager::createSpecialSkill` forwards both fields to
`calcAttackIncreaseForParty`, which loads `UserCard.skill_lv`, subtracts one,
and uses a native multiply-add to compute
`increase_rate + (skill_lv - 1) * lv_bonus` for levels at least one. A separate
runtime modifier is queried and added afterward.

The app projection may therefore expose the level-1 and maximum-level endpoints
of that pre-modifier curve when the character has one unambiguous SA-level cap.
Characters with awakening-growth state caps remain omitted until the DB
state-to-`card_special` selector is audited. This does not authorize a total
damage formula: the base multiplier, special-bonus placement, runtime modifier
sources and integer rounding remain unresolved.

### Omega action-disable boundary

The current first-party export closes the structural identity for Omega
Shenron:

- `card_specials.id=17379`, `card_id=1031501`, `special_set_id=7731`,
  `style=Hyper`, `eball_num_start=18`;
- `special_sets.id=7731`, name `Demon Death Ball`;
- `specials.id=1007731`, `special_set_id=7731`,
  `type=Special::ExtraEfficacySpecial`, `efficacy_type=111`,
  `target_type=3`, `calc_option=0`, `turn=1`, `prob=100`, and zero-valued
  operands.

The pinned `native-special-action-break-semantics.json` evidence now closes the
previous table-boundary gap without borrowing the passive mapping. The native
Special type initializer maps `Special::ExtraEfficacySpecial` to enum 1;
`AbilityManager::createSpecialSkill` sends that branch through
`createAbilityForSpecialEfficacy`, which copies efficacy 111 unchanged into an
`AbilityStatusActive`. Its inherited causality execution loads that value into
the common efficacy dispatcher. Slot 111 resolves to the attack-break handler,
and `AbilityManager::getAttackBreakingActions` selects one eligible current
enemy action per matching marker.

The app snapshot therefore types only this exact pair as partial
`action_break` semantics. It does not reinterpret `target_type=3`, `turn=1`, or
`prob=100` into human target, duration, recurrence, or probability rules. The
localized phrase “disables enemy's action once within the turn” remains
corroboration for those unresolved lifecycle dimensions, not their source of
truth. Native efficacy 119 belongs to the separate `DisableAttack` family and
is not used for this projection.

## Tier and coefficient audit

The damage phrase is a description, not identity. Among active `special_sets`,
the modal pairs are:

| Description family | Modal `increase_rate` / `lv_bonus` | Modal rows | Representative conflicting rows |
|---|---:|---:|---|
| huge | 100 / 10 | 251 | ID 114: 50 / 10; ID 205: 87 / 10 |
| extreme | 120 / 15 | 228 | ID 435: 70 / 15; ID 797: 90 / 15 |
| supreme | 150 / 20 | 3,608 | ID 614: 120 / 20; ID 761: 120 / 15; ID 1633: 150 / 5 |
| immense | 180 / 25 | 1,507 | ID 1440: 180 / 10; ID 2813: 150 / 20 |
| colossal | 200 / 5 | 589 | ID 847: 180 / 5; ID 7504: 180 / 25 |
| mega-colossal | 250 / 10 | 498 | ID 2206: 170 / 5; ID 8184: 180 / 10 |
| destructive | 100 / 10 | 76 | no universal formula inferred |
| ultimate | no stable mode suitable for a rule | 7 audited rows | IDs 8226/8274 use 500/550; other values also occur |

The snapshot has additional custom damage descriptions and extreme numeric
values. No exact `super-ultimate damage` phrase was found. It is therefore not a
published tier. The candidate tables are explicitly partial, and an exact
`special_set` row always overrides them.

## Super, Ultra, Unit and EX

`card_specials.style` contains Normal (18,080), Hyper (888), Condition (100),
Extra (18), and FullPower (56) rows. Ki thresholds include Normal at 1, 8, 9,
10, 11, 12, 15 and 18; Hyper at 12 and 18; Condition at 12 and 18; Extra at 12
and 24; and FullPower at 12.

Representative structural exceptions include Hyper at 12 Ki
(`card_specials.id` 11184 and 15810), Extra at 24 Ki (18761), and multiple
Condition rows sharing a card/priority family (10380-10382). Those facts prevent
the contract from equating Hyper with Ultra or Extra with EX/Unit universally.
The Normal/Ultra/Unit/EX semantic selection remains unresolved.

## Regular, EZA and SEZA caps

`cards.skill_lv_max` directly contains caps 10, 15, 20 and 25. Rarity does not
determine the cap: rarity codes 3 and 4 contain both 10 and 15, and rarity 5
contains 10, 20 and 25. `optimal_awakening_growths` additionally contains exact
step values, including growth type 1001 with skill caps 22, 24 and 25 at steps
1, 2 and 3.

The database has no audited EZA/SEZA enum or state key selecting the applicable
`special_set`. The normative rule therefore says to read the exact release-state
record. Labels and fixed “regular/EZA/SEZA” mappings remain unresolved.

## ATK and DEF raises

For `Special::NormalEfficacySpecial` rows with self target and the audited
calculation option, first-party numeric fields distinguish ATK (`efficacy_type`
1), DEF (2), and ATK & DEF (3). `turn=99` is the persistent source value already
typed by Gate A7.1; A8.1 does not reinterpret that lifecycle.

Canonical one-turn rows directly contain 30 for “raises”, 50 for “greatly
raises”, and 100 for “massively raises”. The source also contains explicit
values such as 10, 25, 33, 44, 58, 77, 86, 103, 140 and 628, plus mixed ATK/DEF
pairs such as 30/50 and 50/100. Persistent rows likewise vary. Therefore the
wording table remains a partial candidate, while exact `specials` rows are the
normative source.

## Hidden Potential SA Boost

`potential_skills.id=6` identifies Super Attack Boost and states that it raises
Super Attack power without changing additional Super Attack effects. All 50
`potential_skill_lv_values` rows satisfy `value = lv * 5`; examples are 1 -> 5,
10 -> 50, 15 -> 75 and 50 -> 250. The Ultimate Guide corroborates five
percentage points per level.

The lookup is normative. Its placement in the final Super Attack multiplier,
rounding and interaction with active/ultimate attacks are not normative because
the first-party tables do not expose the executable formula.

## Permanent ATK stacking penalty

The Ultimate Guide claims that a persistent ATK raise is subtracted from the
base Super Attack multiplier so the first Super does not receive its own ATK
raise, while later Supers do. No reproducible in-game fixture or extractable
first-party formula was found.

First-party rows 114, 288 and 435 each contain a persistent 67-point ATK raise.
The guide claims a 50-point penalty for those exceptions. That is a useful
structural conflict, not verification of behavior. The rule remains candidate;
ATK, DEF, ATK & DEF, first versus later Super, and exception identity are kept
as separate dimensions.

## Coverage change

| Metric | Gate A8 | Gate A8.1 |
|---|---:|---:|
| rules | 17 | 25 |
| normative / verified | 2 | 7 |
| corroborated | 5 | 5 |
| candidate | 10 | 13 |
| unresolved | 12 | 15 |

The five promoted Super Attack facts are exact coefficient-field selection,
exact skill-cap-field selection, exact effect-row selection, exact numeric
ATK/DEF effect-field selection, and the Hidden Potential Super Attack Boost
level/value lookup. None of them is a damage calculator.

## Still blocked

Exact Super Attack multiplier, exact ATK stat and damage remain blocked by the
unproved level formula, threshold-bonus placement, variant selection,
EZA/SEZA release-state mapping, permanent-ATK penalty behavior, integer
operation order and rounding. Consumers must return unknown or require an
explicit candidate assumption when any of those dimensions is needed.
