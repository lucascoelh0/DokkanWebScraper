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

## First-party acquisition helpers

### Initialize the contract folder

```powershell
npm run run:game-db-init-first-party-export
```

### Promote an existing known-good export

```powershell
$env:DOKKAN_GAME_DB_SOURCE_ROOT="C:\path\to\dokkan-backend"
npm run run:game-db-promote-first-party-export
```

### Build directly from a readable SQLite DB

```powershell
npm run run:game-db-build-first-party-export -- --sqlite-path "C:\path\to\database.db" --settings-json "C:\path\to\settings.json"
```

### Download a DB artifact from a captured `/client_assets/database`

```powershell
npm run run:game-db-download-database-artifact -- --client-assets-json "C:\path\to\client-assets-database.json" --settings-json "C:\path\to\settings.json"
```

Or:

```powershell
npm run run:game-db-download-database-artifact -- --database-url "https://example.com/database.db"
```

Writes:

- `./game-db/data/game-db-acquisition/downloads/latest/database.db`
- `./game-db/data/game-db-acquisition/downloads/latest/download-metadata.json`

### Pull a DB artifact from a rooted emulator

```powershell
npm run run:game-db-pull-emulator-database-artifact -- --device-serial "emulator-5554"
```

Writes:

- `./game-db/data/game-db-acquisition/downloads/emulator-backup-latest/database.db`
- `./game-db/data/game-db-acquisition/downloads/emulator-backup-latest/pull-metadata.json`

### Local SQLCipher toolchain

```powershell
python -m venv .venv-sqlcipher
.\.venv-sqlcipher\Scripts\python -m pip install --upgrade pip
.\.venv-sqlcipher\Scripts\python -m pip install sqlcipher3
```

Decrypt a DB artifact with:

```powershell
.\.venv-sqlcipher\Scripts\python game-db\game-db-decrypt-sqlcipher.py --input-path ".\game-db\data\game-db-acquisition\downloads\emulator-backup-latest\database.db" --output-path ".\game-db\data\game-db-acquisition\downloads\emulator-backup-latest\database.decrypted.sqlite" --key "<candidate-db-key>"
```

Useful flags:

- `--cipher-compatibility 3` for the older backup-style artifact flow
- `--cipher-compatibility 4` for the full rooted-emulator asset DB at `files/assets/sqlite/current/en/database.db`
- `--key-mode hex` if the key should be interpreted as raw hex bytes instead of plain text

### Full rooted-emulator asset DB flow

```powershell
npm run run:game-db-pull-emulator-database-artifact -- --device-serial "emulator-5554" --remote-path "/data/data/com.bandainamcogames.dbzdokkanww/files/assets/sqlite/current/en/database.db" --output-dir ".\game-db\data\game-db-acquisition\downloads\emulator-assets-sqlite-current-en"
.\.venv-sqlcipher\Scripts\python game-db\game-db-decrypt-sqlcipher.py --input-path ".\game-db\data\game-db-acquisition\downloads\emulator-assets-sqlite-current-en\database.db" --output-path ".\game-db\data\game-db-acquisition\downloads\emulator-assets-sqlite-current-en\database.decrypted.sqlite" --key "<GlbDbPassword>" --cipher-compatibility 4
npm run run:game-db-build-first-party-export -- --sqlite-path ".\game-db\data\game-db-acquisition\downloads\emulator-assets-sqlite-current-en\database.decrypted.sqlite" --settings-json "C:\path\to\settings.json"
npm run run:game-db-update -- --acquisition-mode first-party-export --first-party-dir ".\game-db\data\game-db-acquisition\first-party\latest" --bucket dokkanpanion-data --dry-run --skip-portraits --local
```

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
