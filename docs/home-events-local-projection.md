# Home events: offline projection experiment

## Current contract — schema 2

The projector now calls `interpretEventAvailability` before its exact catalog
join. Each candidate has `{ id, target, availability }`. Availability contains
`basis`, `availableFrom`, `availableUntil`, nullable `eventEndsAt`, and `validUntil`.
The top-level six-hour validity is an upper bound only: consumers must also
enforce each candidate's shorter `availability.validUntil`.

Only windows containing both observation time and evaluation time are eligible.
Nonempty weekday sets require a valid absolute 24-hour interval; future, ended,
malformed or stale intervals are excluded, without predicting later recurrences.
Valid long overall periods can bound availability but do not create a deadline.
The 2038 sentinel never becomes `eventEndsAt`. Numeric timestamps are accepted
from 2009 through 2099 to accommodate the observed legacy start; this is a parser
bound, not a claim about launch history. Exact quest-to-area joins are unchanged.

Finite event deadlines sort first; records without a deadline sort by source ID.
Rotation closure and cache expiry never affect urgency ordering. Diagnostics are
`unavailableOrInvalidSchedule`, `unresolvedTarget` and `superZBattleDeferred`.
No API text, personal fields or credentials enter the result.

`observationSha256` identifies the exact input bytes. It is an audit identifier,
not authentication: the trusted collector must bind body, capture time and source
session itself, and independently pin the catalog. A caller-provided date or
matching hash alone cannot prove freshness/account origin. Raw-buffer projection
must not be exposed as a public ingestion endpoint. Mandatory quest structure is
validated even for unavailable rows, so malformed data cannot masquerade as a
successful empty projection.

This is an internal breaking revision of an unpublished experiment, not a change
to public Home schema 1. Summons collection, payload preparation, scheduled job
and Android are unchanged. `publicationAllowed` remains false. A bounded optional
event section and consumer support are still required before enabling delivery.

### Trusted collection boundary

### Optional public payload adapter (local, disabled by default)

`prepareEventSection` validates collection receipt consistency and all candidate
IDs, target kinds and temporal bounds before selecting at most 20 entries. The
section has schemaVersion 1, observedAt, validUntil, catalogSha256, partial coverage
and items containing id, target, availableFrom/Until, nullable eventEndsAt and
per-item validUntil. No title is inferred from raw API text; consumer presentation
must resolve the matching Stage catalog target. A hash receipt is not a signature.

`prepareCandidate` accepts a third optional argument `{ enableEvents, eventCollection }`.
Only literal `enableEvents: true` adds `eventSchedule`; missing, invalid or stale
enrichment is omitted. The section is capped at 16 KiB and omitted if the combined
payload would exceed 64 KiB. Original summons bytes and manifest behavior are
preserved when no section is included. All rows are validated before truncation.

The public root schema stays 1. Inspection of the current Android HomeFeedContract
confirms unknown root fields are ignored; no Android changes or runtime validation
were performed in this slice. The deployed job does not opt in. New consumer support
must enforce per-item expiry and resolve destinations before showing any item.

### Collection implementation details

`collect-events.mjs` now connects the opt-in events authentication session to the
projector. It accepts private configuration and independently pinned public
catalog bytes, not arbitrary observed response bodies/dates. It copies and fully
validates the catalog before authentication, makes one fresh nonce/login/events
sequence, records request-start/receive times internally, and closes the session
in `finally`. Capture duration of 60 seconds or more, clock rollback, malformed
data and transport failures produce only `{ status: 'unavailable' }`, with no
retry and no raw error disclosure. Begin-time freshness is conservative.

Successful output retains projection plus a public receipt. Its normalized-body
SHA hashes the exact reserialized JSON bytes fed into the projector, not the
original HTTP wire representation; it matches `observationSha256`. No raw body,
session token or login configuration survives in output. The receipt is local
provenance, not a signature or a publicly trusted attestation.

The collector is implemented and tested but is not invoked by the deployed
summons job. Future optional integration must treat `unavailable` as enrichment
failure, never replace it with an authoritative empty event list, and must not
interrupt healthy summons publication. Production enablement still requires
bounded payload and Android support. Tests used mocked transport only; this step
performed no real account login or publication.

## Original schema 1 implementation (historical, superseded above)

See current payload integration below; historical sections retain their original
validation counts and describe earlier checkpoints, not current feature coverage.

Implemented 2026-09-12 in `home-feed/project-events.mjs`. This pure function is
not imported by the collector, refresh job, publisher or Android. It performs
no network/file I/O and never reads authentication configuration.

`projectEvents` receives raw JSON Buffers (`bodyBytes`, `catalogBytes`), expected
catalog SHA-256, exact endpoint `/events`, HTTP status 200, and canonical UTC
`observedAt`/`now` instants. The caller must independently pin the expected
catalog digest; supplying a matching digest alone does not prove provenance.
Body limit is 4 MiB, catalog limit 16 MiB, root lists 1,000 each and catalog
entries 20,000. Missing body arrays, 304 responses, invalid IDs, duplicate source
identities or a digest mismatch reject the observation with a fixed safe error.

Only explicit numeric IDs and finite period fields survive the API projection.
Titles/artwork are not copied from the API. The catalog uses the existing
`dokkan-stage-delivery` schema 1 / `dokkan-game-db` entry structure. Quest IDs
resolve through all catalog difficulties to a unique area; ambiguous or missing
joins are excluded. Z-Battles resolve in their own namespace. Nested Super
Z-Battles are counted as deferred, never silently promoted as their parent.

Conservative exclusions: absent/nonempty/malformed weekday declarations on
ordinary events, nonzero weekday-window values, missing/reversed periods,
milliseconds, pre-2015/post-2099 values and windows longer than 366 days.
These cutoffs are experimental safety policy, not verified game semantics.
They deliberately omit potentially valid long-running/permanent events rather
than present unsupported countdowns. Seconds interpretation and sentinel/weekday
meaning still require review against a fresh official response.

Results carry `publicationAllowed: false`, partial observation authority,
catalog SHA, a six-hour observation-validity cutoff and candidates sorted by
finite end time then source ID. The six-hour cutoff is local experimental policy.
Candidates include past and future windows; the result does NOT label them live.
Exclusion counts are diagnostics, not a complete inventory or an authoritative
empty feed. Candidate output is not the Android 64 KiB feed contract and must
pass a separate bounded presentation adapter before any delivery.

## Verification

Ten synthetic tests cover ID joins, ambiguous/missing targets, independent
namespaces, account-field exclusion, recurrence, date boundaries and freshness,
304/malformed/oversized inputs and catalog digest/duplicate validation.
The full isolated Home suite passed: 60 tests, zero failures.
No generated lib output is needed for these native `.mjs` modules.

No new dependencies, account requests, workflow/auth allowlist changes, remote
publication or Android changes. Security-review guidance informed allowlisting,
bounded input and constant errors without raw response/error disclosure.

## Next gate

Review the experimental contract, then compare a bounded fresh observation and
the current pinned Stage catalog. Only after that add a narrowly permitted
`/events` read to the secure collector and prepare an additive Home-feed contract.
Do not remove the publication guard or infer availability from historical H3.

## Fresh observation — 2026-09-12T21:32:44.593Z

Following user authorization to continue normal implementation, added opt-in
`apiScope: "events"` to createSession. The default summons scope is unchanged.
The event scope accepts exactly one GET `/events`, permits at most three API
requests including nonce/sign-in, refuses images/other routes, and retains
timeouts, byte bounds, fresh-bearer-only handling and sanitized failures.
The scheduled collector does not opt in and is unchanged. Twelve focused auth
tests and the full 62-test Home suite passed.

A local one-shot observation used the existing secondary-account login material
through an in-memory private pipe. No HAR, credentials, raw body or API text was
written to the result. One fresh login and one event read completed; no game
actions or publication. An initial public-catalog path validation failure happened
before authentication; its correction used the manifest's relative object key.

The public staging catalog compressed object was independently size/hash checked:
511,240 bytes, SHA a0949a7e70233a2a725adfad75804aeb691c17bdd8a79f65b2be91543ae197f8.
Expanded: 10,999,299 bytes, SHA
4a06f9639050c6a5e429e82787a6a64404aa10475db7304b229d6a99a87d8350,
5,629 entries. It was read only, not changed.

Observed root counts: 207 events and 201 Z-Battles. Projection retained ten
Z-Battles, all resolving exactly to the catalog. Excluded: 380 invalid/unsupported
periods under the current conservative policy, 18 unproved recurrence entries,
zero unresolved targets among otherwise eligible records. All 207 ordinary events
had nonempty weekday arrays. Twenty-eight nested Super Z-Battles remain deferred;
that diagnostic is separate from root-row exclusions, not an extra root count.

The ten retained IDs are 199, 200, 202–207, 210 and 211. Their Unix-seconds values
produce plausible finite windows ending 2026-10-20T07:59:59Z; this validates format
plausibility and joins, not in-game visual schedule parity or universal eligibility.
The result remains publicationAllowed=false, and nothing was added to Android.
Sanitized evidence lives in ignored `.agent-logs/home-events-observation.json`.

Next: refine the diagnostic fixture to distinguish long-running/sentinel windows
and weekday combinations, then prove their semantics before widening inclusion.
The aggregate period count does not establish which individual exclusion rule
applied; do not interpret all 380 as permanent events or malformed server data.

## Calendar diagnostics — 2026-09-12T21:38:35.426Z

Added `event-schedule-diagnostics.mjs`, a separate bounded, pure diagnostic. It
retains only validated numeric IDs/timestamps and canonical weekdays, never API
text, account fields or credentials. Invalid values become fixed state markers.
Three focused tests cover classification, unwanted-field exclusion and rejection
of malformed, oversized, duplicate or wrong-route inputs.

One additional fresh login and GET `/events` produced the same 408 root records.
The sanitized evidence is in ignored
`.agent-logs/home-events-calendar-observation.json`; no raw response was saved.

| Group | Count | Calendar evidence |
| --- | ---: | --- |
| Ordinary events, finite period | 18 | All seven weekdays |
| Ordinary events, long period | 179 | All seven weekdays |
| Ordinary events, long period | 9 | A subset of weekdays |
| Ordinary event outside the start-date policy | 1 | All seven weekdays |
| Z-Battles, finite period | 10 | Weekday fields absent |
| Z-Battles, long period | 191 | Weekday fields absent |

All 380 excluded period records end at Unix second 2145916800
(`2038-01-01T00:00:00Z`). This is consistent with a sentinel-like far-future date,
but does not prove permanent or universally accessible content. Of these records,
379 exceed the 366-day bound; one starts before the current 2015 policy boundary.
They are not malformed timestamps merely because the projector excludes them.

Observed weekday intervals run from September 12 to September 13, 2026, each
exactly 24 hours. UTC boundaries vary: 00:00, 04:10, 05:00, 06:00 and 06:30.
These are absolute timestamps, not bare weekday numbers or seconds since midnight.
Some finite event end times precede the corresponding weekday interval's end,
so the weekday end must not replace the overall event deadline.

Decision: keep recurrence and long-window guards unchanged. Do not infer the
weekday timezone, promise permanent availability or turn daily boundaries into
"ending soon" labels. The ten finite Z-Battle candidates remain an offline
experiment, not a published Home feed. Next evidence gate is comparison against
the game's visible schedule for a finite event, a weekday-limited event and a
far-future record; then define separate availability and deadline semantics.

## Native game comparison — September 12, 2026

Opened the installed Global game 6.5.5 on LDPlayer (`emulator-5554`) normally,
without interception or an additional scripted API login. Navigated only through
login notices, event lists and information screens; no battle, summon, purchase
or manual reward claim. Normal login did display automatic login rewards.

Device timezone read-only check returned `America/Santiago`; it was not changed.
The Bulma event announcement showed August 29 05:00 to September 12 20:59.
The corresponding observed finite window, 09:00 UTC on August 29 through
23:59:59 UTC on September 12, matches these local times (including the different
UTC offsets on the two dates). Use a device timezone database, never a fixed
offset, when presenting an interval.

The independently SHA-verified public catalog names area 219 / quest-level
2190011 as `Full of Crisis! Bulma on Duty`. Observed event 219 has that finite
window. This title/ID correlation supports the sample comparison; it does not
replace the production projector's required quest-to-area join.
The native list displayed `Remaining 2 H` during inspection. The announcement
separately described daily attempts and mission resets. Do not conflate mission
reset deadlines with event expiry. Evidence: ignored
`.agent-logs/home-event-bulma-period.png`.

The native Z-Battle list and its detail screen also showed `Planet Namek Saga 2`,
matching catalog Z-Battle 211. Both information buttons led to generic gameplay
help rather than a dated announcement, so its end-time parity is still unverified.
The weekday-limited and far-future cases remain outstanding. No publication guard
was relaxed, no claim of complete schedule validation is made, and no Home UI or
remote data was changed during this read-only verification slice.

## Weekly-window evidence and policy implementation

The native `Prodigy Prince` announcement explicitly lists Monday 03:30–Tuesday
03:29 and Saturday 03:30–Sunday 03:29, in the emulator timezone. It also warns
that campaigns can make the event available outside that schedule. This matches
the observed event 421 weekday set (Monday/Saturday) and current absolute
September 12 06:30 UTC–September 13 06:30 UTC interval. Its catalog area is 421,
named `Prodigy Prince`. Screenshot: ignored
`.agent-logs/home-event-prodigy-weekly.png`. The API's 2038 overall end is not
presented as an event deadline in that announcement.

Added isolated `event-availability.mjs` with seven focused tests. It distinguishes
`availableFrom`/`availableUntil` (intersection of the overall period and current
24-hour weekday window), `eventEndsAt` (nullable finite overall deadline), and
`validUntil` (at most six hours, clipped to current availability). Weekday windows
are consumed as absolute server timestamps without guessing their timezone or
extrapolating the next occurrence. Malformed, future, ended and stale observations
yield no availability. Long overall periods, including the observed 2038 value,
never produce `eventEndsAt` or a permanent claim. `availableUntil` is an internal
bound, not a user-facing event countdown.

This interpreter is not yet imported by the strict projector, collector or Android.
The original projector and publication guard remain unchanged while integrating
the expanded contract is pending. The weekly sample validates the current window,
not all campaign overrides or all long-running Z-Battle schedules. Next integration
must retain exact catalog joins and carry these separate semantics into the feed;
it must not render `validUntil` or a rotation boundary as the event's deadline.

## Scheduled-runner integration — 2026-09-12

The preceding entries are chronological investigation notes. The interpreter,
collector and optional Android DTO are now integrated locally. Checkpoints:
producer ea9337f; Android 888a3e9b. The changes below follow those checkpoints.

`run-refresh.mjs` now supports optional events in both collect-only and scheduled
publication paths. Summons finish and close their session before events begin.
The public catalog is read without game credentials from the fixed staging host;
schema-2 manifest, hash-shaped object key, compressed size/hash and bounded
expanded size are checked. The expanded hash must also equal the independent
`HOME_FEED_EVENTS_CATALOG_SHA256` configuration value. Missing/mismatched pins
omit optional events. No game login is made when catalog validation fails.

`HOME_FEED_EVENTS_ENABLED` must equal literal `true`. Both new settings are wired
to the workflow, but no remote variables, deployed checkout, schedule, R2 or
publication gate were changed. When approving a new Stage catalog, update its
expanded-byte pin deliberately; do not derive that approval from the same
mutable manifest in the scheduled process.

The raw schema-2 projection still has `publicationAllowed: false`: it is an
internal diagnostic object, never a public payload. `prepareEventSection` is the
explicit conversion boundary: verify a fresh collector receipt, copy only the
public field whitelist, and let the separate event flag govern candidate inclusion.
The existing global staging-publication gate and manifest-last publisher remain
unchanged. No private response body, credentials, receipt, or internal projection
is written into the candidate.

95 isolated tests pass. An initial live collect-only run safely omitted events
because the new reader expected schema 1 rather than the real schema-2 manifest.
After fixing that mismatch, the real integrated run completed in 11,462 ms with
15 summons and 20 event entries. Payload: 12,934 bytes (4,822 bytes over the
8,112-byte summons-only payload); 17 local objects total 3,463,258 bytes including
unchanged banner images. This is candidate size, not a remote upload plan.

Payload SHA: 03f14cc4d0498968a0a144cb711d7e55627d60283f8057d65a6c8203d7262731.
Event lease: 2026-09-13T05:28:15.908Z. Catalog expanded SHA:
4a06f9639050c6a5e429e82787a6a64404aa10475db7304b229d6a99a87d8350.
Evidence: ignored `.agent-logs/home-events-integrated-candidate-20260912-b/` and
`.agent-logs/home-events-live-integration-b.log`. Candidate hashes were checked.

The same real payload rendered successfully in the Android Studio emulator, with
Journey to Planet Namek, Grand Elder Guru's Guidance and Bulma as the first three
rows. Their real finite deadlines were shown; no fixture dates were substituted.
Evidence: Android worktree `.agent-logs/home-events-real.png`. Public cached feed
and emulator connectivity were restored after the check.

Remaining: explicit push/deployment and staging activation, followed by remote
preflight and observation of an actual scheduled cycle. This pass did not publish,
push, alter GitHub variables, or transfer credentials. Security review accepted
the independent pin and clarified internal-to-public conversion boundary.
