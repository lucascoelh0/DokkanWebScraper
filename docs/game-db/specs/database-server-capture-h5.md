# H5 — Captured mission-board definitions

Status: complete; local optional sidecar, disabled and non-production.

## Model and boundary

H5 projects only explicitly allowlisted structural values nested in the captured mission-board campaign definitions. It models campaign periods, priority, announcement and completion-mission references; campaign-to-board membership; and board completion-mission, category and display-reward references.

The top-level `missions` array is discarded in full, including its mission IDs, because those rows mix structural references with per-account progress, completion and reward-acceptance state. Names, messages and image paths are also discarded; asset delivery is handled separately in H6. A display-reward ID remains a reference only: the sidecar makes no claim about reward contents, quantity, eligibility, completion or grant.

## Result

| Entity type | Count | Facts |
|---|---:|---:|
| mission-board campaign | 5 | 520 |
| mission board | 16 | 1,248 |

Total: 21 entities and 1,768 per-field provenance facts; all are `partial`, none is `supported`, and none grants user-derived authority. Every capture ID and lineage fingerprint is validated against H0. The secret scan passed.

## Verification

- TypeScript `--noEmit`: passing.
- Focused H5 synthetic test: passing; progress, text and asset paths are excluded, and foreign capture lineage is rejected.
- Two real outputs: byte-identical.
- Compiled runner heap cap: 576 MiB.
- Peak measured compiled-runner working set: 914,882,560 bytes, below 1 GiB.

## Decision

**GO** for committing the disabled local H5 sidecar and using it as capture-bound shadow evidence or sanitized local fixtures.

**NO-GO** for mission-progress authority, mission completion, reward contents or grant semantics, completeness or permanence, activating a consumer, R2, or Android.
