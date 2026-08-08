# H4 — Captured gasha catalog observations

Status: complete; local optional sidecar, disabled and non-production.

## Model and boundary

H4 projects only explicitly allowlisted structural product values from the captured gasha catalog, featured-card and rate endpoints. Numeric category, gasha, course, announcement, currency, item and card identifiers remain references. Names, titles, descriptions, notes, banners, processed timestamps and the user-facing `current_step` state are discarded.

Rate and pool values are retained as per-gasha observed unions. The sidecar does not preserve or claim a step-to-pool association, commercial availability, global summonability, completeness, permanence, or current user eligibility. Every emitted fact remains `partial` capture evidence.

## Result

| Entity type | Count | Facts |
|---|---:|---:|
| gasha category | 4 | 48 |
| gasha | 10 | 494 |

Total: 14 entities and 542 per-field provenance facts; all are `partial`, none is `supported`, and none grants user-derived authority. Each fact carries a value digest, the H0 source-identity anchor and a fingerprint over only its allowlisted public projection. The secret scan passed.

Validation resolves every capture ID back to the expected H0 inventory and requires exact structural, schema, source-identity and capture-timestamp lineage; self-consistent replacement provenance is rejected.

## Verification

- TypeScript `--noEmit`: passing.
- Focused H4 synthetic test: passing; text and user step state do not become facts, and tampering is rejected.
- Two real outputs: byte-identical.
- Compiled runner heap cap: 640 MiB.
- Peak measured compiled-runner working set: 960,122,880 bytes, below 1 GiB.

## Decision

**GO** for committing the disabled local H4 sidecar and using it as capture-bound shadow evidence or sanitized local fixtures.

**NO-GO** for replacing summon availability, interpreting observed pool unions as per-step pools, claiming completeness or permanence, activating a consumer, R2, or Android.
