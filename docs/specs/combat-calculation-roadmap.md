# Combat calculation roadmap

Status: Gate A5.1 foundation. This document describes future data and rule
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

## Start of Turn, On Attack and Super Attack raises

- `passive_start_of_turn` and `passive_on_attack` are mathematical buckets for
  passive ATK/DEF contributions.
- `activationTiming` is a battle event and is not a bucket alias. For example,
  `after_receiving_attack` may still require a separately proven Start of Turn
  bucket.
- `when_performing_super_attack` normally activates a passive On Attack
  contribution, under a versioned domain rule.
- Super Attack effect raises belong to the Super Attack channel. They are not
  passive effects and must not be folded into either passive bucket.
- Old Ki-threshold passives have documented timing differences. A threshold
  only proves the runtime condition and attack timing; it does not universally
  prove the calculation bucket.

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
- available Ki-multiplier text/steps where the source exposes them;
- structural enemy scenario predicates for Class, Type, Category, name, HP and
  status.

## Data still missing

No production calculator should be enabled until these inputs are typed and
versioned:

- Super Attack base multiplier and progression by Super Attack level;
- typed Super Attack ATK/DEF raises, including duration and stacking rules;
- Hidden Potential, Total Ability Boost (TAB) and Total Defense Boost (TDB);
- type advantage, guard, critical, variance and related modifier order;
- boss ATK/DEF, damage reduction and immunity data by phase;
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

## Gate A6 and future evaluator

Gate A6 remains a parser gate. It extends combat-history conditions and timing
for attacks performed, received or evaded, Super Attacks, and final blows. It
must preserve `condition`, `activationTiming`, and `calculationBucket` as three
separate facts and must not select active contributions or calculate stats.

A later Android evaluator will consume those three inputs with tri-state logic,
produce a list of active contributions, and pass only resolved ATK/DEF effects
to a versioned formula engine for bucket grouping. Effects with an unresolved
condition, scenario-dependent timing, or unresolved bucket remain visible but
excluded from a numeric result unless the caller explicitly supplies a
supported assumption policy.
