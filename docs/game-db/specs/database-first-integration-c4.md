# Integration C4 — reproducible focused refresh

## Objective and boundary

C4 refreshes only C1, C2, and C3 from already decrypted, read-only SQLite/ELF snapshots and already validated DB48/DB49/DB50 semantic artifacts. It never invokes the cumulative DB0–DB50 runner and does not rediscover native semantics.

The productive compatibility entry point is commit-bound. It accepts exactly
one of: an AQ `storeRoot + artifactIdentity`; an AQ `storeRoot + useLatest:
true`; or a DQ `derivedStoreRoot + sourceStoreRoot +
derivedArtifactIdentity`. The DQ selector has no `latest`, arbitrary SQLite
path, metadata path, marker path or receipt mode. Runtime parsing rejects mixed
selectors, extra keys, accessors, forged signals and invalid identities before
artifact reads. AQ `latest` means the deterministic winner of the immutable
create-only pointer journal; `latest.json` is only a dispensable legacy cache.

AQ-direct inspection retains its existing `1.2.0` report contract and validates
deterministic metadata, marker, content-addressed identity, artifact
SHA/size/state, descriptor lineage, containment and the exact member set. DQ5
calls `validateDerivedSqliteArtifact` with both trust roots, which also
materially validates the AQ parent named by DQ metadata. It opens the selected
committed database output exactly once,
copies bytes from that same descriptor into an exclusive private contained
read-only snapshot, validates snapshot SHA/size before and after the adapter, and
revalidates the exact source commit before reporting. For readable SQLite, C4 reads
the inspection input positionally from the still-open snapshot `FileHandle`,
hashes those bytes against the selected AQ or DQ output identity, and sends a
private copy to the Python bridge.
The bridge deserializes the bytes into an in-memory read-only SQLite connection;
it never reopens the snapshot pathname. DQ is validated before snapshot
creation, after binding and after inspection. Its private material bindings
cover output, metadata, marker, commit namespace, both trust-root boundaries and
the AQ parent, so replacement or A→B→A restoration fails closed. The DQ `1.3.0`
report identifies `dq_derived` provenance and the inspected derived output;
the AQ parent is lineage only and is never represented as the inspected bytes.

The productive bridge resource profile is pinned: SQLite input must be a positive
safe-integer size no greater than 112 MiB (117,440,512 bytes), which admits the
97,738,752-byte reviewed snapshot while remaining below AQ's 128 MiB ceiling.
C4 validates that bound and the observed selected member size before it creates a
snapshot or subprocess. Node streams the still-open snapshot handle in 64 KiB
chunks with write-callback backpressure, exact byte counting and an in-stream
limit. The incremental SHA-256 of the bytes actually written to stdin must equal
the selected output SHA before any bridge result can be accepted. Node never allocates or
retains a second whole-SQLite `Buffer`. Python may
hold the bounded input required by `sqlite3.deserialize`.

The subprocess timeout is 120 seconds with a 1-second graceful termination
period followed by forced termination and bounded close confirmation. A caller
may provide only an `AbortSignal`, never an inspection result or executable
override. Timeout, cancellation, EPIPE, early stdin close, output overflow,
non-zero exit or parse failure close stdin, terminate and await the child before
snapshot cleanup. Stdout is capped at 8 MiB and stderr at 1 MiB; counts are
checked before buffering, stderr errors are sanitized/truncated, and JSON is
accepted only after exit zero plus complete stream closure with no leading,
trailing, truncated or multiple documents.
On Windows, failure to observe normal close escalates to `taskkill /T /F`; C4
permits snapshot cleanup only after `close` or explicit confirmation that the
child PID no longer exists. If the OS still reports the PID alive after both
forced paths, C4 emits no report and does not truncate/remove the snapshot: it
closes its own handle and moves the fully revalidated directory into an
ownership-bound `.c4-bridge-quarantine-*` container for explicit diagnosis.
Node has no portable descriptor-bound unlink. Cleanup therefore truncates and
fsyncs the exact owned snapshot handle, moves the directory into an exclusive
quarantine container, and validates the moved zero-byte identity. The tombstone
is retained for future separately reviewed bounded GC. If a replacement wins
that boundary, it is retained and the operation fails closed; cleanup never
unlinks a raced pathname.
The CLI has no `--sqlite-path`, and no productive export can inspect an arbitrary
SQLite file or publish `acquiredArtifactState` from one. `latest` and sanitized
operational receipts are evidence/navigation only, never authority over bytes.

Acceptance requires streaming SHA-256/size checks, the pinned bridge limits above, a canonical SQLite table/column schema fingerprint, required-column checks, ELF format checks, exact semantic-artifact identities, source-artifact binding, read-only before/after fingerprints, deterministic downstream artifacts, a sanitized receipt when operational proof is required, and a working-set ceiling of 1 GiB. A receipt is never authority over bytes.

## Compatibility policy

Semantic evidence is reusable only when the SQLite hash, ELF hash, schemas, formats, and DB48/49/50 artifacts exactly match the pinned baseline. A new game snapshot therefore produces `database-first-update-c4-compatibility.json` with explicit issues and no refresh receipt. Matching table shape alone is not permission to reuse native addresses or semantics.

AQ0–AQ6 ends at the official acquired artifact, possibly encrypted. A loose
decrypted SQLite has no authority and cannot enter C4. DQ0-DQ4 defines the only
derived commit contract, and DQ5 permits C4 to inspect only a fully validated
commit selected with both the derived and AQ trust roots. A DQ operational
receipt is never authority and is not accepted by the API or CLI.

For a new derived snapshot, a future separately authorized update workflow is:

1. run the separately reviewed derived-artifact gate and preserve its commit;
2. run C4 on that committed identity to fingerprint and classify incompatibilities;
3. revalidate only affected bounded native/SQLite evidence gates;
4. update the reviewed C4 baseline to the new exact evidence chain;
5. run C4 twice and compare receipt/output hashes;
6. review C3 shadow parity before any production-facing decision.

This flow intentionally reports incompatibility rather than carrying old supported semantics across changed binaries or databases.

DQ5 authorizes only offline, local, read-only compatibility inspection and a
sanitized compatibility report. It does not authorize or implement the DQ
transformer, a secret provider, real decryption, SQLCipher, export, C1-C3
refresh, production promotion, publication, R2 or Android consumption.
