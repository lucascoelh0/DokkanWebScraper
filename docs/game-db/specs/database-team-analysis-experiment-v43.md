# Database Team Analysis experiment v43 (DB44)

Status: experimental, non-production. Contract version: `0.43.0`.

DB44 maps passive efficacy types `59` and `60` through the native single-stat proportional handlers. Each handler writes the proportional flag at `CallChangeParam + 0x1c`. Type 59 delegates to pure ATK and type 60 to pure DEF. Both pure handlers read only the `eff_value1` double at offset `0x28`, narrow it to float32 and delegate to the corresponding stat generator; `eff_value2` and `eff_value3` are ignored.

The shared `AbilityEfficacyInfo` defaults and stat consumer are inherited by exact DB39 artifact/evidence hashes. The consumer multiplies the widened modifier by the signed int32 count stored under raw obtained-ball map key `11` before applying DB31's calculation operation. Raw ball type `11` still has no proved product name, population rule or reset window. The contract therefore keeps the count input partial and does not label it as all Ki spheres.

The current corpus contains 33 rules and stat applications across 25 states and 31 passive IDs: 22 ATK applications from type 59 and 11 DEF applications from type 60. All modifiers, operations, self targets, empty sub-target identities and former/latter buckets are supported. Duration and once-only storage are inherited from DB37; recurrence, reset/expiry, cross-status stacking and final formula order remain partial or unknown. All corresponding legacy effects are `unknown`, so DB44 is a representation gain with zero confirmed parser conflicts.
