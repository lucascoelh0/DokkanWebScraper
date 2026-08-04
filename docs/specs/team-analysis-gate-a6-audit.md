# Team Analysis Gate A6 audit

**Baseline commit:** `3a54f48`
**Character dataset:** `2026-08-03T22:41:40.735Z`
**Character payload SHA-256:**
`a5a2a6b5f4821ff6e9d7d56cc0d56776a98843413ebf3f920a71b63cf14e4938`
**Schema:** `1`
**Parser:** `1.6.0`

## 1. Baseline text audit

The audit traversed the Gate A5.1 artifact before parser changes and grouped
unknown conditions by exact normalized source syntax. Counts are rule
occurrences: a structural header is repeated for each governed effect line.

| Family | Representative syntax | Baseline occurrences |
| --- | --- | ---: |
| current outgoing attack | `When attacking` | 191 |
| per outgoing attack | `For every attack performed` | 152 |
| per incoming attack | `For every attack received` | 117 |
| after incoming attack | `After receiving an attack` | 105 |
| per Super performed | `For every Super Attack performed` | 86 |
| current incoming attack | `When receiving an attack` | 82 |
| per evade | `For every attack evaded` | 48 |
| after evade | `After evading an attack` | 44 |
| incoming Super | `When receiving a Super Attack` | 41 |
| received-or-evaded scaling | `For every attack received or evaded` | 34 |
| final blow | `After delivering a final blow` | 31 |
| Ki Blast Super received | `When receiving a Ki Blast Super Attack` | 28 |
| Unarmed Super received | `When receiving an Unarmed Super Attack` | 19 |
| normal received | `When receiving a normal attack` | 16 |
| before outgoing/incoming | `Before attacking`; `Before receiving...` | 30 |

The real source also contains one Physical Super received occurrence, explicit
thresholds after attacks performed/received/evaded, current-turn wording, and
many repeated-threshold forms beginning `Every time the character ...`.
The latter are not equivalent to a single cumulative threshold and remain
unknown. Clauses involving attack Ki, the next attacking turn, an enemy hit by
the character's Super Attack, or attacker slot retain their independently
recognized branches and residual unknown text where the Gate A6 binding is not
proved.

The audited incoming-attack vocabulary proves four source shapes:

- generic `attack`;
- `normal attack`;
- `Super Attack`;
- Super style `Ki Blast`, `Unarmed`, or `Physical`.

Consequently Gate A6 does not define imagined weapon/damage kinds. Generic
attack stays `attackKind: "unknown"`; the optional style is emitted only for a
Super Attack.

## 2. First-party cross-check

The reproducible Global export is recorded in
`game-db/data/game-db-acquisition/first-party/latest/metadata.json`:

- DB version `1782367825`;
- asset version `1782367204`;
- APK `6.2.5-7bd58ad32a3f187fe638587d4277a850ec8c1d67e04d9aa21433a931211621c1`;
- export timestamp `2026-06-28T17:43:15.341Z`.

The audit joined `passive_skill_sets.id` to
`passive_skill_set_relations.passive_skill_set_id`, then
`passive_skill_set_relations.passive_skill_id` to `passive_skills.id`, and
inspected `itemized_description`, `exec_timing_type`, `efficacy_type`, `turn`,
`causality_conditions`, and `eff_value1..3`.

Representative families were structurally distinct in the engine data:

- per attack performed: passive sets `1073`/`1074`, efficacy `98`, execution
  timing `5`, `turn=99`;
- per attack received: sets `844`/`845`, efficacy `98`, timing `7`,
  `turn=99`, with causality source `24` in the linked rows;
- per attack evaded: set family `1922`, efficacy `98`, timing `7` and linked
  causality rows;
- per Super Attack performed: set family `1591`, efficacy `98`, timing `5`,
  `turn=99`, with causality source `435`;
- final blow: linked timing `9`/`14` rows with causality source `13`;
- normal-attack received: timing `6`, efficacy `120`, plus timing `7`
  reset/removal rows.

The final hit-vs-targeting reconciliation audited two exact passive sets:

- `Zamasu Shall Rule All`, passive set `3529`: skills `8003529` and
  `9003529` correspond to `When receiving an attack`, use
  `exec_timing_type=6`, efficacy `2`, and DEF `50`; `8003529` has no
  causality row and `9003529` is joined to causality source `2547`. Skills
  `10003529` and
  `11003529` correspond respectively to `After receiving an attack` and `For
  every attack received`, use `exec_timing_type=7`, and are joined to
  causality source `2545` (the latter has efficacy `98`, ATK `25`, cap `150`,
  and `turn=99`).
- `God-on-God Showdown`, passive set `2068`: skill `2002068` corresponds to
  `After receiving an attack`, uses `exec_timing_type=7`, efficacy `3`, ATK/DEF
  `70`, `turn=1`, and causality source `24`.

These joins confirm that timing `6` represents pre-resolution incoming
targeting for the audited `When receiving` rows, while the correctly joined
timing `7` rows represent a post-hit channel. `exec_timing_type=7` alone is not
treated as universal proof of a hit: the causality relation, passive set, skill
row, and matching passive text must agree, because dodge causality can also use
post-resolution timing.

This validates that `For every ...` is repeated accumulation over the battle
and that normal-only incoming applicability is a distinct engine concern. The
normalized character payload does not preserve an exact first-party row ID per
generated effect, so output provenance uses `documented_domain_rule` for the
audited repetition/count scope and actor relation. It does not falsely claim an
exact `first_party_game_db` join for each character state.

## 3. Contract and parser decisions

`CombatEventDescriptor` separates event type, actor, attack kind/style, mode,
counter scope, relative timing, and provenance. Current applicability uses
`current_event`; scalar history uses `accumulated_count`; effect repetition
uses `per_event` inside `PassiveEffectScaling`. A condition predicate may not
use the scaling-only mode.

Explicit battle and current-turn scopes are preserved. A historical threshold
without scope serializes `countScope: "unknown"` with unresolved provenance and
keeps the condition partial. Closed intervals are an `all` AST with inclusive
lower/upper predicates. No endpoint is rewritten and no counter is invented.
`Before receiving N attacks` becomes `attack_landed` count `< N`; its completed
history has `after_event` timing because the word `before` defines the window,
not an impossible pre-resolution hit.

Incoming events are split by causality: `incoming_attack` is targeting before
resolution, `attack_landed` is a confirmed hit, and `attack_evaded` is a
confirmed dodge. `When receiving` uses `incoming_attack` and remains satisfied
if the attack is later evaded; `after receiving`, `after being hit`, and
received counters use `attack_landed`. A received-or-evaded expression remains
an AST OR over `attack_landed` and `attack_evaded`. Targeting never increments
hit history.

Damage reduction against normal attacks is represented by one typed
`damage_reduction` effect and one current `incoming_attack` normal-attack
condition with pre-event applicability.
The attack kind is not duplicated on the effect. Caps and durations remain on
the effect, including per-event scaling. Boolean AND/OR/NOT grouping uses the
existing AST and never drops an unknown sibling to obtain supported status.

`activationTiming` gains explicit `before_incoming_attack`,
`when_targeted_by_attack`, `when_attack_landed`, `after_attack_landed`, and
`after_incoming_attack_resolved` moments alongside evade timing. These are
facts about activation, not calculation buckets. In particular, targeting,
hit/evade history, and outcome triggers remain bucket unresolved unless the
independent Gate A5.1 evidence proves a bucket.

## 4. Conservative residuals

The parser intentionally leaves these families unknown or partial:

- `Every time ... N or more attacks`: repeated threshold/reset semantics are
  not the same as one accumulated `gte N` condition;
- attack counts without explicit turn/battle scope: typed count with unknown
  scope, therefore partial;
- incoming attack combined with final attack Ki: both facts are recognizable,
  but their binding/evaluation order is not assumed by a loose regex;
- `enemy ... hit by the character's Super Attack`: historical binding between
  a prior outgoing event and a particular enemy is not modeled yet;
- `next attacking turn`, Active Skill, counters, interruption, and Super Attack
  effect raises: outside Gate A6;
- `the enemy launches a Super Attack at the character`: launch-at wording is
  not silently converted to a received/hit event.

Missing runtime history or current-event context must evaluate to Unknown in a
future consumer. It never means false, true, normal attack, or 24 Ki.

## 5. Compatibility and validation

`schemaVersion` remains `1`: the optional predicate descriptor, additive
scaling union member, activation enum values, and coverage counters do not
remove or reinterpret a Gate A1-A5.1 field. Consumers may ignore the
enrichment. `parserVersion` advances to `1.6.0` so event-aware consumers can
feature-detect the contract.

Goldens cover current and accumulated events, performed/received/evaded/Super/
final-blow families, normal/Super/generic distinctions, battle and turn
counts, intervals, per-event scaling, AND/OR/NOT, caps, durations, ambiguous
scope, ambiguous repeated thresholds, and wrapped-line lossless reconstruction.
Validators reject mismatched predicate/event kinds, invalid counts and scopes,
impossible provenance pairs, per-event mode in a condition, current-event mode
in scaling, and invalid scaling arity/units.

## 6. Final real-payload coverage and artifact

On the same character payload, supported/partial/unknown coverage changed as
follows:

| Channel | Gate A5.1 | Gate A6 |
| --- | ---: | ---: |
| passive states | 400 / 1,150 / 8 | 518 / 1,036 / 4 |
| rules | 5,844 / 3,273 / 200 | 6,834 / 2,373 / 110 |
| conditions | 6,837 / 276 / 2,204 | 7,988 / 266 / 1,063 |
| effects | 7,765 / 976 / 576 | 7,875 / 866 / 576 |

The output contains 866 combat-event predicates and 590 typed effects with
combat-event scaling. Predicate distribution is 333 `attacks_performed`, 163
`incoming_attack`, 94 `incoming_super_attack`, 158 landed-hit
`attacks_received`, 63 `attacks_evaded`, 24 `super_attacks_performed`, and 31
`final_blow_delivered`. There are 768 rules dependent on a current event and
514 dependent on historical counters or per-event accumulation; a rule may
belong to both groups. Across predicates and scaling, event types are 690
`attack_performed`, 257 `incoming_attack`, 350 `attack_landed`, 168
`attack_evaded`, and 33 `final_blow_delivered`.

Across predicate and scaling descriptors, event modes are 787 current, 79
accumulated-count, and 632 per-event. Attack kind is 19 explicit normal, 237
explicit Super, and 1,242 generic/unknown. This high generic count is expected:
the parser did not infer normal or Super from bare `attack`. Explicit Super
style distribution is 28 Ki Blast, 19 Unarmed, 1 Physical, and 189 style-
unknown Supers.

The largest attack/history residuals are incoming attack combined with attack
Ki (10 at 12+ Ki plus smaller thresholds), prior-enemy-hit binding (8),
launch-at rather than received-Super wording (6), repeated `Every time ... 3+
attacks` families (9 across generic and Super examples), per-attack plus slot
or before-attack qualifiers, and next-attacking-turn wording. Unrelated
ally/enemy text containing the word `attacking` is not counted as a Gate A6
success merely because it matches the broad audit filter.

Final artifact:

- dataset version `2026-08-03T22:41:40.735Z:parser-1.6.0`;
- compressed size `997,107` bytes;
- uncompressed size `20,994,993` bytes;
- payload SHA-256
  `fe358c80b13222a2302dae73a4c177ff3985adda59536cd34ea7377607f58fa2`;
- generation times `2.892 s` and `2.869 s`;
- manifest SHA-256
  `0d3fca49323b894e92d960c8483690b31095252743834ef8cf72539a96284a1e`;
- coverage SHA-256
  `133ec1882924117c43ecbe4b3ab2615f167c7d0fcdeb8066857d32b3d7cd0c89`.

The two generated gzip, manifest, and coverage files were byte-identical.
Compared with Gate A5.1, the additive event data costs 70,954 compressed bytes
and 1,119,555 uncompressed bytes. Normal generation performs no network
request. Focused Team Analysis tests passed 262 cases; full `npm test` passed
433 cases, followed by deterministic generation and `git diff --check`.
