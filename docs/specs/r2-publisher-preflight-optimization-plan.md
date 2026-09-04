# R2 publisher preflight optimization plan

## Status and execution boundary

OPT-R2-01 was implemented, reviewed, committed and pushed on 2026-09-04. Its
staging and production rollout gates have also completed successfully. The
optimization remained separate from the production dataset refresh and its
dataset/passive-mode checkpoint.

The publisher continues to require separate authorization for each real R2
publication. The completed rollout does not authorize future remote reads,
writes, publications, commits or pushes; dry-run, byte-budget and baseline-pin
gates remain mandatory.

Tracking name: **OPT-R2-01 — verified portrait inventory fast path**.

Implementation commit: `56caae86953587cc25aa2400043acc2d9fbe8f1a`
(`feat(r2): add verified inventory fast path`). The commit contains only the
12 publisher source, test and corresponding tracked `lib/` files. It was
pushed to `origin/main` at the same hash.

## Implementation and rollout result

### Local implementation gates

- TypeScript build passed.
- Focused publisher tests passed: 64.
- Broad publisher suite passed: 181 passing and one pre-existing Windows
  symlink-dependent pending test.
- `git diff --check` passed.
- Final review returned GO with no unresolved P0-P3 material finding.
- The 3,303-portrait fixture uses four complete LIST pages, zero portrait body
  GETs, zero local body reads and zero PUTs on the trusted-receipt fast path.

The implementation uses one S3 client per operation, bounded concurrency and
retries, per-attempt timeouts, paginated inventory reads, opaque ETag/version
witnesses, schema-2 receipts, create-only immutable writes, exact readback,
three baseline checks around writes, and manifest-last promotion. Receipt
bootstrap is an explicit read-only operation requiring a full audit and a
pinned baseline.

### Staging/v2 rollout

The schema-2 bootstrap audited all 3,303 staging portrait bodies once and
performed zero PUTs. The first trusted-receipt dry-run then completed in about
nine seconds with four LIST pages, two fixed GETs, zero portrait body GETs and
zero planned writes.

A separately authorized live validation promoted the already validated
2026-09-04 production Character data to the isolated `staging/v2` lane. It
wrote only:

- immutable payload
  `staging/v2/releases/2026-09-04T02-57-39.813Z/8c48e2e87f7dbc6dda040ba2838aef2aa4b31ed446c28c62d20a02e081d5276d/characters.json.gz`,
  2,602,106 bytes, SHA-256
  `8c48e2e87f7dbc6dda040ba2838aef2aa4b31ed446c28c62d20a02e081d5276d`;
  and
- mutable `staging/v2/characters-manifest.json`, written last, 456 bytes,
  SHA-256
  `d182e35023956568a8004f93ffecdc39f31d501449129507eb8c01e4500c8892`.

Live telemetry was four LISTs, seven GETs and two PUTs with zero retries. All
3,303 portraits were reused; no portrait was uploaded, overwritten or deleted.
Independent public HTTP reads returned status 200 and reproduced both hashes.
The post-publication dry-run was idempotent: four LISTs, two GETs, zero PUTs and
zero portrait body GETs.

### Production/v2 rollout

The production bootstrap was strictly read-only against pinned Character
baseline
`f3d9a59708be5ad906bee4abe5486084706bf6f94b6ebfc831d0eb156b22311b`.
It performed four LISTs and 3,306 GETs, verified 69,937,681 bytes, reused all
3,303 portraits, found no conflict and performed zero PUTs or deletes. Only
after the final baseline reread did it atomically create the local schema-2
receipt. Its deterministic portrait inventory SHA-256 is
`0c2c18426e8243280fa2ee2f56fbebb306928037fde6b447951ce277ab65d58e`.

The following normal production dry-run completed in about nine seconds with
four LISTs, two fixed GETs, zero portrait body GETs, zero PUTs and all 3,303
receipts reused. A separate public HTTP audit confirmed that production was
unchanged:

- `v2/characters-manifest.json`: 448 bytes, SHA-256
  `41a5586a57103d5efb6d6c3dddd2a603e7bff050a5cfac5b421d5ba394b0f142`;
  and
- immutable payload: 2,598,421 bytes, SHA-256
  `f3d9a59708be5ad906bee4abe5486084706bf6f94b6ebfc831d0eb156b22311b`.

No production object was written during bootstrap or fast-path validation.
No cleanup or historical-object deletion was performed in either channel.

## Problem statement

The long wall-clock time of a routine Character refresh is mostly publisher
preflight, not transfer of changed data.

`publish-r2.ts` currently performs the following work for every portrait that
appears reusable in the local schema-1 publication state:

1. starts a separate Node/Wrangler process;
2. downloads the complete remote object into a temporary file;
3. reads the file again locally;
4. validates its exact size and SHA-256; and
5. repeats that work in the dry-run and again in the live publication.

Production v1 currently references 1,637 portraits and production v2
references 3,303 portrait/layer objects. Project history records stable
preflight times of roughly 8–9 minutes for v1 and 16–20 minutes for v2 at
concurrency 4, with HTTP 429 failures at more aggressive concurrency. A dual
lane refresh can therefore spend most of its time proving thousands of
unchanged bytes more than once.

The 2026-09-04 production candidate demonstrates the mismatch: its meaningful
write plan contains four Character/Team payload-or-manifest objects totaling
5,827,026 bytes and no portrait changes, but the Character preflight still
revalidates every referenced portrait. Uploading four small objects is not the
hours-long part of that workflow.

The relevant current boundaries are:

- `readPublishedPortrait()` starts `wrangler r2 object get` for one object;
- `verifyReusablePortraitEntries()` downloads and hashes every schema-1 state
  candidate;
- the dry-run returns before writing a new publication state, so it cannot
  leave a reusable verification receipt for the subsequent live run;
- `--skip-portraits` is intentionally rejected for typed portrait-layer
  payloads and must remain rejected; and
- uploaded portraits, payloads and manifests are currently read back and
  verified before manifest-last promotion. That invariant must remain.

Cloudflare recommends its S3-compatible API or Workers API for high-throughput
object operations rather than the account REST API. The documented REST limit
is 1,200 requests per five minutes. R2 supports `ListObjectsV2`, `HeadObject`,
conditional operations and object metadata through its S3-compatible API.
Single `PUT` remains appropriate for the small Character and Team payloads;
multipart upload is intended for substantially larger objects and does not
solve this preflight bottleneck.

References, retrieved 2026-09-04:

- <https://developers.cloudflare.com/r2/platform/limits/>
- <https://developers.cloudflare.com/r2/api/s3/api/>
- <https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/>
- <https://developers.cloudflare.com/r2/objects/upload-objects/>

## Goals

OPT-R2-01 must:

- reduce an unchanged 3,303-object portrait preflight from one complete GET
  and one Wrangler process per object to a small paginated inventory read;
- preserve exact SHA-256 authority for every referenced portrait;
- detect a missing, replaced, truncated or otherwise drifted remote object;
- verify new uploads before promoting a mutable manifest;
- retain baseline-pinned, manifest-last, immutable-key and no-delete behavior;
- keep v1/v2 and staging/production state isolated;
- remain resumable after a failed process without trusting partial work;
- make the number and reason for every LIST, HEAD, GET and PUT visible in the
  dry-run summary; and
- provide an explicit full-audit mode for periodic or incident-driven
  byte-for-byte verification.

## Non-goals

This work must not:

- weaken verification to make the current publication finish sooner;
- modify a publisher while it is running;
- make `--skip-portraits` legal for typed layered payloads;
- treat an ETag as SHA-256 or assume that an ETag is always an MD5 digest;
- overwrite an immutable portrait key;
- delete historical releases or portraits;
- alter Character, Team Analysis, Android or dataset contracts;
- change R2 keys, public URLs, cache policy or the 10 GB budget gate;
- introduce multipart upload for the current small payloads; or
- immediately generalize the change to Stage, Support Memory or item assets.

Those other publishers may adopt the proven mechanism later, in separate
slices with their own tests and authorization.

## Required safety invariants

The optimized publisher remains fail-closed:

1. **Content authority remains SHA-256.** Local candidate bytes are hashed as
   they are today. A trusted receipt records the SHA-256 established by a
   prior complete remote GET or immediate post-upload readback.
2. **ETag is only a remote-version witness.** A matching stored/current ETag,
   key and size allows reuse of the previously proven SHA-256. ETag is never
   compared with, converted into or described as SHA-256.
3. **Immutable keys stay create-only.** An unrecognized pre-existing key is
   not overwritten. Its body must be downloaded and proven equal or the run
   aborts as a conflict.
4. **Metadata drift cannot pass silently.** Missing keys, changed size, changed
   ETag, missing receipt entries, invalid state and inventory ambiguity leave
   the fast path and require exact body verification or abort.
5. **The mutable manifest is always last.** Payload and newly required
   portraits must exist and pass exact verification before promotion. The
   uploaded manifest is then read back and verified exactly.
6. **Baseline pins remain mandatory.** The remote mutable manifest is read and
   matched against the user-supplied SHA-or-absence pin immediately before a
   write. A changed baseline aborts without mutation.
7. **State is evidence, not authority by itself.** State is accepted only for
   the exact bucket, target, channel, contract lane and bound remote-manifest
   baseline. Losing state causes a slower audit, never a silent skip.
8. **Dry-run and publish decisions are reproducible.** The live publisher must
   recompute or revalidate the remote inventory and baseline. A dry-run receipt
   may avoid repeated body GETs only when every bound identity still matches.
9. **No cleanup is implied.** Historical immutable objects remain retained;
   garbage collection continues to require a separate release-aware policy.

## Proposed design

### 1. Reuse one S3 client

Replace the per-object Wrangler child-process transport in the Character
portrait inventory path with one `@aws-sdk/client-s3` client for the whole
operation. The dependency and reviewed S3 client patterns already exist in
this repository.

Wrangler may remain for low-volume bucket information or local-mode behavior
until those paths are deliberately migrated. No command should contain or log
credentials. Remote S3 credentials continue to come from the existing
ephemeral environment boundary.

### 2. Add schema-2 verified publication state

Keep schema-1 readable for compatibility but do not silently grant it the fast
path. Schema 2 should bind at least:

- bucket and remote/local target;
- publication channel and contract lane;
- remote mutable-manifest key and exact verified SHA-256;
- dataset version and immutable dataset object key;
- a deterministic SHA-256 of the sorted portrait inventory; and
- one record per portrait containing object key, authoritative SHA-256,
  expected byte size, opaque remote ETag and the verification method.

The semantic inventory digest must exclude timestamps. Operational times may
be recorded separately but must not affect equality. State is written
atomically only after the publication or read-only verification operation has
completed successfully.

Allowed verification methods should distinguish at least:

- `full-get-sha256`: remote body downloaded and hashed exactly; and
- `post-upload-sha256`: newly uploaded body immediately downloaded and hashed
  exactly.

An inventory-only observation is not sufficient to create an authoritative
SHA-256 receipt.

### 3. Build one paginated remote inventory

Use `ListObjectsV2` over the exact managed portrait prefix or prefixes and
consume every continuation token. Canonicalize the result into a map keyed by
the exact object key. Reject duplicate, malformed or out-of-prefix entries
that would make the decision ambiguous.

For each locally referenced portrait:

- if schema-2 state has the same key, SHA-256 and size, and the new remote
  inventory has the same opaque ETag and size, reuse the prior cryptographic
  proof without downloading the body;
- if the key is absent, plan a create-only upload;
- if ETag or size changed, perform a full GET and SHA-256 verification;
- if the full GET exactly matches, refresh that receipt instead of uploading;
- if a pre-existing object does not match, abort as a conflict; and
- if no trustworthy receipt exists, perform a full GET rather than trusting
  list metadata.

With one managed prefix and the normal 1,000-key S3 page size, 3,303 unchanged
objects should require approximately four LIST pages and zero portrait-body
GETs. Tests must assert operation counts rather than a fragile wall-clock
threshold.

### 4. Preserve exact verification for writes

Every new portrait upload remains create-only and is followed by a complete
GET, byte-size comparison and SHA-256 calculation. Record the returned/listed
ETag only after that proof succeeds.

Payload and manifest behavior remains unchanged in substance:

1. prove the pinned mutable baseline;
2. upload an absent immutable payload when needed;
3. read it back and verify exact size/SHA-256;
4. prove every referenced portrait through receipt reuse or exact readback;
5. recheck the mutable baseline;
6. upload the manifest last; and
7. read back and verify the manifest bytes.

### 5. Separate fast refresh from full audit

Provide an explicit full-audit mode that ignores receipt reuse and downloads
every referenced portrait. Use it for:

- schema-1 to schema-2 bootstrap;
- missing or corrupt local state;
- periodic integrity audits;
- suspected external R2 mutation; and
- incident recovery.

The ordinary refresh uses the fast path only after schema-2 has been created by
a complete proof. A prose report or screenshot is not a machine-readable
receipt and cannot bootstrap state retroactively.

## Migration and rollout

1. Treat the completed 2026-09-04 production refresh as the frozen baseline.
   Its four public objects passed independent verification and its
   post-publication dry-runs are idempotent.
2. Preserve commit `37012e3` as the separate dataset/passive-mode checkpoint.
   OPT-R2-01 must not be mixed into that semantic dataset commit.
3. Implement the reusable S3 transport, canonical remote inventory and
   schema-2 receipt behind focused pure interfaces.
4. Run a one-time schema-2 bootstrap using the new single-client full-audit
   path. This may still download all portraits once, but it avoids thousands
   of process startups and establishes the durable fast-path baseline.
5. Run a read-only shadow comparison: old and new planners must produce the
   same upload/conflict decisions for an exact pinned baseline.
6. Run an unchanged staging/v2 dry-run. It must use the receipt fast path and
   plan no portrait writes.
7. Request a material contract/concurrency/provenance review. Resolve every
   P0–P2 finding before any publication using the new path.
8. Commit and push the publisher optimization separately when explicitly
   requested.
9. Use it for a separately authorized staging publication before production.
10. Promote its use to production only after staging dry-run, live publication
    and post-publication audit agree.

No step above itself authorizes the next step.

## Required tests

Focused unit and integration tests must cover:

- 3,303 unchanged schema-2 entries: all reusable, zero body GETs, zero PUTs
  and only the expected paginated LIST calls;
- one missing object: one create-only upload followed by exact body readback;
- changed ETag with matching remote bytes: one full GET and refreshed receipt;
- changed ETag with mismatching bytes: hard conflict and no writes;
- same ETag with changed size: no reuse;
- missing, malformed, cross-bucket, cross-channel or cross-lane state: no fast
  reuse;
- schema-1 state: explicit full-audit/bootstrap path, never silent adoption;
- stale mutable-manifest baseline before upload: abort with zero writes;
- baseline race before manifest promotion: abort without manifest mutation;
- transient 429/5xx/network read errors: bounded jittered backoff and terminal
  failure after the configured ceiling;
- dry-run: no R2 mutation and a deterministic operation-count summary;
- uploaded portrait verification failure: no manifest promotion and no
  schema-2 receipt write;
- payload verification failure: no manifest promotion;
- manifest-last ordering and exact manifest readback;
- independent state for production/v1, production/v2, staging/v1 and
  staging/v2; and
- explicit full-audit mode still downloads and hashes every remote body.

The existing `publish-r2.spec.ts` exact size/SHA reuse test must remain in
force or be superseded by stronger receipt/inventory cases. TypeScript build,
focused publisher tests and `git diff --check` are mandatory. A single broader
publisher validation is warranted because this changes remote transport,
concurrency, cache/state and provenance behavior.

## Acceptance criteria

OPT-R2-01 is complete only when all of the following are true:

- an unchanged production-v2-shaped fixture reports 3,303 reusable portraits,
  zero portrait GET bodies, zero portrait PUTs and no deletes;
- the planner's LIST count is bounded by complete pagination, not object count;
- changed or untrusted objects still receive exact size/SHA-256 verification;
- the fast and full-audit planners agree on the final reusable/upload/conflict
  sets for the same frozen remote snapshot;
- a failed or interrupted run cannot create a trusted receipt for unverified
  objects;
- dry-run and live summaries report LIST/HEAD/GET/PUT/retry counts and bytes;
- no secret appears in commands, logs, state or test fixtures;
- a contract reviewer returns GO with no unresolved P0–P2 issue;
- staging validation proves manifest-last promotion and idempotent rerun; and
- measured wall-clock time is reported for comparison, while correctness is
  gated by deterministic operation counts rather than a network-speed target.

## Expected impact

For a routine refresh with no portrait changes, remote portrait work should
fall from thousands of child processes and full-body downloads to a few
paginated inventory requests. The remaining network work is the fixed
manifest/budget validation plus the small number of genuinely changed
payloads and assets. A four-object, approximately 5.8 MB update should
therefore be governed by normal network latency and verification of those
objects rather than by a complete 3,303-object portrait replay.

This is a performance optimization of the proof mechanism, not a relaxation of
the proof.
