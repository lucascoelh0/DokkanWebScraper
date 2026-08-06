# Database Team Analysis experiment v18 (DB19)

Status: experimental, non-production. Contract version: `0.18.0`.

DB19 recomputes every residual attribution from the DB18 parity view. It uses DB15 for unaffected rule pairs and DB18 overrides for affected pairs, preserving multiset occurrences.

Attribution precedence is occurrence-count imbalance, logical context, polarity, comparator, threshold, then absence. Candidate searches use the complete opposite-side multiset, while only unmatched occurrences receive attributions. Pattern clusters retain side, reason, predicate kind, comparator/event mode, context and polarity.

The gate inherits three DB17 promotions, introduces zero new promotions and does not change DB18 parity.
