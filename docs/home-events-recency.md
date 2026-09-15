# Recent active Home Events

Approved 2026-09-14; local implementation, not yet committed or published.

## Revised user direction — event relevance and Burst Mode

This section supersedes the generic recent-event selection below. User excludes
Story/DB Story from Home, preferring challenge, bonus and Z-Battles. Limited
bonus events remain eligible; ordinary growth/quests/unknown do not. Source
classification is the independently pinned catalog's `browseCategory`, not
name/ID/image text. Filter before the producer's 20-item cap and again against
the exact catalog on Android, including legacy feeds. Light of Hope is bonus,
not Story, so remains eligible.

Captured `resources-login.json` has `genkai_battles.genkai_battles` with explicit
root ID, `area_id`, `genkai_battle_schedule_id`, `start_at`, `end_at`, bounded by
outer `expire_at`. `is_new` and reward/account state never affect highlights.
The adapter adds only GET `/resources/login?genkai_battles=true`, once after
`/events`, events-media scope only, maximum four API calls including auth.
Collector remains under 60 seconds, hashes the separate Burst input into its
receipt, never persists raw login data, and keeps base events on optional read
failure without retry. Scheduled integration is prepared locally, not deployed.

Burst metadata joins to an exact catalog area and a structurally valid event
row. A proved active Burst interval replaces *availability*, independently of
base weekday rotation. Public base `eventStartsAt` stays absent and base
`eventEndsAt` null for these rows; native labels use independent `burstMode`
dates. Validity is clipped by source expiry, six-hour lease and mode end.
Expired/future/conflicting/invalid Burst rows never highlight. If no matching
event/catalog area exists, the partial feed omits it rather than inventing an
ID or destination. Growth is eligible only with a valid Burst; Story remains out.

Android's three-card preview selects one Burst and two recent ordinary events
when available, filling remaining slots only if necessary. Show more exposes
the remainder of the partial 20-item selection. Burst taps open the base event;
modifier/scoring/configuration screens are not implemented or implied.

Latest validation: 286 pipeline tests, 43 Android unit tests, two native replay
tests (360dp and 600dp/200% font), APK build, inspected screenshots. Replay uses
separate supplied JSON files at a historical fixture time, not a fresh certified
observation. Preview: The Evil Emperor (Burst), Light of Hope (bonus), Captain's
Chaos-Bringing Secret Strategy (challenge). No live game calls, Git actions or
R2 writes in this pass. Correct Light of Hope header publication remains pending.

## Original recency pass

Canonical contract: `home-feed/contracts/event-schedule-v1.schema.json`.
Add optional `eventStartsAt` from `/events` overall `start_at`. This is not a
first-release timestamp and not `wday_start_at`. Preserve original availability,
finite deadlines, six-hour observation freshness and exact catalog joins.

`prepareEventSection` validates every candidate before ordering by overall start
descending (unknown last), real deadline ascending (unknown last), then stable
ID. Deduplicate typed targets before taking 20. Coverage remains partial, not
a full directory. No preference inferred from IDs, no fabricated New/Reopened
badges. Android previews three, expands within that selection, and marks real
deadlines within 72 hours as Ending soon. Expired entries never reach Home.

Old Android ignores the additive property. New Android accepts absent/null and
degrades invalid optional starts to unknown without losing availability. The
producer rejects malformed supplied starts or starts after availability. Tests
validate old/new section payloads against the canonical schema using dev-only
pinned AJV; production refresh has no new runtime dependency.

Validation: 279 pipeline tests; 39 focused Android unit tests; native build.
An isolated presentation replay uses the supplied events.json at a capture time
from events.har (which lacks response bodies). It is not a fresh or certified
collector observation. Its leading events are Light of Hope, Trunks, and Fight
Against Despair, each overall start 2026-09-13T04:30Z. No replay is publishable.
The same prepared payload is consumed by Android's real HomeFeedContract in
the native visual test. No game login, cache reset, schedule edit or R2 write.

Rollout requires explicit commit/push/publication authorization and a new
Android build. Automatic refresh uses the changed preparation function once
the pipeline is integrated; no second schedule or retry loop is needed.

Native replay confirmation: two tests passed, phone and wide/200% font, including
expand/collapse and typed event callback. A first test selector assumed loaded
art; corrected to accept the accessible text fallback too. No rendering defect.
Known staging asset gap: catalog Light of Hope listbutton-key returns 404 while
Trunks/Fight Against Despair keys serve the correct illustrated headers. The
API's proper Light of Hope header is `banners/en/event/eve_header/quest_top_banner_257.png`;
repair its mapping/publication only in an authorized data rollout. Do not
publish replay data or silently substitute unrelated artwork.

## Illustrated header repair (2026-09-14)

Canonical schema adds optional `headerImageUrl`, an owned immutable Home PNG.
The collector prefers the exact `event_image` / `eve_header` pair, authorizes
only the signed URL observed for that source row, validates PNG bytes and binds
the result to the trusted schedule. Legacy `banner_image` remains `imageUrl`,
never relabeled as a header. One image per selected event preserves existing
20-download, 8 MiB artwork and 42-publication-object ceilings. Missing enrichment
keeps Android's catalog fallback and never enables the wrong list artwork.

A fresh authorized GET /events recovered event 257's official illustrated art:
852x610, 299427 bytes, SHA-256
`e9151ea0a82dc95ad825c6957c1926d1320df86a7122914157f721c72c75d2f7`.
The original captured signed URL returned 403; no URL guessing was used.
Only verified public PNG bytes were saved locally, not credentials or raw API
responses. Native header layout preserves source proportions; this particular
art is taller than Trunks. Staging remains unchanged pending explicit rollout.

Validation: 288 pipeline tests, 45 focused Android unit tests, canonical schema
validation with the new header field, APK build and two native replay tests
(phone and wide/200% font). Source PNG is loaded at original decode size to avoid
sampling to the initial narrow placeholder. No R2 writes or Git release actions.
