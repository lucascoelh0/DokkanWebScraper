# Integration C1 — optional database-first sidecar contract

Status: experimental, additive, non-production. Sidecar contract version: `1.0.0`.

## Objective

Normalize the DB48 damage-mitigation, DB49 forced-guard and DB50 counter-resistance projections into one optional audit sidecar without changing the productive Team Analysis contract.

## Boundary

- Identity uses snapshot version, card ID, state key, form ID, release state, passive-skill ID, rule key, efficacy type and effect ordinal.
- Names, localized text and parser-generated labels are not identity.
- Condition, timing, target, operation, value/unit, lifecycle, probability, calculation bucket, attack kind and final HP application have independent statuses.
- Non-supported dimensions contain a nonempty `missing` list and no `value` property. Raw values remain only in the audit channel.
- C1 is not the consumable projection. It deliberately retains `partial` and `unknown` dimensions for audit.
- DB48/49/50 final HP, probability and attack-kind remain unknown. Lifecycle remains partial for DB48/49 and unknown for DB50.
- DB50 preserves the conditional native rule `rate > 99 sets flag`; it never projects the dynamically selected flag state from an individual raw record.

## Inputs and outputs

The focused runner consumes the exact gzip and manifests for DB48, DB49 and DB50. It validates compressed/uncompressed sizes, SHA-256, contract versions and common SQLite/ELF/snapshot identity before emitting:

- `team-analysis-database-first-sidecar-c1.json.gz`;
- manifest;
- coverage by gate and dimension status;
- integral validation report.

Each normalized record retains the SHA-256 of its complete source projection, the relevant raw tuple, database/runtime/inherited provenance and exact source-artifact hash.

## Acceptance criteria

- all 1,350 source projections map exactly once;
- no duplicate structural identity;
- every source-projection hash matches;
- every relevant raw tuple reconstructs losslessly;
- every normalized formula, coefficient, value, target, timing and bucket reconstructs from its gate projection;
- only supported dimensions contain values;
- two in-process generations and two runner executions are byte-identical;
- the runner remains below 1 GB aggregate working set;
- focused tests, TypeScript `--noEmit` and `git diff --check` pass.
