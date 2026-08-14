# Database Characters K40 - conditional taxonomy projection publisher

Status: implementation, synthetic validation and the authorized real dry-run
are GO. K40 adds a conditional, fail-closed publisher around the K39 dry-run
plan. Implementation and dry-run do not authorize or execute publication. Any
invocation of the publish mode remains a separate user-authorization boundary.
Contract version `1.0.0`.

## Source and current-state authority

K40 accepts every K37/K36/K32/K2/productive/SQLite/DB1/ELF/native root and both
content-addressed IDs explicitly. It productively reruns K39, which productively
reruns K38. Saved K38, K39 or K40 reports are never current-state authority.
K40 refuses to construct a publication plan unless the current K39 dry-run is
GO and the current K38 budget remains strictly within both limits.

K40 source-bound validates K37/K36 and binds the exact four immutable K36
members by regular single-link handles, contained realpaths, byte sizes and
SHA-256. It reconstructs the mutable candidate from the validated K37 bytes.
The complete source is revalidated after immutable verification and before any
possible mutable-manifest promotion.

## Deterministic publication ID

The publication ID binds the fixed bucket and namespace, K37 plan ID, K36
release ID, four ordered immutable keys/bytes/content types/cache policies,
mutable-manifest key/bytes/metadata, conditional-write policies, required
verification order, no-delete rule and fixed budgets. It excludes timestamps
and current remote observations so an idempotent rerun over the same source
retains the same publication ID.

The K40 dry-run writes a bounded, create-only, content-addressed operational
report. It includes the deterministic publication ID and the current K39/K38
observations, but grants no write or publication authority.

## Exact CLI

Dry-run:

```text
npm run run:database-characters-taxonomy-projection-publisher -- \
  --opt-in-k40 \
  --remote \
  --dry-run \
  --k37-output-root <root> \
  --k37-plan-id <64-character-sha256> \
  --k36-output-root <root> \
  --k36-release-id <64-character-sha256> \
  --k32-root <root> \
  --k2-root <root> \
  --productive-root <root> \
  --sqlite-root <root> \
  --db1-root <root> \
  --elf-root <root> \
  --native-evidence-root <root> \
  --output-root <existing-caller-controlled-root> \
  --checked-at <canonical-UTC-timestamp>
```

Future separately authorized publish invocation replaces `--dry-run` with:

```text
--publish --confirm-publication-id <64-character-sha256>
```

The common switches, exactly one mode and every value argument are required
exactly once. Unknown, duplicate, implicit or noncanonical inputs fail closed.
The publish confirmation must equal the publication ID rebuilt from the
current source.

## Dry-run closure

Dry-run terminates after the local K40 report. It does not read credential
environment variables, construct an S3 client, issue an authenticated request
or mutate R2. It inherits only the five public GETs and the fixed read-only
Wrangler bucket-info command from K39/K38.

## Conditional immutable operations

The publish implementation, if separately authorized and invoked in the
future, uses the fixed bucket `dokkanpanion-data` and the account-scoped R2 S3
endpoint with region `auto`. It directly reads and verifies each exact object
before acting.

- Existing immutable objects must match SHA-256, size, `Content-Type` and
  immutable `Cache-Control` exactly.
- Missing immutable objects are created with `If-None-Match: *` in K37 order.
- Every create is directly reread and byte/metadata verified before continuing.
- A conditional race is acceptable only if the immediate reread proves the
  exact expected immutable object.
- Immutable overwrite, copy, multipart and delete paths do not exist.

## Mutable manifest last

The mutable manifest is read directly before immutable processing. After every
immutable object is verified, all local source is revalidated and all four
immutable objects are directly reread and verified again. The manifest is then
directly reread immediately before promotion; its latest quoted ETag is the
compare-and-swap precondition.

At that point:

- matching manifest bytes and metadata require no write and are verified last;
- a missing manifest uses `If-None-Match: *`;
- a different manifest uses `If-Match` with the directly observed ETag;
- a conditional race is acceptable only when the final direct reread already
  proves the exact candidate bytes and `no-store` metadata.

The manifest is always directly verified after the conditional operation. A
failure never triggers rollback or deletion; content-addressed immutable
objects may remain safely orphaned while the old manifest stays authoritative.

## Verification and real dry-run

The focused K40 suite passed 13 tests. It covers exact CLI modes, closed
runtime exports, dry-run separation from environment/S3 construction,
deterministic publication identity, bound K36 member bytes and hard links,
K39/budget/source drift, ordered conditional immutable creation, exact direct
byte/cache-metadata verification, 409/412 races, complete immutable reread,
source revalidation and fresh manifest compare-and-swap. No test issued a real
request or used a real credential.
The final full `database-characters` suite passed 178 tests with eight Windows
symlink fixtures pending. The final read-only contract review found no P0-P2.

The authorized real dry-run at `2026-08-14T20:52:37.491Z` productively reran
K39/K38 and source-bound revalidated K37/K36. All four immutable objects and
the mutable manifest remained missing. Wrangler again reported `364 MB`; the
conservative projected upper bound remained 365,260,894 bytes. K40 produced
publication ID
`ae0b1626a7ec8de4f42c1d48524bb19966274504644021fc66c681ecebe36804`.
The 13,599-byte K40 report has SHA-256
`987ab02c256a577fe1d2194d445295ad852b23be8283a673f4295ecc79838bc4`.
Its current 8,591-byte K39 report has SHA-256
`de48aac21751fa7bf8a8be992e7ce490a869a2a4cdb4189b1a1ff115905da29a`,
and the nested 5,205-byte K38 report has SHA-256
`56e9f18d317110baa32b396737c053b4cdf689b29c0dfb369215474dc8678f3e`.
The run ended with `dryRun: GO` and `publication: NOT_EXECUTED` before reading
credential environment variables or constructing the S3 adapter.

## Authorized publication and public verification

The separately authorized publish invocation at `2026-08-14T21:01:58.257Z`
rebuilt the same publication ID, uploaded the four absent immutable objects in
the fixed K37 order, and promoted the previously absent mutable manifest last.
All 253,735 immutable bytes were verified directly after upload, the final
manifest bytes and metadata were verified directly after its conditional
create, and the invocation completed as `COMPLETED_CONDITIONALLY`. It performed
zero deletes and attempted no rollback. The invocation's pre-write K40 report
is 13,599 bytes with SHA-256
`10b50453916048e3d238d4f593ae289bb406f0da78417ee1f4b11c82e65dcdbc`;
the nested K39 and K38 report hashes are respectively
`125813a33a676306047b73d46f1ea9538c7cde10baeb4c7ad11669b2c325501d`
and `b4d4bf99279ec001af6e143b892013c85dec33f621d417c2e1708b79351fe02a`.

The first public post-publication preflight observed three immutable matches,
the matching mutable manifest, and a transient cached 404 for the gzip payload.
A direct unauthenticated retry at `2026-08-14T21:06:47Z` returned `200`, the
expected 247,261-byte `application/gzip` object, immutable cache metadata, and
`CF-Cache-Status: EXPIRED`, consistent with expiry of the pre-creation negative
cache entry. No repair write was made.

The final read-only K40 rerun at `2026-08-14T21:07:41.393Z` found all four
immutable objects and the mutable manifest matching. It read 260,894 bytes,
planned zero immutable bytes, retained only the 7,159-byte manifest candidate
in the conservative hypothetical budget, and projected 365,007,159 bucket
bytes. Its 13,638-byte K40 report has SHA-256
`b1d720580242a459f5f7d444a222d1486faf25237f3c50020681fa2552ec13ba`;
the nested 8,630-byte K39 and 5,988-byte K38 report hashes are respectively
`41e4e3ee69a83e5d87484cf09813e7df00e94b9918d7bf75bb5d10cc286456f8`
and `ddd68ba68a9034ae1c44edcbcf18a9a9a50eb1331717e0ec5af202769b06eec3`.

## Authorization and readiness

| Scope | Decision |
| --- | --- |
| K40 implementation | **GO** |
| authorized K40 real dry-run at `2026-08-14T20:52:37.491Z` | **GO** |
| authorized K40 publication at `2026-08-14T21:01:58.257Z` | **COMPLETED CONDITIONALLY** |
| final public K40 verification at `2026-08-14T21:07:41.393Z` | **GO** |
| any further immutable write or mutable-manifest promotion | **REQUIRES EXPLICIT USER AUTHORIZATION** |
| delete or rollback | **NO-GO** |
| Android or consumer | **NO-GO** |
| authority or production | **NO-GO** |
