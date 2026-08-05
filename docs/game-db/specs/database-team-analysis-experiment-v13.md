# Database Team Analysis experiment v13 (DB14)

Status: experimental, non-production. Contract version: `0.13.0`.

DB14 emits exact-turn compatibility aliases for the DB13 rule-aligned subset only. It never rewrites DB11 conditions. Each alias retains the native `gte N` and `lte N` runtime-condition records, DB12 same-conjunction proof, DB13 unique rule/effect-shape route, and the matching current `eq N` signature.

The compatibility predicate is `turn_from_entry == N`. This is the exact integer-domain normalization of `turn_from_entry >= N AND turn_from_entry <= N`; no new enum or runtime semantic is introduced. The logical context attached to the alias comes from the aligned current rule and is explicitly compatibility metadata rather than first-party provenance.

Polarity is part of the identity and provenance of an alias. A negated pair is represented as `NOT (turn_from_entry >= N AND turn_from_entry <= N)` and matched only to the corresponding negated current `eq N` signature.

Candidates with ambiguous or absent DB13 rule alignment are omitted. `semanticPromotionCount` remains zero, and consumers must preserve the first-party native bounds as authoritative evidence.
