# Offline treasure catalog

`game-db/game-db-treasure-catalog.ts` projects official treasure descriptions and
exact-ID acquisition references. This is an optional catalog, not an extension of
the card-only exchange payload. Contract: `dokkan-treasure-catalog` version `1.1.0`.

## Reproduce a local candidate

Requires Node 24+ with built-in SQLite. The database is opened read-only; the
provided SHA-256 is verified before querying. No account, token or network is used.
Output must be a new directory; existing candidates are not overwritten.

```powershell
node lib/game-db/game-db-treasure-catalog-run.js `
  game-db/data/wp01-wallpaper-source-1788329250/database.decrypted.sqlite `
  1788329250 `
  7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495 `
  .agent-logs/treasure-candidate
```

The candidate contains `manifest.json` and gzip bytes named `catalog.payload`
(the extension preserves compressed bytes through Android asset packaging).
The manifest binds snapshot, source database hash, content-derived version,
compressed hash and both sizes. Android rejects mismatches and oversized input.
Its current staging bundle is local only, under `app/src/staging/assets/treasure-catalog`.
No R2 object, endpoint, refresh manager or production asset is added by this slice.

## Coverage and semantics

Snapshot 1788329250 produces 331 descriptions, 3,804 sources covering
82 treasures, 84,804 compressed bytes and 1,484,101 expanded bytes.

- Normal mission rewards include general missions without area ownership.
- Boss definitions and displayed quest drops merge by exact treasure/map ID.
- Drop quantity and probability remain unknown, never estimated.
- Mission quantities and known UTC intervals are retained; the open-ended 2038
  sentinel is omitted. Dates use the device zone for presentation.
- Sources are historical references, not proof of current availability.
- Missing sources mean incomplete coverage, not impossibility of acquisition.
- Navigation requires a matching stage snapshot and a real destination; general
  missions have no fabricated event link.

## Special modes (1.1.0)

The dedicated `game-db-treasure-mode-sources.ts` adapter adds 143 World Tournament
mission rewards, 180 local-ranking rewards, 78 overall-ranking rewards and 323
Ultimate Clash mission rewards. Mode records keep exact reward, mission and edition
identities, quantity and requirement text. Local ranges are validated; overall
ranking uses the official range label. No mode record is a quest navigation target.

World Tournament dates come from the joined `budokais` edition, not row timestamps
or reward collection deadlines. Mission 99035 joins edition ID 99 which is absent;
its edition name and interval remain unknown. Ranking records require complete
edition/range joins. Clash mission rows resolve, but the snapshot contains no
`rmbattles` calendar; no dates or display edition numbers are inferred from IDs.

Android accepts both 1.0.0 and 1.1.0, requires matching manifest/payload versions,
and validates mode/type-specific fields. Clash repeats with identical requirement
and quantity share a visual row; distinct quantities remain separate, never summed.

## Treasure trades (1.2.0)

The CLI accepts an optional fifth argument pointing to the sanitized public shop
projection (never a HAR). `game-db-treasure-trade-sources.ts` adds `trades` with
the independent shop `capturedAt` and six single-treasure offers. Each records the
exact offer/currency/reward IDs, cost, received quantity and known interval.
Unknown joins, self trades, duplicate IDs, ambiguous discounts and multi-reward
treasure bundles fail closed. Ordinary non-treasure offers remain outside this
adapter; the card-only exchange contract is unchanged. No current availability,
account eligibility, purchase-limit or unlimited-stock claim is emitted.

Candidate reproduction: append
`.agent-logs/treasure-login-probe-current-result/public-offers.json` after a new
output directory in the command above. Without this argument, `trades` is null.
The staging candidate is 85,021 compressed / 1,485,025 expanded bytes. It preserves
all 3,804 mission/drop/mode sources and adds six trade offers for six treasures.
Android accepts 1.0.0, 1.1.0 and 1.2.0. Login, gifts and paid packs remain outside
this slice. No account request or remote publication is performed.

Trade tests: `node node_modules/mocha/bin/mocha --no-config lib/game-db/game-db-treasure-trade-sources.spec.js`.

Focused producer tests: `node node_modules/mocha/bin/mocha --no-config lib/game-db/game-db-treasure-catalog.spec.js`.
Mode tests: `node node_modules/mocha/bin/mocha --no-config lib/game-db/game-db-treasure-mode-sources.spec.js`.
