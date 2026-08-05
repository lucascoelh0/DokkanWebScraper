# Database Team Analysis experiment v7 (DB8)

Status: experimental, non-production. Contract version: `0.7.0`.

## Purpose

DB8 is an evidence-gap gate over DB7. It does not promote any numeric causality or efficacy enum. Instead it produces a deterministic inventory of unresolved first-party rows, their affected states/rules, raw value domains, provenance, available opaque script identifiers and the evidence required before a future mapping can become supported. Combat-history entries are emitted individually with their raw causality tuple, raw passive timing/calculation fields and exact state/rule identity.

## Evidence boundary

The audited SQLite snapshot contains no named causality dictionary. Types 3, residual 34, 43, 51 and 55 demonstrate that `cau_val1/2/3`, execution timing, calculation option, turn and `is_once` do not independently determine a runtime predicate. `passive_skill_effects.script_name` is normally absent and otherwise contains opaque asset identifiers such as `pse0069`, not semantic enum names.

DB8 therefore records `semanticPromotionCount=0`. Current scraped text is not used to reinterpret database rows. A future promotion requires a first-party named enum/runtime export or a structurally keyed first-party asset.

The inventory follows the final DB7 AST and selector status. It does not reopen a gap solely because `source.causalities.mappingStatus` retains a legacy DB3 value after DB4 or a later projector has produced a supported predicate from stronger relational evidence. This prevents false gaps while retaining the original source status in DB7 provenance.

## Output and safety

DB8 writes `team-analysis-db8-*` evidence artifacts only under ignored `data/database-experiment/`. It retains DB7 as the latest semantic projection, makes no production or Android changes, and keeps the SQLite source read-only, immutable, query-only and fingerprinted before/after generation.

Full Team Analysis remains NO-GO until the enumerated evidence gaps are resolved.
