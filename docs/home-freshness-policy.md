# Home freshness resilience — 2026-09-15

Consumer: Android Home, News and Campaigns. Provider: home-feed scheduled refresh.
This policy complements existing JSON schemas without changing payload fields.

`validUntil` remains the freshness deadline; it is not the end of every piece of
content. Never rewrite observed/generated timestamps to disguise old data.

- Verified Home and Campaign snapshots remain usable for seven days after their
  observation time (Home uses generatedAt), with a visible last-update warning
  after validUntil. Schema, hash, source and destination checks remain mandatory.
- Historical News remains browseable for thirty days after observedAt, labelled
  last-known when stale. Details retain the exact verified index identity.
- Explicit content deadlines still win: event availableFrom/availableUntil,
  campaign visibleDeadline and bannerEndsAt. Never resurrect daily rotations or
  advertise an ended campaign as active. If no eligible event remains, offer
  the event catalog without asserting current availability.
- Summons use verified bannerEndsAt when present, not the discount deadline.
  Legacy endsAt remains the fallback when the overall deadline is unknown.
  A finished discount must not retain an active countdown or promotional claim.
- New clients must also accept a bounded stale verified public dataset; this
  resilience is not limited to clients that happened to cache it while fresh.

Execution reliability:

- A scheduler wakeup is not proof of a successful refresh. Skipping a slot while
  public sections are stale must be surfaced as degraded/failed health.
- Keep single-flight ownership and no same-slot login retry. Do not reclaim a
  failed/reserved run or remove its lock. Keep the existing boundary safety gap;
  report slot_boundary separately from slot_reserved and wake hourly, so a late
  wakeup can be followed by another chance in the next slot.
- More frequent scheduler wakeups may reuse the same six-hour login slots; they
  must not multiply authentication attempts within a slot.
- No scheduler or network can promise zero failures. Last-known safe content,
  explicit freshness, guarded retries and observable health avoid silent blanks.

Confirmed incident: scheduled runs 34931123830 and 34965719065 concluded success
but emitted already_running without renewing public data. The latter started at
11:53 UTC, inside the old forbidden final twenty minutes of its six-hour slot.
News/Events/Campaign snapshots expired around06:33 UTC; the app then hid them.
Frieza/Goku published endsAt matched discount end00:59:59 UTC even though their
verified bannerEndsAt was20 October07:59 UTC.

## Implementation checkpoint

Provider now gives hourly scheduler opportunities while preserving six-hour
durable login slots and the twenty-minute boundary safety guard. Skipped ticks
read only the reservation and bounded public manifests; they do not scan the
bucket inventory, login or write. `skipReason` distinguishes an occupied slot
from a boundary skip. Hash-verified public section freshness controls the job
exit code, including after an otherwise successful publication.

Recognized three-plus-one rows still advertised by the game after promotion end
remain bounded collection candidates. They are published only when a fresh,
matching official article confirms a later overall deadline; otherwise they are
discarded. Expired promotion text/countdown is omitted. Overall `bannerEndsAt`
feeds the compatibility `endsAt` bounded by the snapshot's original validUntil.

Verification includes delayed/occupied skips, hourly duplicate prevention,
expired optional sections, no-write/no-login skip checks and the post-discount
banner transition with and without verified overall-end evidence.
