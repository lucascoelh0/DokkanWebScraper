# Database Team Analysis experiment v26 (DB27)

DB27 maps causality types `17`, `18`, and `33` using native handlers, the `AbilityStatus` vtable relocations for deck index and an unnamed selection flag, and the native HP-rate helper.

Types 17/18 compare the selected enemy's floating HP percentage against `cau_val1` inclusively (`>=`/`<=`). Type 33 compares a runtime-selected player-or-enemy integer HP percentage inside the inclusive interval `[cau_val1,cau_val2]`. The integer helper's zero behavior, two fractional normalization windows and rounding are pinned; no generic maximum clamp is asserted.

The unnamed selection flag remains raw: zero/nonzero branch behavior is proved, but no semantic enum name is assigned. Types 17/18 also require the flag to be zero, whose product meaning is unknown. Timing, recurrence, bucket and their zero-max policy remain unknown, so all 59 records remain partial.
