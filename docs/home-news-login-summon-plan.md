# Home: news, login bonuses and summon metadata

## Approved execution plan — 2026-09-14

Lucas explicitly approved this ordered scope and implementation. Keep this list
as the resume checklist; do not mistake local completion for published delivery.

1. [ ] Close first-party data: distinguish discount and banner end dates; verify
   summon reward identities/quantities/art and official event images. Missing
   fields remain missing; never substitute website data or infer from "400 hours".
2. [ ] Complete summons: shared title/description/reward geometry, verified
   discount timer, featured navigation and full-description access. Reuse the
   presentation in Home and summons directory; scale with accessibility text.
3. [ ] Image-led Home Events: official art replaces name-only emphasis; retain
   end date, navigation, Show more, accessible name and failed/missing-art fallback.
4. [ ] Finish News: retain open article across expiry/refresh; validate real API
   content/art, Back/Home reset, restoration and artwork failure.
5. [ ] Focused contract/navigation tests followed by one sequential staging
   build and emulator checks at phone/wide/large-font sizes. Present evidence and
   staging build for user review; document remaining limitations honestly.

Login bonus waits for nonempty reset-time evidence. Frontier and Clash research
remain separate. Commit, push and publication each require separate authorization;
no production/release changes are authorized by approval of this plan.

Execution started: first-party capture schema audit and bounded News continuity
implementation. Existing unrelated worktree changes must be preserved.

### Stage 1 evidence / implementation checkpoint

Discount follow-up: crossing actual API description with source dates resolves
the four observed main offers. Gashas 12452/12434 and 12490/12472 have
`end_at - open_at + 1 == 400 * 3600`, timer layout 2, StoneGasha type and
explicit API prose "400 hours only! Perform 3 Multi-Summons and get one FREE!".
Combined with Lucas's clarification of the promotion, this supports using the
provided end_at for those offers, not claiming an unconditional meaning for
timer type 2. `project-summon-presentation.mjs` implements that bounded predicate
and strips only observed center/color markup. Unknown markup/offers omit the
enrichment. Collector now retains optional discount metadata; delivery/Android
timer wiring still pending. 13 focused presentation/collector tests passed.
No deadline is synthesized by adding 400 hours or replaced by feed expiry.
Source expiry can represent the current promotional gasha row, not necessarily
the end of all subsequent variants of that banner.

Discount delivery/UI follow-up: prepareCandidate now includes only the recognized
three-plus-one deadline matching the source row end and 400-hour window. Android
parses it as optional `discountEndsAt`, independently of clipped availability;
malformed/unknown metadata falls back to no timer. Shared SummonBanner renders
"Discount ends in" with days/hours/minutes, refreshes every 30 seconds and reserves
two text lines across carousel pages when any page has an offer. No countdown
seconds or whole-banner end claim. 13 producer tests and 5 Android metadata
tests pass; staging APK build successful. Actual enriched-banner visual verification remains pending;
no feed publication has occurred.

Discount native validation: extracted the unchanged rendering into internal
`SummonBannerContent` so tests exercise production layout without network/viewmodel
side effects. Two LDPlayer instrumentation tests pass at 360dp width, font scales
1.0 and 1.5. Active/absent/ended offer states keep equal measured banner heights;
timer labels remain visible and banner click callback works. Three captured
rasters were inspected (`summon-discount-phone-active`, `-phone-absent`,
`-largefont-active`). Synthetic prose and unavailable-image state only; no claim
of real artwork/reward icons, actual pager swipes or full-Home validation.
The absent-state screenshot contains the test click ripple, not a theme change.
Staging app and instrumentation APK builds passed and were installed with replace,
without clearing emulator data. No account API calls or publication.

News continuity subtask completed locally: HomeScreen retains one opened article
independently of feed expiry/replacement, clears it on Back/Home and restores a
bounded validated snapshot. 10 focused JVM tests passed (7 navigation + 3 news
contract). Staging app/test APK builds passed and were installed with replace
on LDPlayer emulator-5554 without clearing data. Three instrumentation tests
passed, including feed removal followed by saved-state restoration. Screenshot
`news-retained-after-restore.png` inspected; it is synthetic plaintext evidence,
not full real-art or integrated Home acceptance. No remote publication occurred.

- `project-event-artwork.mjs` now projects only exact official `banner_image`
  references from events and Z-Battles, with namespaced source identity and no signed
  query/account fields. Four focused tests pass (privacy, namespace separation,
  invalid-art fallback, malformed/duplicate/oversized inputs). Offline supplied
  `events.json` accepts 212 event and 202 Z-Battle banner references.
- Observed source path is `/banners/en/event/eve_banner/`; header and listbutton
  variants exist but are not interchangeable without checking artwork fit.
  This helper does not authorize fetch or publish and is not yet wired into
  collection/delivery. Next: bounded trusted image collection and immutable
  owned-host delivery, then optional Android artwork field/UI.
- Observed gasha fields include `open_at`, `end_at`, `timer_layout_type`, and
  per-course treasure item counts. No dedicated discount timestamp field appears
  in these captures. Some featured rows have timer type 2; semantics require
  first-party confirmation before labelling `end_at` as discount expiry. Do not
  derive a timer from the image text or from feed freshness. Other plan steps
  can proceed while this evidence is resolved.

2026-09-14. Implementation in progress; Lucas approved the native presentation,
including summon reward item icons and applicable quantities.
Frontier API migration is explicitly backlog. No website data collectors, new
publication, release build or account mutations are part of this slice.

Resume checkpoint: supplied September 14 login and Home JSON bodies are valid,
including the previously missing 757,904-byte login response, but login_bonuses
remains empty. Waiting for reset-time evidence, not another export of the same
response. See main repository `docs/game-db/api-capture-update-20260914.md`.
Native diagnostic follow-up is recorded in Android worktree 94f3
`docs/features/home-news-summons-audit.md`: prioritize open-article continuity
across feed expiry and access to complete summon descriptions before release.

## Source and evidence

The game API is the data and image authority. DokkanStats, DokkanDB and
Dokkan.fyi are visual inspiration only, including Lucas's supplied screenshots.
Never substitute their content when API evidence is incomplete.

- Offline `events.har`: GET `/announcements` contains 90 entries, 70 with art.
  Public metadata includes ID, title, summary, category and `start_at`.
  Exclude `is_new`, account fields, arbitrary `link_to` and signed image queries.
- GET `/announcements/{id}` has `bodies` with layout/image/description. Full
  article rendering needs a separately bounded safe content contract; the
  initial projector intentionally does not publish HTML or external actions.
- GET `/resources/home` has empty `login_bonuses` and `random_login_bonuses` in
  this observation. This is NOT evidence that no global login campaign exists.
  `/resources/login` has no captured body. Before login UI, obtain nonempty
  first-party evidence and distinguish calendar rewards from player login day.
  Never publish gifts, next account login time, accepted rewards or progress.
- GET `/gashas` supplies `description`, `open_at`, `end_at`, and courses with
  `currency_id`, `price`, `items_count`, `drawable_count`. Cost and number of
  drawn characters are not proof of bonus coin rewards. Resolve reward identity
  and official art through explicit first-party references, not banner-name
  inference or website descriptions. Never replay draw.
- Follow-up across all 21 rows found optional `treasure_item_id` on nine banners
  and `treasure_item_count` on individual courses. These are now projected by
  course, independently from price and items_count. Null/zero does not imply a
  reward. Official item image resolution and delivery remain pending.
- Keep offer/discount expiration separate from banner availability and feed
  freshness. Existing clipped feed `endsAt` is not a summon countdown source.

## Approved native presentation (Impeccable shape)

Additional user requirement (2026-09-14): Home Events must use each event's
official API-sourced banner/image as the primary presentation instead of the
current name-only rows. Preserve end-date information, event navigation and
Show more. Keep an accessible event-name label; use the name as a fallback when
verified artwork is unavailable or fails. Do not source event art from websites
or guess URLs. This is recorded pending implementation, not yet shipped.

Extend the established Instrument design, not the sites' decorative frames.
Home is Operate; article detail is Read. The goal is to see current information
quickly, inspect rewards visually and open relevant details.

1. News: a bounded image-led preview with title/date/category, View all, then
   article detail. Preserve old cached feeds when enrichment is absent. Local
   read state may drive unread marks; never use the game's account `is_new`.
2. Login bonuses: campaign art and reward icons with adjacent quantities;
   schedule detail when supported. Do not label a reward as today's or Day N
   without proven global/calendar semantics. Unknown data is not an empty state.
3. Summons: existing art and featured navigation, title reserved for three lines,
   bounded summary, reward row only when verified, explicitly labelled period.
   Match carousel height across cards at the current width/font scale; do not
   clip accessible text into fixed pixel heights. Longer information belongs in
   detail. Keep image failure, missing reward data and long names stable.

## Execution and gates

### Event artwork local checkpoint — 2026-09-14

#### Real API preparation and publication gate — 2026-09-14 15:51Z

UPDATE 16:08Z: user explicitly requested publication now for visual checking.
Published the already collected candidate as a one-off staging validation, with
zero game requests and a separate manual receipt `runs/1789402003785.json`.
The scheduled receipt was neither deleted nor reclaimed; conditional manifest
promotion and lease ownership checks remained active. Preflight: 851803 bytes
written, 851611 new bytes, no conflicts. Public byte/hash verification succeeded
for all operations. Manifest SHA-256:
`f3c018b5d0e77a60a1b81a169ed8fc37157240f72ed93fc35fd9e06465055363`.
Staging now contains 21 summons, 13 event images and six News. Production untouched.
Earlier statements that publication necessarily had to wait for the next automated
slot were too broad: this expressly authorized existing-candidate manual path does
not repeat game login. Hosted source still lacks these local changes, so a later
scheduled refresh may replace the enrichment until source rollout is authorized.

User authorized staging publication when needed; production remains excluded.
Read-only current-slot audit found slot 82842 already successful. Do not reclaim
or bypass it; next standard slot is 2026-09-14T18:00Z (15:00 Sao Paulo).
No staging upload, configuration change, commit or push was made this pass.

Fresh local API collection confirmed descriptions on 21 summons, rewards on nine,
and four independently labelled 400-hour discounts. Initial preparation exposed
two integration defects: publisher's 42-object ceiling discarded the whole optional
event-art block, and one news body's angle-bracket markup rejected all news.
Fixed by budgeting optional art within the existing ceiling (reserving News slots)
and omitting unsupported article bodies while retaining validated index/art. Never
render or execute the markup. 256 pipeline regression tests pass.

Second real candidate: `.agent-logs/home-real-20260914-b`, payload SHA-256
`b65d641b43ad9e5f24ae003edede46126032d00676fc8544a4d3723ce51de260`, 33840 bytes,
42 objects / 5670382 bytes total. Contains 21 summons, 20 events (13 delivered art
references), six News (one body omitted). Events expire 2026-09-14T21:50:43.557Z;
root expires 2026-09-15T15:49:57.216Z. Never extend these observations.
Read-only publisher preflight passed: zero conflicts, 851803 write bytes,
851611 new bytes, prior bucket 1664395411 bytes (~1.665 GB projected total).
Official first Event and News PNGs were inspected locally; full Home/emulator
rendering against this candidate remains unverified. No publication claim.
Local changes are not in the hosted workflow: its next scheduled run alone will
not activate this implementation. A normal-gated local publication or separately
authorized source rollout is still required; authorization to staging is retained.

At 16:00Z the slot remained occupied/successful. Two opt-in Android instrumentation
tests now passed using this real public candidate in a separate external-files
fixture directory (normal app cache untouched). Inspected native screenshots:
`home-real-summon.png` shows Gohan description, source discount timer and reward
quantity fallback; `home-real-event.png` shows the actual event:257 official art,
expiry and verified target callback. Summon fixture intentionally has no exchange
catalog, so it does not validate reward icons/names. Event image uses a local-file
substitution after parsing the signed/hash-checked public candidate, not the remote
delivery path. Full Home, remote image delivery and staging publication remain
pending; do not call these isolated checks full integration acceptance.

- Added an events-media session restricted to one `/events` read and at most 20
  observed official `eve_banner` PNG fetches. CDN requests carry no account headers.
- Collection is bounded to 60 seconds, 2 MiB/image and 8 MiB unique artwork;
  fully decoded PNGs are stripped of metadata and delivered under immutable hashes.
  Artwork is bound privately to the collected schedule/source IDs, not guessed
  from titles or event-area IDs. Missing/failed art retains the schedule.
- Existing explicit events collection now requests optional presentation. No
  remote configuration, live collection, deployment or upload was performed.
- Android accepts only optional owned hashed PNG URLs, renders image-led rows
  using the established event-banner ratio with Fit, and preserves deadlines,
  exact-event callbacks and Show more. Missing/failed images show a growing title
  fallback; long names and dates wrap at 200% font scale.
- Verification: 254 pipeline regression tests, 28 Android contract tests, staging
  APK compilation and 4 LDPlayer component interaction tests passed. Screenshot
  fixtures exercise image rendering, missing/failed art and 240dp/200% text.
  They do not prove real API artwork appearance or full-Home delivery. First
  screenshot pass exposed a missing background in the isolated test harness;
  harness corrected to use the app theme Surface, without changing production UI.
- Remaining: real candidate/dry-run and full-Home visual inspection with official
  artwork before any separately authorized staging publication. No commit/push.

- [x] Record Frontier pause and API-only boundary.
- [x] Add offline announcement metadata whitelist with defensive bounds.
- [x] Five focused tests pass; supplied capture accepts 90 entries / 70 images.
- [x] Wire bounded read-only news collection and validated image delivery.
  News metadata and optional artwork collection are implemented and tested with
  mock transport. Media reads are restricted to observed URLs, at most 6 latest
  nonfuture announcements, 2 MiB/file, 8 MiB total and 60 seconds. PNGs are fully
  decoded with pixel limits, metadata removed and output hashed. Shared art is
  deduplicated. Full plaintext bodies are read only for observed announcement IDs;
  no arbitrary links or HTML are rendered. Public preparation is bound to an
  in-process successful collection via private copies, 48 KB section maximum.
  Runner wiring uses exact `HOME_FEED_NEWS_ENABLED=true`; not activated remotely.
  No live collection or upload has run.
- [x] Define optional versioned feed enrichment and old-cache compatibility.
- [ ] Obtain nonempty login payload evidence and prove reward schedule semantics.
- [ ] Resolve summon reward references and independently labelled offer dates.
- [x] Implement native news preview, list and plaintext detail; connect Home reset.
  32 Android unit tests and two LDPlayer instrumentation tests passed. Initial
  capture found standalone screen background dependence, corrected explicitly
  and confirmed in the second capture. Independent contract review verified
  runner gating, cancellable deadline and first-party icon source fixes.
  64 focused pipeline tests pass, including collect-only runner image hash output.
  Live imagery/full-Home integration still needs a real candidate and inspection.
- [x] Add optional summon descriptions and per-course rewards to delivery/parser.
  UI reserves shared carousel slots; quantities use min/max across course choices,
  never sum choices. Icons/names use first-party TreasureExchangeCatalog, NOT the
  legacy dokkaninfo ItemCatalog. Unresolved IDs stay generic; no URL guessing.
- [ ] Review contract and run publisher dry-run before any authorized upload.

Current code: `home-feed/collect-news.mjs` uses a one-shot news-only session;
`project-announcements.mjs` strips private fields. No live request was executed.
`project-summon-rewards.mjs` feeds optional per-course references into the summon
observation and candidate. No reward quantities are inferred from cost.
Errors never echo input.

### 2026-09-14 complete summon availability

The collector now preserves the official information_announcement_id. With news
enabled, it reads up to eight distinct matching announcement details in the same
session as the six news articles, sharing an ID cache (no duplicate detail GETs).
The session budget is 17 API calls including nonce/sign-in/index; the existing
60-second deadline, image limits and observed-ID allowlist remain in force.

project-summon-period.mjs accepts only one specifically labelled paired stone
summon duration in the Event Period section, matching the banner opening time.
Ticket/exchange durations and the 400-hour offer deadline are not availability.
Verified in-process evidence supplies optional bannerEndsAt; unsupported markup,
missing joins, stale collections and ambiguous durations are omitted. This first
parser deliberately does not infer availability for other banner categories.
Current official announcements 107229 and 107189 confirm 2026-10-20T07:59:00Z
for the four featured stone banners. No date is hardcoded in implementation.

The feed endsAt remains its existing visibility/offer cap, and discount.endsAt
keeps its seconds-precision source. Clients display bannerEndsAt independently.
No decoder work was resumed.

Staging publication completed and independently verified on 2026-09-14:
candidate generated at 17:34:14.022Z, 21 summons (four confirmed full periods),
six news, 20 events / 13 event images. Payload SHA-256:
8352d3ddb9012530703e5ec164b8a8aef421f333f0427140ce10857c4e784300.
Manifest SHA-256: 89d992abf4e3fa5cf423cf302fba2e2db13b15c26593101f603db619d87c9d07.
Manual receipt: staging/v2/home/runs/1789407369111.json.
Dry-run: bucket 1,665,247,315 bytes; 34,050 new bytes; 34,242 write bytes,
plus bounded control receipt. All 59 focused tests pass. No commit/push or
production publication. Hosted runner source was not deployed by this manual
data publication; automatic future runs need the code changes separately shipped.
Private HARs remain local and are not fixtures. Android implementation is local;
no remote deployment, production change, commit or push was performed.
