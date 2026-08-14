# Database Characters K38 - remote read-only taxonomy projection preflight

Status: default-off implementation, synthetic transport validation and the
authorized real remote read-only execution are GO. K38
cannot publish, mutate R2, authorize publication, promote authority, feed a
consumer, alter Android, or activate production. Contract version `1.0.0`.

## Boundary

K38 observes the exact K37 object plan through the fixed public endpoint
`https://assets.dkbcompanion.com/` and the fixed bucket
`dokkanpanion-data`. Its only source authority is:

```text
readValidatedTaxonomyProjectionObjectPlan({
  outputRoot: k37OutputRoot,
  planId: k37PlanId,
  k36OutputRoot,
  k36ReleaseId,
  k32Root,
  k2Root,
  productiveRoot,
  sqliteRoot,
  db1Root,
  elfRoot,
  nativeEvidenceRoot
})
```

Every root and both content-addressed IDs are explicit. K37 is revalidated
before any remote transport and again after all object and bucket reads. A
change in the plan, manifest candidate, receipt, marker, ID, source lineage,
inventory, hash, size, key, cache policy, or budget rejects the run before a
report is written.

The productive API accepts no object reader, bucket reader, transport,
prebuilt report, saved-report authority claim, or write bypass. Importing the
module performs no request or subprocess. Synthetic tests instrument a
transpiled test-only copy of the source; those hooks do not exist in the
productive compiled API.

## Exact CLI

```text
npm run run:database-characters-taxonomy-projection-remote-preflight -- \
  --opt-in-k38 \
  --remote-read-only \
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

Both switches must occur exactly once. Unknown or duplicate arguments,
missing values, noncanonical IDs, non-UTC timestamps, omitted roots and an
omitted output root fail closed. There are no path, ID, timestamp, target or
remote-mode defaults.

The report root must not be the K37 plan directory, the K36 release directory,
or a descendant of either closed source artifact. K38 requires a separate
caller-controlled stable output namespace.

## Read-only transports

K38 issues GET only, with `Accept-Encoding: identity`, redirects blocked, and
only status 200 or 404 accepted. It inspects exactly the four immutable K37
keys and the fixed mutable key
`database-characters/taxonomy-projection/v1/manifest.json`. Concurrency is two,
the request timeout is 30 seconds, each response must remain strictly below
1 MiB, and aggregate response bytes must remain strictly below 5 MiB.
Unexpected status, redirect, encoding, timeout or byte growth becomes a
sanitized bounded failed observation.

Immutable results are `matching`, `missing`, `conflict` or `failed`.
`conflict` and `failed` are blocking. Mutable-manifest `matching`, `different`
and `missing` remain acceptable planning observations; `failed` is blocking.
No remote bytes become source authority.

The only bucket process is the local Wrangler entrypoint with the exact
arguments:

```text
r2 bucket info dokkanpanion-data --json
```

It runs without a shell, with a 30-second timeout, 256 KiB `maxBuffer`, hidden
window and forced kill signal. No other Wrangler subcommand or remote client
exists in K38. Unknown, failed, malformed or unsafe bucket usage is blocking.
Displayed units are rounded upward by one display resolution; numeric byte
counts are conservatively increased by one byte.

## Decisions and budgets

`bytesNewIfPublished` always equals the expected bytes for missing immutable
objects plus the full K37 mutable-manifest candidate bytes. It does not drop
the candidate when the current manifest already matches. The projected bucket
upper bound is the conservative current upper bound plus those new bytes and
must be strictly below 10,000,000,000 bytes. The already source-bound K37
namespace plan must also be strictly below 50,000,000 bytes; equality is
NO-GO at both boundaries.

The operational report records `checkedAt`, source hashes and sizes, exact key
observations, sanitized failures, byte accounting, checks and readiness. It is
bounded below 64 KiB and written create-only under:

```text
<outputRoot>/database-characters-k38-taxonomy-projection-remote-preflight-v1/
  <planId>/<report-sha256>/
  database-characters-k38-taxonomy-projection-remote-preflight-report.json
```

Output, namespace, plan and report directories are containment and identity
checked. Existing report destinations are never reused or replaced; regular
single-link files are required. A saved report is an operational observation
only. It exposes no publication authority API, and any future publisher must
rerun K38 against current remote state.

Portable Node still has no `openat`-style child creation bound to a retained
directory handle. K38 checkpoints each parent immediately before and after
directory/file creation and rejects changed identities, while explicitly
requiring the same caller-controlled stable-namespace assumption documented by
K36/K37 against malicious concurrent same-user A-B-A replacement.

Process RSS must remain strictly below 1 GiB. Before transport K38 reserves
twice the full 5 MiB aggregate-response allowance for chunk plus `Buffer.concat`
copies, and four times the 64 KiB report allowance for string/byte serialization
copies. It keeps report headroom through the second source-bound K37 validation.
The guard uses both current RSS and the operating system process high-water
mark. The launcher uses the same 768 MiB old-space bound as K36/K37.

## Synthetic verification

The focused suite passed 11 tests with no real network or Wrangler execution;
the file-symlink fixture was skipped because Windows denied its creation. It covers exact
opt-in and explicit inputs, import side effects, closed productive exports,
matching/missing/different-manifest GO, immutable conflict and read failure,
manifest failure, bucket failure, strict bucket and namespace equality,
200/404 and rejected status/redirect/encoding/timeout/byte limits, aggregate
accounting, exact keys, fixed process arguments, K37 before/after drift,
bounded create-only output, unrelated-path containment, hard links, junctions
and file symlinks when the platform permits them. Static checks reject remote
mutation clients, publisher imports, credential/authorization headers and
`Character[]` APIs.

The first authorized real attempt on 2026-08-14 completed all five fixed GETs
but stopped fail-closed because the local Wrangler entrypoint was unavailable.
It wrote a non-authoritative NO-GO report with SHA-256
`7927dbc433f67167679fa8f7b5942ee0f7eb71c72ed6693fc0fa9e655ea44659`.
The repository dependencies were then restored from the local npm cache without
network access or lockfile changes, and the 11 focused tests passed again with
the file-symlink fixture pending on Windows.

The separately authorized retry at `2026-08-14T20:15:26.471Z` completed the
five fixed GETs and the one fixed Wrangler bucket-info query. All four
immutable objects and the mutable manifest were missing, with zero conflicts
or read failures. Wrangler reported `364 MB`; K38 conservatively bounded that
at 365,000,000 bytes and projected 365,260,894 bytes after the 253,735 missing
immutable bytes plus the complete 7,159-byte manifest candidate. The source
bound K37 plan was GO before and after the reads. The 5,205-byte operational
report has SHA-256
`03c22dfc42006eeb6f0dc6d88af859fb898d7abded4046a97df4e4a714f63046`.
No publication, R2 mutation, Android action, consumer read, authority promotion
or production action was executed.

## Readiness

| Scope | Decision |
| --- | --- |
| default-off K38 implementation and synthetic validation | **GO** |
| authorized real read-only remote preflight at `2026-08-14T20:15:26.471Z` | **GO** |
| `readOnlyRemotePreflight` in that operational report | **GO** |
| `publicationAuthorization` | **REQUIRED** |
| publication or R2 mutation | **NO-GO** |
| Android or consumer | **NO-GO** |
| authority or production | **NO-GO** |

Even a current K38 GO ends at read-only preflight readiness. It is neither a
publication dry-run nor durable publication authorization.
