# Database Team Analysis experiment v49 — DB50 counter consumer

Status: experimental, additive, non-production. Contract version `0.49.0` consumes the pinned Global 6.4.0 SQLite and `libcocos2dcpp.so` snapshots plus DB24, DB35 and DB47 artifacts by exact SHA-256.

## Candidate choice

DB50 first examined `AbilityManager::clearExecCount`, whose reset epoch affects 1,049 once-only rules. A bounded streamed scan over named symbol intervals found no direct branch, relocation or vtable reference to the method. Its trigger therefore remains a dynamic-observation boundary. Unknown efficacy types 103 and 119 also retain null dispatch slots in the pinned runtime evidence.

The gate selected efficacy type 120 because 50 rules across 38 states expose a complete bounded chain from the already-proved DB24 SQLite payload through native selection to an intermediate enemy-damage operand. This improves counter simulation and incoming-damage calculation without inventing the external activation event.

## Proven semantics

The registration handler reads `CallChangeParam + 4`: zero registers the behavior; nonzero skips it. The field's product meaning is unknown. Normal selection filters efficacy-info records by literal type 120 and input deck index, then replaces its current candidate only for a strictly larger `resistDamageRate`; the greatest rate wins and the first record wins ties.

The general selector checks a type-128 dodge-counter candidate before the type-120 normal candidate. The caller boolean, type-128 SQLite binding and surrounding cannot-attack/trigger gates remain preserved control flow rather than named product semantics.

The enemy-source intermediate-damage consumer calculates `pre - truncTowardZero(pre × resistDamageRate / 100)`. It runs after efficacy-13 mitigation and before player DEF and guard. A rate above 99 sets a separate native flag. No extra clamp is introduced by the contract.

## Boundaries and validation

`increaseDamagePercent` and `battleScriptNo` retain their DB24 structured bindings, but their consumers remain unknown. External activation, probability application, lifecycle/reset/expiry, counter outgoing damage, battle-script execution, attack-kind partition and final HP application are not promoted.

The builder pins ten bounded code regions, six direct-call/PLT/relocation chains, ELF and SQLite hashes, and inherited artifact hashes. The validator reconstructs all 50 payload and activation tuples losslessly, checks passive-skill and effect-count identity on both joins, and preserves full provenance. Goldens cover maximum selection, first-wins ties, empty selection, positive/negative/zero/100/out-of-range arithmetic, real rates 0/59/100, invalid payloads, evidence mutations and unknown-boundary mutations.

`team-analysis-db50-run.ts` is the bounded revalidation path: it consumes the already validated DB24/DB35/DB47 artifacts, validates their exact hashes, and executes only the DB50 ELF adapter, builder, validator and goldens. The cumulative DB0–DB50 runner crossed the 2 GB campaign limit and was interrupted; the focused run completed with a measured peak aggregate working set of 522,100,736 bytes. Two focused generations produced identical JSON and gzip bytes.
