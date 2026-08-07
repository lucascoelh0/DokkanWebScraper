# Database Team Analysis experiment v47 — DB48 efficacy-13 mitigation

Status: experimental, additive, non-production. Contract version `0.47.0` consumes the pinned Global 6.4.0 SQLite and `libcocos2dcpp.so` snapshots plus DB11/35/36/37/47 artifacts by exact SHA-256.

## Question and bounded native method

DB48 asks whether passive `efficacy_type = 13` is damage reduction, which operand it changes, and where it sits relative to DEF and guard. The investigation used only named symbol intervals, exact relocation slots, short `llvm-objdump` ranges and streamed branch hits. It did not disassemble the full ELF or retain a whole-text instruction graph.

The SQLite `eff_value1` field reaches `CallChangeParam + 40`. Dispatch slot 13 binds by ABS64 relocation to a 16-byte handler that reads that double, narrows it to float32, writes literal efficacy type 13 and tail-calls the efficacy-info generator. The handler does not read `eff_value2`, `eff_value3` or `calc_option`. The normal getter returns the stored float32 field; type 13 does not select its alternate proportional path.

## Proven semantics

The deck/category aggregate starts at 100 and, in efficacy-info order, subtracts `100 - storedRemainingRate` for each matching record before clamping to `[0, 100]`. Therefore `eff_value1` is a remaining-damage rate in percentage points and a single record contributes `100 - float32(eff_value1)` percentage points of reduction. The fold is native type-13 behavior, independent of `SkillCalcOption`.

Two direct action-bank chains consume the aggregate:

- player-source damage: after enemy DEF subtraction and optional guard coefficient, using `truncTowardZero(pre - ((100 - rate) × pre / 100))`;
- enemy-source damage: before counter resistance, player DEF correction and guard, using `pre - truncTowardZero((100 - rate) × pre / 100)`.

The distinct truncation order is contractual because it differs for small operands. Both values remain intermediary damage; final HP application is not claimed.

## Corpus projection and boundaries

The source has 1,538 type-13 rows. The current character-state graph references 951 unique rows through 995 rules/effects across 432 states. All 995 inputs and targets are supported; 946 inherit a supported DB47 timing and 49 retain raw timings 3/11 as unknown. The old DB-first projector's 995 `damage_reduction` atoms numerically match the native projection, but that comparison is non-authoritative and is not exact HTML-parser identity.

Condition order, probability application, attack-kind partition (regular/Super/Ultra/Unit/EX), final HP application, removal/reapplication order, recurrence/reset and cross-status lifecycle stacking remain partial or unknown. Target, timing, lifecycle, aggregate operation and consumer bucket are separate dimensions.

## Validation

The builder pins SQLite/ELF hashes, nine symbol ranges and code hashes, dispatch/vtable/PLT relocations, formula instruction bytes and action-bank calls. The validator reconstructs every projected SQLite tuple, inherited target/sub-target/timing/lifecycle and full provenance. Goldens cover real self/team/class targets, positive/negative/zero/float32 inputs, invalid input, aggregate clamp, unknown boundaries and the two rounding orders. Two JSON/gzip generations must be byte-identical, and both source fingerprints must remain unchanged.
