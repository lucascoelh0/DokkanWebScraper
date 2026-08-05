# Database Team Analysis experiment v3 (DB4)

Status: experimental, non-production. Contract version: `0.3.0`.

## Purpose

DB4 addresses the two largest DB3 gaps without changing production: recursively composed first-party conditions and engine rows that encode one scalable mechanic as a complete threshold series. It preserves every DB3 rule and adds normalized projections with the complete source-rule and table/row provenance.

Artifacts remain ignored under `data/database-experiment/`. The source SQLite is still opened read-only/immutable/query-only and fingerprinted before and after generation.

## Compiled condition AST

The `compiled` field is prefix JSON:

- a numeric leaf is `skill_causalities.id`;
- `["&", child, ...]` is logical AND;
- `["|", child, ...]` is logical OR;
- children may be recursively nested.

The snapshot contains 1,356 AND and 2,201 OR nodes in passive skills, with nesting to two child-array levels. No current passive row contains `!`; unknown operators remain raw and unknown.

DB4 adds:

- causality `40`: after the character performs a Super Attack;
- causality `34`: minimum category-member count for joined team (`cau_val1=0`) and rotation (`cau_val1=2`) scopes, where `cau_val2=card_categories.id` and `cau_val3=count`.

Enemy-scope type 34, causality 3's non-universal Ki encoding, type 41's name-selector domain, type 44's mixed event/count behavior and type 46's class/type mask remain partial or unknown.

For efficacy 98 with timing 5 and one direct type-40 causality, DB4 absorbs that condition into `per_combat_event(super_attack_performed)` scaling. It does not depend on a snapshot-specific causality row ID.

## Threshold-series projection

A projection is emitted only when all source rows satisfy these structural gates:

1. direct sibling rules in the same passive set;
2. exactly one causality per rule;
3. same causality type, non-count tuple and selector;
4. identical effect, target, timing and calculation fields;
5. thresholds exactly `1..N`, without gaps or duplicates;
6. no competing same-effect threshold rows in that group;
7. all original rules and provenance remain in the artifact.

Supported type-42 series become capped `per_ki_sphere_threshold_series`. Type-34 category series become `per_qualifying_unit_threshold_series`. Structurally complete type-41 and type-46 series are retained as partial projections with their raw selector and explicit unknown selector domain.

Types 3 and 44 are never aggregated. Incomplete or stepped families, such as thresholds 4 and 6 without `1..N`, remain as their original independent rules.

## Artifacts

- `team-analysis-db4-experiment.json.gz`;
- `team-analysis-db4-manifest.json`;
- `team-analysis-db4-coverage.json`;
- `team-analysis-db4-parity.json`;
- `team-analysis-db4-report.md`;
- `team-analysis-db4-golden-validation.json`.

The current Team Analysis contract cannot represent a threshold-series `maxIncrements`. DB4 therefore reports uncapped shape parity separately and never labels it an exact effect match. Its exact normalized comparison uses only DB4 rules, including proven type-40 upgrades; the artifact never deletes or rewrites source rules.
