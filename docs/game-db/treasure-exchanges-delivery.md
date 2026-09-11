# Treasure Exchange — first How to Get delivery

Status: local candidate and Android integration, September 11, 2026. No publication.
Scope: card acquisition only. The future treasure-detail catalog is a separate UI delivery.

## Source and boundaries

The input is the sanitized result of the authorized manual shop query documented
in [the refresh runbook](treasure-shop-manual-refresh.md), not a HAR or login data.
The offline producer neither authenticates nor sends network requests.

Official metadata comes from the Global export
`game-db/data/first-party-complete-source/1788329250-awakening-routes-v1`.
The fields actually used were compared against the full readable SQLite with
SHA-256 `7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495`:
17,380 card IDs/names, 2,311 awakening medal IDs/names and 331 treasure IDs/names/icon
suffixes match exactly. The CLI requires explicit snapshot/hash metadata; it is
not a replacement for this source validation when changing snapshots.

The first delivery includes all 413 offers containing a Card reward, across
31 currencies and 295 distinct cards. All 52 multi-reward bundles are preserved,
including nine bundles containing both cards and awakening medals. The 268
non-card-only offers are excluded and counted, not silently treated as missing
source data. No purchase-limit or account-specific eligibility claim is emitted.

## Contract 1.0.0

Contract: `dokkan-treasure-exchanges`. Manifest and payload both bind schemaVersion,
contractVersion, datasetVersion, sourceSnapshotVersion and sourceDatabaseSha256.
The manifest additionally records compressed SHA-256, compressed/expanded byte
length and immutable relative object key. Limits: 64 KiB manifest, 2 MiB compressed,
8 MiB expanded. A consumer must reject mismatched bytes or identity before promotion.
Collection limits are 1,000 currencies, 10,000 offers and 100 rewards per offer.
Consumers reject unknown fields at every contract level and invalid timing metadata.

Payload fields:

- `capturedAt`: UTC instant of the shop query, not a promise of live availability.
- `generatedAt`: deterministically equal to capturedAt for replayable generation.
- `source`: `official-shop-snapshot`.
- `assetBaseUrl`: existing trusted asset origin, without credential/query/fragment.
- `currencies`: exact ID, official name and relative icon path.
- `offers`: exact offer ID, currency ID, price, nullable start/end instants, and
  complete rewards with `itemType`, exact `itemId`, official `name`, `quantity`.

Only Card and AwakeningItem rewards occur in the included offers. Any other type
in a card-containing bundle stops generation: never drop its companion reward.
The source `is_sale` must be false and `discount_price` must equal `price`; future
sale data needs a reviewed contract change, not guessed pricing. Duplicate IDs,
missing names/joins, non-integer or nonpositive quantities and invalid intervals
stop generation. Unexpected fields, including account-state fields, are rejected.

The source's exact `2145916800` end value corresponds to January 1, 2038 and also
appears in generic shop definitions; it is represented as unknown (`null`), never
as a promise of availability until that date. Other positive ordered epoch-second
timestamps are converted to UTC instants. UI may identify an ended or future
interval, but must not call an in-range offer guaranteed available or unlimited.

## Reproduce locally

From DokkanWebScraper, with a new output directory:

```powershell
node lib/game-db/game-db-treasure-exchanges-run.js `
  --input .agent-logs/treasure-login-probe-current-result/public-offers.json `
  --source-dir game-db/data/first-party-complete-source/1788329250-awakening-routes-v1 `
  --source-db-sha 7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495 `
  --source-snapshot 1788329250 `
  --asset-base-url https://assets.dkbcompanion.com/staging/v2/game-assets `
  --output game-db/data/treasure-exchanges-NOVA-EXECUCAO
```

No output directory is overwritten. Generated files: `treasure-exchanges.json.gz`,
`treasure-exchanges-manifest.json`, `coverage.json`. The current candidate is
`game-db/data/treasure-exchanges-20260911-v1`, dataset
`1788329250-ca7205f30423a68a`: 7,123 compressed bytes, 91,065 expanded bytes,
compressed SHA-256 `365c36b90f1cff506d8c4e866bab5602fec01391bf5608b84a3fe4f222faf18d`.

The Android staging asset copy is for local verification before remote publication.
Its compressed payload is named `exchanges/treasure-exchanges.payload`: Android's
asset packager transparently expands `.gz` files and removes that suffix, so a
neutral extension preserves the exact manifest-verified compressed bytes.
It contains no authentication material. Production is disabled. No publisher is
introduced by this slice; remote publication still requires dry-run/byte planning
and the user's separate approval.

## Verification

Ten focused producer tests cover deterministic bytes/manifests, mixed bundles,
scope exclusions, exact reward IDs, private-field rejection, sale rejection,
unknown joins/types, duplicate IDs, invalid dates/quantities and provenance/URLs.
The three new TypeScript files pass an isolated TypeScript compile. Only their
six compiled JS/map files are copied into tracked `lib/`.

Android must compare the exchange snapshot/hash directly with the awakening graph
before including predecessor cards. Stage readiness must not gate exchanges. Keep
a verified cache/bundle available if a remote response is missing or invalid.

Consumer verification completed locally: 9 domain contract tests, 4 presentation
tests and staging APK build pass. The final APK preserves the exact 7,123-byte
compressed payload/hash. LDPlayer checks cover Vegito's predecessor offers,
Gogeta's complete mixed bundles, navigation return and narrow/large-font layouts.
No publication was performed. Sixteen currency artworks currently return 404 on
the staging asset origin; Android uses a neutral fallback with readable name/price.

Follow-up: artwork for all 331 Global treasures is now published to staging
(303 unique PNGs, including all 31 exchange currencies). The image-only update
uploaded 256 new objects and reused 47 identical ones; the exchange dataset itself
remains unpublished. See [treasure artwork acquisition](treasure-art-acquisition.md).
