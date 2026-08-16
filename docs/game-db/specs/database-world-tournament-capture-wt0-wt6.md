# World Tournament Capture Audit WT0-WT6

## Scope and source

This campaign processed `world_tournament_until_start_crash.har` locally and
offline from an external path. The raw HAR remains untracked. Its pinned
identity is 7,087,930 bytes, SHA-256
`70ce81581e9237fb1b9a8da7dd0db1c24dd397dc329cc57cca468705265d66cd`,
with 106 entries. The ignored external source lock contains only that identity,
the source ID and entry count.

The branch started at exact `main`/`origin/main`
`3222f2eeede2b70bafbf1b6c00f2c6a521b74485` and is isolated as
`codex/database-world-tournament-capture-audit`. No request was replayed, no
external game/API request was made, and Android, R2, publishers and production
were not touched.

## Gate results

- WT0 retained a sanitized inventory, 13 route/method surfaces, structural IDs,
  schema shapes and seven exact URL/validator 200-to-304 relations. It discarded
  headers, tokens, query values, raw bodies, sign values and personal scalars.
- WT1 made route schemas lossless by type occurrence and entry index. POST
  `/budokais/{id}/tournaments` remains observed structure only.
- WT2 separated Budokai 63 identity/presentation/lifecycle, the four lifecycle
  coordinates, account-scoped entry/status, maps 631-634 and rank definitions.
  Global event status remains unknown.
- WT3 separated general ranking/pagination/`updated_at`, borders/`my_ranking`,
  friends, box ranking 631 and bonus schedule 5. Ranking values and people are
  schema-only. No reward grant or claim was observed.
- WT4 retained briefing, supporter/deck, teaming-power, advantageous-card and
  mission schemas. Mission 63001 stays an account-scoped partial relation. The
  start response is an opaque `sign` envelope: HTTP 200 and ordering are proved;
  decoding, replay, internal semantics and crash causality are not.
- WT5 joined only numeric structural coordinates against pinned E0-E9,
  H0-H13, S0-S7 and a private read-only SQLite snapshot. The result is one
  identity agreement (bonus schedule 5), four coverage gaps, one unknown and
  seven unjoinable cells. Budokai 63, mission 63001 and box ranking 631 are
  absent from the older database/E/S roots. That absence is not a conflict.
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
| WT5 | `wt5-shadow-parity.json` | 14,048 | `e92bf96337a58d2bb3cef0629e7d9a04b594320c9f465862d9174a90a4778c58` |
| WT6 | `wt6-readiness.json` | 9,706 | `c0bc768062707b4895b68785a4f19450e1027c295c9a036565856729b22a3401` |

WT6 pins 18 WT0-WT5 payload/manifest/validation members with aggregate SHA-256
`6b9b1e9faf83c11e73e921b324f54262a01b10d4c41e0bb36efdaadbe5bfa5b2`.
Two complete external generations of all 21 WT0-WT6 files were byte-identical;
their aggregate SHA-256 was
`7893b29943b8442800a91df724f66637cfce162ed22a286595075b494ee7aa48`.

## Security and resource evidence

The offline scanner collected 1,289 sensitive captured values in memory from
all HAR routes. Across 71 unique sanitized/versioned and generated scan inputs
it found zero exact captured value matches and zero generic token/JWT matches.
No `.har` file is tracked.
The source lock, diagnostics and generated artifacts remain ignored.

Observed process-tree working-set peaks were:

| Gate | Peak bytes |
| --- | ---: |
| WT0 | 105,861,120 |
| WT1 | 63,803,392 |
| WT2 | 48,201,728 |
| WT3 | 49,168,384 |
| WT4 | 49,483,776 |
| WT5 | 525,422,592 |
| WT6 | 589,828,096 |

Every peak is below the strict 1 GiB limit. The final WT6 repeat measured
589,828,096 bytes. The evidence is bound to the HAR identity, the aggregate of
the 18 upstream artifacts and the aggregate of the 23 executable implementation
files used by the campaign.

## Readiness

GO is limited to additive offline/default-off TypeScript infrastructure and
sanitized local fixtures.

NO-GO remains explicit for request replay, authenticated automation, missing
finish/battle results, sign decoding or reproduction, Android, R2, publisher,
production and replacement of current sources.

A future refresh is manual and offline: keep a new HAR outside the repository,
create a new ignored source lock, run WT0-WT6 serially, repeat the captured-value
scan and contract review, and require byte-identical double generation plus a
sub-1-GiB peak. No additional HAR is required for this campaign.

## Risks and integration recommendation

This is one bounded account capture, not sustainable availability authority.
The static database checkpoint is older than Budokai 63. Runtime map parenting,
rank/ranking semantics, global event status, finish/result payloads and internal
`sign` meaning remain partial, unknown, opaque or unjoinable. Account-scoped
schemas must never become global facts, and numeric namespaces must remain
isolated.

Integration is recommended only as reviewed, optional, default-off offline
infrastructure. Preserve the seven gate commits during review, do not replace
existing sources, and require a separate explicit decision for any consumer,
network, publication or production work. This campaign performs no merge to
`main`.

## Commits

- WT0: `42e2f99`
- WT1: `3a1fdfa`
- WT2: `aedd9cf`
- WT3: `18194f6`
- WT4: `85c594e`
- WT5: `6b3bcdb`
- WT6: the commit containing this report
