# Dataset hosting plan

## Status

Production hosting is intentionally postponed for now because we do not want to pay for a custom domain yet.

The scraper and app are already prepared for the long-term shape:

- scraper emits a stable bundle:
  - `data/latest/characters.json.gz`
  - `data/latest/characters-manifest.json`
- app can ingest the dataset from:
  - remote `manifest + gzip`
  - cached local copy
  - bundled asset fallback

## Recommended long-term setup

When we are ready to publish this properly, use:

- Cloudflare R2
- custom domain
- stable manifest URL
- versioned dataset file path

Suggested structure:

- `https://assets.<domain>/characters/characters-manifest.json`
- `https://assets.<domain>/characters/releases/<datasetVersion>/characters.json.gz`

The manifest should point `fileName` at the versioned release path, not just `characters.json.gz`.

This gives us:

- stable app URL
- aggressive caching on versioned datasets
- simple rollback
- no giant dataset checked into the app repo forever

## Cost guardrails

We do not want to exceed the Cloudflare R2 free tier.

Current practical rules:

1. use the bucket only for app datasets
2. do not upload portraits or large media there
3. keep only:
   - current dataset
   - optional previous dataset for rollback
4. delete older versioned datasets during publish
5. keep storage class on Standard

With the current dataset size, this should stay comfortably below the free storage limit as long as old versions are cleaned up.

## No-domain interim option

If we want to test remote delivery before buying a domain:

- use the R2 public dev URL temporarily
- treat it as a short-term validation path only

Do not consider that the final production setup.

## Next implementation step when we resume this

Build a scraper publish flow that:

1. uploads `characters/releases/<datasetVersion>/characters.json.gz`
2. uploads `characters/characters-manifest.json`
3. prunes older releases beyond the retention limit
4. keeps the app configured with a single `characterDatasetBaseUrl`

## Current recommendation

Until we buy a domain, the best next work is inside the product/data pipeline itself, not hosting:

- improve dataset correctness
- improve bootstrap UX
- continue reducing legacy parsing in the app
