# Database Characters K38 - remote read-only taxonomy projection preflight

Status: default-off implementation and synthetic transport validation GO.
Real remote execution remains pending separate explicit authorization. K38
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

No real request, Wrangler process, bucket inspection, publication, R2
mutation, Android action, consumer read, authority promotion or production
action was executed while implementing K38.

## Readiness

| Scope | Decision |
| --- | --- |
| default-off K38 implementation and synthetic validation | **GO** |
| separately authorized real read-only remote preflight | **PENDING** |
| `readOnlyRemotePreflight` in a current real run | **GO or NO-GO from current observations** |
| `publicationAuthorization` | **REQUIRED** |
| publication or R2 mutation | **NO-GO** |
| Android or consumer | **NO-GO** |
| authority or production | **NO-GO** |

Even a current K38 GO ends at read-only preflight readiness. It is neither a
publication dry-run nor durable publication authorization.
