# Database Characters K39 - taxonomy projection publisher dry-run

Status: implementation, synthetic validation and the authorized real dry-run
are GO. K39 is a remote read-only, dry-run-only planning boundary. It contains
no R2 writer, publisher write mode, credentials, authorization headers, delete
path, manifest promotion or production switch. Contract version `1.0.0`.

## Boundary

K39 accepts the same explicit K37, K36, K32, K2, productive, SQLite, DB1, ELF
and native-evidence roots and the same content-addressed IDs as K38. It must
productively rerun K38 against current public object state and current bucket
usage; a saved K38 report is never authority. K39 rejects unless that current
K38 result is GO, and it source-bound revalidates K37 around construction of
the dry-run plan.

The only productive remote operations are inherited from K38: five fixed
public GETs and the fixed bounded read-only Wrangler command:

```text
r2 bucket info dokkanpanion-data --json
```

K39 introduces no additional remote transport.

## Exact CLI

```text
npm run run:database-characters-taxonomy-projection-publisher-dry-run -- \
  --opt-in-k39 \
  --dry-run-only \
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

All three switches and every value argument are required exactly once. Unknown
or duplicate arguments and implicit roots, IDs, timestamps or modes fail
closed. K38 validates the canonical timestamp and complete source boundary
before it performs transport.

## Planned immutable operations

The plan preserves the exact four K37 immutable objects and their order.
For each object:

- a current K38 `matching` observation becomes verified byte reuse;
- a current K38 `missing` observation becomes a prospective create-only step;
- conflict, failure or an unrecognized observation rejects the dry-run;
- the exact expected SHA-256, size, source filename and immutable cache policy
  remain bound to K37;
- payload bytes use `application/gzip`; the three JSON artifacts use
  `application/json`;
- any future writer must use `If-None-Match: *` for creation and directly
  verify bytes and cache metadata before continuing;
- overwrites and deletes are never planned.

These are prospective write semantics only. K39 cannot execute them.

## Planned mutable-manifest operation

The K37 mutable manifest remains last. It uses `application/json` and
`Cache-Control: no-store`.

- `matching` means reuse plus direct verification in a future write gate;
- `missing` means prospective create-only promotion;
- `different` means prospective replacement only with a fresh direct ETag and
  `If-Match` in a future separately authorized write gate;
- `failed` rejects the dry-run.

The future writer must rerun K38 and perform its own direct metadata and ETag
checks immediately before any mutation. The K39 report supplies no publication
authority.

## Budgets, output and safety

K39 copies the current K38 byte accounting, conservative bucket bound and
projected upper bound into a bounded operational report. It writes that report
create-only in a dedicated K39 namespace under the caller-controlled output
root and content-addresses the report by its SHA-256. K38 may write its separate
operational namespace below the same root first.

The output root cannot alias or descend from the closed K36 or K37 source
artifacts. K39 follows the existing stable caller-controlled namespace,
containment, link-count, link-substitution, bounded serialization and RSS
assumptions from K36-K38.

## Verification and real dry-run

The focused K39 suite passed nine tests. The file-symlink fixture remained
pending because Windows denied its creation; junction and hard-link cases ran
and passed. The tests cover exact CLI parsing, closed productive exports and
static writer/credential bans, productive K38 rerun, K38 GO and lineage
requirements, immutable and mutable-manifest action mapping, exact budget
copying, K37 drift, create-only output and linked-path rejection.
The final full `database-characters` checkpoint suite passed 165 tests with
eight Windows symlink fixtures pending. The final read-only contract review
found no remaining P0-P2 findings.

The authorized real run at `2026-08-14T20:28:40.470Z` productively reran K38.
All four immutable objects and the mutable manifest were still missing, so the
dry-run planned four create-if-absent immutable operations followed by one
create-if-absent mutable-manifest promotion. It planned no overwrite or delete.
Wrangler again reported `364 MB`; the conservative projected upper bound was
365,260,894 bytes. The embedded 5,205-byte K38 report has SHA-256
`6923d7027da97ecbd39476c1396870da36e2ca3c1d1d3bc8842474bdab010274`.
The 8,591-byte K39 report has SHA-256
`1193690e3b9aa7ecccd48e2e6d869e84fd40971515835a8cc880a1b003fd7ef8`.
K37 was source-bound GO before and after planning. No remote mutation occurred.

## Readiness

| Scope | Decision |
| --- | --- |
| current K38 rerun | **REQUIRED GO** |
| authorized real K39 dry-run at `2026-08-14T20:28:40.470Z` | **GO** |
| saved K38 or K39 report as publication authority | **NO-GO** |
| publisher write implementation | **NO-GO** |
| publication authorization | **REQUIRED** |
| publication or R2 mutation | **NO-GO** |
| Android or consumer | **NO-GO** |
| authority or production | **NO-GO** |
