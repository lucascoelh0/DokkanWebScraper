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
- `https://assets.dkbcompanion.com/images/v2/portrait_<id>.png`

## Production and staging channels

Production and staging share the custom domain but not mutable manifests or
payload namespaces:

- production: `characters-manifest.json` and `releases/`
- staging: `staging/characters-manifest.json` and `staging/releases/`

Publisher dry-runs may inspect production by default. A real remote production
write additionally requires `--channel production --promote-production`.
Staging still requires `--skip-portraits` for legacy, non-channel-scoped
portrait keys. Typed portrait candidates may use channel/lane-scoped,
content-addressed keys instead; in that mode the publisher validates and plans
every referenced object and refuses `--skip-portraits`.
Character and Team Analysis staging manifests must always be promoted as a
validated compatible pair.

Android release builds are fixed to the production manifest names. Debug
builds remain production by default and opt into staging with
`-PdebugDatasetChannel=staging`. This lets a candidate be installed and smoked
without changing what an already published Play build downloads.

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
2. upload only portraits referenced by a validated character release
3. retain immutable payloads and portrait objects needed by active or rollback
   releases; never infer that an object is orphaned from the current manifest
   alone
4. delete only through a future release-aware GC that proves no retained
   manifest references the object
5. keep storage class on Standard

With the current dataset size, this remains comfortably below the free storage
limit while every publication measures a conservative whole-bucket upper
bound. The publisher also enforces a 10,000,000,000-byte managed-output budget
by default; lower it with `--max-total-bytes` when sharing the bucket with
other data. Release-aware GC remains future work rather than an implicit part
of publication.

## Current recommendation

The hosting pipeline is no longer a blocker. The best next work is inside the
product/data pipeline and Android integration:

- validate a fresh-install Android smoke test
- keep the character dataset on the FYI source
- mirror additional media only when the app has a feature that consumes it
