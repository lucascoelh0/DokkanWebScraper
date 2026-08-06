# Database Team Analysis experiment v36 (DB37)

Status: experimental, non-production. Contract version: `0.36.0`.

DB37 binds `passive_skills.turn` and `passive_skills.is_once` to distinct native lifecycle fields. The row constructor stores `turn` at `PassiveSkill +0x4c` and normalizes nonzero `is_once` into the boolean at `+0x50`; passive-status creation transports them to `CreateAbilityStatusCausality +0xb0/+0xb4`. The runtime constructor initializes current/max turn counters at `AbilityStatusCausality +0x160/+0x164`, stores `is_once` at `AbilityStatusEfficacy +0x11c`, and initializes `exec_count`/executed-this-turn at `+0x16c/+0x170`.

The proved once-only gate is `is_once == 0 || exec_count < 1`. Successful execution reloads current turn from maximum, processes the status, sets executed-this-turn and increments exec count. End turn updates the duration counter and independently clears executed-this-turn. A separate `clearExecCount` implementation zeroes exec counts, but its trigger and epoch remain unknown; DB37 therefore does not claim once per battle, turn, appearance or transformation.

For nonnegative `turn`, the successful execution reloads the raw maximum. On an eligible end-turn update, after the independent active, available and internal-turn gates, the counter decrements by one and a nonpositive result clamps to zero and deactivates the status. Raw `-1` bypasses this decrement path, but `isEndTurn` still returns true for it, so the contract preserves the sentinel without naming it `forever`. The current projected corpus contains only positive turn values.

## Snapshot coverage

- 14,301 rules / 18,078 effects / 13,991 passive IDs / 1,571 states carry supported field mechanics.
- 1,049 rules / 1,204 effects / 397 states have `is_once = 1`.
- All 14,301 projected `turn` values are positive and supported as native counters.
- Full lifecycle simulation remains partial for all rules because the exec-count reset epoch and other removal paths are not proved.

DB37 does not derive condition, target, timing, operation, unit, calculation bucket or stacking from these fields. The 120 DB20 legacy appearance-turn correlations remain a cross-dimension comparison, not semantic parity.
