# Database Team Analysis experiment v33 (DB34)

Status: experimental, non-production. Contract version: `0.33.0`.

DB34 maps the native calculation buckets used by basic passive ATK/DEF efficacy types `1`, `2` and `3`. It follows `passive_skills.exec_timing_type`, `calc_option`, `eff_value1` and `eff_value2` through the passive runtime materialization, efficacy dispatch, ATK/DEF handlers, `AbilityEfficacyInfo`, stat consumers and the final difference accumulator.

The supported native buckets are:

- `former_passive_stat`: execution timing values `1`, `3`, `11`, `15`, `18`;
- `latter_passive_stat`: execution timing values `4`, `5`, `6`, `7`, `9`, `14`.

The names are bounded native accumulator identities. They do not assign an execution-event label to timings that DB32/DB33 have not proved. In particular, a latter bucket is not automatically named on-attack, and a former bucket is not automatically named start-of-turn. Timing `12` remains unknown for basic stats.

Efficacy `1` maps `eff_value1` to ATK, efficacy `2` maps `eff_value1` to DEF, and efficacy `3` maps `eff_value1` to ATK plus `eff_value2` to DEF. Operation remains the independent DB31 `SkillCalcOption` dimension. The basic-stat consumer independently proves stat-point operands for options `0/1/4` and percentage-point operands for `2/3`.

The runtime converts each modifier to `float32` before widening it to `double` for stat accumulation. Flat operands are truncated toward zero, percentages change a double multiplier, negative percentage multipliers floor at zero, and the last assignment in efficacy-list order wins. DB34 records this consumer-specific boundary without rewriting DB31.

Target selection, duration, recurrence, expiry, reset and cross-bucket final formula order remain unknown. All applications are therefore `partial`. DB13 exact-effect alignments are diagnostic only; candidate legacy bucket conflicts are not promoted to confirmed identity conflicts.

The contract retains every basic-stat application even when its raw timing is outside both proved bucket groups. Such rows preserve their raw timing and runtime-backed stat mapping with `calculationBucket.status = unknown`; an unseen or timing-12 row must not abort generation. Coverage reports supported and unknown bucket populations separately.

Validation pins the SQLite literals, the exact efficacy-slot-to-stat/column mapping, double-operation dispatch relocations, named symbols, VMAs, sizes, code hashes, timing literals, ATK/DEF integration call bytes and the exact `AbilityEfficacyInfo` vtable-slot set. Goldens cover every calculation option's consumer unit, unknown operations and supported/unknown buckets. The payload must reconstruct its raw modifiers losslessly, generate identical JSON/gzip twice and leave the SQLite/ELF sources unchanged.
