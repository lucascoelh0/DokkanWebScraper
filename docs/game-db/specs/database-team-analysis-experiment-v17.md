# Database Team Analysis experiment v17 (DB18)

Status: experimental, non-production. Contract version: `0.17.1`.

DB18 applies the three DB17 conclusions only to occurrences attributed by DB16. Current-only `turn_from_entry >= 1` occurrences are removed from the comparison as tautologies, and reciprocal DB `lte 1`/current `eq 1` occurrences are normalized to the current signature.

Every application retains its DB16 reason, DB17 conclusion and the precondition `appearance_gate_true_and_normal_runtime_lifecycle`. Removing `gte 1` additionally requires a non-negated atom in a conjunctive branch; `any`, direct and negated occurrences remain untouched. Boundary normalization requires the DB/current atoms to have the same logical context and polarity. DB11 native conditions and DB15 parity bytes remain unchanged. DB18 inherits three semantic promotions and introduces zero new promotions.
