# Database Characters K28

## Purpose

K28 is a stopped, explicit publisher for the K25-K27 content-addressed
character delivery. Its presence does not authorize publication. The only
operation executed during this gate is the read-only dry-run.

## Invocation

Dry-run:

```text
--opt-in-k28 --release-id <release-id> --remote --dry-run
```

Publication:

```text
--opt-in-k28 --release-id <release-id> --remote --publish \
  --confirm-delivery <delivery-id-from-dry-run>
```

Publication additionally requires these process environment variables:

```text
CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

The access key must be an R2 S3 credential scoped to `dokkanpanion-data`.
Wrangler authentication is used only by the read-only K27 bucket-size check;
Wrangler's object upload command is not used because it cannot express the
conditional headers required by this contract.

No shorter, reordered, local, or unconfirmed publish form is accepted. The
CLI runs with a 512 MiB V8 old-space ceiling.

## Safety Sequence

1. Revalidate the complete K21-K23 release and capture its payload bytes.
2. Rebuild K25 and K26 in memory.
3. Repeat K27 against public HTTPS and Wrangler bucket info.
4. Require K27 GO and an exact confirmed delivery ID.
5. Read every immutable object directly through the S3 API, including objects
   that public HTTPS reported as present.
6. If an immutable object exists, accept only exact size, SHA-256,
   `Content-Type` and `Cache-Control` identity.
7. Otherwise create it atomically with `If-None-Match: *`, then re-read and
   validate it. If another writer wins the race, accept only the same exact
   bytes and metadata.
8. Read the current manifest directly and require its bytes to match the state
   observed by K27.
9. Promote `characters-manifest.json` last with `If-Match` on the directly
   observed ETag, or `If-None-Match: *` when absent. A lost race is accepted
   only if the winning manifest has the exact intended bytes and `no-store`
   metadata.
10. Re-read and validate the promoted manifest directly.

K28 contains no delete command and no retention cleanup. Failed uploads can
leave only unreferenced content-addressed objects; they cannot promote a
partial release. Conditional S3 writes prevent cached public responses or
concurrent publishers from overwriting immutable keys or an unexpected
manifest version.

## Data and Budgets

The first real K27 plan contains 1,628 immutable objects and 18,797,554 new
bytes. Its conservative projected bucket upper bound is 362,797,554 bytes,
well below the fixed 10 GB ceiling. K28 always repeats that calculation before
any write.

## Readiness

| Capability | Decision |
|---|---|
| Publisher implementation | GO after review/tests |
| Real remote dry-run | GO |
| Real R2 publication | REQUIRES explicit user authorization |
| Deletes/cleanup | NOT IMPLEMENTED |
| Production activation | NO-GO |
| Android change | NO-GO |

The mutable manifest promotion is the publication boundary. A successful R2
publication makes the new dataset discoverable by existing Android clients,
but no publication may be run merely because K28 is merged.

## Authorized Publication Checkpoint

The user separately authorized the first K28 publication on 2026-08-11. The
publisher repeated the remote dry-run immediately before writing and reported:

- 1,628 missing immutable objects and zero conflicts or failed reads;
- 18,797,554 new bytes;
- a conservative projected bucket upper bound of 362,797,554 bytes;
- publication readiness GO.

The write then uploaded all 1,628 immutable objects, verified those objects
and the final manifest, and promoted `characters-manifest.json` last. The
promoted manifest is 445 bytes with SHA-256
`8413123534ec16fb2f1e2ee3d9cbe5e8392abce5c410e40a4e25b8c0d16f24ff`.
It references dataset version `2026-08-11T00:56:35.327Z`, 1,436 characters and
payload SHA-256
`e6c7770f8db88412879ee92ed12731e874463557eb94f2e326871af1b7725275`.

An immediate read-only dry-run after publication found 1,628 exact matches,
zero missing objects, zero conflicts, zero failures and zero new bytes. The
public manifest returned HTTP 200, `Content-Type: application/json`,
`Cache-Control: no-store`, the expected size and the expected SHA-256. The
post-publication bucket report was approximately 352 MB, with a conservative
upper bound of 353,000,000 bytes. No deletes, Android changes, UI changes or
production-code switch occurred.
