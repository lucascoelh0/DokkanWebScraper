# Database Team Analysis experiment v30 (DB31)

DB31 maps `SkillCalcOption` values 0–4 through the native `AbilityCalcFunc` dispatch table and each float implementation.

- Contract `dokkan-team-analysis-skill-calc-option-native-semantics-experiment` `0.30.0`.
- Artifact `team-analysis-db31-skill-calc-option.json.gz`.
- Operations: add, subtract with floor zero, percent-of-lhs add, percent-of-lhs subtract with floor zero, and assign rhs.
- Both operands, ignored operands, zero fast paths, division by 100, native
  `float32` rounding and clamps are explicit.
- SQLite linkage is pinned from the `calc_option` literal through
  `PassiveSkill(SQLite3::Row*)` to the field stored at runtime offset `0x48`.
- Values outside 0–4 remain unknown despite the positive native fallback.
- Operation does not imply effect unit, target, execution timing, calculation bucket, duration, recurrence or stacking.
- The legacy parser is comparison-only and has no explicit operation field.

Validation pins ELF identity, code hashes, dispatch relocations, SQLite provenance, synthetic numeric edge cases, real rule accounting, deterministic gzip and unchanged sources.
