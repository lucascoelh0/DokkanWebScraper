# Database Team Analysis experiment v11 (DB12)

Status: experimental, non-production. Contract version: `0.11.0`.

DB12 is a diagnostic attribution layer over DB11. It introduces no semantic promotion and does not modify the DB11 state contract. Every DB-only and current-only structural signature counted by DB11 is reconciled into one conservative reason, in precedence order: logical context, polarity, exact-turn encoding candidate, threshold, comparator, or absence on the opposite side.

Structural equality retains normalized `all`/`any` ancestry and `not` polarity. Threshold and comparator mismatches require equal state, scope, polarity and logical context. Absence is used when no stronger relationship exists; it does not imply that either source is wrong or stale.

An exact-turn candidate is recognized only when DB11 contains `turn_from_entry >= N` and `turn_from_entry <= N` inside the same proven conjunction and the current dataset contains `turn_from_entry == N` in the same state. Integer-domain equivalence of the condition is exact, but rule/effect alignment across sources is not yet proven, so the candidate status is explicitly `candidate_not_rule_aligned`.

Current `eq` atoms are retained in a diagnostic-only list because they were outside the DB11 comparable causality families. Coverage reports the complete unique diagnostic set separately from the subset linked to exact-turn candidates.

State presence gaps are reported after applying only the audited form projection aliases. DB12 does not infer snapshot freshness, awakening compatibility or release-state policy from a missing key.

Each attributed atom retains every DB11 or current rule key in which that unique state-level structural signature occurred. Exact-turn candidates additionally retain the first-party rule key and exact conjunction path that proves the paired bounds.
