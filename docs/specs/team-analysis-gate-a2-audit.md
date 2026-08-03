# Team Analysis Gate A2 Audit

**Date:** 2026-08-03
**Baseline:** `4aa404b Implement Team Analysis Gate A1.1`
**Character payload:** `2026-07-20T20:22:44.502Z`
**Character SHA-256:** `a92d451e771a170d3aeffc36aaf47d97dc4538f68f3d1aa2edef9eb196930d72`

## Scope and source audit

The audit inspected all 1,556 passive-bearing states in the local first-party-
compatible character payload before adding parser patterns. Matching source
lines were grouped by exact syntax, not by character name.

Observed candidate occurrences included:

- 161 Class-ally clauses. Frequent exact forms were `another Extreme Class
  ally attacking in the same turn`, `3 Extreme Class allies attacking in the
  same turn`, and `3 or more Super Class allies on the team`.
- 20 Type-ally clauses covering all five Types. One distinct form was `the
  character is the only STR Type ally attacking in the turn`.
- 400 slot clauses. The dominant forms were `As the 1st attacker in a turn`
  (108), `As the 2nd or 3rd attacker in a turn` (98), and `As the 3rd attacker
  in a turn` (50).
- 121 Class-targeted ally effect prefixes and 27 single-Type prefixes, plus
  multi-Type and Class+Type prefixes.
- five current-payload Class+Category predicates where both dimensions must
  constrain the same allies.

The current payload contains no explicit `team includes all five Types`, no
explicit Class absence clause, and no explicit `all allies attacking in the
same turn are ... Class` clause. Those contract forms therefore use synthetic
goldens. Real payload examples back the remaining core forms.

Phrases such as `When all allies are Super Class characters` do not identify
team versus rotation and remain unknown. Enemy Class/Type conditions, `Per ...
ally`, Entrance Animation timing, HP/turn/attack history, and Ki Sphere clauses
also remain outside Gate A2.

## Implemented semantics

- Class values are exactly `Super` and `Extreme`; Type values are exactly
  `AGL`, `TEQ`, `INT`, `STR`, and `PHY`.
- `on the team`, `attacking in the same turn`, and `the/this character` map to
  `team`, `rotation`, and `self`, respectively. Missing scope is not inferred.
- `another` and `(self excluded)` map to `selfInclusion: "excluded"`; ordinary
  ally wording and explicit all-allies wording map to `included`; unsettled
  wording is retained as unknown.
- Class+Type and Class+Category constraints stay on one predicate, so the
  dimensions cannot accidentally be satisfied by different allies.
- `the only STR Type ally attacking in the turn` becomes self Type AND NOT an
  excluded-self rotation Type predicate.
- Class, Type, multi-Type, and Class+Type effect prefixes resolve separately
  from effect atoms. All beneficial typed ally effects retain only the derived
  `classifications: ["support"]` marker.
- Slots are `battle_slot` predicates with `scope: "self"` and values 1, 2, or
  3. Attack-history qualifiers around a recognized slot remain unknown
  children, making the condition partial.
- Parentheses and logical grouping are preserved. AND binds more tightly than
  OR. Mixed known/unknown trees remain partial and retain both branches.

`schemaVersion` remains `1`: the implementation only adds optional selector
fields and new enum values. No existing field was removed or reinterpreted.
`parserVersion` advances from `1.1.2` to `1.2.0`; optional-enrichment consumers
can ignore predicates or targets they do not understand.

## Real-payload coverage

| Metric | Gate A1.1 | Gate A2 | Delta |
| --- | ---: | ---: | ---: |
| Passive supported / partial / unknown | 91 / 1,454 / 11 | 128 / 1,417 / 11 | +37 / -37 / 0 |
| Rule supported / partial / unknown | 2,541 / 6,247 / 504 | 3,037 / 5,816 / 439 | +496 / -431 / -65 |
| Condition supported / partial / unknown | 3,446 / 0 / 5,846 | 3,933 / 167 / 5,192 | +487 / +167 / -654 |
| Effect supported / partial / unknown | 7,045 / 1,423 / 824 | 7,205 / 1,263 / 824 | +160 / -160 / 0 |
| Unknown effects | 2,289 | 2,111 | -178 |
| Unknown source fragments | 7,892 | 7,353 | -539 |
| Derived support effects | 1,280 | 1,684 | +404 |
| Team-evaluable rules | 3,446 | 3,611 | +165 |
| Placement-evaluable rules | not separated | 322 | +322 classified |

Supported Gate A2 predicates in the real payload are: `battle_slot` 399,
`ally_class_present` 116, `ally_type_present` 20,
`ally_category_class_present` 5, and `character_type` 2. Boolean parsing also
exposes more existing Category/Name predicates inside supported and partial
expressions; no unknown branch was removed to gain coverage.

## Residuals

The largest remaining condition groups are intentionally outside this slice:

- Ki and Ki Sphere conditions: 1,517 unknown nodes;
- turn/time conditions: 860;
- enemy conditions: 741;
- HP thresholds: 557;
- attack receiving/history: 394;
- attack performing/history: 290;
- remaining Category/Name compounds: 334.

The most frequent exact residuals are `When attacking with 12 or more Ki`
(505), `When attacking` (191), `For every attack performed` (152), `For every
Ki Sphere obtained` (126), `For every attack received` (117), and `After
receiving an attack` (105).

There are 59 Class-looking residual nodes. The leading forms are deliberately
unresolved `When all allies are Extreme Class characters` (12, ambiguous
scope), `Per Extreme Class ally on the team` (9, per-member scaling), and
`When all allies are Super Class characters` (5, ambiguous scope). The parser
does not relax scope or reinterpret a scaling clause to consume them.

## Artifact and determinism

The generated `team-analysis.json.gz` has:

- uncompressed size: 15,797,418 bytes;
- compressed size: 765,987 bytes;
- SHA-256: `49ba3f24addc7dd832556211f5d82c49ca022864a4e3010b6f3603f8a271881b`;
- first measured complete generation: 3,057 ms.

Two complete sequential generations with the fixed source timestamp produced
identical gzip bytes, manifest bytes, and coverage JSON. The second run took
2,847 ms. Generation and tests were not run concurrently because both may
update generated paths.

## Next-gate risk

The main risk is treating battle-context wording as harmless decoration around
a recognized team predicate. Gate A2 intentionally preserves those qualifiers
as unknown. The next gate should choose one coherent condition family—HP/turn
scenario conditions or Ki/attack runtime counters—and add evaluator semantics,
fixtures, and residual auditing for that family without broad connector regexes.
