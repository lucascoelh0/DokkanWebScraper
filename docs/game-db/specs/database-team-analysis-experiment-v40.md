# Database Team Analysis experiment v40 (DB41)

Status: experimental, non-production. Contract version: `0.40.0`.

DB41 resolves causality type `34` through the native causality dispatch and the raw-mode-1 branch of `AbilityCausalityFunc::findSpecificGroup`. The handler reads `cau_val1` as the group mode, `cau_val2` as a structured card-category ID and `cau_val3` as a matching-character threshold. Mode 1 enumerates current `PuzzleEnemyData` entries, filters them through the first-party `MasterCard` category set, accumulates accepted enemies and tests partner count unsigned `>=` the sign-extended int32 threshold. The threshold is also used for collection short-circuiting.

The projected corpus contains 434 occurrences from 119 structured causality rows across 157 states and 321 passive skill IDs. Every current row uses mode 1 and threshold 1; 42 category IDs occur. All associations reconstruct losslessly and replace legacy unknowns. Full evaluation remains partial because modes 0/2, the semantic name of the enemy eligibility field at offset `0x14c`, evaluation timing, duration, recurrence, reset/expiry and calculation bucket are not proved.
