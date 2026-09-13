# Offline campaign preparation

Status: local experiment only. Not imported by authentication, collection,
scheduled refresh, candidate preparation or Android. No campaign is delivered.

## Structural projector

`project-campaigns.mjs` accepts an already-received body, HTTP 200 and the exact
mission-board endpoint, canonical observation/current instants, and an explicit
`unix-seconds` unit. It performs no I/O. Input is capped at 1 MiB, 100 campaigns,
100 boards per campaign, 1,000 boards total and nine-digit positive IDs.

The result remains `publicationAllowed: false`, with partial/unknown inventory
and no eligibility authority. It includes only structural references and bounded
time metadata. It discards all names, images, messages, personal progress and
top-level mission wrappers. Source bytes are represented only by a diagnostic
SHA-256, not persisted or published.

Freshness expires exclusively at six hours. Unknown or future-at-observation
starts produce neither a window nor a visible deadline. Missing bounds remain
unknown. Hidden/unknown end flags, sentinel ends at or beyond 2038, and ends over
366 days away produce no visible deadline. These are conservative offline
policies, not a claim that every source sentinel has been catalogued.

## Read-only definition audit

`audit-campaign-definitions.py` accepts a structural board list through stdin
(64 KiB maximum) and an explicit existing SQLite path. It opens with `mode=ro`
and `query_only`, caps the database at 256 MiB, bounds board count to 1,000 and
uses parameterized lookups with a query-time budget. Only aggregate counts leave
the tool. CLI failures have a fixed message without private values or paths.

An aligned board requires all of:

1. Its category exists exactly once in `mission_categories`.
2. Its completion mission exists exactly once and belongs to that category.
3. Its display reward exists exactly once and belongs to that completion mission.

Existence of unrelated IDs is insufficient. Shared category mission/reward
counts are deduplicated by category; they are definition counts, not obtainable
or outstanding rewards. Neither tool reads or interprets account progress.

## Historical evidence

The user-provided 2026-09-11 capture contains one successful campaign observation
at `2026-09-11T17:20:14.610Z`: 6 campaigns, 17 boards and integer Unix-second
windows. Four campaign ends are hidden. A historical replay at the capture
instant produced 6/17, four hidden and two visible deadlines, without source
names/images/progress fields. It was not replayed as a current observation.

Against the existing local Global SQLite snapshot `1788329250`:

- All 17 category references resolve.
- All 23 campaign/board completion references resolve to missions.
- All 17 board completion missions belong to the referenced category.
- All 17 display rewards belong to the corresponding board completion mission.
- The 17 distinct categories contain 159 mission definitions and 502 reward rows.

The reusable audit independently confirmed 17 aligned boards. The database has
mission/category/reward definitions but no mission-board campaign tables. The
response has titles for all six campaigns; titles are still excluded from the
structural projector until a separately reviewed presentation conversion exists.
Old community snapshots are not needed to establish these structural joins.

An in-memory size experiment for the 159 missions (names, descriptions, raw
definition periods and 502 reward references) yielded 109,459 JSON bytes,
11,709 bytes gzip. This is not a delivery schema, current eligibility claim,
or upload plan; no resulting file was persisted. Expanded data already exceeds
the Home client's 65,536-byte limit. Keep the future Home summary small and
resolve campaign details on demand through a separately pinned catalog/shard,
rather than increasing the Home limit or embedding every mission in its feed.

Local evidence helpers remain ignored: `home-campaign-capture-audit.py` and
`home-campaign-project-historical.mjs` in the integration worktree's `.agent-logs`.
The HAR is not copied, committed or uploaded. No new game request was made.

## Checks and next gate

Run from `home-feed`:

```text
node --test project-campaigns.test.mjs
python -B audit-campaign-definitions.test.py
```

15 projector tests and 9 read-only audit/CLI tests passed. The independent
contract review found a future-start deadline issue; it was fixed with regression
tests, and re-review reported no remaining material issue in this scope.
Python audit tests are a separate local suite, not part of the hosted Node job.
Final isolated Node suite including existing feed behavior: 112 passed, zero
failures. Nine Python audit tests passed separately. The change remains local,
uncommitted and undeployed; the existing scheduled Home verification is unchanged.

## Offline presentation preview follow-up

`export-campaign-definitions.py` now exports explicitly selected static categories,
missions and rewards from an existing read-only SQLite snapshot. An independently
selected SHA-256 is checked before and after the export; WAL/journal sidecars are
rejected. Queries, input/output sizes and counts are bounded. Only whitelisted
public definition fields leave the exporter: no progress, account state, media,
or naive database dates. Names become single-line text; descriptions retain
legitimate line breaks. CLI errors remain fixed and redact source values.

`prepare-campaign-preview.mjs` joins that independently pinned definition file
to the structural observation. It checks board/category/completion/reward
ownership and produces inert plain text, never executable routes or HTML.
Campaign-title line breaks normalize to spaces; descriptions retain LF/tab.
Other control characters, bidi controls and invalid surrogates are rejected.
The original source hashes still identify the input bytes, not normalized text.
Campaign titles are first-party metadata bound by `observationSha256`, not
SQLite-derived fields; the local database does not contain campaign tables.

Historical integration at the capture instant passed: 6 campaigns, 17 boards,
159 missions, 502 reward rows; preview size 103,936 bytes. Static definitions
alone are 99,599 bytes, SHA-256
`f706f33cbd44c90e8ea011191c2b2a97356f4163d61f89757b0411ce1925eb6f`;
database SHA-256 is
`7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495`.
Generated artifacts remain ignored local files. The preview explicitly says
`offline-experiment` and `publicationAllowed: false`; counts do not imply active
campaigns, player eligibility, obtainable totals or rewards remaining.

Focused checks: 11 exporter and 14 preview tests pass. Final isolated Node suite
now passes 126 tests. The 9 audit tests are unchanged. No Android source, hosted
collector, credentials, publication path or production object changed.
Independent review of the exporter/preview found no remaining material issue.

Delivery follow-up: `prepare-campaign-delivery.mjs` now packs a compact index
and independently hashed per-campaign details, with typed campaign destinations.
Historical measurement: 2,529-byte index and 110,409 bytes total. Nine focused
tests and independent review passed. Contract and remaining consumer gates:
`CAMPAIGN-DELIVERY.md`. These are offline preview artifacts, not public schemas
or implemented Android navigation. Final isolated Node suite: 135 passed.

Next: consumer validation/cache and fresh-collection/public-contract design,
then native UI. Do not add a new API scope,
assume the historical response is current, sum rewards as remaining, or promote
these internal objects directly to a public feed. Production stays out of scope.
