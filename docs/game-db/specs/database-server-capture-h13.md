# Database/server capture H13 — corrective gasha audit

H13 is an offline, additive audit over the exact pinned H0, H4, H8, H9 and H10 bytes. It reads the already pinned local HARs directly to recover coordinates and dimensions discarded by earlier aggregate contracts. It performs no request or replay, adds no credential flow, changes no H0–H10 artifact and has no Android, R2 or production authority.

## Finding

The H11 finding is confirmed. H4 declares `per_gasha_observed_unions_step_association_not_claimed` and flattens steps, rates and special gashas before emitting per-gasha unions. H10 emits unique scalar facts and also omits step/rate/special identity from its fact key. H11 then classified any H10 scalar missing from the H4 union as `confirmedConflict`, even when H4 had no matching pool observation and the snapshots differed.

The 627 H11 facts are unique. The old 1,254 total is non-exclusive because every fact was counted in both `h10_gashas_vs_prior_capture` and `per_har_mainly_gasha`.

## Material result

| Classification | Unique facts |
| --- | ---: |
| agreement | 0 |
| temporal_change | 0 |
| representation_mismatch | 612 |
| coverage_gap | 15 |
| unknown | 0 |
| confirmed_conflict | 0 |
| **Total** | **627** |

By field, the audit covers 601 `normal_card_ids`, 12 `featured_card_ids` and 14 `card_id` facts across three gashas. Of the 612 representation mismatches, 605 H10 scalars occur in two distinct step/rate/special dimensions and seven occur in four. The remaining 15 have one recovered dimension but no older endpoint baseline, so they are coverage gaps. H4 contains no corresponding pool fact/provenance for these legacy-missing values; absence from that older union is not evidence of contradiction.

## Per-fact evidence

Every fact has a stable additive audit key and records gasha ID, normalized endpoint, field, observed value, exact JSON coordinate, capture ID, entry index, observation timestamp, HTTP status, step, rate ID, rarity applicability, special gasha ID when applicable, the nearest known open/end period and capture fingerprints. All 627 audited values are card IDs from pool-member coordinates, not values nested under `rarities[]`; their rarity is therefore explicitly null with `not_applicable_to_card_id_pool_coordinates`, rather than silently unknown or collapsed. Baseline observations carry the same atomized shape when present. The linked legacy baseline preserves the complete H4 fact provenance and union values when H4 actually supplied them.

The classifier is conservative:

- same dimension and same value is `agreement`;
- same dimension with a different value across unproved or different windows is `temporal_change`;
- aggregate/element or step/rate/special dimensional collisions are `representation_mismatch`;
- no endpoint baseline is `coverage_gap`;
- insufficient comparability is `unknown`;
- `confirmed_conflict` requires the same dimension plus an equal known open/end window (or the exact same capture/time) and incompatible values.

The generated audit remains ignored under `data/database-server-captures/h13/`. Only its generator, contract, source lock, tests, documentation and corresponding compiled `lib/` output are tracked.
