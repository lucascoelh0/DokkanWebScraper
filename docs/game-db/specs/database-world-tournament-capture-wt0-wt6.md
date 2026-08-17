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
| WT6 | `wt6-readiness.json` | 13,106 | `cf875977b7333569a9256a88416b0ee604cd221ace17164833c0c51a705d5a56` |

WT6 pins 18 WT0-WT5 payload/manifest/validation members with aggregate SHA-256
`0ed76199d05bf27bf90ef89c8aa474c09e6ea2d894060b577409b179fe9117df`.
Two complete external generations of all 21 WT0-WT6 files were byte-identical;
their aggregate SHA-256 was
`340e9fb02a48a5becf92383c09346b501c0e2439be50d052c39d741765b69eec`.

## Security and resource evidence

The offline scanner collected 19,572 captured scalar observations in memory:
1,807 headers, 0 cookies, 317 URL path segments, 672 query names/values, 0 URL
credentials, 16 request-body leaves and 16,760 response-body leaves. Every JSON
leaf is retained in memory with request/response origin, sanitized endpoint,
method, structural category, exact JSON path, JSON type and canonical value.
It examined 3,708 targets and 3,462 unique blobs: all 3,335 files in the
reviewed tip plus 127 old and 246 new historical targets across the
twelve-commit candidate range. The complete matcher classified 6,097 matches: 6,059
`permitted_protocol_structure`, 38
`permitted_public_game_structure`, 0 `prohibited_sensitive` and 0 `unresolved`.
The public-game total is 35 exact global `/ping` host coordinates plus three
exact `POST /auth/sign_in` `$.bundle_id` coordinates. The three mutation-body
matches are therefore public first-party identity, while effectively sensitive
account-scoped payload matches and opaque credential matches are both zero.
Of the 20 matches above the formerly reported 6,077, 16 are long query names
that the corrected exact structural matcher finds at delimiter boundaries and
four are permitted protocol-header constants in the changed documentation
lineage. The derived result was retained rather than forced to the earlier estimate. There
are zero captured/raw HAR targets. Two
historical targets are structurally HAR-shaped copies of the former wholly
synthetic fixture. They are accepted only by two exact, category-bound structural
fingerprints; any missing, additional or tip HAR-shaped target fails closed.
Neither matches captured values, and no HAR-shaped file is present in the
corrected tip. Specs, fixtures, `lib/`, arbitrary extensions and
deleted historical blobs receive no exclusion.
The source lock, diagnostics and generated artifacts remain ignored.

Compact strings of at least 16 bytes and numeric scalars of at least 8 bytes
receive literal byte matching across every blob, independent of source and
target context. This covers hexadecimal, UUID with or without hyphens, base32,
base64, base64url, long decimal identifiers and single-class alphabetic or
alphanumeric strings without requiring character-class diversity. Token
boundaries prevent a compact long source value from matching only as a
substring of an unrelated larger token.
Short values use structural context: complete JSON shape plus exact path/type,
normalized header name, cookie name, absolute URL component, query name and
value, or exact non-JSON text. `json_body`, `text_body` and raw `text_exact`
remain distinct; explicit non-JSON MIME wins even when its bytes parse as JSON.
Raw text retains whitespace, newlines and bodies beyond 4 KiB exactly, while
empty text is ignored symmetrically. Static JSON-like literals in
TypeScript/JavaScript receive the JSON projection; explicit textual/raw names,
constant bindings and static templates receive the textual projection. When a target carries
an explicit capture envelope, origin, method and sanitized endpoint also bind
body, header, cookie, URL and query matching. Public route components remain
catalogued and can be classified only through exact static-route structure;
credential/account coordinates retain higher prohibited precedence. The scanner
rejects blobs above 16 MiB, empty catalogs/targets, malformed
expected JSON/URL structures, unreadable blobs and captured categories without
an implemented matcher.

Forty observations removed by the previous correction were empty bodies with
the `application/` + `octet-stream` media type. They contain no scalar value and remain
ignored symmetrically for request and response; this is an explicit empty-body
rule, not a missing matcher.

The field-scoped rule `public_first_party_app_bundle_identity_v1` is supported
independently by the pinned first-party APK (98,799,013 bytes, SHA-256
`a51ba758e0555e0a756aa4f20278e6bec25ba6b0c7dcdcd0f4372e0fad159bc0`).
The pinned 1,646,688-byte Android Asset Packaging Tool
`v0.2-12874835` has executable SHA-256
`3a79b1b3f6e68d83a0eb5fe82bd557f51c6c02f07355ee0ad293c5ea43e32427`.
The runner validates each external source root, opens the APK and tool once,
records their realpath, file type, device/inode where available, link count,
size, mode and timestamps, and streams each still-open handle into an
exclusive directory below the ignored runner-controlled root. Destination
files are create-only, incrementally hashed, fsynced with their directory when
supported, required to be regular non-reparse single-link material and made
read-only when supported. The external pathnames are never reopened for the
copy.

Only `privateSnapshot/aapt.exe` is launched, with no shell, an isolated working
directory and environment, fixed productive arguments, bounded output and
timeouts; only `privateSnapshot/source.apk` is passed to `dump badging`.
Snapshot containment, material identity, stable timestamps, size and SHA-256
are validated before and after both executions. Evidence schema 2 binds the
private material contract and lineage SHA-256
`de08a35c3410de426b9fce344e894623d0c5d1ab9ec45c7e3c686e41772adc72`,
not either external pathname. Normal cleanup removes only the exact owned
members and directory. Unexpected members are quarantined only while the
operation-directory identity is still proved; an identity substitution makes
cleanup refuse the unknown pathname.

This guarantees that concurrent replacement or A-B-A restoration of either
external pathname cannot cause B to be copied, inspected or executed; source
identity changes instead fail closed. It rejects symlink, junction/reparse and
unexpected hard-link material, detects snapshot changes before or after
execution, and prevents ordinary path mistakes or external races from
selecting bytes other than the pinned snapshots. It does not claim protection
against a malicious process running as the same OS identity that discovers and
mutates the private namespace, including an internal A-B-A; a compromised
kernel/filesystem; or alteration of an executable already loaded by the OS.
Only the extracted identity's size (32 bytes) and SHA-256
`74d2f87b503e9ff38f27298af6942a1a1898d1aef543b6c85720205e92cd0888`
are persisted. The clear identity and the HAR observation were compared only
in memory. The rule requires exact method, route, JSON path, string type, value
and evidence provenance; token/sign/cookie/authentication coordinates take
precedence as prohibited, and every other auth/mutation field remains
fail-closed.

Observed process-tree working-set peaks were:

| Gate | Peak bytes |
| --- | ---: |
| WT0 | 84,836,352 |
| WT1 | 49,209,344 |
| WT2 | 49,414,144 |
| WT3 | 51,400,704 |
| WT4 | 39,075,840 |
| WT5 | 518,160,384 |
| WT6 | 595,144,704 |

Every peak is below the strict 1 GiB limit. The final WT6 repeat measured
595,144,704 bytes. The evidence is bound to the HAR identity, the aggregate of
the 18 upstream artifacts and the aggregate of the 26 executable implementation
files used by the campaign, including the identity verifier
`51fbbb10544bfce93051399fdec642dc5bd0c2be66289651f92ac5cd49562391`).

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
- Complete scanner coverage: the ninth corrective commit cataloguing every JSON
  scalar leaf and enforcing literal/contextual matchers
- Long/text boundary correction: the tenth corrective commit removes the
  character-class requirement for compact long literals, separates JSON,
  textual and raw projections, and enforces the 16 MiB fail-closed blob bound
- First-party field classification: the eleventh corrective commit binds the
  exact auth bundle coordinate to independently pinned APK evidence, preserves
  credential precedence and reports every permitted/prohibited/unresolved class
- Private proof snapshot: the twelfth corrective commit removes the APK/aapt
  pathname TOCTOU boundary, binds evidence to exclusive private snapshots and
  documents cleanup ownership and the exact threat model
