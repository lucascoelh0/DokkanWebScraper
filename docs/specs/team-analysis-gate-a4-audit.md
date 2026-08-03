# Team Analysis Gate A4 Audit

**Date:** 2026-08-03
**Baseline:** `942ec70 Implement Team Analysis Gate A3`
**Character payload:** `2026-07-20T20:22:44.502Z`
**Character SHA-256:** `a92d451e771a170d3aeffc36aaf47d97dc4538f68f3d1aa2edef9eb196930d72`

## Source audit

The baseline payload had 827 enemy-looking unknown condition nodes across 171
exact syntaxes. The primary audited families were:

- enemy count: 204 nodes / 16 syntaxes;
- Category: 251 / 84;
- Class: 142 / 14;
- name: 48 / 17;
- Type: 9 / 5;
- enemy HP: 13 / 8;
- target-status headers and related target references: 119 / 18.

The most frequent exact forms were `When facing only 1 enemy` (82), `When
facing 2 or more enemies` (81), `When there is an Extreme Class enemy` (32),
`When there is a Super Class enemy` (29), and Category-presence conditions.

The source payload has a material status limitation. Sixty-three passive states
contain `When the target enemy is in the following status:`, but the status
labels themselves are absent from both `rawText` and `PassiveDetails`; several
lines contain only punctuation such as `or` or commas where source icons were
lost. Gate A4 does not infer ATK Down, DEF Down, stun, or seal from the affected
character, effect, or display context. Explicit textual statuses remain covered
by synthetic goldens and will become real predicates when a lossless source
provides them.

No real audited passive used `all_enemies`, `enemySelection: "unknown"`, or a
Class+Type enemy clause. Those contract branches are exercised synthetically.

## Contract decisions

- `enemy_count` is total battle enemy count and uses battle scope without an
  enemy selection.
- Enemy attributes use enemy scope plus one explicit `enemySelection`:
  `any_enemy`, `all_enemies`, `current_target`, `only_enemy`, or `unknown`.
- `the enemy` is not treated as existential. It retains `unknown` selection and
  makes the condition partial.
- `that enemy` is retained as `enemyReference: "that_enemy"` with unknown
  selection. It becomes `only_enemy` only beside `enemy_count == 1` in the same
  AND-connected component. Nested `all` nodes share that proof without losing
  their grouping; resolution does not cross OR or NOT and is not authorized by
  `enemy_count >= 2` or by an existential enemy predicate.
- `multiple enemies` is documented as cardinality greater than one and maps to
  `enemy_count >= 2`; no other qualitative count is converted.
- `enemy_hp_percent` is separate from shared-team `hp_percent`.
- `before_attack` and `when_attacking` are explicit sampling moments, not
  attack-history predicates.
- `enemy_name` distinguishes exact matching from `whose name includes`.
  Structurally explicit exclusions remain attached to the same predicate;
  prose exclusions remain residual unknown branches.
- The controlled status enum is `atk_down`, `def_down`, `stunned`, and
  `super_attack_sealed`. Numerical debuff effects do not imply status presence.

`schemaVersion` remains 1 because the new fields, enum values, predicates, and
coverage map are additive. No existing serialized field changes meaning.
`parserVersion` advances from 1.3.0 to 1.4.0.

## Coverage

| Metric | Gate A3 | Gate A4 | Delta |
| --- | ---: | ---: | ---: |
| Passive supported / partial / unknown | 199 / 1,346 / 11 | 229 / 1,316 / 11 | +30 / -30 / 0 |
| Rule supported / partial / unknown | 3,689 / 5,315 / 282 | 4,166 / 4,866 / 254 | +477 / -449 / -28 |
| Condition supported / partial / unknown | 4,810 / 202 / 4,274 | 5,379 / 184 / 3,723 | +569 / -18 / -551 |
| Effect supported / partial / unknown | 7,207 / 1,261 / 818 | 7,207 / 1,261 / 818 | 0 / 0 / 0 |
| Unknown fragments | 6,701 | 6,246 | -455 |
| Rules containing scenario predicates | 950 | 1,557 | +607 |
| Fully scenario-evaluable rules | 898 | 1,467 | +569 |

The final enemy predicate distribution is:

- `enemy_category`: 309;
- `enemy_count`: 198;
- `enemy_class`: 128;
- `enemy_name`: 40;
- `enemy_hp_percent`: 23;
- `enemy_type`: 9;
- `enemy_class_type`: 0 in real data;
- `enemy_status`: 0 in real data because the audited labels are missing.

Selection distribution over real emitted enemy-attribute predicates is:

- `any_enemy`: 450;
- `current_target`: 56;
- `only_enemy`: 3;
- `all_enemies`: 0;
- `unknown`: 0.

The final real payload contains three `that_enemy` references. All three are
resolved to `only_enemy`, and every one has an `enemy_count == 1` proof in the
same AND-connected component; one proof crosses only nested `all` nodes created
by a temporal suffix. No unresolved real anaphora was promoted.

The enemy-looking residual set fell from 827 nodes / 171 syntaxes to 221 nodes
/ 53 syntaxes. Its leading families are missing status labels (119), per-enemy
or existing-enemy scaling (26), Entrance/entry activation (24), attack history
(18), Ki/Ki Sphere qualifiers (9), and mixed enemy/ally name wording that does
not identify one clean selector (7).

## Conservative fallbacks

- A blank `following status` header remains unknown.
- If that damaged header also contains an independent target-HP threshold, the
  HP predicate is retained beside an unknown status branch and the condition
  remains partial.
- `the enemy's HP` uses `enemySelection: "unknown"`, never `any_enemy`.
- Isolated `that enemy's HP` also uses unknown selection. The real `facing only
  1 enemy and that enemy's HP...` form retains `only_enemy` because its binding
  proof is local and explicit.
- Parenthetical exclusions such as `Youth, Captain Ginyu, Jr., etc. excluded`
  keep the known name-includes predicate plus an unknown exclusion branch.
- Enemy HP after an attack, attack counts/history, Entrance Animation,
  per-existing-enemy scaling, and Ki qualifiers remain unknown.

## Artifact and determinism

The generated `team-analysis.json.gz` has:

- uncompressed size: 16,258,501 bytes;
- compressed size: 791,128 bytes;
- SHA-256: `0371fedd32f467033c8db6b4f3fb5b4113a3761f754d32ff8d6fa16cfeee9922`;
- final complete generation times: 4,199 ms and 4,169 ms.

The two final runs produced byte-identical gzip, manifest, and coverage files.
Generation and tests were run sequentially.

## Next-gate risks

The source-status icon loss must be fixed upstream before real status coverage
can be raised honestly. Parsing around the missing labels would fabricate
conditions. Enemy HP sampled after attacks and `next attacking turn` require a
runtime event/history model rather than more condition regexes.

The next safe semantic gate should address Ki amount and typed Ki Spheres as
runtime/scenario inputs, while attack history, Entrance Animation, per-event
counters, domains, standby, and revive remain separately versioned gates.
