# Integration C4 — reproducible focused refresh

## Objective and boundary

C4 refreshes only C1, C2, and C3 from already decrypted, read-only SQLite/ELF snapshots and already validated DB48/DB49/DB50 semantic artifacts. It never invokes the cumulative DB0–DB50 runner and does not rediscover native semantics.

Acceptance requires streaming SHA-256/size checks, a canonical SQLite table/column schema fingerprint, required-column checks, ELF format checks, exact semantic-artifact identities, source-artifact binding, read-only before/after fingerprints, deterministic downstream artifacts, a validated receipt, and a working-set ceiling of 1 GiB.

## Compatibility policy

Semantic evidence is reusable only when the SQLite hash, ELF hash, schemas, formats, and DB48/49/50 artifacts exactly match the pinned baseline. A new game snapshot therefore produces `database-first-update-c4-compatibility.json` with explicit issues and no refresh receipt. Matching table shape alone is not permission to reuse native addresses or semantics.

For a new snapshot, the update workflow is:

1. decrypt SQLite and ELF outside this repository and preserve them read-only;
2. run C4 to fingerprint and classify incompatibilities;
3. revalidate only affected bounded native/SQLite evidence gates;
4. update the reviewed C4 baseline to the new exact evidence chain;
5. run C4 twice and compare receipt/output hashes;
6. review C3 shadow parity before any production-facing decision.

This flow intentionally reports incompatibility rather than carrying old supported semantics across changed binaries or databases.
