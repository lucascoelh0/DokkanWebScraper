# World Tournament Capture Audit WT0-WT6

## Scope and source

This campaign processed `world_tournament_until_start_crash.har` locally and
offline from an external path. The raw HAR remains untracked. Its pinned
identity is 7,087,930 bytes, SHA-256
`70ce81581e9237fb1b9a8da7dd0db1c24dd397dc329cc57cca468705265d66cd`,
with 106 entries. The ignored external source lock contains only that identity,
the source ID and entry count.

The campaign ancestry is pinned to
`3222f2eeede2b70bafbf1b6c00f2c6a521b74485`. The capture execution itself did
not perform repository integration. No request was replayed, no external
game/API request was made, and Android, R2, publishers and production were not
touched.

## Gate results

- WT0 retained a sanitized inventory, 13 route/method surfaces, structural IDs,
  schema shapes and seven exact URL/validator 200-to-304 relations. It discarded
  headers, tokens, query values, raw bodies, sign values and personal scalars.
- WT1 made route schemas lossless by type occurrence and entry index. POST
  `/budokais/{id}/tournaments` remains observed structure only.
- WT2 separated the observed Budokai identity/presentation/lifecycle, the four
  lifecycle coordinates, account-scoped entry/status, map identities and rank definitions.
  Global event status remains unknown.
- WT3 separated general ranking/pagination/`updated_at`, borders/`my_ranking`,
  friends, box ranking and bonus schedule identities. Ranking values and people are
  schema-only. No reward grant or claim was observed.
- WT4 retained briefing, supporter/deck, teaming-power, advantageous-card and
  mission schemas. The mission identity stays an account-scoped partial relation. The
  start response is an opaque `sign` envelope: HTTP 200 and ordering are proved;
  decoding, replay, internal semantics and crash causality are not.
- WT5 joined only numeric structural coordinates against pinned E0-E9,
  H0-H13, S0-S7 and a private read-only SQLite snapshot. The result is one
  identity agreement, four coverage gaps, one unknown and seven unjoinable
  cells. The observed event, mission and box-ranking identities are absent from
  the older database/E/S roots. That absence is not a conflict.
  Mission, box and map joins require both child ID and Budokai ID. Reward
  definitions remain distinct from grants.
- WT6 records readiness, refresh policy, security scan, memory and deterministic
  generation. The campaign stops at WT6.

## Artifact identities

Generated artifacts under `data/database-world-tournament-captures/` are
ignored. The matching TypeScript contracts and compiled `lib/` output are
tracked.

| Gate | Primary artifact | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| WT0 | `wt0-inventory.json` | 100,953 | `2734c77882aae345e4608fe20e1cc7fac620ede50d7ca3a5546a844190fadb1b` |
| WT1 | `wt1-route-catalog.json` | 138,484 | `0658d39e12fee5490393cc4320cf207df998406082d889f4828e0c25fe05cf2d` |
| WT2 | `wt2-event-entry-ranks.json` | 11,676 | `87742378720b05ac60fb43ebc4da9e36e764126dbc66e1014092bcd37e3c0539` |
| WT3 | `wt3-rankings-box-schedules.json` | 40,529 | `cb438a3f166873d285a79fbe0ca626763c49cf872c89b1e03bb19d6ee087b840` |
| WT4 | `wt4-briefing-missions-start.json` | 21,308 | `b5d8a7999ad2352e84090511b5e57c605a7c132d355cf35d05a540ead722ebff` |
| WT5 | `wt5-shadow-parity.json` | 14,043 | `9723fb520cc68a37a3ee75e07e9e277da9b1952b5e93df208e287c365ce0e0f1` |
| WT6 | `wt6-readiness.json` | 10,600 | `8af37202cb78a9d406853e31b09ed2ce581fde0b5aa5527c9a69eafaf338e785` |

WT6 pins 18 WT0-WT5 payload/manifest/validation members with aggregate SHA-256
`0ed76199d05bf27bf90ef89c8aa474c09e6ea2d894060b577409b179fe9117df`.
Two complete external generations of all 21 WT0-WT6 files were byte-identical;
their aggregate SHA-256 was
`4463b3343e57413c6d6f5e1880adbedbc5920f4f67d928e58b0bd97aa4fc3d88`.

## Security and resource evidence

The offline scanner collected 3,361 sensitive captured values in memory across
headers, cookies, query values, URL credentials and request/response bodies. It
examined 3,560 targets and 3,388 unique blobs: every one of the 3,329 files in
the reviewed tip plus the old/new blobs of every changed path in the eight-commit
range. It found zero sensitive matches and zero captured/raw HAR targets. Two
historical targets are structurally HAR-shaped copies of the former wholly
synthetic fixture. They are accepted only by two exact, category-bound structural
fingerprints; any missing, additional or tip HAR-shaped target fails closed.
Neither matches captured values, and no HAR-shaped file is present in the
corrected tip. Specs, fixtures, `lib/`, arbitrary extensions and
deleted historical blobs receive no exclusion.
The source lock, diagnostics and generated artifacts remain ignored.

Observed process-tree working-set peaks were:

| Gate | Peak bytes |
| --- | ---: |
| WT0 | 84,836,352 |
| WT1 | 49,209,344 |
| WT2 | 49,414,144 |
| WT3 | 51,400,704 |
| WT4 | 39,075,840 |
| WT5 | 518,160,384 |
| WT6 | 589,512,704 |

Every peak is below the strict 1 GiB limit. The final WT6 repeat measured
589,512,704 bytes. The evidence is bound to the HAR identity, the aggregate of
the 18 upstream artifacts and the aggregate of the 25 executable implementation
files used by the campaign.

## Readiness

GO is limited to reviewed additive offline/default-off TypeScript infrastructure
and completely synthetic local fixtures.

NO-GO remains explicit for request replay, authenticated automation, missing
finish/battle results, sign decoding or reproduction, Android, R2, publisher,
production and replacement of current sources.

A future refresh is manual and offline: provide an absolute external
`--source-root` plus a strict `--source-relative-path`, create a new ignored
source lock, run WT0-WT6 serially, repeat the full-tip/historical-blob scan and
contract review, and require byte-identical double generation plus a sub-1-GiB
peak. No additional HAR is required for this campaign.

## Risks and integration recommendation

This is one bounded account capture, not sustainable availability authority.
The static database checkpoint predates the observed event. Runtime map parenting,
rank/ranking semantics, global event status, finish/result payloads and internal
`sign` meaning remain partial, unknown, opaque or unjoinable. Account-scoped
schemas must never become global facts, and numeric namespaces must remain
isolated.

Integration is GO only for the reviewed, optional, default-off offline
infrastructure and completely synthetic fixtures. This does not authorize a
consumer or any network, publication or production operation. Preserve the gate
commits during review, do not replace existing sources, and require a separate
explicit decision for every excluded scope.

## Commits

- WT0: `42e2f99`
- WT1: `3a1fdfa`
- WT2: `aedd9cf`
- WT3: `18194f6`
- WT4: `85c594e`
- WT5: `6b3bcdb`
- WT6: `d1516f1`
- Corrective hardening: the eighth commit containing the scanner, containment,
  synthetic-fixture and post-integration readiness corrections
