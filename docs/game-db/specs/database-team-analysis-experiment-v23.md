# Database Team Analysis experiment v23 (DB24)

Status: experimental, non-production. Contract version: `0.23.0`.

DB24 follows passive efficacy type `120` from the `passive_skills.eff_value1/2/3` SQLite columns through the native `PassiveSkill` object, runtime efficacy values, `CallChangeParam`, and `AbilityEfficacy::CounterBehavior`. Exact code regions, column-string addresses, object offsets, symbols, VMAs, sizes and SHA-256 hashes are pinned to the Global 6.4.0 native runtime.

The proved mapping is `eff_value1 → resistDamageRate`, `eff_value2 → increaseDamagePercent`, and `eff_value3 → battleScriptNo`. The contract adds a source-keyed counter payload for every efficacy-120 rule in DB11 and retains its raw activation fields and provenance.

This is one efficacy-type promotion, not a complete counter simulator. Execution timing type 6, the handler's `CallChangeParam +4` gate, causalities, target behavior, probability application, calculation bucket, duration, recurrence and battle-script behavior remain explicit unknowns. Consequently every DB24 resolution is `partial`, even when all three payload fields are supported.
