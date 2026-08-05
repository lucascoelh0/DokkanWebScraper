# Database Team Analysis experiment v14 (DB15)

Status: experimental, non-production. Contract version: `0.14.0`.

DB15 measures structural condition parity inside DB13-aligned rule pairs. Its explicit comparison universe contains first-party runtime types 43, 51 and 55 plus current exact-turn predicates. Conditions outside that universe are not counted as matches or divergences.

The baseline retains native DB11 signatures and includes current `eq` signatures. The compatibility view removes each DB14 alias's two specifically identified native bound occurrences and adds its matching current-compatible signature. This transformation exists only in the diagnostic view: native conditions and provenance remain unchanged.

Parity uses multisets of structural-signature occurrences per aligned rule pair rather than state-level deduplications. An alias removes only the two native occurrences identified by causality ID and conjunction group; an identical signature in another branch remains divergent. Rules without a supported condition on either side are reported separately and excluded from exact/partial/divergent counts. `semanticPromotionCount` remains zero.
