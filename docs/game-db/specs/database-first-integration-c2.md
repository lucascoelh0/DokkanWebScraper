# Integration C2 — supported-only consumable projection

Status: experimental, additive, non-production. Contract version: `1.0.0`.

## Objective

Derive a compact consumer-facing sidecar from C1 while guaranteeing that only dimensions whose audit status is exactly `supported` can appear. C1 remains the separate audit channel for all raw, partial and unknown data.

## Boundary

- The payload contains structural identity and supported target, operation, value/unit and calculation-bucket dimensions. Target selectors retain only proved selector IDs and inclusion; raw enums, localized labels and per-filter provenance remain in C1.
- Timing is present only for C1 records with supported timing and absent otherwise.
- Condition, lifecycle, probability, attack kind and final HP do not exist in the C2 contract because none is supported across the current source families.
- `status`, `missing`, raw fields, provenance, names, localized text and display fields are forbidden recursively.
- Existing production generation and Android behavior remain valid when C2 is completely absent.

## Acceptance criteria

- all eligible C1 rules project exactly once;
- each C2 record is byte-for-byte equal to an expected supported-only projection;
- all 73 unknown timings are omitted rather than defaulted;
- forbidden-field count is zero;
- C1 artifact hash and sizes are validated before generation;
- two in-process generations and two runner executions are byte-identical;
- focused tests, TypeScript `--noEmit`, integral validation and `git diff --check` pass;
- peak runner working set remains below 1 GB.
