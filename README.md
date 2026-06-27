# DokkanWebScraper
Scrapes the Dokkan Wiki to build a database of characters etc

## Run locally
```
npm run run
```

## Run the dokkan.fyi migration experiment
```
npm run run:fyi-experiment
```

This writes:

- `./data/fyi-experiment/latest/characters.json`
- `./data/fyi-experiment/latest/coverage-report.json`

You can override the default 20-character spike set with:

```powershell
$env:DOKKAN_FYI_CHARACTER_IDS="1032521,1025731,1033061"
npm run run:fyi-experiment
```

Output goes to `./data/{currentDate}DokkanCharacterData.json`

The scraper also writes stable app-ingestion artifacts to:

- `./data/latest/characters.json.gz`
- `./data/latest/characters-manifest.json`

Future hosting notes and the planned R2/custom-domain setup live in:

- `./docs/dataset-hosting-plan.md`

The planned migration from DokkanInfo to `dokkan.fyi` lives in:

- `./docs/dokkan-fyi-migration-plan.md`

The target app-facing `dokkan.fyi` character contract lives in:

- `./docs/specs/dokkan-fyi-character-contract.md`

The planned auxiliary datasets around characters live in:

- `./docs/specs/dokkan-fyi-auxiliary-datasets-plan.md`

You can also generate a small contract reference snapshot for review:

```powershell
npm run run:fyi-contract-sample
```

This writes:

- `./docs/specs/examples/dokkan-fyi-character-sample.json`

## Scrape dokkan.fyi support memories
```powershell
npm run run:fyi-support-memories
```

This writes:

- `./data/support-memories/latest/support-memories.json`

## Scrape active dokkan.fyi summons
```powershell
npm run run:fyi-summons
```

This writes:

- `./data/summons/latest/summons-index.json`
- `./data/summons/latest/summons-details.json`

## Scrape dokkan.fyi Z-Battles
```powershell
npm run run:fyi-z-battles
```

This writes:

- `./data/z-battles/latest/z-battles.json`

Useful development overrides:

```powershell
$env:DOKKAN_FYI_Z_BATTLE_LIMIT="5"
npm run run:fyi-z-battles

$env:DOKKAN_FYI_Z_BATTLE_IDS="205,55"
npm run run:fyi-z-battles
```

## Scrape dokkan.fyi stage indexes
```powershell
npm run run:fyi-stages
```

This writes:

- `./data/stages/latest/quest-story-stages.json`
- `./data/stages/latest/event-stages.json`

Useful development override:

```powershell
$env:DOKKAN_FYI_EVENT_STAGE_AREA_LIMIT="10"
npm run run:fyi-stages
```

## Test 
```
npm run test
```

## Publish the app dataset to R2

After generating a fresh `data/latest/characters.json.gz` and `data/latest/characters-manifest.json`, publish what the app consumes with:

```powershell
npm run publish:r2 -- --bucket dokkanpanion-data
```

Useful flags:

- `--dry-run`: show what would upload/delete without touching R2
- `--force-portraits`: re-upload every portrait referenced by the current dataset
- `--skip-portraits`: publish only `characters.json.gz` + `characters-manifest.json`
- `--local`: target Wrangler local R2 storage instead of Cloudflare

What the script does:

1. reads the current gzip bundle from `data/latest`
2. discovers every referenced portrait from the dataset itself
3. uploads only portraits that changed since the last successful publish
4. deletes stale portraits that disappeared from the dataset
5. uploads the manifest last, so the app only sees the new dataset after the assets are already in place

The script stores its last successful publish state in `data/latest/r2-publish-state.json`.
