# Database Characters K24

Status: implemented as an explicit, remote, read-only preflight.

## Purpose

K24 reopens an exact K21-K23 local release, revalidates every local byte and
derivation, and observes the corresponding remote object namespace without
possessing upload, delete, or manifest-promotion commands.

It answers the four remaining delivery questions:

1. whether every stable portrait key is absent or has the exact expected bytes;
2. whether the content-addressed character payload already exists;
3. whether the current mutable manifest matches the candidate;
4. whether a conservative post-publication bucket upper bound stays below the
   user's 10,000,000,000-byte ceiling.

## Remote contract

- Public object reads are fixed to `https://assets.dkbcompanion.com/` and use
  GET with redirects and content encodings rejected.
- The only Wrangler command is the fixed read-only command
  `r2 bucket info dokkanpanion-data --json`.
- Object keys come exclusively from the rederived K22 plan. Immutable keys are
  restricted to the content-addressed payload and
  `images/v2/portrait_<numeric-id>.png`.
- Individual responses are limited to 5 MB; aggregate bytes are limited to
  50 MB; concurrency is bounded to 12.
- A matching immutable object is reusable, a missing object may be uploaded by
  a future separately authorized publisher, and a byte mismatch is a blocking
  conflict because these keys carry immutable cache metadata.
- A different current manifest is expected during an update and is observed,
  never modified.

Wrangler's rounded bucket size is converted to a conservative upper bound by
adding one display unit before applying the projected new bytes. Unknown or
unparseable bucket usage fails closed.

## Output and safety

The ignored report is written content-addressed under
`data/fyi-characters/preflight-k24/<release-id>/<report-sha256>/remote-preflight-k24.json`.
Directories are identity-checked, junctions/symlinks are rejected, and the
report file is created exclusively without replacement.
It records every immutable object result, current manifest observation, byte
budgets, source hashes, and readiness.

K24 can return GO only for the read-only preflight. Publication authorization
remains REQUIRED and publication, production, Android, and every R2 mutation
remain NO-GO.

## Command

```powershell
npm run preflight:fyi-character-release-k24 -- --opt-in-k24 --release-id <exact-release-id> --remote
```

The exact opt-in, release ID, and `--remote` target are mandatory. The next
boundary after a clean result is explicit user authorization for a separate,
write-capable publisher gate.

## Observed preflight

The first real read-only run inspected 1,628 immutable objects plus the mutable
manifest:

- 1,568 immutable objects matched byte-for-byte;
- 5 were absent: the new content-addressed payload and four new portraits;
- 55 existing `images/v2/...` portraits had different bytes;
- zero reads failed;
- all 55 conflicts also differed after PNG pixel decoding, so they are not
  merely compression or metadata changes;
- the current manifest still identifies dataset
  `2026-07-20T20:22:44.502Z`;
- Wrangler reported 343 MB, yielding a conservative current upper bound of
  344,000,000 bytes;
- the current plan's projected upper bound was 345,262,121 bytes, comfortably
  below 10 GB.

K24 therefore correctly returned NO-GO. Existing immutable portrait keys must
not be overwritten. The next safe design gate is a delivery-only rewrite to
content-addressed portrait keys, preserving the proven image bytes and all
non-portrait character data.
