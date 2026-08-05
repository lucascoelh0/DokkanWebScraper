# Database Team Analysis experiment v10 (DB11)

Status: experimental, non-production. Contract version: `0.10.0`.

DB11 applies the three fully supported DB10 native causality semantics to the complete DB7 state dataset. It does not modify production contracts or reinterpret localized passive descriptions.

The projections are:

- causality `43` → `attacks_evaded`, self scope, current event;
- causality `51` → `turn_from_entry <= cau_val1`;
- causality `55` → `turn_from_entry >= cau_val1 + 1`.

The type-55 normalization is exact because the native operands are integers: `actual > N` and `actual >= N + 1` have the same truth set. DB11 preserves `nativeComparator=gt`, `nativeThreshold=N` and the `appearance_initialized` gate alongside the normalized predicate.

Every projected occurrence retains the `skill_causalities` row and columns plus the runtime handler symbol, VMA, byte size and code SHA-256 inherited from DB10. Invalid thresholds remain unknown. Type `3` is never projected because its runtime metric identity and unit remain unresolved.

Parity compares only the three promoted predicate families against the current Team Analysis dataset. Full projected occurrence counts, occurrences within matched states and unique per-state structural signatures are reported separately so repeated rules cannot inflate exact-match coverage. Structural signatures retain normalized `all`/`any` ancestry and `not` polarity, preventing a positive atom from matching the same atom in an opposite logical context. Signature parity is explicitly scoped to states present in both datasets after audited form aliases are applied.
