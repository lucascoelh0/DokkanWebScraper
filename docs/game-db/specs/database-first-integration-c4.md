# Integration C4 — reproducible focused refresh

## Objective and boundary

C4 refreshes only C1, C2, and C3 from already decrypted, read-only SQLite/ELF snapshots and already validated DB48/DB49/DB50 semantic artifacts. It never invokes the cumulative DB0–DB50 runner and does not rediscover native semantics.

The productive compatibility entry point is descriptor-bound. It accepts only
an AQ `storeRoot` plus a committed `artifactIdentity`, or an explicit `latest`
selector. `latest` means the deterministic winner of the immutable create-only
pointer journal; `latest.json` is only a dispensable legacy cache. It validates deterministic metadata, marker, content-addressed
identity, artifact SHA/size/state, descriptor lineage, containment and the exact
member set before inspection. It opens the committed database exactly once,
copies bytes from that same descriptor into an exclusive private contained
read-only snapshot, validates snapshot SHA/size before and after the adapter, and
revalidates the source commit before reporting. The report records AQ identity
and inspected snapshot hash/size and requires equality. A source A→B→A pathname
swap can therefore inspect only the already-open A bytes or fail closed; it can
never report lineage A for inspection B.
Node has no portable descriptor-bound unlink. Cleanup therefore truncates and
fsyncs the exact owned snapshot handle, moves the directory into an exclusive
quarantine container, and validates the moved zero-byte identity. The tombstone
is retained for future separately reviewed bounded GC. If a replacement wins
that boundary, it is retained and the operation fails closed; cleanup never
unlinks a raced pathname.
The CLI has no `--sqlite-path`, and no productive export can inspect an arbitrary
SQLite file or publish `acquiredArtifactState` from one. `latest` and sanitized
operational receipts are evidence/navigation only, never authority over bytes.

Acceptance requires streaming SHA-256/size checks, a canonical SQLite table/column schema fingerprint, required-column checks, ELF format checks, exact semantic-artifact identities, source-artifact binding, read-only before/after fingerprints, deterministic downstream artifacts, a sanitized receipt when operational proof is required, and a working-set ceiling of 1 GiB. A receipt is never authority over bytes.

## Compatibility policy

Semantic evidence is reusable only when the SQLite hash, ELF hash, schemas, formats, and DB48/49/50 artifacts exactly match the pinned baseline. A new game snapshot therefore produces `database-first-update-c4-compatibility.json` with explicit issues and no refresh receipt. Matching table shape alone is not permission to reuse native addresses or semantics.

AQ0–AQ6 ends at the official acquired artifact, possibly encrypted. A loose
decrypted SQLite has no productive derived contract and cannot enter C4. A future
separate decryption/import gate must consume the parent AQ commit and emit a
content-addressed derived commit with parent identity, pinned tool/version,
required non-secret parameters, result SHA/size/state, deterministic marker and
metadata, and a sanitized receipt. Only that derived commit can enter C4.

For a new derived snapshot, the update workflow is:

1. run the separately reviewed derived-artifact gate and preserve its commit;
2. run C4 on that committed identity to fingerprint and classify incompatibilities;
3. revalidate only affected bounded native/SQLite evidence gates;
4. update the reviewed C4 baseline to the new exact evidence chain;
5. run C4 twice and compare receipt/output hashes;
6. review C3 shadow parity before any production-facing decision.

This flow intentionally reports incompatibility rather than carrying old supported semantics across changed binaries or databases.
