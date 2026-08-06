# Database Team Analysis experiment v44 (DB45)

Status: experimental, non-production. Contract version: `0.44.0`.

DB45 maps raw passive execution timing `5` and efficacy type `28` through native runtime consumers. The timing proof follows the SQLite field into the exact equality filter and three literal call sites in `PlayerAttackDamageAndActionBank::setup`. For passive `(category 0, SkillType 2)` execution, the call occurs after damage calculation, the enemy after-HP update and attack recording, and before the enemy-round timing-5 call and setup return. The bounded event name is `player_attack_post_damage_setup`; it does not imply a landed attack, Super Attack, animation execution, calculation bucket, duration, recurrence or stacking.

This promotes another 631 rules, 665 effects, 627 passive IDs and 346 states from unknown execution timing. Supported timing coverage becomes 11,522 of 14,301 rules, leaving 2,779 rules unknown.

The efficacy-28 dispatch handler reads only `eff_value1`, narrows the SQLite double to float32 and stores it in the dedicated field at `AbilityEfficacyInfo + 0x1a0`. It ignores `eff_value2`, `eff_value3` and `calc_option`. Its aggregate filters records by deck index and raw skill category, starts at float32 zero and adds matching modifiers in stored-record order. The player-damage consumer divides the float32 sum by 100, multiplies it by the signed int32 damage value independently observed in the damage view and max-damage mission, truncates toward zero and eventually appends that signed result as raw HP-factor type `2`.

All 21 projected efficacy-28 rules therefore have supported modifier unit, candidate self target, empty sub-target identity, calculation bucket and within-query float32 stacking. Twenty have supported execution timing; the timing-15 rule remains unknown. DB31 `calc_option` values are retained with provenance but marked `preserved_not_applied`, because the handler, aggregate and consumer do not read the field. The two native gates, probability ordering, status reset/expiry, cross-query stacking, interaction with other HP-factor types, final HP cap and factor application order remain partial or unknown. The contract deliberately does not rename the result as a generic heal.

Every corresponding legacy effect is `unknown`, so DB45 records 21 first-party representation gains and no confirmed parser conflict.
