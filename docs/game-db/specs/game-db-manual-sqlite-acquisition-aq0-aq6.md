# Game DB manual SQLite acquisition AQ0–AQ6

## Boundary

AQ0–AQ6 replaces the unsafe behavior of the existing
`game-db-download-database-artifact` helper without adding a second downloader.
It is a manual, offline-first bridge from an externally supplied official
`/client_assets/database` descriptor (or an already downloaded artifact) to a
validated, immutable local acquisition. It does not acquire credentials, call
the descriptor endpoint, decrypt bytes, run an export/refresh, publish, update
Android or promote production data.

Acquisition is deliberately split into these states:

1. descriptor received externally;
2. descriptor validated;
3. temporary download in progress;
4. downloaded/offline bytes validated;
5. immutable acquired artifact committed;
6. `readable_sqlite` or `encrypted_or_packaged` classified;
7. decryption, export and refresh not executed.

No state in this contract authorizes the next state automatically. In
particular, acquisition is not decryption, first-party export, shadow refresh,
publication or production promotion.

## AQ0 — prior behavior and gaps

The replaced implementation accepted an arbitrary `--database-url`, followed
up to five redirects, buffered the complete response in memory, wrote directly
to an arbitrary output filename, and emitted metadata only after the write. It
did not validate the official host/path/locale/version, declared hash or byte
length; did not have a hard streaming limit, timeout, cancellation cleanup,
single-writer lock, atomic promotion or immutable cache; and persisted the URL,
absolute input/output paths and user-supplied notes. It also mixed acquisition
with suggested decryption/export commands. Its four tests covered only basic
argument and URL selection.

## AQ1 — descriptor contract

The accepted document is one JSON object with exactly these known fields:

| Field | Contract |
| --- | --- |
| `url` | required HTTPS URL; exact host `cf.ishin-global.aktsk.com`; default port; no credentials, query or fragment |
| `file_path` | required exact logical path `sqlite/current/en/database.db` |
| `algorithm` | required allowlisted database value `version` |
| `hash` | required canonical positive decimal string exactly equal to `version` |
| `version` | required positive safe integer |
| `patch` | required and preserved as `null` or an unknown JSON value; non-null does not authorize patch handling |
| `patch_hash` | required and preserved as `null` or an unknown JSON value; non-null does not authorize patch handling |

Unknown top-level fields are rejected. They are never silently ignored. The
CDN path must be
`/sqlite/current/en/YYYYMMDD-HHMMSS/database.db`; it therefore agrees with the
Global EN logical family and contains no encoded separator or traversal. The
observed timestamp segment is delivery lineage, not identity. Query parameters
are not currently allowlisted.

The immutable identity is derived from region `global`, locale `en`, logical
file path, database version, declared algorithm/hash and validated byte length.
The URL is excluded.

The `version` algorithm is a descriptor/version binding, not a byte digest.
Local SHA-256 remains the byte-integrity authority. It is never relabelled as
the declared hash. `xxhash` is proven for asset manifests, not for this database
descriptor, and is therefore outside this allowlist.

`patch` and `patch_hash` are retained only as their validated `observed_null`
states in descriptor lineage. Because patch semantics are unproved, a non-null
patch fails closed and is never persisted as a usable patch instruction.

## AQ2 — inputs and filesystem policy

The normal CLI accepts exactly one of:

```text
--descriptor-json <external-json-file>
--artifact-path <already-downloaded-file>
```

Offline artifact validation also requires descriptor lineage, so the manual
operator supplies the descriptor file in the same command when the CLI contract
requires it. `--database-url`, arbitrary output names and free-form metadata are
not normal inputs. Legacy URL-only use is NO-GO.

The acquisition root is a local operator choice or the ignored default under
`game-db/data/`. Descriptor paths are logical POSIX paths only. Absolute,
drive-relative, UNC, device, traversal, mixed-separator and NUL-containing paths
are rejected. Existing roots and input files are resolved with `realpath`;
symlinks/junctions that escape the allowed root are rejected. Store filenames
come from a fixed allowlist and content identities, never from descriptor URL or
user-controlled output names.

## AQ3 — transport and validation

The production transport is injected behind the acquisition function and is
not called by module import, argument parsing, descriptor validation or dry-run.
It performs one GET over HTTPS with redirects disabled. The response must be a
successful non-redirect response with a bounded, valid `Content-Length`.

Bytes stream into an exclusive temporary file in the target store directory.
The stream counts bytes and calculates local SHA-256. The declared `version`
hash was already validated in its descriptor domain and is not misrepresented
as a byte digest. A hard byte ceiling and timeout apply even if response headers
lie or are absent. Truncation, overflow, declared-hash/size mismatch, cancellation,
transport failure and premature close fail closed and remove the temporary.
The implementation never buffers the approximately 100 MB artifact.

No real transport was executed in AQ0–AQ6. Tests use injected streams only.

## AQ4 — immutable store and portable metadata

Validated bytes are promoted into a content-addressed directory in the ignored
acquisition root. Promotion is same-filesystem and atomic; a commit marker is
written last. A single-writer lock serializes acquisition. An existing committed
identity is immutable and reusable only after its marker and byte identity
validate again.

Portable metadata contains only contract/schema versions, Global/en identity,
database version, logical path, declared algorithm/hash, observed byte length,
local SHA-256, readability state, the minimum descriptor lineage, acquisition
timestamp and the allowed next step. It contains no URL, query, headers, token,
descriptor body, account data or absolute filesystem path.

The local `latest` pointer is promoted atomically only after artifact, metadata
and commit marker validation. The previous content-addressed version is retained
for rollback. AQ0–AQ6 performs no deletion or pruning.

## AQ5 — decryption, export and C4 boundary

`readable_sqlite` may proceed only to the read-only SQLite compatibility command
and then the existing first-party exporter. `encrypted_or_packaged` may proceed
only to the existing local `game-db-decrypt-sqlcipher.py` helper in a separately
authorized execution against local bytes. Neither transition occurs inside the
downloader.

`run:game-db-sqlite-compatibility` compares a readable SQLite identity and
canonical schema with the current C4 baseline and returns exactly one of:

- `exact_profile_match` — SQLite identity and complete schema match C4;
- `schema_compatible_but_evidence_refresh_required` — required tables/columns
  remain present but the exact SQLite profile changed;
- `incompatible` — a required table/column is missing;
- `unknown` — the artifact is not readable SQLite and must be decrypted first.

This comparison records the pinned ELF and DB48/DB49/DB50 identities but does
not inspect them and always sets automatic native-evidence reuse to false. Even
an exact SQLite profile must run C4 against the exact pinned ELF and semantic
artifacts. A changed SQLite requires bounded evidence refresh and reviewed C4
baseline changes before C1–C3. The cumulative DB0–DB50 runner is never invoked.

## AQ6 — decisions

| Decision | AQ0–AQ6 |
| --- | --- |
| merge disabled/manual infrastructure | GO after independent review |
| offline descriptor validation | GO |
| offline validation of an already acquired artifact | GO |
| one official CDN GET | NO-GO until separate explicit authorization |
| local SQLCipher decryption | NO-GO in this campaign; separate authorization |
| focused shadow refresh | NO-GO in this campaign |
| authenticated refresh/login/credential acquisition | NO-GO |
| R2/publication/production promotion | NO-GO |
| Android | NO-GO |

The next gate is an independent code/contract review. Only after that review may
the operator separately authorize one official descriptor-bound GET.
