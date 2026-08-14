# Game DB derived decrypted SQLite artifact DQ0-DQ6

## Boundary

DQ0-DQ4 establishes the first production-shaped lineage and storage boundary
between a fully revalidated AQ commit and a derived plain-SQLite commit. It is
offline and has no productive transformer. Tests inject both the secret provider
and transformer. DQ5 adds only productive C4 compatibility consumption of a
fully validated DQ commit. DQ6 adds a fail-closed local SQLCipher runtime
selection boundary and process-protocol test fixtures. It does not expose a
productive process transformer or authorize any executable, key or artifact.

The only source authority is the existing AQ validator with exactly one of:

- `storeRoot + artifactIdentity`; or
- `storeRoot + useLatest: true`.

There is no arbitrary input path or loose SQLite mode. The derived store must be
a separate, non-overlapping root. DQ does not mutate AQ, export CSV, refresh
evidence, publish, access R2 or change Android.

## DQ0 - authority and NO-GOs

The runner calls `validateAcquiredDatabaseArtifact`, opens the resulting AQ
`database.db`, binds that pathname to the opened regular single-link read-only
file, and hashes the open descriptor against AQ size and SHA-256. After the
transform it repeats that descriptor check and revalidates the exact resolved AQ
identity, even when the initial selector was `useLatest`.

The only implemented transform kind is `sqlcipher_decrypt`, and it requires an
AQ parent in state `encrypted_or_packaged`. The transformer remains injected
into the runner. DQ6 does not supply an executable implementation: its exported
factory always fails closed because the reviewed runtime allowlist is empty.
The process protocol is exercised only by test-owned code and a controlled
synthetic fixture. Real SQLCipher execution, productive secret lookup and the
historical Python helper remain NO-GO. DQ5 authorizes only local read-only C4
compatibility inspection after a DQ commit already exists.

## DQ1 - deterministic contract and lineage

`metadata.json` is canonical JSON and contains exactly:

- schema, contract and contract-version pins;
- parent AQ identity, source SHA-256, source byte size and source state;
- transform kind;
- pinned transform implementation identity, version and SHA-256;
- canonical non-secret JSON parameters; and
- output SHA-256, byte size and `readable_sqlite` state.

Metadata contains no timestamp or operational result. Its SHA-256 is the derived
artifact identity. `commit-marker.json` binds that identity and the SHA-256 of
the exact canonical metadata bytes.

Runtime parsing rejects extra, missing or incorrectly typed fields even when
TypeScript types are bypassed. Non-secret parameters must be bounded plain JSON;
field names associated with secrets, credentials, URLs, headers, queries,
accounts or paths are prohibited, as are URL, absolute-path and traversal-like
string values.

## DQ2 - secret and receipt boundary

An injected provider returns secret bytes only at runtime. A copy is passed only
to the injected transformer together with an already-open AQ input, a controlled
sequential output sink and an `AbortSignal`. The transformer receives no output
`FileHandle`, path, argv, environment, logger or receipt channel. Each sink write
is awaited as backpressure, reserves its byte range before writing and rejects
before total output can exceed 112 MiB. The runner clears its secret copies after
the operation.

The transform boundary defaults to 120 seconds and accepts only a positive safe
integer timeout no greater than 120 seconds. Timeout or caller cancellation
aborts the signal, revokes the sink and preserves a fixed public error. The
runner now permits up to 750 milliseconds for the aborted transformer Promise to
settle before it clears shared staging; it still never waits indefinitely for a
non-cooperative transformer. Late writes are rejected. This in-process boundary
cannot preempt transformer code that blocks the JavaScript event loop
synchronously; no such productive transformer is authorized.

Provider and transformer exceptions are replaced with fixed errors. Deterministic
metadata, markers, receipts, identities, filenames and output bytes are scanned
for raw, UTF-8, hexadecimal and base64 secret forms before authority is returned.
Tests use a sentinel and inspect successful state, failed state, results,
filenames and errors for non-leakage.

The separate operational receipt contains only contract pins, mode,
`completedAt`, result (`created` or `reused`), derived identity, parent identity,
transform kind and transform implementation identity. It contains no key, URL,
headers, query, raw descriptor, absolute path, account data or transformer
stdout/stderr. Receipt bytes and timestamps never affect deterministic identity,
the marker or reuse. Public runner results expose only a validated receipt
filename, never its absolute store path.

## DQ3 - output validation and marker-last storage

The transformer writes one exclusive regular staging file. Before commit, DQ:

- rejects empty output and output above 112 MiB;
- verifies the transformer's declared size and SHA-256 against observed bytes;
- requires the SQLite magic, a valid SQLite page-size/header profile and a file
  size that is a whole number of pages;
- rejects output containing secret material;
- verifies that the open output descriptor and pathname remain the same regular
  single-link file; and
- rechecks the AQ source descriptor and complete AQ commit.

Validated output is copied independently into a pending commit, then copied
again into a create-only content-addressed destination. No hard link or AQ alias
is used. Final `database.sqlite` and `metadata.json` are installed first;
`commit-marker.json` is installed last. Every member is fsynced, made read-only,
required to have one hard link and independently validated.

The final identity directory is reserved with exclusive `mkdir`. A same-output
writer may reuse a destination only after the complete destination validates as
the exact expected commit. An incomplete, mismatched or corrupt destination
fails closed and is never overwritten or removed. A failed reservation owned by
the current operation is moved to an identity-checked quarantine. Existing valid
derived commits and every AQ commit remain untouched when later work fails.

Material authority ends only after the marker-last destination has passed full
derived and parent-AQ validation. Failures before that point quarantine an owned
reservation. Clock or receipt installation happens afterward as operational
evidence: its failure makes the operation fail but does not quarantine or remove
the already valid material commit.

Store creation and validation reject symlink, junction and reparse substitutions.
All internal member names are fixed; controlled descendants are checked
lexically, by realpath and by file/directory identity before and after use.

## DQ4 - consumer validator and readiness

`validateDerivedSqliteArtifact({ storeRoot, sourceStoreRoot,
artifactIdentity })` is the only derived consumer API. `storeRoot` is the
derived trust root and `sourceStoreRoot` is the AQ trust root. It accepts no
arbitrary database path and no receipt as authority. It revalidates the exact
derived member set, canonical metadata, content identity, marker, SQLite
structure, byte size/SHA, regular-file type, single-link/read-only state,
containment and stable opened identities. It then materially revalidates the AQ
commit named by metadata and requires exact parent identity, source SHA-256,
size and state matches.

A derived root alone cannot prove AQ lineage. DQ5 therefore requires C4 to
receive and validate both trust roots. DQ0-DQ4 alone does not authorize
compatibility inspection, evidence refresh, export, production promotion,
publication or Android use.

## DQ5 - local C4 compatibility consumption

C4 accepts a mutually exclusive DQ selector containing exactly
`derivedStoreRoot`, `sourceStoreRoot` and `derivedArtifactIdentity`, plus an
optional real `AbortSignal`. DQ has no `useLatest` mode and accepts no loose
SQLite, receipt, metadata or marker path. Mixed selectors, extra keys,
accessor-bearing objects, forged signals and invalid identities fail before
artifact reads. The existing exact AQ selectors remain supported unchanged.

C4 calls `validateDerivedSqliteArtifact`, creates its own exclusive private
read-only snapshot from the opened DQ output descriptor, and binds inspection to
the DQ output SHA-256, size and `readable_sqlite` state. The bridge keeps the C4
112 MiB input limit, streaming backpressure, timeout, output limits,
termination confirmation, quarantine cleanup and no-partial-report behavior.
C4 imports neither the DQ runner nor a transformer or secret provider.

Validation occurs before snapshot creation, immediately after the snapshot is
bound, and after inspection. Opaque internal bindings cover the DQ output,
metadata, marker, commit directories, trust-root boundaries and the material AQ
parent. The first comparison excludes only the derived-root timestamps changed
by C4's own snapshot creation; the inspection-period comparison includes them.
Output, metadata, marker, parent or namespace replacement, including A→B→A
restoration, therefore fails closed before a report is returned.

AQ-direct reports retain contract version `1.2.0`. DQ-derived reports use
version `1.3.0`, identify `sourceKind: dq_derived`, bind the inspection snapshot
to `dq_derived_output`, and list the AQ parent only as lineage. They never claim
that the encrypted or packaged AQ parent was inspected and contain no paths,
receipts, secret material or transform parameters.

## DQ6 - fail-closed SQLCipher process boundary

`createLocalSqlcipherProcessTransformer` validates only an exact selection for
the named `approved_sqlcipher_bundle_v1` profile: absolute bundle root,
lowercase 64-hex identity, explicit compatibility `3` or `4`, explicit
`utf8_passphrase` or `raw_bytes` material mode, and a bounded timeout. Extra
command, argument, executable, bridge and caller-hash fields are rejected.
The code-reviewed runtime allowlist is empty, so every well-formed selection is
rejected before filesystem access and the factory never returns a
`DerivedSqliteTransformer`.

This is deliberate. Portable Node cannot spawn an already validated executable
descriptor. Hashing either a caller pathname or a private snapshot and then
calling `spawn(path)` reopens a mutable pathname; a same-OS-identity A-B-A swap
can select different bytes for `CreateProcess`. A caller path plus a claimed
hash also cannot establish executable authority. DQ6 withdraws the former
private-bundle guarantee rather than treating post-spawn revalidation as proof.
No production-exported DQ6 path launches a process or receives AQ source or
secret material. The DQ runner has no DQ6-specific settlement integration.

A future executable adapter requires an approved OS-bound launcher design plus
a complete exact-file, content-addressed runtime/bridge bundle in a reviewed
allowlist. Its composed identity must enter `DerivedTransformSpecification`
without absolute paths. Runtime and bridge would be TCB members and could not
create child processes or aliases. These requirements are not implemented and
the checked-in Python bridge cannot currently be invoked by productive code.

The pending Python bridge remains review material. It applies explicit
`cipher_compatibility` before key material, verifies `sqlite_master` through
SQLCipher, exports with an empty output key, validates plain SQLite and removes
its fixed temporary members. It can best-effort clear only its mutable
`bytearray`; immutable Python values and copies inside `sqlcipher3`/SQLCipher
cannot be proven zeroized. A short-lived, confirmed-terminated approved runtime
is still TBC, so no subprocess secret-zeroization guarantee is made.

Synthetic process execution exists only in the focused spec. The test transpiles
tracked TypeScript source text, stored outside the compiler input and published
`lib/`, to an operation-local `.js` and executes that
emitted JavaScript with the current test runtime. It covers compatibility `3`
and `4`, UTF-8/raw modes, valid SQLite, secret output, timeout, cancellation,
bounded grace/force close waits, quarantine on missing close, overflow, stderr,
EPIPE, nonzero/malformed/trailing protocol, cleanup before fixture assignment
and zero test residue. The A-B-A regression proves replacement is inert because
the productive factory rejects before any validation/spawn boundary; the test
harness is not executable authority and cannot produce a DQ commit.

No real key was used and no SQLCipher decryption was executed. The historical
argv-key helper is retired and exits without accepting paths or secrets; no
productive secret provider or manual decryption command is present. C4 still consumes only an already
committed, fully two-root-validated DQ identity and never invokes DQ6. C1-C3,
export, refresh, publication, R2, production and Android remain outside this
gate.

## Threat model

AQ selectors, runtime objects, transform declarations, store contents, metadata,
markers and receipts are untrusted. Corruption, substitution and reproducible
races inside validation, transformation and promotion boundaries fail closed.
The contract does not claim protection from a malicious process or administrator
using the same OS identity after return, a compromised filesystem/kernel, or
permanent physical immutability on writable storage.

## Decision

| Capability | DQ0-DQ6 status |
| --- | --- |
| deterministic derived contract and validator | GO |
| injected secret provider/transformer in focused tests | GO |
| fail-closed runtime selection boundary | GO |
| test-only synthetic process protocol/lifecycle harness | GO |
| productive process-bound SQLCipher adapter | NO-GO |
| separate local content-addressed derived store | GO |
| real key or real decryption | NO-GO |
| real SQLCipher bridge execution or productive secret provider | NO-GO |
| local read-only C4 compatibility inspection of a validated DQ commit | GO |
| export, refresh, publication, R2 or Android | NO-GO |
