# Game DB Backend

This folder contains the first-party game-database pipeline work that was split out of the main scraper root.

It is the path for using Dokkan's own database artifacts instead of depending on `dokkan.fyi` scraping as the primary source.

Related docs:

- `../docs/game-db/source-repo-evaluation.md`
- `../docs/game-db/game-db-backend-bootstrap-plan.md`
- `../docs/game-db/game-db-first-party-acquisition-playbook.md`
- `../docs/game-db/specs/dokkan-source-contract.md`
- `../docs/game-db/specs/game-db-first-party-acquisition-contract.md`

## Layout

Code in this folder:

- `game-db-*.ts`
- `game-db-*.py`
- `portrait-assets.ts`

Generated outputs:

- `./data/game-db-acquisition`
- `./data/game-db-experiment`
- `./data/game-db-dataset`
- `./data/game-db-update`

## Main commands

All commands still run from the workspace root.

### Experiment against an existing export

```powershell
$env:DOKKAN_GAME_DB_SOURCE_ROOT="C:\path\to\dokkan-backend"
npm run run:game-db-experiment
```

Writes:

- `./game-db/data/game-db-experiment/latest/characters.json`
- `./game-db/data/game-db-experiment/latest/dokkanpanion-projection.json`
- `./game-db/data/game-db-experiment/latest/report.json`
- `./game-db/data/game-db-experiment/latest/comparison-report.json`

Useful override:

```powershell
$env:DOKKAN_GAME_DB_CARD_IDS="1032521,1029471,1025731"
npm run run:game-db-experiment
```

### Build the game DB dataset

```powershell
$env:DOKKAN_GAME_DB_SOURCE_ROOT="C:\path\to\dokkan-backend"
npm run run:game-db-dataset
```

Writes:

- `./game-db/data/game-db-dataset/latest/characters.json`
- `./game-db/data/game-db-dataset/latest/characters.json.gz`
- `./game-db/data/game-db-dataset/latest/characters-manifest.json`
- `./game-db/data/game-db-dataset/latest/source-characters.json`
- `./game-db/data/game-db-dataset/latest/report.json`

Useful overrides:

```powershell
$env:DOKKAN_GAME_DB_CARD_LIMIT="100"
npm run run:game-db-dataset

$env:DOKKAN_GAME_DB_CARD_IDS="1032521,1025731,1033061"
npm run run:game-db-dataset
```

### Run the full update flow

```powershell
$env:DOKKAN_GAME_DB_SOURCE_ROOT="C:\path\to\dokkan-backend"
npm run run:game-db-update -- --bucket dokkanpanion-data --dry-run --local
```

This runner:

1. acquires a source
2. builds the dataset
3. validates golden cards
4. prepares portraits unless skipped
5. optionally publishes
6. writes reports to `./game-db/data/game-db-update/latest`

Useful runner-only flags:

- `--skip-validation`
- `--skip-publish`
- `--card-limit 100`
- `--card-ids 1032521,1025731`
- `--validation-card-ids 1032521,1033061`
- `--acquisition-mode existing-export`
- `--acquisition-mode mirror-repo --mirror-dir .\game-db\data\game-db-acquisition\mirror\dokkan-backend`
- `--acquisition-mode first-party-export --first-party-dir .\game-db\data\game-db-acquisition\first-party\latest`
- `--mirror-url https://github.com/Nicholas1006/dokkan-backend.git`
- `--mirror-branch main`
- `--skip-sync`

Publish flags such as `--dry-run`, `--local`, `--skip-portraits`, `--force-portraits`, and `--bucket` are forwarded through.

## Manual official SQLite acquisition

The acquisition input is always an externally supplied, exact
`/client_assets/database` descriptor. Descriptor validation is offline and
performs no request:

```powershell
npm run run:game-db-download-database-artifact -- --descriptor-json "C:\path\to\database-descriptor.json" --dry-run
```

An already available artifact can be inspected only when it is bound to the
same validated descriptor:

```powershell
npm run run:game-db-download-database-artifact -- --descriptor-json "C:\path\to\database-descriptor.json" --artifact-path "C:\path\to\database.db"
```

The one allowlisted official CDN GET is a distinct manual action and requires
separate authorization:

```powershell
npm run run:game-db-download-database-artifact -- --descriptor-json "C:\path\to\database-descriptor.json" --authorize-download
```

Authorized acquisition streams into an ignored content-addressed store. Each
committed identity contains `database.db`, deterministic `metadata.json` and a
marker-last `commit-marker.json`. Sanitized operational receipts live under
`receipts/`. Current selection comes from immutable create-only records under
`pointers/`, never from overwriting a shared pathname. Each record binds the
commit identity, a validated predecessor and deterministic database-version /
artifact-identity order. No delivery URL, query, credential or operational timestamp
participates in the artifact identity.

Promotion is create-only on Windows and POSIX: the final identity is reserved by
exclusive directory creation. Each validated pending `FileHandle` is streamed
into an independently created `wx` member, fsynced, rehashed, required to have
`nlink == 1`, and made read-only. Database and metadata are installed before the
marker; the directory is fsynced where supported. No promotion step creates a
hard link. Pending is removed only after every final member proves an independent
inode. A raced destination is never replaced and an owned reservation that fails
final validation is moved to a pinned quarantine instead of remaining under the
content-addressed name.

Readable artifacts are checked against the tracked canonical C4 profile only
through the production read-only SQLite adapter:

```powershell
npm run run:game-db-sqlite-compatibility -- --store-root ".\game-db\data\game-db-acquisition\database-artifacts" --artifact-identity "<64-char-sha256-identity>"
# Or explicitly resolve and revalidate the current commit:
npm run run:game-db-sqlite-compatibility -- --store-root ".\game-db\data\game-db-acquisition\database-artifacts" --latest
```

The productive C4 API has no arbitrary SQLite-path mode. It derives `database.db`
only from a fully validated AQ commit, checks deterministic metadata, marker,
content identity, descriptor lineage, size/SHA/state, containment and members,
opens that member once, copies the bytes from the same `FileHandle` into an
exclusive private read-only snapshot, reads inspection bytes from its still-open
descriptor, and has the bridge deserialize that private byte copy without
reopening the snapshot pathname.
The productive C4 wrapper accepts only positive safe-integer SQLite sizes up to
112 MiB, below AQ's 128 MiB ceiling. It streams the open snapshot in 64 KiB
chunks with backpressure instead of allocating a whole-file Node `Buffer`.
The stream is counted and hashed incrementally against the AQ SHA.
The bridge is bounded to 120 seconds, a 1-second graceful/forced shutdown,
8 MiB stdout and 1 MiB stderr. An optional `AbortSignal` cancels work without
injecting inspection data; every failure waits for child termination before
the owned snapshot cleanup runs. Windows escalates to tree-forced termination
and confirms `close` or absence of the child PID.
If termination remains unconfirmed, no report is emitted and the intact,
revalidated snapshot is moved to a named ownership-bound bridge quarantine
instead of being truncated or silently orphaned.
Snapshot size/SHA are checked before and after inspection and the AQ source commit
is revalidated before reporting. The report binds the AQ identity to the inspected
snapshot hash and requires equality. Journal records, receipts and `latest.json`
are not authority over bytes; `latest.json` is at most a dispensable legacy cache
and may be missing or divergent. This compatibility report does not decrypt, export,
refresh evidence, publish, promote production data or authorize reuse of pinned
native evidence. Those are separate reviewed workflows.
Snapshot cleanup truncates/fsyncs the exact open descriptor, quarantines the
whole private directory and validates the zero-byte identity actually moved. A
raced replacement is retained rather than unlinked; zero-byte tombstones require
a future separately reviewed bounded GC.

AQ0–AQ6 terminates at the official acquired artifact, which may be
`encrypted_or_packaged`. A loose decrypted SQLite does not belong to the
productive chain and cannot be passed to C4. A future separate derivation gate
must consume the parent AQ commit and create a new deterministic commit containing
the parent identity, pinned tool/version, required non-secret parameters,
result SHA/size/state, marker/metadata and a sanitized operational receipt. Only
that derived commit may enter C4.

### Acquisition threat model

Descriptors, paths, pointers, receipts and artifact members are untrusted.
Operations detect corruption, substitution and races within their execution
boundaries; committed members are independent read-only files, and every
consumer revalidates the complete pointed commit. Later corruption fails closed
instead of being consumed silently. The manual/default-off workflow grants no
byte authority to an operational receipt or to `latest.json`.
Pointer journal records are immutable and create-only. Consumers ignore malformed
record candidates but fail closed when no valid materialized journal winner
exists; unexpected pointer-directory members fail closed. Selection and rollback
are derived solely from fully revalidated commits by the documented deterministic
order: the winner is the maximum and rollback is the next-lower materialized
record. Two writers may append records concurrently without replacing each other.

This boundary does not promise protection from a malicious process or
administrator running as the same OS identity after the operation returns, from
a compromised filesystem/kernel, or permanent physical immutability on a
writable filesystem. Those exclusions do not excuse reproducible substitutions
or races during acquisition, promotion, pointer update or C4 consumption; those
remain in scope and fail closed.

## Publish the game DB dataset to R2

```powershell
$env:DOKKAN_GAME_DB_SOURCE_ROOT="C:\path\to\dokkan-backend"
npm run publish:game-db-r2 -- --bucket dokkanpanion-data
```

This wrapper:

1. rebuilds the current game DB dataset
2. prepares missing portraits in `./data/images`
3. reuses the existing `publish-r2.ts` flow with the game DB bundle paths

Useful flags:

- `--dry-run`
- `--local`
- `--skip-portraits`
- `--force-portraits`
- `--concurrency 4`
