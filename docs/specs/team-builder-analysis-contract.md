# Team Builder Analysis Data Contract

**Status:** proposed
**Last updated:** 2026-08-03
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

## 4. Passive contract

```ts
export interface ParsedPassive {
  name?: string;
  rawText: string;
  parseStatus: "supported" | "partial" | "unknown";
  rules: PassiveRule[];
  unparsedFragments: SourceFragment[];
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
```

Rule IDs are deterministic from state key plus normalized source position, not
random UUIDs. Re-scraping unchanged text must produce byte-stable semantic data
apart from top-level timestamps.

Condition and effect status are independent. A rule with an unknown condition
and recognized effects is `partial`: it retains `op: "unknown"` for the
condition and the typed effects. Rule status is `supported` only when both are
supported, and `unknown` only when both are unknown.

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
  kiSphereTypes?: string[];
  sourceText: string;
}

export type TeamAnalysisClass = "Super" | "Extreme";
export type TeamAnalysisType = "AGL" | "TEQ" | "INT" | "STR" | "PHY";
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
- `turn_number`
- `turns_from_entry`
- `enemy_count`
- `enemy_category`
- `enemy_name`
- `enemy_class`
- `enemy_type`
- `enemy_status`
- `domain_active`
- `standby_active`
- `active_skill_used`
- `revive_triggered`

### Runtime/battle dependent

- `ki_amount`
- `ki_spheres_obtained`
- `ki_sphere_type_obtained`
- `attacks_performed`
- `attacks_received`
- `attacks_evaded`
- `super_attacks_performed`
- `super_attack_received`
- `final_blow_delivered`
- `chance_roll`

Unknown or unsupported clauses use `op: "unknown"`; they are never coerced to
`always` or false.

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
  duration?: PassiveDuration;
  categories?: string[];
  names?: string[];
  classes?: TeamAnalysisClass[];
  types?: TeamAnalysisType[];
  classifications?: PassiveEffectClassification[];
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

## 7. Parsing pipeline

1. Preserve source skill name, raw text, lines, and sections.
2. Normalize punctuation/whitespace without deleting source offsets.
3. Split section headers from effects using the existing deterministic passive
   section logic.
4. Parse boolean connectors (`and`, `or`, `when`, `if`, `for every`, `plus an
   additional`) into an AST.
5. Parse predicates and effects independently.
6. Associate effects with the narrowest preceding condition scope.
7. Preserve every unsupported fragment explicitly.
8. Generate a coverage report by predicate/effect/status.

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
- team-evaluable versus scenario/runtime-only rules.

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
  "parserVersion": "1.2.0",
  "sourceCharacterDatasetVersion": "...",
  "sourceCharacterPayloadSha256": "..."
}
```

Gate A2 keeps `schemaVersion` at `1`. It adds optional selector fields and new
predicate/target enum values but does not remove or reinterpret any Gate A1/A1.1
field. Consumers that treat Team Analysis as optional enrichment and ignore
unrecognized predicates/targets remain compatible; `parserVersion` advances to
`1.2.0` so consumers can feature-detect the richer semantics. A schema bump is
reserved for a change that makes previously valid payloads invalid or changes
the meaning of an existing field.

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
