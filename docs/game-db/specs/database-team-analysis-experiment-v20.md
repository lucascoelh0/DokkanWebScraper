# Database Team Analysis experiment v20 (DB21)

Status: experimental, non-production. Contract version: `0.20.0`.

DB21 performs a bounded native-linkage audit for the DB20 `passive_skills.turn` correlation. It fingerprints and verifies the `PassiveSkill` and nested `SkillEffect` SQLite constructors plus the relevant `AbilityEfficacyInfo` timing APIs in the exact first-party runtime binary.

The audit proves that the SQLite row is deserialized and that the runtime carries `isOnce`, execution timing, and modifier-turn concepts. It does not prove which object offset receives `passive_skills.turn`, nor a call chain from that field to the later runtime APIs. Consequently the runtime consumer, start point, unit, end inclusivity, efficacy dependencies, and `is_once` interaction remain explicitly `unknown`.

The evidence is deliberately bounded: it cannot establish exhaustive absence of an inlined, unnamed, indirect, or alternate consumer. DB21 therefore inherits three prior semantic promotions, introduces zero new promotions, and does not rewrite DB20 parity or reinterpret any localized description.
