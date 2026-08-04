# Combat calculation roadmap

Status: Gate A7 Super Attack effect foundation. This document describes future data and rule
boundaries; it does not define an implemented calculator.

## Evidence policy

The calculation model must distinguish three questions:

1. Is the effect's condition satisfied?
2. At what battle moment does the effect activate?
3. In which mathematical bucket is the contribution applied?

Those answers are independent. A trigger such as receiving an attack can make
an effect active without proving whether its percentage is a Start of Turn or
On Attack multiplier. Missing scenario context or missing phase evidence must
produce `unknown`, never false, true, or a guessed bucket.

The source priority is explicit passive wording, an exact first-party join for
the same state/passive/effect, a versioned domain rule, then unresolved. The
community [calculation guide](https://docs.google.com/document/d/1Kjk7QnNmfax80qXM8LL4b9woN_GxR0rqyAibR8BoDFY/edit?tab=t.0)
and its [Reddit index thread](https://www.reddit.com/r/DBZDokkanBattle/comments/zza0ye/the_ultimate_guide_to_calculating_dokkan_full/)
are useful historical explanations, but are not normative game data. Character
names are never evidence keys.

The community [damage-taken guide](https://docs.google.com/document/d/11S78tMJsqVr-_bQuvdwi4uR6M5sDB51gpKpnPwzwiZA/edit)
and its [in-game example workbook](https://docs.google.com/spreadsheets/d/1Fk5jVGUxSAnupWcBNAC5WuqFBaSQYBPsCTMkj7Plyzs/edit)
provide a more precise candidate model for incoming damage. The workbook is
valuable corroborating evidence because its formulas are tied to observed
in-game examples, but both sources remain community evidence and must be
validated against first-party data or reproducible runtime tests before their
constants become normative `combatRulesVersion` data.

## Future calculation order

The initial order to validate for ATK is:

1. card ATK at the selected level, awakening and potential investment;
2. percentage and flat leader contributions;
3. typed passive `passive_start_of_turn` contributions;
4. item and support-memory channels;
5. active link contributions;
6. active-skill stat-buff channel;
7. attack Ki multiplier;
8. typed passive `passive_on_attack` contributions;
9. Super Attack base multiplier, level progression and typed Super Attack
   raises;
10. critical/type/guard/variance modifiers, enemy DEF and enemy damage
    reduction for damage dealt.

The initial DEF order to validate is analogous through leader, Start of Turn,
items, links, active-skill buffs and On Attack passive contributions, followed
by typed Super Attack DEF raises. Damage received then needs the boss attack
channel, variance, type/guard interaction, damage reduction, immunities and
the correctly phased DEF value. Exact rounding boundaries and the damage
modifier order remain intentionally unspecified until first-party behavior is
validated.

Percentages inside one passive bucket are accumulated as independent active
contributions before that bucket is applied. Contributions from different
buckets must never be merged. Multiple conditional contributions remain
separate so the scenario evaluator can activate each one independently.

## Candidate damage-received model

The damage-taken guide and example workbook support this candidate equation:

```text
(
  enemy ATK
  * adjusted Super Attack multiplier
  * product of non-SA ATK-lowering source groups
  * (1 - general damage reduction)
  * (1 - attack-kind-specific damage reduction)
  * Class/Type alignment multiplier
  * variance
  - resolved character DEF
)
* guard coefficient
```

The model has several non-interchangeable channels:

- ATK lowering from a Super Attack effect reduces the enemy Super Attack
  multiplier when the incoming hit is a Super Attack. Against a normal attack,
  it behaves as an ATK-stat reduction because the Super Attack multiplier is 1.
- ATK-lowering contributions from the same origin group add. Different origin
  groups, such as passive, item and Super Attack effect, apply as separate
  multiplicative reductions.
- General damage reduction contributions add inside their shared group.
  Reduction that applies only to normal attacks is a distinct multiplicative
  group and must not be silently added to general reduction.
- Support-memory reduction belongs to the support-item channel for calculation
  purposes according to the guide. This is a global rule, not character data.
- Class and Type determine the base alignment multiplier. Natural type
  advantage and passive guard both use a separate 0.5 guard coefficient after
  DEF subtraction, but passive guard uses its own alignment behavior.
- Type Defense Boost reduces the alignment multiplier by 0.01 per level only
  when the character has actual Type advantage. Passive guard alone does not
  activate Type Defense Boost.
- Enemy variance is modeled over 1.00 through 1.03. The workbook uses 1.015 as
  a midpoint example; that value must not be labeled an expected value without
  validating the game's distribution.
- The guide reports a special minimum-damage path when the equation result is
  below 150, producing incoming values in the 9 through 132 range for enemies
  with zero Ki. This is not a simple numeric clamp and requires a separate,
  validated rule.

Multiplication is algebraically reorderable only in real-number arithmetic.
The implementation must preserve the game's integer truncation boundaries;
the workbook explicitly rounds DEF down after each DEF calculation stage, but
does not by itself prove every incoming-damage rounding boundary.

## Start of Turn, On Attack and Super Attack raises

- `passive_start_of_turn` and `passive_on_attack` are mathematical buckets for
  passive ATK/DEF contributions.
- `activationTiming` is a battle event and is not a bucket alias. For example,
  `after_attack_landed` may still require a separately proven Start of Turn
  bucket.
- `when_performing_super_attack` normally activates a passive On Attack
  contribution, under a versioned domain rule.
- Super Attack effect raises belong to the Super Attack channel. They are not
  passive effects and must not be folded into either passive bucket.
- Old Ki-threshold passives have documented timing differences. A threshold
  only proves the runtime condition and attack timing; it does not universally
  prove the calculation bucket.
- Gate A6 distinguishes an attack targeting the character
  (`incoming_attack`) from its resolved outcome (`attack_landed` or
  `attack_evaded`). Targeting is available before damage and remains true when
  the later outcome is a dodge; only `attack_landed` increments received-hit
  history. A future engine must retain both the announced attack and outcome
  rather than deriving one from the other.

## Data already available

The current character and Team Analysis datasets provide:

- stable state/release identity and exact character-payload compatibility;
- base character stats, rarity, level limits, Class/Type and categories;
- leader-skill text plus typed display-boost clauses;
- passive raw text, lossless source spans, condition/effect AST, targets,
  durations, caps, chances and Gate A5 Ki/Ki Sphere semantics;
- additive passive activation timing and ATK/DEF calculation bucket metadata;
- link-skill identities;
- Super Attack names, Ki thresholds and raw effect text;
- typed source-neutral Super Attack ATK/DEF raises, enemy ATK/DEF lowering,
  stun and Super Attack seal, with exact source spans, target, duration,
  stacking/cap uncertainty, chance provenance, activation timing and separate
  future calculation buckets;
- available Ki-multiplier text/steps where the source exposes them;
- structural enemy scenario predicates for Class, Type, Category, name, HP and
  status.

## Data still missing

No production calculator should be enabled until these inputs are typed and
versioned:

- Super Attack base multiplier and progression by Super Attack level;
- numeric mappings for qualitative Super Attack raise/lowering terms and
  first-party stacking rules where the text leaves duration or accumulation
  unresolved;
- Hidden Potential, Type Attack Boost (TAB) and Type Defense Boost (TDB);
- the versioned Class/Type alignment table, natural/passive guard behavior,
  guard coefficient and Type Defense Boost interaction;
- enemy variance distribution and the special minimum-damage rule;
- typed applicability for general, normal-only and Super-only damage reduction;
- source grouping for ATK lowering and damage reduction so additive and
  multiplicative channels cannot be confused;
- boss base ATK, Super Attack multiplier, DEF, Class/Type or no-Class state,
  damage reduction, attack kind and immunity data by phase;
- active-skill attack and stat-buff calculation channels;
- counter, nullification and reflected-damage calculation channels;
- exact integer rounding/truncation rules and their boundaries;
- first-party phase joins for passive contributions whose text is ambiguous;
- a validated rule for triggered accumulations after attacks received,
  performed or evaded.

Hidden Potential procs remain separate channels: Critical/Additional use skill
level x 2%, while Dodge uses skill level x 1%. They must not be added directly
to passive proc percentages during parsing.

## Ownership boundary

The scraper owns source acquisition, stable joins, lossless text, source-neutral
typing, evidence provenance, validation, coverage and deterministic artifacts.
It must not precompute team-specific activation, average spheres, expected
damage or recommendations.

The future Android engine owns scenario input, tri-state condition evaluation,
active contribution selection, bucket accumulation, battle calculations,
scoring and user-facing explanations. When required context is absent, its
result is `unknown` and the UI must expose that uncertainty.

Global mechanics such as formula order, rounding, Ki multiplier interpolation,
type/guard modifiers and stacking policy must be versioned separately from
character data. A future calculation manifest should therefore reference both
the compatible character/team-analysis version and a `combatRulesVersion`.
Changing a global mechanic must not require rewriting immutable character
identity or passive source text.

## Gate A6 combat events and future evaluator

Gate A6 is a parser gate. It extends combat-history conditions and timing
for attacks performed, received or evaded, Super Attacks, and final blows. The
current incoming event must distinguish at least normal attack from Super
Attack whenever the source text proves it, because normal-only damage reduction
and Super-specific behavior cannot share one undifferentiated received-attack
predicate. Gate A6 must preserve `condition`, `activationTiming`, and
`calculationBucket` as three separate facts and must not select active
contributions or calculate stats.

The serialized `CombatEventDescriptor` separates current-event applicability,
accumulated counters, and per-event scaling. Counts are scoped to the current
turn, the battle, or explicitly unknown; current-event attack kind remains
unknown for bare `attack`. Explicit normal/Super distinctions and audited Ki
Blast/Unarmed/Physical Super styles are runtime facts, not damage-formula
modifiers. Caps and durations remain attached to the typed effect. This keeps
normal-only damage reduction as one effect guarded by one incoming-event
condition instead of duplicating attack-kind metadata across channels.

Gate A7 types the Super Attack effect channel, including ATK/DEF raises,
SA-effect ATK/DEF lowering, stun and Super Attack seal. It preserves bare raises
with unknown duration/stacking, qualitative probabilities without invented
percentages, and residual effect text without selecting contributions. Damage-
kind-specific reduction remains outside Gate A7. Boss-phase combat facts should
be a separate source-neutral dataset; neither concern is folded into the event
parser merely to increase coverage.

A later Android evaluator will consume those three inputs with tri-state logic,
produce a list of active contributions, and pass only resolved ATK/DEF effects
to a versioned formula engine for bucket grouping. Effects with an unresolved
condition, scenario-dependent timing, or unresolved bucket remain visible but
excluded from a numeric result unless the caller explicitly supplies a
supported assumption policy.
