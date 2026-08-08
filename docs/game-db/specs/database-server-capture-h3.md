# H3 — Captured schedules and availability

Status: complete; local optional sidecar, disabled and non-production.

## Model and boundary

H3 projects only explicitly allowlisted public product values. Numeric IDs remain entity identity; names and descriptions are discarded. Database identity stays authoritative, while captured server periods and references remain `partial` observations tied to their capture timestamps.

The model covers event-to-quest IDs, event and Z-Battle periods, weekday windows, Super Z-Battle relations, event-key references, bonus schedules, the observed Ultimate Clash root and the observed Genkai Battle root. No active Budokai object was present in the captured responses, so H3 emits none and does not infer one.

The projector discards user/progress fields including `user_quest`, visited/reset values, `has_entry`, `is_progress`, reward-acceptance flags, processing timestamps and `open_status`. Event-key membership is recorded only as `referenceObserved`, not as an assertion that a user can enter or that availability is permanent.

## Result

| Entity type | Count |
|---|---:|
| event | 194 |
| event-key event | 145 |
| Z-Battle | 178 |
| Super Z-Battle | 28 |
| event-key Z-Battle | 25 |
| bonus schedule | 1 |
| Ultimate Clash | 1 |
| Genkai Battle | 1 |

Total: 573 entities and 9,296 per-field provenance facts; all are `partial`, none is `supported`, and none grants user-derived authority. Each fact carries a value digest, the H0 source-identity anchor and a fingerprint over only its allowlisted public projection. The secret scan passed with zero exact or generic matches.

Validation resolves every capture ID back to the expected H0 inventory and requires exact structural, schema, source-identity and capture-timestamp lineage; self-consistent replacement provenance is rejected.

## Verification

- TypeScript `--noEmit`: passing.
- Focused H3 test: passing with synthetic progress/secret fields excluded.
- Two real outputs: byte-identical.
- Compiled runner heap cap: 640 MiB.
- Peak measured compiled-runner working set: 912,953,344 bytes, below 1 GiB.

## Decision

**GO** for committing the disabled local H3 sidecar and using it as capture-bound shadow evidence.

**NO-GO** for replacing schedules/availability, claiming completeness or permanence, deriving user entry state, activating a consumer, R2, or Android.
