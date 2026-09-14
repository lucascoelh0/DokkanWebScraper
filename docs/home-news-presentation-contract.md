# Home News presentation enrichment — 2026-09-14

Implementation only; not yet committed or published.

The user-approved Android brief is `docs/features/home-news-events-redesign.md`
in the active Android worktree `C:/Users/Lucas/.codex/worktrees/94f3/Dokkanpanion`.

## Category and tab are different fields

The supplied first-party `announcements.json` contains `announcement_tabs` with
1 Campaign, 2 Event and 3 Other. Article rows carry `announcement_tab_id`
independently from `category`. For example a summon announcement can belong to
the Campaign tab. Neither identity is derived from a localized title.

The producer now optionally emits `tabId` from the observed positive integer
`announcement_tab_id`. Missing/null input omits the field; malformed values fail
the bounded news observation. The Android consumer accepts absence for old
cached payloads and does not reinterpret `category` as a tab. Unknown tab IDs
remain unclassified in presentation.

The schema stays at version 1: this is an optional additive field. Collection,
freshness, six-item presentation limit, authentication scopes, media limits and
publication permissions are unchanged. A directory represents the current
partial snapshot, not a complete global announcements archive.

## Native article rendering

Article descriptions remain bounded strings under `paragraphs`, including game
presentation tokens. The Android presentation layer interprets supported text
formatting and dates natively, without HTML execution or new network endpoints.
Old cached strings therefore benefit from the rendering fix without recapture.

## Events

Home now selects the exact API-derived stage catalog `eventImagePath` used by
the Event detail screen, after the existing catalog-content hash and typed target
checks. The `/events` artwork remains in the wire contract for old clients, but
the new Home does not substitute it for missing illustrated catalog artwork.
No asset URL is invented by replacing a filename or borrowing reference-site art.

## Checks

Home pipeline suite: 265 passed. Added producer and prepared-candidate assertions
for independently valued category/tab fields. Read-only cross-repository review
found no material defect; its requested end-to-end assertion was added and passed.
Android verification and visual evidence are recorded in its surface brief.
