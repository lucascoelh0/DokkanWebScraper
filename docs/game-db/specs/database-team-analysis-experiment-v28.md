# Database Team Analysis experiment v28 (DB29)

DB29 maps passive efficacy type `111` to the native attack-break marker consumed by `AbilityManager::getAttackBreakingActions(int)`.

## Contract

- Artifact: `team-analysis-db29-attack-break.json.gz`.
- Contract version: `0.28.0`.
- Additive and experimental; production contracts are unchanged.
- Inputs are DB8 efficacy gaps, DB9 runtime dispatch evidence, DB11 canonical states, `passive_skills`, and the pinned first-party arm64 ELF.
- Every resolution preserves the SQLite row, consumed columns, raw activation fields, runtime code regions, byte hashes and native evidence hash.

## Supported semantics

- efficacy `111` registers a parameterless `attack_break_marker`;
- the runtime target is the enemy index copied from `CallChangeParam + 0` into `AbilityEfficacyInfo::deck_index`;
- each matching marker contributes one unit of multiplicity;
- the consumer selects the first N eligible current actions in native order;
- selection eligibility is preserved as raw predicates at action offsets 8 and 44;
- `eff_value1`, `eff_value2` and `eff_value3` are not consumed by the selection path.

## Conservative boundary

Structured `target_type`, timing, calculation option, probability ordering, duration, recurrence, raw condition-mask names, action-field names, removal predicate and efficacy `112` interaction remain unknown. These fields are not inferred from descriptions or handler names. The operation is supported while each complete resolution remains `partial`.

## Validation

The builder rejects broken lineage, duplicate rows, incomplete consumed columns, mutated native code, changed vtable relocations and source-gap accounting drift. Golden fixtures cover target type 4, timing type 4 with calculation option 2, and probability 30. Two independent JSON/gzip generations must be byte-identical, and the source SQLite/ELF fingerprints must remain unchanged.
