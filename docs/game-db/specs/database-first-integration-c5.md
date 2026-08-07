# Integration C5 — readiness and staged adoption

## Objective and boundary

C5 turns the validated C1–C4 chain into a deterministic, machine-readable adoption decision. It does not enable generation in the production pipeline, publish an object, change a production contract, or modify Android.

Acceptance requires exact artifact hash/size checks, an unbroken C1→C2→C3→C4 receipt chain, green gate validations, six explicit GO/NO-GO decisions, independent deterministic rebuilds, mutation rejection, a publication checklist, and documented version/cache/rollback/retention behavior.

## Decisions

- **GO — merge infrastructure:** only as a reviewed, disabled, additive and dependency-complete unit.
- **GO — optional production generation:** only for the exact C4-compatible SQLite/ELF/evidence identity, producing an optional sidecar and receipt without changing current outputs.
- **NO-GO — R2 publication:** publisher dry-run, remote keys, cache policy and rollback drill do not exist yet.
- **NO-GO — Android shadow consumption:** Android is unchanged and has no sidecar adapter/cache compatibility matrix.
- **NO-GO — partial combat authority:** condition, probability, lifecycle, attack kind, final HP and common rule identity remain incomplete.
- **NO-GO — full simulation:** turn-state, recurrence/reset/expiry, event semantics and final combat formulas remain incomplete.

## Integration strategy

The preferred integration is to merge the reviewed experimental infrastructure as a dependency-complete unit while leaving every activation path disabled. Cherry-picking C1–C5 alone is prohibited unless the DB48–DB50 source contracts, semantic evidence and inherited structural dependencies are included or replaced by a separately reviewed standalone input contract.

The adoption sequence is infrastructure, pinned optional generation, remote shadow artifact, Android shadow, then field-by-field selective authority. Unknown contract versions or snapshots are rejected or ignored; they never receive compatibility defaults.
