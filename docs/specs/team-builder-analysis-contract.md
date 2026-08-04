# Team Builder Analysis Data Contract

**Status:** proposed
**Last updated:** 2026-08-04
**Consumer:** DkB Companion Android Team Builder

## 1. Decision

The scraper normalizes stable character identity and passive semantics. Android
evaluates those semantics against the user's team, rotations, and optional
battle scenario.

Do not scrape or reproduce another site's recommendation order, synergy grade,
rotation plan, or passive-activation count. Those are runtime results, not
source data.

This contract is additive. Existing raw passive text and `PassiveDetails`
remain the display/debug source of truth.

The product specification is:

`D:\Dokkan\Dokkanpanion\docs\features\team-builder.md`.

## 2. Why a separate dataset

Passive semantic parsing is used by Team Builder, evolves faster than the core
character display contract, and can add significant structured data. Publish a
separate `team-analysis.json.gz` so that:

- catalog startup and Room rebuild do not pay the full semantics cost;
- parser releases can be tested and rolled back independently;
- Android can load it only when Team Builder needs it;
- older Android clients continue using the existing character dataset;
- missing enrichment degrades to leader/link analysis.

The dataset must declare the exact compatible character dataset version or
content SHA-256. Android must not join mismatched versions.

## 3. Top-level contract

```ts
export interface TeamAnalysisDataset {
  schemaVersion: number;
  rulesVersion: string;
  parserVersion: string;
  generatedAt: string;
  sourceCharacterDatasetVersion: string;
  sourceCharacterPayloadSha256: string;
  stateCount: number;
  supportedRuleCount: number;
  partialRuleCount: number;
  unknownRuleCount: number;
  states: CharacterStateAnalysis[];
}

export interface CharacterStateAnalysis {
  stateKey: string;
  characterId: string;
  canonicalId?: string;
  gameCharacterId?: string;
  baseCharacterId?: string;
  hardDuplicateGroupId: string;
  variantGroupId?: string;
  awakeningFamilyId?: string;
  formId: string;
  releaseState: "initial" | "eza" | "seza";
  displayName: string;
  passive?: ParsedPassive;
  superAttacks?: ParsedSuperAttack[];
}
```

Identity values come from the source payload where available. They must not be
reconstructed from portrait filenames or display text.

`hardDuplicateGroupId` represents one recruitable card across all of its
transformations, exchanges, standby/domain forms, and release states. Android
uses it to reject two copies in the six owned slots. The Friend slot is an
explicit runtime exception.

`variantGroupId` relates distinct recruitable cards that represent variants of
the same character identity. It drives an allowed soft-duplicate warning only;
it must never be used as a linking decision or hard legality rule. When the
source does not expose a reliable relationship, omit it instead of deriving it
from a display name.

`stateKey` is deterministic and opaque to Android. A recommended readable form
is `{characterId}:{formId}:{releaseState}`, but consumers compare the full key
and never parse it.

`superAttacks` is optional additive enrichment. It is populated only from the
Super Attack fields belonging to that exact form and release state. A base,
EZA, SEZA, transformed, Unit, Ultra, or EX effect is never copied to another
release merely because a display name matches. Current character payloads that
expose only their current release may use that sole release's generic Super
Attack fields; multi-release payloads require release-specific fields.

## 4. Passive contract

```ts
export interface ParsedPassive {
  name?: string;
  rawText: string;
  parseStatus: "supported" | "partial" | "unknown";
  rules: PassiveRule[];
  unparsedFragments: SourceFragment[];
  conditionEvidence?: PassiveConditionEvidence[];
}

export interface PassiveRule {
  id: string;
  condition: ConditionExpression;
  conditionStatus: "supported" | "partial" | "unknown";
  effects: PassiveEffect[];
  effectStatus: "supported" | "partial" | "unknown";
  source: SourceFragment[];
  parseStatus: "supported" | "partial" | "unknown";
  confidence: "high" | "medium" | "low";
}

export interface SourceFragment {
  lineIndex: number;
  text: string;
  start?: number;
  end?: number;
}

export interface PassiveConditionEvidence {
  kind: "enemy_status";
  stateKey: string;
  characterId: string;
  formId: string;
  releaseState: "initial" | "eza" | "seza";
  passiveSkillId?: string;
  passiveTextSha256: string;
  anchor: {
    lineIndex: number;
    endLineIndex?: number;
    normalizedText: string;
    structuralText: string;
  };
  statuses: Array<{
    order: number;
    sourceToken: string;
    status?: EnemyStatus;
    resolution: "supported" | "unresolved";
  }>;
  connector?: "and" | "or";
  resolution: "supported" | "partial" | "unresolved";
  provenance: {
    source: "dokkan_fyi_payload";
    sourceVersion: string;
    payloadField:
      | "props.character.passive_skill.description"
      | "props.character.extreme_z_awakening.passive_skill.description";
    markerSyntax: "passiveImg";
  };
}
```

Rule IDs are deterministic from state key plus normalized source position, not
random UUIDs. Re-scraping unchanged text must produce byte-stable semantic data
apart from top-level timestamps.

Condition and effect status are independent. A rule with an unknown condition
and recognized effects is `partial`: it retains `op: "unknown"` for the
condition and the typed effects. Rule status is `supported` only when both are
supported, and `unknown` only when both are unknown.

Gate A4.1 keeps the display contract lossless: `rawText`, `PassiveDetails.text`,
`lines`, and `sections` remain the marker-stripped text that existing consumers
already receive. Optional `PassiveDetails.conditionEvidence` and the validated
copy on `ParsedPassive` retain structural condition markers separately. The
parser accepts an evidence record only when state, form, release, passive hash,
line range, normalized anchor, marker order, connector, and payload field all
agree. Source type and marker syntax must match the contract, while source
version is retained as required provenance rather than an independent trust
boundary. A mismatch is ignored and the original unknown branch is preserved.

`connector` is emitted only when `and` or `or` is explicit in the structural
source. Comma-only lists do not receive an invented boolean meaning. A partially
resolved marker list retains known status predicates plus an unknown branch
only when the connector itself is proven. Source evidence never causes network
I/O during semantic parsing.

## 5. Boolean condition AST

```ts
export type ConditionExpression =
  | { op: "always" }
  | { op: "all"; children: ConditionExpression[] }
  | { op: "any"; children: ConditionExpression[] }
  | { op: "not"; child: ConditionExpression }
  | { op: "predicate"; predicate: PassivePredicate }
  | { op: "unknown"; sourceText: string };

export interface PassivePredicate {
  kind: PassivePredicateKind;
  scope: "self" | "rotation" | "team" | "enemy" | "battle";
  selfInclusion?: "included" | "excluded" | "unknown";
  comparator?: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "between";
  value?: number;
  maxValue?: number;
  count?: number;
  categories?: string[];
  names?: string[];
  classes?: TeamAnalysisClass[];
  types?: TeamAnalysisType[];
  slots?: number[];
  kiSphereTypes?: KiSphereType[];
  kiContext?: KiContext;
  evaluationMoment?: PassiveEvaluationMoment;
  enemySelection?: EnemySelection;
  enemyStatuses?: EnemyStatus[];
  nameMatch?: EnemyNameMatch;
  excludedNames?: string[];
  excludedNameMatch?: EnemyNameMatch;
  enemyReference?: EnemyReference;
  combatEvent?: CombatEventDescriptor;
  sourceText: string;
}

export type TeamAnalysisClass = "Super" | "Extreme";
export type TeamAnalysisType = "AGL" | "TEQ" | "INT" | "STR" | "PHY";
export type ConcreteKiSphereType = TeamAnalysisType | "rainbow";
export type KiSphereType = ConcreteKiSphereType | "non_rainbow" | "any";
export type KiContext = "final_attack_ki" | "collected_ki_spheres" | "board_state";
export type PassiveEvaluationMoment =
  | "start_of_turn"
  | "entry_turn"
  | "end_of_turn"
  | "before_attack"
  | "when_attacking";
export type EnemySelection =
  | "any_enemy"
  | "all_enemies"
  | "current_target"
  | "only_enemy"
  | "unknown";
export type EnemyStatus =
  | "atk_down"
  | "def_down"
  | "stunned"
  | "super_attack_sealed";
export type EnemyNameMatch = "exact" | "includes";
export type EnemyReference = "that_enemy";

export type CombatEventType =
  | "attack_performed"
  | "incoming_attack"
  | "attack_landed"
  | "attack_evaded"
  | "final_blow_delivered";
export type CombatEventActor = "self" | "enemy";
export type CombatAttackKind = "normal_attack" | "super_attack" | "unknown";
export type CombatAttackStyle = "ki_blast" | "unarmed" | "physical" | "unknown";
export type CombatEventMode = "current_event" | "accumulated_count" | "per_event";
export type CombatEventCountScope = "current_turn" | "battle" | "unknown";
export type CombatEventRelativeTiming = "before_event" | "during_event" | "after_event" | "unknown";

export interface CombatEventDescriptor {
  eventType: CombatEventType;
  actor: CombatEventActor;
  attackKind: CombatAttackKind;
  attackStyle?: CombatAttackStyle;
  mode: CombatEventMode;
  countScope?: CombatEventCountScope;
  relativeTiming: CombatEventRelativeTiming;
  provenance: {
    eventType: CalculationPhaseResolutionSource;
    actor: CalculationPhaseResolutionSource;
    attackKind: CalculationPhaseResolutionSource;
    attackStyle?: CalculationPhaseResolutionSource;
    mode: CalculationPhaseResolutionSource;
    countScope?: CalculationPhaseResolutionSource;
    relativeTiming: CalculationPhaseResolutionSource;
  };
}
```

Every ally-related predicate must declare `selfInclusion`. `another ally` and
`(self excluded)` map to `excluded`. Source wording that explicitly permits the
current character maps to `included`. When the source does not settle the
question, use `unknown`; do not infer it from a character name or category.

Gate A2 uses the following scope rules:

- `on the team` maps to `team`;
- `attacking in the same turn` maps to `rotation`;
- a predicate about `the character` or `this character` maps to `self`;
- a clause without an explicit scope remains `op: "unknown"`.

Values inside one dimension are alternatives unless the source connector
creates separate AST children. Different dimensions on the same predicate are
conjunctive: for example, `classes: ["Extreme"]` plus
`categories: ["Crossover"]` must be satisfied by the same ally. This avoids
mistaking a Class+Category or Class+Type restriction for two unrelated allies.
`all` is logical AND, `any` is logical OR, and `not` negates only its child.
The parser preserves parentheses and gives AND higher precedence than OR. A
recognized child and an unknown child produce a partial AST; neither child is
discarded.

Initial predicate taxonomy:

### Team-resolvable

- `ally_category_present`
- `ally_name_present`
- `ally_class_present`
- `ally_type_present`
- `ally_class_type_present`
- `ally_category_class_present`
- `team_category_count`
- `team_class_count`
- `team_type_count`
- `all_rotation_allies_category`
- `all_rotation_allies_class`
- `rotation_partner_category`
- `rotation_partner_name`
- `character_class`
- `character_type`
- `rotation_partner_link_present`
- `character_is_leader`
- `character_is_friend`

### Placement-resolvable

- `battle_slot`
- `rotation_assignment`
- `rotation_partner_present`
- `floater_assignment`

`battle_slot` always has `scope: "self"` and `slots` containing only `1`, `2`,
or `3`. Multiple positions in the same phrase are alternatives. The predicate
captures only the current character's rotation position; an attack-history
qualifier surrounding it stays as a separate unknown child until a later gate.

### Optional scenario

- `hp_percent`
- `battle_turn`
- `turn_from_entry`
- `enemy_count`
- `enemy_category`
- `enemy_name`
- `enemy_class`
- `enemy_type`
- `enemy_class_type`
- `enemy_hp_percent`
- `enemy_status`
- `domain_active`
- `standby_active`
- `active_skill_used`
- `revive_triggered`

Gate A3 defines the three implemented scenario predicates as follows:

- `hp_percent` is the team's shared HP percentage, always with `scope: "team"`;
- `battle_turn` is the global turn index since battle start, with
  `scope: "battle"`;
- `turn_from_entry` is the index relative to this character's first appearance,
  with `scope: "self"`.

The older TypeScript literals `turn_number` and `turns_from_entry` remain
deprecated type-only aliases for source compatibility, but the generator has
never serialized them and Gate A3 does not emit them.

Both turn indexes are 1-based. The entry turn itself is
`turnFromEntry = 1`; battle start is `battleTurn = 1`. Source ordinals are
stored without incrementing or decrementing them. `starting from the 3rd turn`
therefore maps directly to `gte 3`, not 4. `on the 4th turn` maps to `eq 4`,
and `up to the 6th turn` maps to `lte 6`.

Closed HP and turn windows are `all` ASTs of scalar lower and upper bounds.
For example, `For 5 turns from the character's entry turn` is exactly
`turn_from_entry >= 1 AND turn_from_entry <= 5`. Open-ended wording emits only
the bound stated by the source. This keeps point conditions distinct from
windows and avoids hidden off-by-one conversion.

`evaluationMoment` is present only when the source states when a scenario value
is sampled. `start_of_turn`, `entry_turn`, `end_of_turn`, `before_attack`, and
`when_attacking` are distinct. An absent value means that the source did not
constrain the phase; it does not authorize the consumer to invent one.
`entry_turn` means the character's first appearance, not every attacking turn.

The minimum future evaluator context is:

```ts
interface TeamAnalysisScenarioContext {
  hpPercent?: number;       // shared team HP, 0..100
  battleTurn?: number;      // 1-based
  turnFromEntry?: number;   // 1-based, absent before/when entry is unknown
  evaluationMoment?: PassiveEvaluationMoment;
}
```

If a predicate requires a missing value or a different explicit evaluation
moment, its future result is `Unknown`, never false.

Gate A4 defines enemy predicates as follows:

- `enemy_count` describes the total battle enemy count, has `scope: "battle"`,
  uses a non-negative integer scalar value, and never declares
  `enemySelection`;
- `enemy_class`, `enemy_type`, `enemy_class_type`, `enemy_category`,
  `enemy_name`, `enemy_hp_percent`, and `enemy_status` describe an enemy or set
  of enemies, have `scope: "enemy"`, and always declare `enemySelection`;
- `enemy_hp_percent` is separate from `hp_percent`: the former is the selected
  enemy's HP while the latter remains shared team HP.

`enemySelection` preserves the source quantifier/reference:

- `any_enemy`: an existential condition such as `there is an ... enemy`;
- `all_enemies`: every battle enemy must match;
- `current_target`: the enemy selected/attacked by the character;
- `only_enemy`: the sole enemy, stated explicitly by the source or proven by a
  sibling `enemy_count == 1` in the same conjunctive branch;
- `unknown`: the source says, for example, `the enemy` without identifying
  which enemy. The typed predicate is retained but its condition status is
  `partial` and a future evaluator returns `Unknown`.

`multiple enemies` has the documented cardinal meaning “more than one” and is
normalized to `enemy_count >= 2`. No other qualitative count word receives a
numeric value. A comparator plus `count` on an enemy attribute predicate means
the number of enemies matching that exact attribute predicate, while
`enemy_count` always means total battle count.

Class and Type on `enemy_class_type` constrain the same selected enemy.
Category values and name values connected by OR remain alternatives; explicit
AND creates separate AST children. `enemy_name` distinguishes exact name from
`whose name includes` through `nameMatch`. A structurally explicit exclusion
uses `excludedNames` and `excludedNameMatch` on the same predicate so it cannot
accidentally refer to a different enemy. Prose exclusions that cannot be
normalized losslessly remain a sibling unknown branch.

The initial controlled enemy-status enum contains only `atk_down`, `def_down`,
`stunned`, and `super_attack_sealed`. A numerical ATK/DEF reduction is an
effect, not evidence that the target currently has the corresponding status.
Negated status conditions use the normal `not` AST node.

For enemy HP, `before_attack`, `when_attacking`, and `start_of_turn` are emitted
only when stated by the source. Scaling by remaining HP, HP after an attack,
and damage-derived HP remain unknown.

The minimum future enemy scenario context is additive to the Gate A3 context:

```ts
interface TeamAnalysisEnemyContext {
  enemyCount?: number;
  enemies?: Array<{
    class?: TeamAnalysisClass;
    type?: TeamAnalysisType;
    categories?: string[];
    name?: string;
    hpPercent?: number;
    statuses?: EnemyStatus[];
  }>;
  currentTargetIndex?: number;
}
```

The evaluator must use tri-state logic. A missing list, missing enemy field,
inconsistent count, absent current target, or `enemySelection: "unknown"`
evaluates to `Unknown`, never false.

Anaphoric wording such as `that enemy` is preserved as
`enemyReference: "that_enemy"`. It starts with `enemySelection: "unknown"` and
is refined to `only_enemy` only when the same AND-connected component contains
a sibling `enemy_count` with `comparator: "eq"` and `value: 1`. Nested `all`
nodes are logically associative for this proof but retain their serialized
grouping. Resolution does not cross `any`, `not`, or an `enemy_count >= 2`
predicate. An
existential predicate such as `there is an enemy` is not a binding identifier;
without a source-neutral enemy ID/binding construct, a following `that enemy`
remains unresolved. Validators reject a serialized resolved anaphora without
the required sibling proof.

### Runtime/battle dependent

- `ki_amount`
- `ki_spheres_obtained`
- `ki_sphere_type_obtained`
- `attacks_performed`
- `incoming_attack`
- `incoming_super_attack`
- `attacks_received`
- `attacks_evaded`
- `super_attacks_performed`
- `super_attack_received`
- `final_blow_delivered`
- `chance_roll`

Unknown or unsupported clauses use `op: "unknown"`; they are never coerced to
`always` or false.

### Gate A6 combat-event semantics

The attack-event predicate kinds carry a source-neutral
`CombatEventDescriptor`. `eventType` describes what happened, `actor`
describes who initiated it, and `attackKind` constrains the attack only when
the source does. Therefore bare `attack` serializes as `attackKind: "unknown"`
with unresolved provenance and matches either normal or Super in a future
tri-state evaluator; it is not an error and is never silently narrowed.
Explicit `normal attack` and `Super Attack` serialize as `normal_attack` and
`super_attack`. The audited Super subtypes `Ki Blast`, `Unarmed`, and `Physical`
use the independent optional `attackStyle`; a bare Super keeps
`attackStyle: "unknown"`.

`mode` separates three different channels:

- `current_event`: applicability or a trigger tied to the event now occurring;
- `accumulated_count`: a threshold over runtime history and therefore an AST
  scalar comparator plus a non-negative integer `value`;
- `per_event`: repeated effect scaling and therefore valid only inside
  `PassiveEffect.scaling`, never as a condition predicate.

An accumulated count declares `countScope: "current_turn"`, `"battle"`, or
`"unknown"`. Missing textual scope remains `unknown` and makes the condition
partial; the parser does not assume battle scope. Closed count intervals are
two predicates in one `all` node. Endpoints are copied as written without
off-by-one conversion. In `before receiving N attacks`, `before` supplies the
`count < N` comparator; the counter still observes resolved `attack_landed`
events and therefore uses `after_event` rather than inventing a pre-resolution
hit. `relativeTiming` otherwise records `before_event`,
`during_event`, or `after_event` independently from both the condition and the
effect's `activationTiming`.

Incoming resolution is intentionally split into three source-neutral events:

- `incoming_attack` means the character has been selected as the target and the
  attack is pending resolution. It is true before impact whether the later
  result is a hit or a dodge and it never increments received-hit history;
- `attack_landed` means the incoming attack actually hit. `After receiving`,
  `after being hit`, received-attack counters, and per-received scaling use this
  event only;
- `attack_evaded` means the incoming attack was evaded. It is independent from
  `attack_landed`.

Consequently, `after receiving or evading an attack` is an explicit `any` AST
over `attack_landed` and `attack_evaded`; it is not collapsed into one event.
The shared `after_incoming_attack_resolved` activation moment is allowed only as
timing metadata for that proved union. It does not erase either branch.

Normal-only damage reduction is represented once: the typed
`damage_reduction` effect remains unchanged and its rule receives a
`current_event`/`incoming_attack`/`normal_attack` condition with
`before_event` timing, because applicability must be known before damage is
calculated. Attack kind is not duplicated on the effect. `For every attack
...` and unambiguous `with each attack ...` modifiers instead use
`per_combat_event` scaling, leave the rule condition `always`, and keep cap and
duration on the corresponding effect. First-party passive rows establish the
repeated battle accumulation rule used for these audited headers; this is
recorded as `documented_domain_rule`, not as an invented textual fact.

Future runtime context must separately expose the announced/targeted incoming
attack (including known kind/style), its resolved outcome (landed or evaded),
current-turn hit/evade counters, and battle hit/evade counters. Targeting alone
must never satisfy or increment a landed-hit counter. Missing event identity,
outcome, counter, or count scope evaluates to `Unknown`, never true or false.
Conditions, activation timing, and calculation bucket remain three independent
facts: targeting, being hit, or evading does not imply an On Attack bucket.

### Gate A5 Ki and Ki Sphere semantics

The three Ki predicates are runtime inputs, not team-construction facts:

- `ki_amount` is the character's final Ki for the current attack. It uses
  `scope: "self"`, `kiContext: "final_attack_ki"`, an explicit scalar
  comparator, and `evaluationMoment: "when_attacking"` or `before_attack`.
- `ki_spheres_obtained` is an explicit count from the character's current
  collection. It uses `kiContext: "collected_ki_spheres"`; its
  `kiSphereTypes` restrict which collected spheres enter the count.
- `ki_sphere_type_obtained` is presence shorthand and means `gte 1` for its
  declared sphere selector in the current collection.

Ki values and Ki Sphere counts are separate quantities. Closed intervals are
serialized as an `all` AST containing lower and upper scalar predicates, so no
implicit endpoint conversion or off-by-one rule is required. Attack Ki is an
integer in `0..24`; sphere counts are non-negative integers.

`KiSphereType` is deliberately distinct from `TeamAnalysisType`, even though
the five color labels overlap. `rainbow` is a sphere color, `non_rainbow`
represents the source phrase `Type Ki Sphere`, and `any` means no color filter.
`any` and `non_rainbow` are exclusive selectors and cannot be combined with
other values. Wording such as bare `When Ki is 24` does not prove whether the
value is final attack Ki and remains unknown. Missing runtime context also
evaluates to `Unknown`, never false or true.

The future evaluator needs, at minimum, optional `finalAttackKi`, the exact
counts collected in the current path by sphere color, and (only for board
effects) the pre-conversion board state. It must not estimate an average path,
assume 24 Ki, or infer unprovided sphere colors.

## 6. Effect contract

```ts
export interface PassiveEffect {
  kind: PassiveEffectKind;
  target: PassiveTarget;
  value?: number;
  unit?: "percent" | "flat" | "ki" | "count" | "boolean";
  count?: number;
  activationChancePercent?: number;
  additionalToSuperChancePercent?: number;
  /** @deprecated Compatibility alias for activationChancePercent. */
  chancePercent?: number;
  qualitativeChanceTerm?: "a chance" | "rare" | "medium" | "high" | "great";
  probabilitySource?: "explicit_text" | "first_party_game_db" | "qualitative_lexicon" | "unresolved";
  additionalToSuperQualitativeChanceTerm?: "a chance" | "rare" | "medium" | "high" | "great";
  additionalToSuperProbabilitySource?: "explicit_text" | "first_party_game_db" | "qualitative_lexicon" | "unresolved";
  perStack?: number;
  stackCap?: number;
  scaling?: PassiveEffectScaling;
  kiSphereChange?: KiSphereChange;
  duration?: PassiveDuration;
  categories?: string[];
  names?: string[];
  classes?: TeamAnalysisClass[];
  types?: TeamAnalysisType[];
  classifications?: PassiveEffectClassification[];
  activationTiming?: PassiveActivationTiming;
  calculationBucket?: PassiveCalculationBucketAssignment;
  sourceText: string;
}

export type PassiveEffectClassification = "support";

export interface PassiveTarget {
  scope:
    | "self"
    | "rotation_allies"
    | "team_allies"
    | "category_allies"
    | "class_allies"
    | "type_allies"
    | "class_type_allies"
    | "enemy"
    | "all_enemies"
    | "unknown";
  selfInclusion?: "included" | "excluded" | "unknown";
}

export interface PassiveDuration {
  kind: "instant" | "within_turn" | "turns" | "battle" | "until_trigger" | "unknown";
  turns?: number;
}

export type CalculationPhaseResolutionSource =
  | "explicit_text"
  | "first_party_game_db"
  | "documented_domain_rule"
  | "unresolved";

export type PassiveActivationMoment =
  | "start_of_turn"
  | "before_attacking"
  | "when_attacking"
  | "when_performing_super_attack"
  | "before_incoming_attack"
  | "when_targeted_by_attack"
  | "when_attack_landed"
  | "after_incoming_attack_resolved"
  | "after_attacking"
  | "after_attack_landed"
  | "when_evading"
  | "after_evading"
  | "after_final_blow"
  | "unresolved";

export interface PassiveActivationTiming {
  moment: PassiveActivationMoment;
  source: CalculationPhaseResolutionSource;
}

export type PassiveCalculationBucket =
  | "passive_start_of_turn"
  | "passive_on_attack"
  | "unresolved";

export interface PassiveCalculationBucketAssignment {
  bucket: PassiveCalculationBucket;
  source: CalculationPhaseResolutionSource;
}

export interface KiSphereEffectScaling {
  kind: "per_ki_sphere";
  kiSphereTypes: KiSphereType[];
  spheresPerIncrement: number;
  kiContext: "collected_ki_spheres";
}

export interface CombatEventEffectScaling {
  kind: "per_combat_event";
  connector: "single" | "and" | "or";
  eventsPerIncrement: number;
  events: CombatEventDescriptor[];
}

export type PassiveEffectScaling =
  | KiSphereEffectScaling
  | CombatEventEffectScaling;

export interface KiSphereChange {
  sourceSelection: "listed_types" | "all" | "random_type";
  sourceTypes?: ConcreteKiSphereType[];
  excludedSourceTypes?: TeamAnalysisType[];
  destinationType: ConcreteKiSphereType;
  kiContext: "board_state";
}
```

`activationChancePercent` is the probability that the typed effect activates.
`additionalToSuperChancePercent` has a narrower and different meaning: for an
`additional_attack`, it is the probability that each additional attack becomes
a Super Attack. `chancePercent` remains serialized as a compatibility alias for
`activationChancePercent`; when both fields exist they must be equal. It must
never be populated with the additional-to-Super probability. `count` records an
explicit number of attacks without changing either probability.

The activation channel owns `qualitativeChanceTerm` and `probabilitySource`.
The conversion channel owns the corresponding `additionalToSuper*` metadata.
This prevents an activation qualifier such as `high chance` from being confused
with a separate conversion qualifier such as `medium chance`. A typed effect
whose probability source is `unresolved` remains present, has no invented
numeric percentage, and makes the rule's independent `effectStatus` `partial`.

`duration` and `stackCap` modify the corresponding typed effect. They are not
emitted as standalone unknown effects when their association is unambiguous.
Unrecognized intervening qualifiers remain separate `unknown` effects.

`activationTiming` answers when the passive contribution becomes active.
`calculationBucket` answers where an ATK/DEF percentage contribution belongs in
the future formula. They are independent from the rule's `condition`: a
condition decides whether a contribution is available, activation timing says
when it becomes available, and the bucket says which passive multiplier owns
it. In particular, a contribution that activates after receiving an attack is
not automatically an On Attack bucket contribution.

The initial bucket contract is deliberately limited to typed `atk` and `def`
effects. Every generated typed effect carries either a resolved or unresolved
activation timing; every generated ATK/DEF effect likewise carries either a
resolved or unresolved bucket. An unresolved phase is metadata uncertainty and
does not change `conditionStatus`, `effectStatus`, or the recognized effect.
Unknown effect atoms cannot carry a calculation-phase claim.

Resolution precedence is explicit wording, exact first-party evidence for the
same passive/effect when available, a documented domain rule, then unresolved.
`Basic effect(s)` is classified as Start of Turn by the documented passive
calculation rule. Explicit start-of-turn wording also maps to that bucket.
`when performing a Super Attack` and `after performing a Super Attack` map to
the passive On Attack bucket by the documented rule. Bare `when attacking`,
attack-triggered stacks, and Ki thresholds remain bucket-unresolved unless a
stronger source proves their calculation phase. Super Attack effect raises are
a separate channel and are never serialized as passive buckets.

For `scaling.kind: "per_ki_sphere"`, the effect's `value` is the increment
applied once per `spheresPerIncrement` matching spheres; it is not a static
bonus. `stackCap` remains the cap on that same effect and is not folded into the
increment. Effects under a proven `For every ... Ki Sphere obtained` header and
effects with an inline `per ... Ki Sphere obtained` modifier use the same
structure. Separate passive contributions remain separate effects even when
they share kind, selector, or target.

`ki_sphere_change` requires a structured `KiSphereChange`. `listed_types`
names concrete source colors, `all` proves every source sphere, and
`random_type` proves that one Type is selected while optional exclusions remain
explicit. Destinations are concrete colors or `rainbow`; ambiguous "another
Type", item/special spheres, chance-qualified conversions without validated
probability semantics, and unclear source/destination wording remain unknown.
Board conversion always carries `kiContext: "board_state"` and is not a
character-Type target.

A temporal window that decides whether a rule is active belongs to the
condition AST, including an inline suffix such as `ATK +X% for 5 turns from the
character's entry turn`. An effect-local phrase such as `ATK +X% for 3 turns`
remains `PassiveDuration { kind: "turns", turns: 3 }`. Gate A3 does not move or
reinterpret `PassiveDuration` as a condition.

Initial effect taxonomy:

- `ki`
- `hp`
- `atk`
- `def`
- `damage_reduction`
- `guard`
- `evade_chance`
- `critical_chance`
- `additional_attack`
- `additional_super_attack`
- `effective_against_all_types`
- `super_attack_seal`
- `stun_chance`
- `enemy_atk_down`
- `enemy_def_down`
- `ki_sphere_change`
- `scouter`
- `revive`
- `domain`
- `unknown`

`support` is emitted only as a derived classification on an underlying typed,
beneficial ally-targeting effect. This includes typed Ki/HP/ATK/DEF, critical
chance, evade chance, damage reduction, guard, additional attack, additional
Super Attack, and effective-against-all-types effects when their target is allied.
The generator never emits an isolated
`kind: "support"` effect, and never classifies support solely because a
character appears on a site's support-only page. Every ally target must declare
whether it includes self, excludes self, or is unknown.

For `category_allies`, `class_allies`, `type_allies`, and
`class_type_allies`, selector arrays live on the effect and constrain the
target. Values within a selector array are alternatives; Class and Type
selectors on `class_type_allies` are intersected. `allies` includes self,
`another ally` or `(self excluded)` excludes self, and genuinely unsettled
wording uses `unknown`. A recognized beneficial Class/Type ally effect receives
only `classifications: ["support"]`; `support` is never an effect kind.

### Validated qualitative chance lexicon

Gate A1.1 resolves qualitative probability in this priority order:

1. percentage explicit in passive text;
2. checked-in first-party evidence tied to the exact state, complete passive
   text hash, rule line, and effect semantic;
3. the stable qualitative lexicon below;
4. `unresolved`, preserving the typed effect and source term without a number.

The central stable lexicon is:

| Source term | Percent | Validated source |
| --- | ---: | --- |
| `medium` | 30 | Global first-party game DB |
| `high` | 50 | Global first-party game DB |
| `great` | 70 | Global first-party game DB |

`rare` has no universal numeric mapping. It is resolved only by exact
first-party evidence for the affected state/rule/effect. Current validated
records legitimately contain both 7% and 15%; unrelated 7/15 fields are never
reverse-mapped to `rare`.

The phrase `a chance` is accepted as 10% only for additional-attack-to-Super
conversion. All eight audited first-party passive sets using that exact syntax
store 10 in `eff_value3`; other effect families remain unresolved. This
family-specific entry prevents the 10% observation from becoming a universal
probability rule.

The central mapping and row-level provenance live in
`team-analysis-chance-lexicon.ts`. The evidence comes from the local first-party
export (`dbVersion` `1782367825`, `assetVersion` `1782367204`) and joins
`passive_skill_sets`, `passive_skill_set_relations`, and `passive_skills`.
Separate rows validate critical activation (`eff_value1`), evade activation
(`eff_value1`), additional Super activation (`probability`), and conversion of
an additional attack to Super (`eff_value3`). Exact state-bound evidence lives
in `team-analysis-first-party-probabilities.ts`; stable terms and the audited
family-specific `a chance` entry live in `team-analysis-chance-lexicon.ts`.
An explicit percentage always wins. `Chance of...` without a percentage or
qualifier is a typed but unresolved probability, never `true`, `false`, or
`always`.

Hidden Potential is a separate mechanic: Critical and Additional use skill
level × 2%, while Dodge/Evasion uses skill level × 1%. Those formulas are future
domain knowledge outside this passive contract and are not applied by this
parser.

### Gate A7 Super Attack effect channel

Gate A7 adds a sibling channel; it does not serialize Super Attack effects as
passive rules or Active Skill effects.

```ts
export interface ParsedSuperAttack {
  id: string;
  variant: "normal" | "ultra" | "extra" | "unit";
  ordinal: number;
  name?: string;
  ki?: number;
  attackType?: string;
  style?: string;
  effectOrigin: "super_attack";
  rawText: string;
  condition: ParsedSuperAttackCondition;
  effects: SuperAttackEffect[];
  effectStatus: ParseStatus;
  parseStatus: ParseStatus;
  sourceFragments: SourceFragment[];
  unparsedFragments: SourceFragment[];
}

export interface ParsedSuperAttackCondition {
  rawText: string;
  expression: ConditionExpression;
  parseStatus: ParseStatus;
  sourceFragments: SourceFragment[];
  unparsedFragments: SourceFragment[];
}

export interface SuperAttackEffect {
  kind:
    | "atk_raise"
    | "def_raise"
    | "enemy_atk_lowering"
    | "enemy_def_lowering"
    | "stun"
    | "super_attack_seal";
  origin: "super_attack";
  target: {
    scope: "self" | "allies" | "current_target" | "all_enemies" | "unknown";
    selfInclusion?: "included" | "excluded" | "unknown";
  };
  magnitude?:
    | "raise" | "greatly_raise" | "massively_raise"
    | "lower" | "greatly_lower" | "massively_lower";
  value?: number;
  unit?: "percent";
  activationChancePercent?: number;
  qualitativeChanceTerm?: "a chance" | "rare" | "medium" | "high" | "great" | "may";
  probabilitySource?: ProbabilitySource;
  duration: {
    kind: "current_turn" | "turns" | "permanent" | "unknown";
    turns?: number;
    source: CalculationPhaseResolutionSource;
  };
  stacking?: {
    kind: "stackable" | "not_stackable" | "unknown";
    capPercent?: number;
    source: CalculationPhaseResolutionSource;
    capSource?: CalculationPhaseResolutionSource;
  };
  activationTiming: {
    moment: "when_super_attack_effect_resolves" | "unresolved";
    source: CalculationPhaseResolutionSource;
  };
  calculationBucket?: {
    bucket:
      | "super_attack_raise"
      | "super_attack_enemy_stat_lowering"
      | "unresolved";
    source: CalculationPhaseResolutionSource;
  };
  parseStatus: ParseStatus;
  sourceText: string;
  source: SourceFragment[];
}
```

The `variant` names gameplay attack slots, not a source website. `id` is stable
from state key, variant, and ordinal. `rawText`, condition text, and exact line
offsets are retained independently. An empty attack condition is explicit
`always`; a non-empty condition remains `unknown` until its complete binding is
modeled. In particular, EX conversion conditions are not folded into an effect
or treated as already met.

ATK/DEF raises target `self` unless the effect explicitly says allies. The
source-neutral `allies` target does not guess team versus rotation scope and
keeps `selfInclusion: "unknown"` unless the source proves it. Enemy effects use
`current_target` for singular enemy wording and `all_enemies` only when the
description proves the plural target. This channel does not reuse
`PassiveTarget`, whose team/rotation scopes have different evidence rules.

Numeric percentages are emitted only when present in the effect text.
`raise`, `greatly raise`, `massively raise`, and the corresponding lowering
terms remain qualitative magnitudes; they are not reverse-mapped to imagined
percentages. `for 1 turn`, `for N turns`, and explicit `in battle`/
`permanently` wording map respectively to `current_turn`, `turns`, and
`permanent`. A bare raise has `duration: unknown`; it is never promoted to a
permanent stack by convention.

Every stat effect preserves stacking separately. Gate A7 emits `stackable` and
`capPercent` only for explicit stacking/cap syntax. Otherwise it emits
`stacking.kind: "unknown"` with unresolved provenance, even when community
knowledge would normally call the effect stackable. The production payload has
no explicit cap syntax; cap support is protected by synthetic goldens rather
than inferred production data.

Status chance wording is equally conservative. An explicit numeric chance is
stored with `probabilitySource: "explicit_text"`. Qualitative Super Attack
terms are retained with unresolved probability and no number. The passive
chance lexicon is not reused because its checked first-party evidence is tied
to passive semantics, not the Super Attack special channel. A stun or seal
without chance wording remains a typed deterministic-looking source statement
but does not receive an invented `100` percentage.

`activationTiming` states only that the effect belongs to Super Attack effect
resolution; it does not claim a damage/DEF rounding boundary. ATK/DEF raises
use the future `super_attack_raise` bucket, and enemy ATK/DEF lowering uses the
separate `super_attack_enemy_stat_lowering` bucket. Status effects have no
mathematical stat bucket. These fields remain independent from condition,
duration, stacking, and source text, and Gate A7 does not evaluate or calculate
any contribution.

Attack-level status is `unknown` when no Gate A7 effect is recognized, and
`partial` when typed effects coexist with residual damage/formula text, an
unmodeled condition, or unresolved probability. Damage tier, base Super Attack
multiplier, critical/all-Type effects, healing, sacrifice, action disable,
evasion, counters, and other out-of-scope clauses remain lossless residuals.

## 7. Parsing pipeline

1. Preserve source skill name, raw text, lines, and sections.
2. Normalize punctuation/whitespace without deleting source offsets.
3. Split section headers from effects using the existing deterministic passive
   section logic.
4. Parse boolean connectors (`and`, `or`, `when`, `if`, `for every`, `plus an
   additional`) into an AST.
5. Parse predicates and effects independently.
6. Extract an unambiguous inline HP/turn activation window into the condition
   channel while leaving effect duration in `PassiveDuration`.
7. Associate effects with the narrowest preceding condition scope.
8. Preserve every unsupported fragment explicitly.
9. Generate a coverage report by predicate/effect/status.

The Super Attack pipeline runs independently: select the exact release/variant
source, preserve effect and condition text, recognize only Gate A7 effect
families, bind duration/chance/target/stacking to the matched source span, and
retain every remaining token as an offset-backed residual. It never reparses a
passive or Active Skill string as a Super Attack to increase coverage.

Effect parsing is target-independent: first recognize source-neutral effect
atoms, then apply the target resolved from the source prefix (`self`, all
allies, category allies, Class allies, Type allies, or Class+Type allies). In a compound
effect, recognized atoms remain typed while only the unrecognized qualifier or
segment becomes `unknown`. Qualitative chance words such as `high` or `great`
must not receive numeric values until a central, validated mapping exists.

Do not parse Android display output. The TypeScript pipeline owns source cleanup
and semantics so every consumer receives the same rules.

## 8. Coverage gates

The current published payload has 1,556 passive states and broad condition
families. Parser rollout is staged:

### Gate A - team and rotation predicates

- category/name/class/type ally conditions;
- all-same-turn conditions;
- slot 1/2/3;
- unconditional/basic effects;
- beneficial typed ally-targeting effects with derived support classification.

Required before Android shows enabler/support labels:

- golden fixtures for every supported form;
- no source-token loss;
- no `unknown` converted to `Met`/`NotMet`;
- measured high-confidence coverage reported, not assumed.

### Gate B - scenario predicates

- HP and turn thresholds;
- enemy count/category/class/type/name/status;
- entry duration, domains, standby, active skill, revive.

### Gate C - runtime counters

- attacks, supers, evades, Ki and Ki spheres;
- stacking, caps, duration, and chance.

Gate C can remain `Unknown` in Team Builder unless a user supplies a simulation
scenario. Parsing it is still useful for role explanations.

No global percentage alone is sufficient. Coverage reports must separate:

- source states;
- parsed rules;
- supported predicates;
- supported effects;
- partial rules;
- unknown fragments;
- team-evaluable versus scenario/runtime-only rules;
- scenario-containing versus fully scenario-evaluable rules.

Gate A7 additionally reports attack/effect/condition status, typed and numeric
effect counts, target scopes, duration and stacking resolution, explicit caps,
probability provenance/qualitative terms, future calculation buckets, and
unparsed Super Attack fragments. Passive rule totals retain their previous
meaning and are not inflated by the sibling channel.

## 9. Validation and fixtures

Required golden families:

- unconditional/basic passive;
- entrance animation;
- category, name, class, and type ally;
- `another ally` versus self-inclusive conditions;
- same-turn all/any composition;
- slot 1, 2, 3 and combinations;
- HP upper/lower/range;
- turn threshold and duration from entry;
- attacks performed/received/evaded;
- Super Attack performed/received;
- Ki thresholds and typed/Rainbow spheres;
- enemy count/type/class/category/name/status;
- stack per event with cap;
- Active Skill, standby, finish, revive, and domain;
- nested `and`/`or` precedence;
- transformed, exchange, tag, EZA, and SEZA states;
- malformed/unknown text fallback.

Validators:

- state keys unique;
- hard-duplicate group present for every state and stable across forms of one
  card;
- variant groups never merge states solely because display names match;
- every state references a character/form in the matching character payload;
- source fragments are ordered and point to original text;
- numeric values are finite and within contract bounds;
- AST nodes are non-empty and bounded in depth;
- unknown enum values serialize safely;
- manifest count/size/SHA match payload;
- output deterministic with fixed `generatedAt`.

## 10. Publication and compatibility

Suggested manifest:

```json
{
  "schemaVersion": 1,
  "datasetVersion": "...",
  "generatedAt": "...",
  "fileName": "releases/.../team-analysis.json.gz",
  "compression": "gzip",
  "sha256": "...",
  "sizeBytes": 0,
  "uncompressedSizeBytes": 0,
  "stateCount": 0,
  "rulesVersion": "1",
  "parserVersion": "1.7.0",
  "sourceCharacterDatasetVersion": "...",
  "sourceCharacterPayloadSha256": "..."
}
```

Gate A3 keeps `schemaVersion` at `1`. It adds an optional
`evaluationMoment`, emits new predicate enum values that had no Gate A2 payload
instances, and adds `scenarioEvaluableRuleCount` to coverage. It does not remove
or reinterpret a serialized Gate A1/A1.1/A2 field. Consumers that treat Team
Analysis as optional enrichment and ignore unrecognized predicates remain
compatible; `parserVersion` advances to `1.3.0` so consumers can feature-detect
the scenario semantics. A schema bump is reserved for a change that makes
previously valid payloads invalid or changes an existing serialized meaning.

Gate A4 also keeps `schemaVersion` at `1`. Enemy selection/name/status fields,
enemy predicates, evaluation moments, and the enemy-selection coverage map are
additive; no existing serialized meaning changes. Consumers already required
to tolerate unknown optional enrichment may ignore these values.
`parserVersion` advances to `1.4.0` for feature detection.

Gate A4.1 keeps `schemaVersion` at `1`. The optional evidence arrays and
coverage counters are additive, while existing condition/effect fields retain
their meaning. `parserVersion` advances to `1.4.1` because validated upstream
markers can now change an affected condition from unknown to typed
`enemy_status`. Consumers that ignore the new evidence continue to consume the
same AST and raw-text fields.

Gate A5 also keeps `schemaVersion` at `1`. `kiContext`, typed sphere selectors,
effect scaling, conversion metadata, and Ki coverage counters are additive;
previously valid fields retain their meaning, and consumers may ignore the new
optional enrichment. The already reserved Ki predicate/effect kinds now gain
validated payload instances. `parserVersion` advances to `1.5.0` so consumers
can feature-detect these runtime semantics. A schema bump remains reserved for
removing a field, narrowing previously valid payloads, or changing an existing
serialized meaning.

Gate A5.1 keeps `schemaVersion` at `1`. `activationTiming`,
`calculationBucket`, their provenance values, and calculation-phase coverage
counters are additive enrichment. Existing condition/effect meanings and parse
statuses do not change, and consumers may ignore the new fields.
`parserVersion` advances to `1.5.1` for feature detection. The current
generator emits explicit `unresolved` assignments where a calculation consumer
would otherwise be tempted to infer a phase from absent data; older cached
schema-1 payloads may omit the enrichment entirely.

Gate A6 keeps `schemaVersion` at `1`. The optional `combatEvent` descriptor,
the new `per_combat_event` member of the additive scaling union, additional
activation moments, and combat coverage counters do not remove or reinterpret
any Gate A1-A5.1 field. The attack predicate enum values were already reserved;
they now gain validated payload instances. Consumers that ignore unknown
optional enrichment continue to read schema-1 payloads, while
`parserVersion: "1.6.0"` allows calculation-aware consumers to feature-detect
the event semantics. Older cached payloads may omit every Gate A6 field.

Gate A7 also keeps `schemaVersion` at `1`. Optional `superAttacks` is a sibling
enrichment on a state; all new attack/effect types, provenance fields, and
coverage counters are additive. Existing passive fields, rule counts, and
serialized meanings are unchanged. Consumers may ignore the sibling channel,
and older cached schema-1 payloads may omit it entirely. `parserVersion:
"1.7.0"` allows consumers to feature-detect the conservative Super Attack
effect contract.

- Upload immutable payload before mutable manifest.
- Run publisher dry-run and report projected new bytes before upload.
- Keep R2 comfortably below the owner's 10 GB free allowance.
- Cache payload by content hash and promote manifest atomically.
- Bundle one compatible compressed payload in Android for offline use.
- Android rejects mismatch/corruption and keeps the previous compatible cache.
- Old cached character datasets remain supported; passive-aware analysis is
  optional enrichment.

## 11. Explicit exclusions

This dataset does not contain:

- team drafts or user choices;
- precomputed team recommendations;
- synergy grades;
- rotation suggestions;
- event-specific optimal teams;
- tier-list power;
- copied Dokkan.fyi badge values;
- runtime battle outcomes.
