# Database Team Analysis experiment v45 (DB46)

Status: experimental, non-production. Contract version: `0.45.0`.

DB46 maps raw execution timings `6` and `7` through six direct calls to the native equality filter, all owned by `EnemyAttackDamageAndActionBank::setup`. Timing 6 is called before counter-finish lookup, disable-attack, absorb, dodge and intermediate enemy-damage calculation. Timing 7 is called after intermediate damage calculation, absorb/invalid-KO handling, received-attack bookkeeping and dodge/guard mission updates, but before attacking-condition assembly.

The bounded labels are `enemy_attack_pre_damage_calculation_setup` and `enemy_attack_post_damage_calculation_setup`. They do not prove a landed attack, HP application, animation execution, Super Attack identity, calculation bucket, duration, recurrence or stacking. The overlay promotes 1,332 rules and 1,411 effects, raising supported timing coverage from 11,522 to 12,854 of 14,301 rules and leaving 1,447 unknown.
