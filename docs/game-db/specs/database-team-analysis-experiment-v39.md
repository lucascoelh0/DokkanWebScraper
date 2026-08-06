# Database Team Analysis experiment v39 (DB40)

Status: experimental, non-production. Contract version: `0.39.0`.

DB40 resolves causality types `3` and `4` through the native causality dispatch. Both read `cau_val1` as a signed threshold and ignore `cau_val2/3`. When the raw `AbilityStatus` category is zero, the handler selects the current character by the status deck index, obtains the battle-gauge value with boolean argument `false`, divides it by `battleGaugeCap100` in float32, multiplies by 100 and truncates toward zero. Type `3` compares the result with `>=`; type `4` uses strict `<`. A nonzero raw status category produces metric zero without reading gauge state.

The projected corpus contains 1,267 occurrences from 343 structured causality rows across 607 states: 1,262 type-3 and five type-4 occurrences. All reconstruct losslessly and replace legacy unknowns. Full evaluation remains partial because the raw category's product name, zero-denominator behavior, battle-gauge population/reset timing, condition evaluation timing, recurrence and calculation bucket are not proved. Thresholds are percentage points relative to `battleGaugeCap100`, not Ki; observed values legitimately extend through 800.
