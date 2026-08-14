# Database Characters K37 - local taxonomy projection object plan

Status: explicitly opt-in, offline, local-only object planning GO. Remote
inventory and preflight, network, publication, R2, Android, consumers,
`Character[]`, apply/overlay, authority and production remain NO-GO. Contract
version `1.0.0`.

## Boundary

K37 derives a deterministic future object layout from one exact K36 release.
It neither reads nor mutates remote state. Its only release input is the public
K36 source-bound reader:

```text
readValidatedTaxonomyProjectionDelivery({
  outputRoot: k36OutputRoot,
  releaseId: k36ReleaseId,
  k32Root,
  k2Root,
  productiveRoot,
  sqliteRoot,
  db1Root,
  elfRoot,
  nativeEvidenceRoot
})
```

Every root and both content-addressed IDs are explicit. Generation validates
K36 before constructing the plan, writes only the three non-marker K37 files,
revalidates K36 and compares a complete reconstruction, then writes the marker
last. The public K37 reader is also source-bound and accepts no integrity-only
claim, prevalidated object, builder, writer or bypass API.

## CLI

The compiled runner requires exactly one opt-in flag and every argument:

```text
npm run run:database-characters-taxonomy-projection-object-plan -- \
  --k36-output-root <existing-k36-output-root> \
  --k36-release-id <64-character-sha256> \
  --k32-root <root> \
  --k2-root <root> \
  --productive-root <root> \
  --sqlite-root <root> \
  --db1-root <root> \
  --elf-root <root> \
  --native-evidence-root <root> \
  --output-root <existing-caller-controlled-root>
```

There are no default paths, IDs or remote modes. Unknown and duplicate flags,
missing values and malformed IDs fail closed.

## Remote object candidate

The remote namespace is fixed and versioned:
`database-characters/taxonomy-projection/v1`. The immutable object inventory
contains exactly the four K35 members already sealed by K36. Each key has the
form:

```text
database-characters/taxonomy-projection/v1/objects/sha256/<sha256>/<allowlisted-k35-file-name>
```

The payload, coverage, validation and K35 manifest use
`public, max-age=31536000, immutable` only because every key contains the exact
object SHA-256. Reuse requires future remote hash proof. Duplicate keys,
unexpected names, traversal, absolute paths, mixed separators, invalid hashes,
invalid sizes and any K36/K35 inventory disagreement are rejected.

The separately serialized mutable candidate targets
`database-characters/taxonomy-projection/v1/manifest.json` with `no-store`.
It binds the K36 receipt and marker hashes/sizes, K36 release ID, dataset
version, every K35 object hash/size/key and the full K35 lineage. It is only a
candidate for a future consumer: K37 creates no consumer, pointer authority or
publication authorization.

## Local commit

K37 creates a SHA-256 plan directory below the fixed local namespace
`database-characters-k37-taxonomy-projection-object-plan-v1`. The closed
inventory contains exactly:

| File | Role |
| --- | --- |
| `database-characters-k37-taxonomy-projection-object-plan.json` | deterministic four-object plan and conservative budgets |
| `database-characters-k37-taxonomy-projection-remote-manifest-candidate.json` | separate mutable remote-manifest candidate |
| `database-characters-k37-taxonomy-projection-object-plan-stopped-receipt.json` | deterministic receipt stopped before remote preflight |
| `.database-characters-k37-taxonomy-projection-object-plan-ready.json` | create-only commit marker written last |

The directory and every member are create-only. An existing plan destination
is rejected and unrelated caller files are preserved. Output root, namespace,
plan directory and members require lexical containment and stable real paths;
members must remain regular non-links with `nlink == 1`. Files are reopened and
compared before success. Portable Node still provides no `openat`-style binding
against malicious concurrent same-user A-B-A namespace replacement, so the
caller-controlled stable-namespace assumption from K32/K36 remains.

## Budgets and stopped state

The conservative namespace ceiling is 50,000,000 bytes. Worst-case new bytes
equal all four immutable object sizes plus a fixed 65,536-byte reservation for
the mutable manifest; equality at the ceiling is accepted and one byte above
is rejected. The local metadata commit stays below 256 KiB and each file stays
at or below 64 KiB.

The user's 10,000,000,000-byte bucket ceiling is recorded, but remote bucket
bytes, projected bucket bytes and whole-bucket compliance are all `UNKNOWN`.
K37 does not claim the bucket is safe; a separate read-only remote preflight is
required. RSS must remain strictly below 1 GiB, including nested K36 high-water
marks, and public errors are capped at 512 characters.

## Verification

Focused synthetic regressions cover exact CLI opt-in and explicit roots,
byte-identical plans, fixed keys and cache metadata, source byte and lineage
mutation, traversal/absolute/mixed separators, malformed or duplicate
inventory, the exact 50 MB boundary, create-only destinations, unrelated files,
closed inventory, hard links, conditional symlink/junction rejection, the
exclusive RSS limit and bounded errors. Static checks require the K36 public
reader and reject weak builder/writer exports, network/URL/fetch code,
publisher/Wrangler/S3 imports, remote mutation clients and `Character` APIs.

The focused suite passed with 10 tests, including the real junction and
hard-link cases; the file-symlink case was skipped because Windows denied
fixture creation. TypeScript `--noEmit` passed.

Two full runs against the two byte-identical real K36 releases produced the
same plan ID
`7411a1c5b3220e5acf248fb5e670c03c437c699cb2b765fab0aa50fd9001d204`.
All four local K37 files were byte-identical. The plan is 8,277 bytes with
SHA-256 `19c2293c3d0ece19f9210eb1489bff16abdfe035450533bfabeec29193664a0c`;
the manifest candidate is 7,159 bytes with SHA-256
`9f803eb8eba00f2b7f49681b379fb3fe71eb08d551dc69cab03204542ec6e1e8`;
the stopped receipt is 1,413 bytes with SHA-256
`6ab0515e5fc3fccfbb3c4c0670526883ceb73c93d5421524177738290eccc8c5`;
and the 1,611-byte marker SHA-256 is
`959234fbeb69ec948524f6b431e6cbd7bd6dc00465706ca18745a872204d17c6`.
The four immutable objects plus the fixed manifest reservation project
319,271 worst-case new bytes. Peak RSS was 666,722,304 and 671,862,784 bytes.
No network, remote inventory, publisher, R2, Android or production operation
was executed.

## Readiness

| Scope | Decision |
| --- | --- |
| explicitly opt-in local object plan | **GO** |
| source-bound K36 validation before/after planning | **GO** |
| remote inventory or read-only preflight | **NO-GO** |
| network, fetch, Wrangler/S3, publisher or R2 | **NO-GO** |
| Android or any consumer | **NO-GO** |
| `Character[]`, apply/overlay or authority | **NO-GO** |
| production | **NO-GO** |

The deterministic receipt ends at `STOPPED_BEFORE_REMOTE_PREFLIGHT`.
