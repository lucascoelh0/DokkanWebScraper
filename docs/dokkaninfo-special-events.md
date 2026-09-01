# DokkanInfo special event catalogs

Dokkan Frontier, Burst Mode and Ultimate Clash do not share the ordinary quest
event contract. Each collector preserves the structure actually exposed by
DokkanInfo and avoids joining fields through localized names.

## Dokkan Frontier

The Frontier catalog retains the full navigation chain:

`series → episode → page → battle → enemies`

Each battle includes its display number, title, STA, user EXP, Zeni, link-level
rate, display-enemy portrait, clear reward, bonus-passive card references and
ordered enemy data. Enemy HP/ATK/DEF, damage reduction, Super Attack and skill
rows reuse the same lossless DokkanInfo enemy contract used by quest events.
The intermediate `pageId` is retained because it is a real part of Frontier's
route and must not be inferred from the battle title.

## Burst Mode

The index supplies edition, area, Sugoroku map, schedule and availability IDs.
The detail page supplies the human-readable modifier options and points.

DokkanInfo does not expose modifier or group IDs in the rendered detail HTML.
The collector therefore records `groupIndex` and `optionIndex` in source order,
plus the label, points and whether DokkanInfo printed `[Selection]`. These are
positional presentation records, not invented first-party identities. No
scoring formula, precedence or gameplay effect is inferred from the text.

## Ultimate Clash

Each edition retains its schedule, card-count limit, announcement reference,
banner provenance, levels, ordered enemies and native missions. Enemy records
include:

- card/icon identity and raw element;
- health bars, HP, ATK, DEF and damage reduction;
- every labelled Super Attack stat line in source order;
- ordered mechanic/gimmick text, values and icon references;
- visual reward references and quantities.

The left-hand display cell alternates between numbered images and a Boss image.
Its `alt` value is not a reliable sequence number: historical pages contain
Boss labels with raw values such as `5` and `7`. The dataset uses DOM order as
`sequence` and retains the image separately as `displayLabelKind`,
`displayLabelRaw` and `displayLabelImagePath`.

Missions keep exact mission IDs, native types, target values, parsed conditions
and normalized reward identities. Large duplicated item/card payloads embedded
by the page are intentionally not copied into every reward.

## Refresh and output

From the repository root:

```powershell
npm run run:dokkaninfo-frontier
npm run run:fyi-frontier
npm run run:dokkanstats-frontier
npm run run:dokkan-frontier-catalog
npm run run:dokkaninfo-burst-mode
npm run run:dokkaninfo-ultimate-clash
```

Ignored local outputs are written to:

- `data/dokkaninfo-frontier/latest/frontier.json`
- `data/dokkaninfo-burst-mode/latest/burst-mode.json`
- `data/dokkaninfo-ultimate-clash/latest/ultimate-clash.json`
- `data/dokkan-frontier-catalog/latest/frontier.json`
- `data/dokkan-frontier-catalog/latest/frontier-manifest.json`
- `data/dokkanstats-frontier/latest/frontier.json`

`run:dokkan-frontier-catalog` consumes the latest Frontier outputs and
builds the Android delivery contract. Run all three source collectors first when a
fresh remote snapshot is required. The merge requires exact battle-ID parity
between DokkanInfo and Dokkan.fyi and exact enemy-card joins. DokkanInfo remains
authoritative for node titles, encounter portraits and types, runtime stats,
Super Attacks, rewards and bonus-passive cards. Dokkan.fyi adds series/map
topology, map backgrounds, unlock conditions, required characters, intensity,
enemy mechanic descriptions and missions. A missing or duplicate join fails
the build instead of silently producing a partial catalog.

DokkanStats supplies an authorized, additive English enrichment for card-skin
mission rewards. Its card-skin index is cached locally and joined only when the
DokkanStats item ID, card ID and step all match the Dokkan.fyi reward. The raw
Dokkan.fyi label remains in the source snapshot; only the Android delivery
label is replaced with the English card title/name and explicit skin step. A
missing or conflicting skin fails closed. DokkanStats mission-category pages
are retained as independent evidence with reward IDs, quantities, images and
displayed dates; they are not joined to individual FYI missions because the
rendered pages do not expose mission IDs.

The generated manifest records the payload byte size and SHA-256. Its version
is derived from the canonical payload, so unchanged source data keeps the same
version. These delivery files are generated artifacts and are not committed.

Each collector caches mapped responses for 168 hours. The environment prefixes
are `DOKKANINFO_FRONTIER`, `DOKKANINFO_BURST_MODE` and
`DOKKANINFO_ULTIMATE_CLASH`; append `_REFRESH`, `_CONCURRENCY`, `_DELAY_MS` or
`_CACHE_TTL_HOURS` to control a refresh.

The collectors validate advertised pagination totals and record detail failures
explicitly. They do not download referenced images, modify Android, publish to
R2 or promote any production dataset.

DokkanStats responses use a 168-hour mapped-response cache. Set
`DOKKANSTATS_FRONTIER_REFRESH=1` to refresh, and optionally configure
`DOKKANSTATS_FRONTIER_DELAY_MS` or `DOKKANSTATS_FRONTIER_CACHE_TTL_HOURS`.
The default collector is sequential and waits 500 ms between mission-category
requests.
