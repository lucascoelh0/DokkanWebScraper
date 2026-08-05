# Database Team Analysis experiment v8 (DB9)

Status: experimental, non-production. Contract version: `0.8.0`.

DB9 adds the first-party native runtime as a second read-only source. For the pinned Global 6.4.0 APK, `AbilityEfficacyCore::callEfficacyFunc` directly indexes an ELF relocation table by `SkillEfficacyType`, while `AbilityCausalityFunc::executeCausalityFuncBySkillCausalityId` bounds and directly indexes the exported `s_AbilityCausalityFuncTable` by `SkillCausalityType`.

The adapter parses ELF64 section, dynamic-symbol and RELA records in-process. It does not invoke the game, mutate the APK/SO, parse localized descriptions or depend on HTML. Layout addresses and source SHA-256 are version-pinned in `native-runtime-layout.json`; a new APK requires a new audited layout. The dataset and manifest chain the SHA-256 of DB8, the native SO and the audited layout document.

An identified handler proves only the minimum operation carried by its exported symbol. `eff_value*`, `cau_val*`, target, timing, stacking, recurrence and calculation bucket remain unknown until separately proven. Null slots require both an absent relocation and an on-disk zero word and mean unsupported-null in this APK, not aliases. Missing, empty, non-numeric or fractional enum values retain their raw source value as `invalid_value`; they are never coerced to enum zero. DB9 therefore records zero semantic promotions and preserves the DB8 NO-GO boundary.
