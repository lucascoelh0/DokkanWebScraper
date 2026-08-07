# Database Team Analysis Experiment v48 — DB49

Status: experimental, non-production. Contract version: `0.48.0`.

## Question

DB49 asks whether passive `efficacy_type = 78` has a native, bounded guard and damage-calculation meaning. It was selected over the type-28 HP-factor tail after a short comparison: type 78 reaches 305 projected rules / 267 states and exposes a complete SQLite → efficacy object → `checkGuard` → coefficient chain, while type 28 reaches 21 projected rules.

## Evidence chain

1. `passive_skills.efficacy_type = 78` selects dispatch slot `0x57c7da0`.
2. The exact relocation binds the slot to the eight-byte type-78 handler. The handler loads literal 78 and tail-calls the generic no-value efficacy-info generator; it does not read `eff_value1..3` or `calc_option`.
3. Both defender types are queried for efficacy 78 and pass the boolean to `DPuzzleGameCalcData::checkGuard`.
4. The proved decision is `has78 || (!has24 && !rawOverride && !playerModeOverride && affinity == 1)`.
5. `getGuardCoef()` returns the immediate double `0.5`. Both bounded damage functions branch on the computed guard boolean, multiply by `0.5`, and convert toward zero.
6. On the enemy-source path, the check result is followed across the caller/callee ABI: `[sp,#0x74]` → mask → caller `[sp,#0x18]` → callee frame-equivalent slot → guard branch.

Every symbol interval, VMA, size, code hash, PLT instruction, relocation and small instruction identity used by the validator is recorded in `native-forced-guard-semantics.json`. The analysis uses only bounded symbol ranges and saved small contexts.

## Contract

Each projection retains the first-party ID, all raw SQLite operands, inherited target/sub-target, timing and lifecycle, native runtime provenance, and a non-authoritative legacy comparison. `force_guard` is a boolean-presence effect with coefficient `0.5`; it is not a `SkillCalcOption` operation.

Timing, target, lifecycle, condition, probability and stacking are independent dimensions. Probability application, recurrence/reset/expiry, cross-status ordering, attack-kind partition, final HP application, and the separate element-coefficient input remain explicitly unknown.

## Validation

Goldens cover forced and normal truth-table paths, guard-disable interaction, positive/negative/zero truncation, self/team/class targets, known timings, evidence mutations, payload identity mutations, lossless reconstruction, deterministic double generation, and read-only source hashes.
