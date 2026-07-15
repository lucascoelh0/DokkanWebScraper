# DokkanWebScraper

Workspace focused on the `dokkan.fyi` scraping pipeline for Dokkanpanion.

The newer first-party game-database backend work now lives separately in:

- `./game-db/`
- `./docs/game-db/`

If you want the DB-first pipeline instead of the scraper, start with:

- `./game-db/README.md`

## Run locally

```powershell
npm run run
```

## Main scraper flows

### Character migration experiment

```powershell
npm run run:fyi-experiment
```

This writes:

- `./data/fyi-experiment/latest/characters.json`
- `./data/fyi-experiment/latest/coverage-report.json`

Useful override:

```powershell
$env:DOKKAN_FYI_CHARACTER_IDS="1032521,1025731,1033061"
npm run run:fyi-experiment
```

### Contract sample

```powershell
npm run run:fyi-contract-sample
```

This writes:

- `./docs/specs/examples/dokkan-fyi-character-sample.json`

### Support memories

```powershell
npm run run:fyi-support-memories
```

This writes:

- `./data/support-memories/latest/support-memories.json`

Joined support-memory details with category/applicability/acquisition refs:

```powershell
npm run run:fyi-support-memory-details
```

This writes:

- `./data/support-memories/latest/support-memory-details.json`

Notable support-memory details fields:

- `unlockMethod`: `direct-item`, `mission-fallback`, `film-only`, or `unknown`
- `unlockAcquisition`: exact unlock sources when the site exposes them directly or via mission fallback
- `filmAcquisition`: acquisition sources for the required film color
- `unlockAcquisition.groups` / `filmAcquisition.groups`: grouped source summaries with total quantities per event/stage surface
- `dokkanInfo`: optional DokkanInfo enrichment block already joined by support-memory id
  - card art / complete art / film icon
  - enhancement item icons
  - local animation mirrors with `status: mirrored | partial | unavailable`

DokkanInfo enrichment for local support-memory assets and animations:

```powershell
npm run run:dokkaninfo-support-memory-enrichment
```

This writes:

- `./data/support-memories/latest/support-memory-dokkaninfo-enrichment.json`
- local assets under `./data/support-memories/assets/dokkaninfo/`

Useful overrides:

```powershell
$env:DOKKANINFO_SUPPORT_MEMORY_IDS="10001,50015"
npm run run:dokkaninfo-support-memory-enrichment
```

```powershell
$env:DOKKANINFO_SUPPORT_MEMORY_LIMIT="5"
npm run run:dokkaninfo-support-memory-enrichment
```

Notable DokkanInfo enrichment fields:

- `largeAsset.localPath`: local mirror of the support-memory card art
- `completeAsset`: local mirror of the unlock/complete image plus quantity
- `requiredFilm`: local mirror of the required film icon plus quantity and film code
- `enhancementItems`: local mirrors of support-memory enhancement medals
- `animation`: local mirrored LWF payload plus texture atlas files when the page exposes an in-game animation
  - `status` can be `mirrored`, `partial`, or `unavailable`
  - `partial` means the `.lwf` payload was mirrored but one or more referenced textures were missing upstream

DokkanInfo enrichment for awakening-medal metadata and thumbs:

```powershell
npm run run:dokkaninfo-awakening-medal-enrichment
```

This writes:

- `./data/awakening-medals/latest/awakening-medal-dokkaninfo-enrichment.json`
- local assets under `./data/awakening-medals/assets/dokkaninfo/`

Useful overrides:

```powershell
$env:DOKKANINFO_AWAKENING_MEDAL_IDS="1,2,100001"
npm run run:dokkaninfo-awakening-medal-enrichment
```

```powershell
$env:DOKKANINFO_AWAKENING_MEDAL_LIMIT="10"
npm run run:dokkaninfo-awakening-medal-enrichment
```

Notable awakening-medal enrichment fields:

- `itemKey`: normalized join key in the form `AwakeningMedal:{id}`
- `tradePoints`: DokkanInfo `selling_exchange_point` value
- `eventJumpable`: whether the site flags the medal as event-jumpable
- `thumbnailAsset.localPath`: local mirror of the medal thumb used on DokkanInfo

### DokkanInfo item catalog

```powershell
npm run run:dokkaninfo-item-catalog
```

This writes:

- `./data/dokkaninfo-items/latest/item-catalog.json`
- local item assets under `./data/dokkaninfo-items/assets/`

The catalog currently covers act items, keys, potential items, special items,
stickers, support items, training fields, training items, and treasure items.
Each entry has a stable `itemType:id` key, normalized name/description, an
optional training value, source path, and local icon/background references.
Equipment and awakening medals remain on their specialized pipelines because
they have richer contracts and extra metadata already implemented.

Useful overrides:

```powershell
$env:DOKKANINFO_ITEM_CATEGORIES="supportitems,trainingitems"
$env:DOKKANINFO_ITEM_LIMIT="10"
$env:DOKKANINFO_ITEM_DOWNLOAD_ASSETS="false"
npm run run:dokkaninfo-item-catalog
```

The page cache lives under `./data/dokkaninfo-items/cache/`. Use
`DOKKANINFO_ITEM_REFRESH=true` to bypass it. `DOKKANINFO_ITEM_CONCURRENCY`,
`DOKKANINFO_ITEM_ASSET_CONCURRENCY`, and
`DOKKANINFO_ITEM_CACHE_TTL_HOURS` tune the pipeline. Failed categories are
recorded in `failedCategorySlugs` while the remaining catalog continues.

### Exclusive skill orb details

```powershell
npm run run:fyi-exclusive-skill-orb-details
```

This writes:

- `./data/exclusive-skill-orbs/latest/exclusive-skill-orb-details.json`

Notable exclusive-skill-orb details fields:

- `owners`: the fully-awakened characters that currently expose the orb on their page
- `acquisitionModel`: `acquisition-item`, `character-hint`, or `unknown`
- `acquisitionSummary.groups`: grouped event/shop surfaces for the orb
- `acquisitionSummary.sources`: detailed mission/shop source rows, including Baba-shop currency metadata when the normalized acquisition layer does not yet cover the orb
- `dokkanInfo`: optional DokkanInfo equipment metadata joined by the official orb ID, including restrictions, exchange value and permanence
- `presentationAssets`: local mirrors of the orb icon and background assets

The optional DokkanInfo join reads the newest `YYYYMMDDDokkanEquipmentData.json` in `data/`. Set `DOKKAN_INFO_EQUIPMENT_DATA_PATH` to override that file when running the pipeline from another location. Missing equipment data does not prevent the `dokkan.fyi` orb catalog from being generated.

Character pages are cached for 24 hours under `data/exclusive-skill-orbs/cache/` so a full scrape can resume after a transient failure. Use `DOKKAN_FYI_ORB_REFRESH=true` to bypass the cache, or `DOKKAN_FYI_ORB_CACHE_TTL_HOURS=0` to force expiry.
For manual batch recovery, `DOKKAN_FYI_ORB_CHARACTER_LIMIT` and `DOKKAN_FYI_ORB_CHARACTER_OFFSET` select a window from the paginated character index; after the windows finish, run without these variables to assemble the complete dataset from cache.
The runner records `failedCharacterIds` and continues when an individual page remains unavailable. `DOKKAN_FYI_ORB_REQUEST_TIMEOUT_MS` and `DOKKAN_FYI_ORB_REQUEST_RETRIES` can tune the network policy for a slower or rate-limited source.

### Summons

```powershell
npm run run:fyi-summons
```

This writes:

- `./data/summons/latest/summons-index.json`
- `./data/summons/latest/summons-details.json`

### Categories

```powershell
npm run run:fyi-categories
```

This writes:

- `./data/categories/latest/categories.json`

Useful override:

```powershell
$env:DOKKAN_FYI_CATEGORY_LIMIT="10"
npm run run:fyi-categories
```

### Z-Battles

```powershell
npm run run:fyi-z-battles
```

This writes:

- `./data/z-battles/latest/z-battles.json`

Useful overrides:

```powershell
$env:DOKKAN_FYI_Z_BATTLE_LIMIT="5"
npm run run:fyi-z-battles

$env:DOKKAN_FYI_Z_BATTLE_IDS="205,55"
npm run run:fyi-z-battles
```

### Stage indexes

```powershell
npm run run:fyi-stages
```

This writes:

- `./data/stages/latest/quest-story-stages.json`
- `./data/stages/latest/event-stages.json`

Useful override:

```powershell
$env:DOKKAN_FYI_EVENT_STAGE_AREA_LIMIT="10"
npm run run:fyi-stages
```

### Event missions

```powershell
npm run run:fyi-event-missions
```

This writes:

- `./data/event-missions/latest/event-missions.json`

The scraper caches index pages and category details for 24 hours under
`./data/event-missions/cache/`. Use `DOKKAN_FYI_EVENT_MISSION_REFRESH=true` to
force a refresh. `DOKKAN_FYI_EVENT_MISSION_CONCURRENCY`,
`DOKKAN_FYI_EVENT_MISSION_TIMEOUT_MS`, and
`DOKKAN_FYI_EVENT_MISSION_RETRIES` tune the network policy. A category that
remains unavailable is recorded in `failedCategoryIds` while the rest of the
dataset continues.

### DokkanInfo event rewards

```powershell
npm run run:dokkaninfo-event-rewards
```

This writes:

- `./data/dokkaninfo-events/latest/event-rewards.json`

The dataset covers the configured DokkanInfo event surfaces for bonus,
challenge, DB Stories, growth, limited, quest, story, Z-Battle, Dokkan Frontier,
and Super Dragon Ball Heroes events. It extracts event/stage reward rows for
cards, medals, potential items, training items, equipment skill orbs, support
items, treasures, support memories, and other reward types.

The event reward layer is also consumed by `acquisition.json`,
`acquisition-source-index.json`, `acquisition-navigation.json`, and the
Exclusive Skill Orb details dataset. This gives the app an item-to-event/stage
route without duplicating event parsing in the Android client.

The scraper caches detail pages for 24 hours under
`./data/dokkaninfo-events/cache/`. Use `DOKKANINFO_EVENT_REWARD_REFRESH=true`
to bypass the cache. `DOKKANINFO_EVENT_REWARD_TYPES` can limit the event
families, `DOKKANINFO_EVENT_REWARD_LIMIT` can run a small batch, and
`DOKKANINFO_EVENT_REWARD_CONCURRENCY` tunes parallel requests. Pages that
remain unavailable are recorded in `failedEventIds`.

### Wallpapers

```powershell
npm run run:fyi-wallpapers
```

This writes:

- `./data/wallpapers/latest/wallpapers.json`

Useful override:

```powershell
$env:DOKKAN_FYI_WALLPAPER_LIMIT="10"
npm run run:fyi-wallpapers
```

## App dataset output

The scraper flow writes stable app-ingestion artifacts to:

- `./data/latest/characters.json.gz`
- `./data/latest/characters-manifest.json`

Portraits are stored in:

- `./data/images`

## Publish the scraper dataset to R2

```powershell
npm run publish:r2 -- --bucket dokkanpanion-data
```

Useful flags:

- `--dry-run`
- `--force-portraits`
- `--skip-portraits`
- `--local`

The script stores publish state in:

- `./data/latest/r2-publish-state.json`

## Important docs

Scraper-specific planning and contracts:

- `./docs/dokkan-fyi-migration-plan.md`
- `./docs/specs/dokkan-fyi-character-contract.md`
- `./docs/specs/dokkan-fyi-auxiliary-datasets-plan.md`
- `./docs/specs/dokkan-scraper-spec.md`
- `./docs/scraper-reference.md`
- `./docs/dataset-hosting-plan.md`

Game DB / first-party backend research:

- `./game-db/README.md`
- `./docs/game-db/source-repo-evaluation.md`
- `./docs/game-db/game-db-backend-bootstrap-plan.md`
- `./docs/game-db/game-db-first-party-acquisition-playbook.md`

## Test

```powershell
npm run test
```
