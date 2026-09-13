# Campaign public candidate — version 1 proposal

Status: local producer implemented and tested with synthetic responses. Not
published or enabled in the scheduled Home job. Android now has a separate public
reader; the existing offline-preview entrypoints still reject this schema.
Deployment review and native integration remain required. Production is out of scope.

Verification: the isolated Node suite passed 145 tests, then the authentication
suite passed 15 tests after adding a one-MiB advertised/streamed-body regression.
Collector/public-projection review found no material boundary violation. These
tests use synthetic requests only; no fresh real-account observation is claimed.
Android public/preview/transport and offline lifecycle checks passed together:
57 tests, zero failures or errors. Independent public-reader, HTTPS-source and
atomic-catalog-store reviews found no material issue. Neither the public reader
nor the transport has a production DI binding.

## Fresh collection boundary

`collectCampaigns` is disabled unless `enabled === true`. It validates the complete
independently pinned static definitions before authentication. The new `campaigns`
session scope allows only one GET `/missions/mission_board_campaigns`, following
one nonce/sign-in sequence. It cannot access summons, events, reward acceptance,
images or arbitrary paths; the response is bounded to 1 MiB. Failures poison the
session, close it and return a fixed unavailable result without retry.

Observation time is measured by the collector, not copied from caller-provided
JSON. Clock rollback and total collection time of 60 seconds or more reject the
result. Missing current definitions reject the join; do not perform another login
or silently reuse an older successful response to hide that failure.

This module is deliberately absent from `collectHome` and the scheduled runner.
No new credential or scope was activated remotely. Actual collection must be
coordinated with the pending Home verification; do not bypass its durable slot or
create concurrent game sessions merely to validate this proposal.

## Public projection is separate from preview

`prepareCollectedCampaignCandidate` accepts only a successful in-process result
registered by this collector. Copies, deserialized historical previews, arbitrary
receipt objects and expired observations are rejected. The private registry stores
detached copies so caller mutation of returned preview buffers cannot alter the
trusted projection. Test-injected I/O and clocks remain trusted test seams, not
independent cryptographic proof of a network observation.

The public producer uses an explicit context with:

- `schemaVersion: 1`, `region: global`, `source: global-game-campaigns`;
- `coverage: partial-observation`, `contentSemantics: mission-definitions`;
- canonical `observedAt`, exclusive six-hour `validUntil`;
- `revisionSha256`, derived only from the public context, campaign definitions
  and mission definitions, never from the raw account response.

Campaigns, boards, missions and rewards are already allowlisted and structurally
joined by the preview builder. No progress wrappers, credentials, media URLs,
private receipt hashes, database hashes or raw observation hashes are published.
A regression verifies that changing private mission progress does not change any
public candidate byte when the public data and observation time are identical.
This is a new schema/projection, not deletion of preview safety flags.

Coverage does not mean all campaigns available to every player. Reward quantities
are static definitions, not outstanding rewards or proof of eligibility. Visible
deadlines follow the existing hidden/unknown/sentinel policy; never invent a date.

## Three document types

Proposed staging prefix: `staging/v2/campaigns/` (not the existing Home prefix).

| Document | Contract | Content |
| --- | --- | --- |
| `manifest.json` | `dokkan-campaign-manifest` | Schema/region, exact index file/hash/size |
| `index/<sha256>.json` | `dokkan-campaign-index` | Public context and compact summaries with typed destinations |
| `details/<sha256>.json` | `dokkan-campaign-detail` | Matching public context/revision, one campaign and its referenced missions |

Manifest maximum: 4 KiB. Index maximum: 32 KiB. Detail maximum: 512 KiB.
Total candidate including manifest: 4 MiB. All byte identities are SHA-256 of
expanded UTF-8 JSON; no content encoding is required by this proposal.
The internal candidate retains `publicationAllowed: false`; it is not a publish
receipt. No publisher/gateway extension exists for this prefix.

The native typed destination is `{type: campaign-detail, campaignId, detailSha256}`.
The client constructs object locations locally, verifies manifest/index/detail
pins and checks full revision/summary/mission relationships. It must not treat a
correct hash alone as proof that detail bytes belong to the selected campaign.

## Remaining activation gates

1. Independent review of collector/public projection and isolated HTTPS source:
   completed without material findings, including the final manifest bootstrap.
2. A coordinated fresh observation and useful-data report without private output.
3. Public manifest retrieval, fresh offline bootstrap and failed-refresh retention
   are implemented, including shared runtime ownership and restricted temporary
   maintenance. No DI or UI is wired.
4. Reviewed publication capability limited to this prefix, read-only preflight,
   explicit publication authorization, immutable-details-first/manifest-last.
5. Native navigation and UI design/validation; only then Home activation.

Existing Home publication permissions do not authorize this new storage prefix.
Do not silently repurpose the Home gateway to upload campaigns or broaden it to
general-purpose storage. No paid infrastructure or spending limit changes are
required by this local work.

## Refreshed static definitions — 2026-09-13

After the separately authorized production Character refresh, campaign preparation
resumed using the new Global SQLite snapshot `1789006776`, database SHA-256
`dcccb18baf72727e3f31db6b2f17a11eefb1b3f9aecaa75a04cfbabfae89e7b8`.
The existing historical board selection was re-exported with the bounded,
digest-pinned, read-only exporter. All 17 board/category/completion/reward joins
remain aligned: 17 categories, 159 missions and 502 static rewards, 99,599 bytes.
Definition SHA-256:
`c34825663273ad1ce6ad7a118a9d042fdfe154d3590333427056a603df65eadf`.

Local artifacts and the safe receipt are in the main pipeline `.agent-logs/`
(`campaign-definitions-<sha256>.json` and
`campaign-definition-refresh-20260913-receipt.json`). No HAR, token, progress or
network request was needed for this step. This is a fresh database with a
historical selection, **not** a fresh campaign observation or proof of current
availability/completeness. A coordinated observation must still validate every
selected join; new categories must not be silently filled from old definitions.
No campaign/Home publication, scheduled collector change or native activation
was performed.

## Local publication planning

`plan-campaign-publication.mjs` prepares an immutable, metadata-only plan from a
genuine in-process collector result. It invokes the separate public projection,
checks freshness at planning time, and emits exact owned keys, hashes, byte counts,
content metadata and intended write modes. Detail objects come first, then the
index, with the mutable manifest strictly last. It performs no network or file
I/O and contains no credentials, payload bodies, uploader or storage capability.

Four synthetic tests passed for ordering/byte totals, forged or expired input,
defensive separation from experimental buffers, frozen output and empty catalogs.
The test log is local at the integration worktree's
`.agent-logs/campaign-publication-plan-tests.log`.

This is **not a remote dry-run, permission grant or executable publication**.
`publicationAllowed` and `remotePreflightPerformed` remain false. Candidate byte
totals are known; current bucket usage, reuse/conflicts and net storage growth are
unknown (`projectedBucketBytes: null`). A future authorized preflight must inspect
those before any upload, remain below the configured storage budget, and reject
immutable-key conflicts. A future publisher must recheck freshness, verify every
dependency, conditionally replace the manifest against the observed remote state,
and verify public bytes after promotion. No rollback/delete policy is inferred.

## Read-only preflight implementation — 2026-09-13

`preflight-campaign-publication.mjs` now checks injected object and bucket readers
without any upload capability. It rejects immutable collisions, changed manifest
versions, malformed metadata, expired candidates, clock rollback and checks taking
60 seconds or longer. Exact objects are reusable; planned writes count their full
size conservatively. The default ceiling is 8 GB, reserving 2 GB below the 10 GB
upper bound; reaching the configured ceiling is rejected, not accepted.

The frozen report is metadata only and keeps `publicationAllowed: false`.
Twelve focused planning/preflight tests pass, including version-only races and
budget equality (`.agent-logs/campaign-preflight-final-tests.log`). Independent
review identified the storage-margin boundary; it was corrected and retested.

These injected readers are trusted test/integration seams, not evidence of live
remote verification. There is no live adapter, new permission or publication.
A future adapter must bound and cancel network requests itself: checks after an
await do not cancel a reader that never resolves. A publisher must obtain the
separate prefix authorization and freshly recheck all conditions before writing.

## Authorized staging activation — 2026-09-13

Lucas explicitly authorized checkpoint push and campaign staging publication.
The new local `campaign-r2-store.mjs` adapter restricts reads/writes to manifest,
hashed index and hashed detail objects under `staging/v2/campaigns/`, pins the
existing bucket, enforces size/hash/conditional-write metadata, and exposes no
delete. Existing local R2 credentials remain local; the hosted Home gateway,
its permissions, production and spending settings are not changed.

`publish-campaigns.mjs` requires the exact authorized target and a genuine
in-process collection, reports preflight before any put, rechecks inventory and
manifest witnesses, verifies immutable dependencies before manifest promotion,
and verifies public bytes. Failed/uncertain writes never claim rollback.

The first live collection authenticated but campaigns returned HTTP 400. Offline
comparison with the successful first-party capture found endpoint-specific
`X-RequestVersion: 5`, while the reusable Shop config supplies `11`. The session
now overrides that header for campaigns only, without altering login or other
scopes. Regression tests passed. This is a new corrected attempt, not an automatic
retry loop; a subsequent failure must stop without publication.

The corrected attempt also returned HTTP 400 after nonce/sign-in HTTP 200.
It stopped before projection/preflight/publication: no campaign objects were
written and no existing manifests were changed. Safe receipts are local at
`D:/Dokkan/DokkanWebScraper/.agent-logs/campaign-live-20260913-{a,b}/receipt.json`.
The header mismatch was real but does not by itself explain the current rejection.
Further game requests are paused pending a current successful campaign-screen
capture; do not guess parameters or loop authentication attempts. The publication
authorization remains valid, conditional on successful collection and validation.

Verification: 179 integrated Node tests passed; after the measured inventory
duration adjustment, all 12 publisher tests passed again. Publisher lifetime is
180 seconds, preflight remains 60 seconds, and each transport request is bounded.
The read-only bucket inventory observed 1,656,917,608 bytes. No actual campaign
write proposal was produced because collection failed first.
