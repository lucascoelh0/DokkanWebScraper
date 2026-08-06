# Database Team Analysis experiment v38 (DB39)

Status: experimental, non-production. Contract version: `0.38.0`.

DB39 maps passive efficacy type `61` from `passive_skills` through the native energy-ball proportional ATK/DEF handler and the shared stat-difference consumer. The handler sets the proportional flag, narrows `eff_value1` and `eff_value2` from double to float32, and emits them as attack and defense modifiers. `eff_value3` is ignored by this handler. The emitted `AbilityEfficacyInfo` retains constructor defaults raw ball type `11` and raw bitpattern `0`.

When the consumer's independent boolean gate is zero, it reads `InGameCharaData.getObtainedBallTypeNumbers()`, looks up raw key `11` and uses zero for an absent entry. It multiplies the widened float32 modifier by that signed int32 count before applying the independently inherited DB31 calculation operation. Timings `1` and `4` are assigned only to the previously proved DB34 former/latter passive-stat buckets.

The current corpus contains 89 rules, 89 source effects and 178 ATK/DEF applications across 56 states and 87 passive IDs. All modifiers, operations and buckets are supported; full simulation remains partial because the semantic name, population and reset window of raw ball type `11`, recurrence/expiry and cross-bucket final order are not proved. The contract deliberately does not call raw value `11` “all Ki spheres”. The legacy parser emits `unknown` for all 89 rules, making DB39 a first-party representation gain with no confirmed parser conflict.
