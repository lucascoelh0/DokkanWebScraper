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
`receipts/`; `latest.json` references only complete validated current and
previous commits. No delivery URL, query, credential or operational timestamp
participates in the artifact identity.

Readable artifacts are checked against the tracked canonical C4 profile only
through the production read-only SQLite adapter:

```powershell
npm run run:game-db-sqlite-compatibility -- --sqlite-path "C:\path\to\database.db"
```

This compatibility report does not decrypt, export, refresh evidence, publish,
promote production data or authorize reuse of pinned native evidence. Those are
separate reviewed workflows.

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
