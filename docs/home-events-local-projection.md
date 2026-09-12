# Home events: offline projection experiment

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
