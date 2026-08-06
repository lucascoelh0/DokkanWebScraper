# Database Team Analysis experiment v27 (DB28)

DB28 maps causality types `47` and `54` through a first-party revival activation counter at `InGameCharaData +0x268`.

The identity is not inferred from a handler name alone. The runtime path finds an available revival efficacy, verifies revival availability, opens `setupRevivalSkillView`, and its completion callback increments the counter for `getPureCharaDataCurrent(deckIndex)`. A separate availability reader consults the same field, while `resetActivateRevivalSkillCount` zeros it.

Type `47` tests the ability owner's pure-current record count with `> 0` and ignores `cau_val1/2/3`. Type `54` scans deck indices `0..6` across pure-current and back-current records. Its `cau_val1` is a polarity value: zero requires at least one positive counter, nonzero requires none. All current rows use zero.

The structural predicates are supported. Their records remain partial because the reset trigger/history window, timing, recurrence, calculation bucket and overflow behavior are not proved.
