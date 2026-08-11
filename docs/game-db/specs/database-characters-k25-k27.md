# Database Characters K25-K27

## Decision

K25-K27 replace unsafe stable portrait delivery with content-addressed remote
keys. They are an offline derivation plus a remote read-only preflight. They do
not publish, mutate R2, promote a manifest, alter Android, or activate
production data.

## K25: Versioned Portrait Projection

K25 accepts only a fully revalidated K21-K23 release. The validated payload
bytes are captured by the release reader and passed in memory, avoiding a
second untrusted path read.

The source JSON must be byte-for-byte canonical under the repository's own
two-space serialization contract. This rejects duplicate JSON keys and any
alternate serialization before derivation. The declared uncompressed size is
bounded at 32 MB before decompression, and zlib enforces the same output cap.
The explicit CLI additionally runs with a 512 MiB V8 old-space ceiling. The
real K21 payload is 13,516,376 raw bytes, leaving deliberate growth headroom
without permitting a near-200 MB object graph to multiply in memory.

The real local K25/K26 run peaked at 501,297,152 RSS bytes under that CLI
ceiling, below the repository's 1 GiB campaign limit.

Every `portraitURL` matching `images/v2/portrait_<id>.png` is rewritten to:

```text
images/v3/portrait_<id>.<portrait-sha256>.png
```

The hash and size come from the K21 portrait inventory. K25 rejects missing,
duplicate, malformed, or unused mappings. It removes `portraitURL` values from
both source and derived JSON and requires the remaining structures to be
identical. Character IDs, order, count, dataset version, and generation time
must also remain unchanged.

The resulting character gzip is content-addressed independently. K25 keeps the
new payload and manifest in memory and does not create another `latest`
directory or duplicate portrait files.

## K26: Delivery Plan

K26 deterministically plans:

- one content-addressed character payload;
- one content-addressed `images/v3` object per validated portrait;
- the mutable `characters-manifest.json`, with `no-store` caching.

Immutable objects use one-year immutable caching. Portrait local paths refer
back to the validated K21 release, so the approximately 18 MB portrait set is
not copied. The plan must remain below the 50 MB character release namespace
guard. Bucket capacity is unresolved until K27.

## K27: Remote Read-Only Preflight

K27 requires exactly:

```text
--opt-in-k25-k27 --release-id <release-id> --remote
```

It uses only public HTTPS GETs from `assets.dkbcompanion.com` and the fixed
Wrangler command `r2 bucket info dokkanpanion-data --json`. Redirects,
compressed responses, oversized responses, content-address conflicts, read
failures, unknown bucket usage, and an unsafe projected bucket total all fail
closed.

Before any remote read, K27 rebuilds K25 and K26 from the validated release and
requires complete contract equality plus byte-identical payload and manifest
buffers. A caller cannot remove objects, alter hashes, or replace buffers while
retaining a passing preflight.

The expected normal result for a first versioned release is that every v3
portrait and the new payload are missing, while the current mutable manifest
is different. Missing objects are not errors; conflicting bytes at a
content-addressed key are errors.

## Readiness

| Capability | Decision |
|---|---|
| K25 in-memory projection | GO |
| K26 deterministic local plan | GO |
| K27 remote read-only preflight | GO when all checks pass |
| Publication authorization | REQUIRED |
| Publisher implementation | NO-GO |
| R2 mutation | NO-GO |
| Manifest promotion | NO-GO |
| Production activation | NO-GO |
| Android change | NO-GO |

The next gate may design a stopped publisher only after K27 passes against the
real release. Any real upload remains a separate user-authorized action and
must repeat the remote dry-run immediately before writing.

## First Real Run

Release:

```text
dc82059973fb399da84cb5769b5947ceacde2774b3a0883ca6a85fbfb8d07dcb-
fb5a1b442fa39a6f1cfd64e35336a4a6c8fd970dd0863bd62e41eacc75eb8148
```

K25 produced 1,436 characters, 1,627 portrait mappings, a 1,295,005-byte
payload and an 18,797,554-byte worst-case plan. K27 inspected all 1,628
immutable objects in 33.4 seconds: zero matched, all 1,628 were missing, and
there were zero conflicts or read failures. The current manifest differed and
still points to dataset `2026-07-20T20:22:44.502Z`.

Wrangler reported 343 MB. The conservative current upper bound is 344,000,000
bytes and the projected post-publication upper bound is 362,797,554 bytes,
comfortably below 10 GB. K27 therefore returned GO for the read-only preflight
while retaining REQUIRED publication authorization and NO-GO for every write,
production, Android, and R2 mutation decision.
