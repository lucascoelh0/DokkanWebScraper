# Database Team Analysis experiment v29 (DB30)

DB30 maps passive efficacy type `110` to exact native efficacy removal and status inactivation.

- Contract: `dokkan-team-analysis-efficacy-removal-native-semantics-experiment` `0.29.0`.
- Artifact: `team-analysis-db30-efficacy-removal.json.gz`.
- `eff_value1`, `eff_value2`, `eff_value3` remain raw and are respectively proved as SkillType, skill-ID and removal-category selectors.
- Matching is exact over category, runtime-selected deck index, skill type and skill ID.
- Skill type 2 has a reproducible ID candidate in `passive_skills`, kept partial because its enum name is unproven; skill type 15 remains unknown.
- Raw source target type 16 selects the alternate runtime deck index; no human enum name is asserted.
- Target/source status writes are preserved at offset 20 with raw value zero; the operation is called inactivation, while the enum name remains unknown.
- Timing, bucket, recurrence and probability order remain unknown, so resolutions are partial.

The gate validates SQLite/DB8/DB9/DB11 lineage, native code hashes, exact vtable relocations, source accounting, real fixtures, lossless raw fields, two deterministic generations and unchanged source fingerprints.
