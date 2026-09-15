# Shared event artwork refresh

Status: committed, pushed and staging art verified on 2026-09-15. User requested on
2026-09-15. Decoder remains on hold; News/Summons presentation is out of scope.

## Source truth

Live first-party event 257 inspection corrected the earlier field interpretation:

| API field | Variant | Observed dimensions | Intended preview use |
| --- | --- | --- | --- |
| listbutton_image | Illustrated horizontal banner | 500x110 | Home, event list and detail header |
| banner_image | Plain event selection strip | 600x120 | Not the requested illustrated preview |
| event_image | Large promotional poster | 852x610 | Not the Home preview |

Light of Hope horizontal PNG SHA-256:
`651e95fd0d320e597207dddff5d2097acba5dfd3e18fa19031f8a6ae4eccd669`, 44997 bytes.
The earlier poster fix is superseded, not a justification to crop the poster.
Frieza area 507 current horizontal PNG:
`c706072f6cbaf22682b04267d717d6e423db5307a0fb4f39bfa6215e70855605`.

## Boundary and update behavior

Canonical contract: `home-feed/contracts/event-artwork-v1.schema.json`.
Home contains optional `eventArtwork`, identifying up to eight immutable 64 KiB
shards. Their union maps at most 2000 typed target keys to PNG SHA and successful
check time. Expanded catalog SHA must match. URLs are owned content-addressed
Home URLs; signed API URLs and private metadata never enter the graph.

The collector resolves artwork targets before availability/relevance filtering,
so daily rotation, Story exclusion and the 20-item Home schedule do not hide
artwork from the shared registry. One GET-only collection attempts at most 20
observed listbutton URLs, within 60 seconds and 8 MiB. PNGs are decoded and only
horizontal aspect ratios 3..6 are admitted. Same path is downloaded again when
its turn arrives; changed bytes produce a new URL. Unchanged bytes are deduped.

First collection prioritizes Home candidates. Subsequent rounds follow a durable
typed-target cursor; failed targets advance the scan without deleting last good
art. Budget-omitted targets do not advance it. This is deliberately gradual, not
an every-event-every-six-hours claim: the real sample resolved 403 targets, so a
full successful scan at 20/round takes approximately 21 six-hour slots. Existing
catalog artwork remains the fallback during initial coverage. Future faster
launch-aware scans or a bounded initial backfill are separate optimizations.

The existing runner loads the hash-verified previous graph before collecting.
This traversal shares a 20-second cancellation budget (10 seconds per request).
An unreadable graph blocks replacement rather than becoming an empty registry.
Source/image failure retains prior mappings. Shared art is collected before
the optional Burst resource read. An art change never marks an event as new.

Publication retains the existing staging namespace, lease and manifest-last
flow. Shared-art releases permit up to 70 objects (40 pre-existing Home assets,
20 art PNGs, eight shards and two Home JSONs); legacy releases remain capped at
42. The 16 MiB write ceiling and 8 GB bucket guard are unchanged. Publication
preflight and writes share a five-minute budget, capped below the
lease deadline with a 120-second network/receipt reserve. The verified Home
receipt is saved before optional campaign/news refreshes. Extra operations must be bound
to validated artwork shards and at most 20 referenced PNGs, not merely an index
marker. A budget failure retains the previous manifest; no blind retry is added.
Existing objects are not uploaded again. No R2 deletion/automatic garbage collection was
added: any future prune must traverse retained Home manifests AND artwork
shards, protect referenced PNGs, and be explicitly approved with a dry-run.

## Evidence and release boundary

- 303 pipeline tests passed, including schema, bad hashes, 2000-target bound,
  failed oldest target, Burst 503, forty summon images, dedup and manifest order.
- A real collect-only run fetched 20 horizontal images totaling 984748 bytes.
- Native replay uses verified PNG bytes and the provider shard contract; its
  historical event dates are fixture data, not current availability claims.
- Per user request after PC crash: use Android Studio AVD Store_Phone34, not
  LDPlayer. Emulator booted without wiping app/user data.
- Android: 71 focused unit tests passed; APK and test APK build succeeded.
- Both native replay tests passed on Store_Phone34: phone and wide/font-scale 2.
  Primary inspected both screenshots, confirmed horizontal Light of Hope and
  current Frieza art, with no clipping. Screenshots are in the Android worktree
  `.agent-logs/shared-art-studio-phone.png` and `shared-art-studio-wide.png`.
- User approved commit, push and staging publication on 2026-09-15, then PC hibernation.
- Android commit `33b2f9a1`; pipeline `ff8c0c7`, fast-forwarded to remote main.
- The full refresh respected the already reserved six-hour slot and made no
  game request. An authorized data-only promotion instead published 20 recently
  verified first-party artworks, including Light of Hope and current Frieza.
  Existing live Home dates, News and Summons were preserved (no replay payload).
- Dry-run: bucket 1,687,893,110 bytes; writes 1,022,666 bytes; new bytes 1,022,474.
  All objects publicly verified before conditional manifest promotion. The
  previous manifest ETag fenced this data-only operation; no scheduled lock was
  removed, reclaimed or modified, and no game login occurred.
- Verified manifest SHA: `a93a9d3dff75caab1d8ae3368bfe5167ffabb2c9c34a820bf8ccac27d3bd9344`.
  Existing scheduled main refresh will retain/extend this registry in later batches.
