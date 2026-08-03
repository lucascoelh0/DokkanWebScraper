# Team Analysis Gate A3 Audit

**Date:** 2026-08-03
**Baseline:** `a00d6fd Implement Team Analysis Gate A2`
**Character payload:** `2026-07-20T20:22:44.502Z`
**Character SHA-256:** `a92d451e771a170d3aeffc36aaf47d97dc4538f68f3d1aa2edef9eb196930d72`

## Source audit

The pre-parser audit inspected unknown condition nodes across all 1,556 passive
states. It found 557 HP occurrences in 131 exact syntaxes and 1,045 occurrences
in 289 broader syntaxes containing turn/entry vocabulary. The temporal count is
intentionally broad and includes same-turn rotation wording; it was used for
discovery, not as a claimed parseable denominator.

The most frequent HP thresholds were:

- `When HP is 50% or more`: 80;
- `When HP is 50% or less`: 38;
- `When HP is 80% or less`: 32;
- `When HP is 30% or less`: 24;
- `When HP is 30% or more`: 23.

The most frequent explicit temporal windows were `For 1 turn from the
character's entry turn` (83), `For 4 turns from the character's entry turn`
(29), `For 5 turns from the character's entry turn` (28), and `Starting from
the 5th turn from the character's entry turn` (26). Global lower bounds include
`Starting from the 4th turn from the start of battle` (21), 5th (16), 3rd (14),
and 7th (13).

The real payload also contains a closed entry-relative window (`From the 2nd to
the 4th turn from the character's entry turn`) and explicit odd/even
entry-relative point lists. It contains no audited passive condition using the
strict words `above`/`below`, no `exactly`, no bare `on the 4th turn`, and no
`up to the 6th turn`; those contract forms use synthetic goldens.

## Contract decisions

- `hp_percent` is shared team HP and always has `scope: "team"`.
- `battle_turn` is the global 1-based index from battle start and has
  `scope: "battle"`.
- `turn_from_entry` is the character-relative 1-based index whose first
  appearance is index 1 and has `scope: "self"`.
- No ordinal is shifted. `3rd` is stored as 3.
- `or more`/`or above` are inclusive `gte`; `or less`/`or below` are inclusive
  `lte`; standalone `above`/`below` are strict `gt`/`lt`; `exactly` is `eq`.
- Closed ranges are `all` ASTs of scalar bounds. `For N turns from ...` is
  exactly `[1, N]`, not `[1, N + 1]`.
- Explicit sampling phases use `evaluationMoment`: `start_of_turn`,
  `entry_turn`, or `end_of_turn`.
- Missing scenario values or phase yield `Unknown` in a future evaluator, not
  false.

`schemaVersion` remains 1. Gate A3 adds an optional predicate field, new enum
values that had no Gate A2 payload instances, and an additive coverage field.
No serialized Gate A1/A1.1/A2 meaning was removed or reinterpreted.
`parserVersion` advances from 1.2.0 to 1.3.0.

## Condition versus effect duration

An activation window is represented in the condition channel whether it is a
header or an unambiguous inline suffix. Thus `damage reduction for 10 turns
from the character's entry turn` gets a `turn_from_entry` condition window.
`ATK +20% for 3 turns`, with no scenario origin, stays
`PassiveDuration { kind: "turns", turns: 3 }` on the effect.

Lowercase wrapped continuations such as `starting from the 11th turn...` are
kept with their originating bullet instead of being promoted to standalone
headers. Six previously artificial standalone rules are consequently folded
back into their source rules; no source fragment or token is dropped.

## Coverage

| Metric | Gate A2 | Gate A3 | Delta |
| --- | ---: | ---: | ---: |
| Passive supported / partial / unknown | 128 / 1,417 / 11 | 199 / 1,346 / 11 | +71 / -71 / 0 |
| Rule supported / partial / unknown | 3,037 / 5,816 / 439 | 3,689 / 5,315 / 282 | +652 / -501 / -157 |
| Condition supported / partial / unknown | 3,933 / 167 / 5,192 | 4,810 / 202 / 4,274 | +877 / +35 / -918 |
| Effect supported / partial / unknown | 7,205 / 1,263 / 824 | 7,207 / 1,261 / 818 | +2 / -2 / -6 |
| Unknown fragments | 7,353 | 6,701 | -652 |
| Team-evaluable rules | 3,611 | 3,590 | -21 reclassified to scenario |
| Placement-evaluable rules | 322 | 322 | 0 |
| Rules containing scenario predicates | 0 | 950 | +950 |
| Fully scenario-evaluable rules | 0 | 898 | +898 |

The final recognized scenario-predicate distribution is:

- `turn_from_entry`: 801 predicates (`gte` 436, `lte` 325, `eq` 40);
- `hp_percent`: 428 predicates (`lte` 254, `gte` 173, `eq` 1), including 32
  with an explicit start/end evaluation moment;
- `battle_turn`: 111 predicates (`gte` 109, `lte` 2).

The 950 scenario-containing rules comprise 898 fully supported conditions and
52 partial conditions that retain at least one unknown branch.

## Conservative residuals

There are 130 remaining HP-looking unknown nodes in 54 syntaxes. The leading
groups are proportional scaling (`The more HP remaining`, 30; `The less HP
remaining`, 15), enemy HP, HP sampled while attacking/receiving an attack, HP
combined with Ki thresholds, and HP after an attack-history threshold. These
remain unknown because their required runtime or enemy context is outside Gate
A3.

There are 206 targeted temporal/phase residual nodes in 51 syntaxes. The main
groups are Entrance Animation activation upon entry (54), bare `At the start of
each turn` effects (36), residual `at the start of turn` qualifiers (23), next
attacking turn after attacks received/performed/evaded, and per-turn counters.
The parser does not reinterpret these as numeric battle turns.

Examples of intentional fallbacks:

- `The less HP remaining` remains one unknown condition;
- `HP is 50% or less after receiving an attack` remains unknown rather than
  evaluating HP at an invented phase;
- `Starting from the character's next attacking turn after ... attacks`
  remains unknown because it depends on attack history;
- a known HP or numeric-turn branch OR an enemy branch remains a partial `any`
  AST with both branches preserved.

## Artifact and determinism

The generated `team-analysis.json.gz` has:

- uncompressed size: 16,099,926 bytes;
- compressed size: 782,422 bytes;
- SHA-256: `6557f2705f19cb9bcd262f9a5a924daf90909eeec08be00aa3b2234286680131`;
- final complete generation times: 2,759 ms and 2,687 ms.

The two final verification runs produced byte-identical gzip, manifest, and
coverage outputs. Generation and tests were not run concurrently because they
may update generated paths.

## Next-gate risks

The largest semantic risk is parsing HP independently when its value is sampled
during an attack or after an attack-history event. That requires an explicit
runtime phase model and must not be added as a regex suffix shortcut. Entrance
Animation entry conditions also need a dedicated activation predicate rather
than treating every `upon entry` phrase as a numeric turn.

The next scenario slice can safely address enemy count/class/type/category/name
and enemy HP/status. Attack history, Ki, Ki Spheres, next-attacking-turn events,
and per-turn counters should remain a separate runtime gate.
