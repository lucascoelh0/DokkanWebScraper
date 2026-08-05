# Database Team Analysis experiment v15 (DB16)

Status: experimental, non-production. Contract version: `0.15.0`.

DB16 attributes every DB15 residual signature occurrence within the same aligned rule pair. Reasons distinguish context, polarity, comparator and threshold differences from absence on the other side.

Two turn-one patterns receive explicit candidate labels: `lte 1` versus `eq 1`, and a current-only `gte 1` without any same-kind first-party atom. Both labels end in `_unproven`; they do not assert a minimum counter value, tautology, or equivalence.

The gate consumes DB15 only, preserves its comparison universe and source hashes, and keeps `semanticPromotionCount` at zero.
