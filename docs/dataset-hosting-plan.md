# Dataset hosting plan

## Status

Production hosting is active on Cloudflare R2 behind `assets.dkbcompanion.com`.

The scraper and app are already prepared for the long-term shape:

- scraper emits a stable bundle:
  - `data/latest/characters.json.gz`
  - `data/latest/characters-manifest.json`
- app can ingest the dataset from:
  - remote `manifest + gzip`
  - cached local copy
  - bundled asset fallback

## Recommended long-term setup

The current production setup uses:

- Cloudflare R2
- custom domain
- stable manifest URL
- versioned dataset file path

Current structure:

- `https://assets.dkbcompanion.com/characters-manifest.json`
- `https://assets.dkbcompanion.com/releases/<datasetVersion>/characters.json.gz`
- `https://assets.dkbcompanion.com/images/portrait_<id>.png`

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
2. upload only portraits referenced by the current character manifest; do not
   keep unrelated or orphaned media there
3. keep only:
   - current dataset
   - portraits referenced by the current dataset
   - optional previous dataset for rollback
4. delete older versioned datasets during publish
5. keep storage class on Standard

With the current dataset size, this should stay comfortably below the free storage limit as long as old versions are cleaned up. The publisher also
enforces a 10,000,000,000-byte managed-output budget by default; lower it with
`--max-total-bytes` when sharing the bucket with other data.

## Current recommendation

The hosting pipeline is no longer a blocker. The best next work is inside the
product/data pipeline and Android integration:

- validate a fresh-install Android smoke test
- keep the character dataset on the FYI source
- mirror additional media only when the app has a feature that consumes it
