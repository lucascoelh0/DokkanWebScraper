# Database Team Analysis experiment v24 (DB25)

DB25 audits causality types `40` and `56` at their native handlers and at the caller that copies `AbilityStatus::AddtionalParam` into `AbilityStatusCausality`. The reproducible static result is deliberately narrower than the native symbol names: type 40 tests bit 0 of byte 1, while type 56 tests whether byte 1 is zero.

The contract adds a correction overlay instead of changing DB4/DB11 silently. The 132 type-40 occurrences previously projected as `super_attacks_performed` are marked overclaimed because their stated evidence was only a first-party row join. The 20 type-56 occurrences become partial native predicates. Attack kind, outgoing/incoming direction, event scope, timing, recurrence and calculation bucket remain unknown. This gate has zero semantic promotions.

Every record preserves the raw causality values, SQLite row provenance, native file hash, evidence hash, handler symbol, VMA, size and code hash. All current rows for both types have zero payload values. A specified dynamic experiment is required to map the caller-supplied context byte to action kind and direction.
