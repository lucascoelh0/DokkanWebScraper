# Database Team Analysis experiment v12 (DB13)

Status: experimental, non-production. Contract version: `0.12.1`.

DB13 aligns DB11 and current Team Analysis rules through effect shapes that are unique inside a matched state. It consumes the existing `db3-normalized-effect-shape-v1` fingerprint and introduces no new gameplay interpretation.

An `exact_effect_set_unique` alignment requires identical non-empty normalized effect sets and exactly one rule with that set on each side. A `unique_effect_signature_anchor` requires at least one shared effect signature that occurs in exactly one DB rule and one current rule in the state. Repeated shared signatures are recorded as ambiguous and never used as anchors by themselves.

The normalized effect shape covers kind, supported target dimensions, value/unit, stack cap, supported scaling, and Ki Sphere conversion. It does not prove activation chance, duration, activation timing, calculation bucket, recurrence, or unsupported fields. Alignments are therefore evidence routes between rules, not complete semantic equivalence.

DB12 exact-turn candidates are considered rule-aligned only when the candidate's first-party rule has an accepted alignment to exactly one current rule carrying the corresponding diagnostic `eq` atom. Native `gte/lte` conditions are not rewritten in DB13, and `semanticPromotionCount` remains zero.

The assessment preserves DB12 polarity explicitly. Positive and negated candidates with the same state, rule, value, and logical context remain distinct.
