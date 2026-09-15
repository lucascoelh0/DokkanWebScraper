# Public News library v1

Approved follow-up, 2026-09-14. Canonical machine-readable boundary:
`home-feed/contracts/news-library-v1.schema.json`. Main session owns integration.
Home's six-item preview and 64KiB budget remain unchanged. Android reads a separate
`staging/v2/news/manifest.json`, <=1KiB, with schemaVersion1, file `index/<sha>.json`,
sha256 and sizeBytes. Index <=1MiB; immutable article `articles/<sha>.json`
<=256KiB; images `images/<sha>.png` <=2MiB, decoded <=4 million pixels.
No app requests to game API. No arbitrary URLs or signed query strings in output.

Index is the complete returned nonfuture observation, not a global historical
archive. IDs unique; category and tab independent. Missing image/detail are null
and explicitly unavailable, not empty success. Freshness exactly6h. Old cached
Home works as fallback if the library is not deployed, loading fails or is old.
Existing opened articles remain readable offline; do not put article bodies into
saved-state Bundles. Cached content stays bounded and hash-verified.

Observed API `bodies[].layout_type=0`: image first, then description. Preserve
array order. Source image must be an exact observed first-party news PNG URL.
Unknown layouts retain text with an explicit unavailable block; no invented
image order. Native text interprets bounded game markup, never executable HTML.
First body image replaces the redundant index banner on the article surface.

Collection is independently bounded: one fresh index, <=100 observed article IDs,
<=256 observed PNG fetches, <=64MiB decoded delivery bytes, <=180s total, no retry.
Auth requests count toward103 API calls. Index beyond100 stays listed with null
detail; coverage must not claim those articles are downloaded. Existing Home
scope limits remain unchanged. Shared standard refresh lease must own publishing;
do not bypass an occupied six-hour slot. This is not an unbounded live proxy.

Publication/hosted activation requires separate release validation: independent
bounded namespace, content-addressed dedupe, capacity dry-run before writes,
lease fencing and manifest-last CAS. No production delivery or automatic scope
activation is implied by defining this contract. Tests cover source order,
signed URL removal, unknown layouts, invalid descriptors, old cache fallback and
public hash verification. User examples107213/107305 verified directly from API.

## Implementation evidence — 2026-09-14

The real bounded collection returned 90 announcements, 90 article documents and
190 unique images (21,609,112 delivery bytes). This is an actual observation,
distinct from the 91-row controlled transport test. Local public artifacts are
under `.agent-logs/news-library-real`; no new News objects have been published.
The collector/auth/publisher suite passes 25 tests, including CAS, lease loss,
manifest-last failure, public-byte corruption and metadata repair. Publication
still needs standard-slot release integration and a capacity dry-run; the new
scope is not enabled in scheduled refreshes.

## Authorized rollout integration

The user subsequently authorized commit, push, automatic refresh integration and
staging publication. `hostedNewsRefresh` now runs after Home and Campaigns under
the same standard six-hour reservation. Failures retain already-published Home
and the previous News library; the host exits nonzero on News failure, without
retry. The job keeps its existing 15-minute timeout and concurrency group.

Activation uses `HOME_FEED_NEWS_LIBRARY_ENABLED`, `NEWS_GATEWAY_URL`, and a separate
`NEWS_GATEWAY_TOKEN` in the existing protected GitHub environment. The gateway
exposes only News object/inventory routes to that credential, bounded paths and
hash-checked conditional writes. Home/Campaign credentials cannot access News.
No broad R2 secret is provided to GitHub. The dry-run report precedes upload;
manifest promotion remains last. Real publication receipts will be recorded here.

Android consumes the separate index, pins immutable article descriptors across
restoration, validates and caches image bytes, and uses cancellable bounded HTTP.
Unknown layouts and game-specific embedded character widgets remain explicit
unavailable content; this renderer does not claim full game-widget parity.
