# Database Characters K36 - local taxonomy projection delivery

Status: explicitly opt-in offline local materialization and source-bound
validation GO. Network, fetch, Wrangler/S3, publisher, R2, Android, consumer,
`Character[]`, apply/overlay, authority and production remain NO-GO. Contract
version `1.0.0`.

## Boundary

K36 copies one exact K35 release into a separate content-addressed local
directory. It does not rebuild K35 through a builder, accept an integrity-only
claim, transform the payload, expose the payload as a consumer API, or import
any publisher. Its only authority input is the existing K35 source-bound API:

```text
validateTaxonomyProjectionArtifact({
  artifactRoot: k35Root,
  k32Root,
  k2Root,
  productiveRoot,
  sqliteRoot,
  db1Root,
  elfRoot,
  nativeEvidenceRoot
})
```

All eight source roots are explicit. The same API is called again with the
new release directory as `artifactRoot`; this revalidates K32 and executes K34
in-process against the supplied roots while reconstructing and comparing the
exact K35 bytes. K36 exports no builder, byte writer, prevalidated-artifact
entry point, publication function or integrity-only authorization helper.

## CLI

The compiled runner requires exactly one opt-in flag and every root:

```text
npm run run:database-characters-taxonomy-projection-delivery -- \
  --k35-root <existing-k35-root> \
  --k32-root <root> \
  --k2-root <root> \
  --productive-root <root> \
  --sqlite-root <root> \
  --db1-root <root> \
  --elf-root <root> \
  --native-evidence-root <root> \
  --output-root <existing-caller-controlled-root>
```

There are no default paths. Unknown or duplicate flags and missing values fail
before delivery. `outputRoot` must already exist and must remain a regular,
non-link, caller-controlled stable directory throughout the operation.

## Release contract

K36 creates the fixed namespace
`database-characters-k36-taxonomy-projection-delivery-v1` below `outputRoot`.
The release directory name is one 64-character SHA-256 derived from the K35
dataset version, generated-at value, complete K35 lineage and ordered four-file
inventory. Names are fixed or allowlisted; release IDs cannot be absolute or
contain traversal.

The closed release inventory has exactly six files:

| File | Role |
| --- | --- |
| `database-characters-k35-taxonomy-projection.<sha256>.json.gz` | exact K35 payload gzip bytes |
| `database-characters-k35-taxonomy-projection-coverage.json` | exact K35 coverage bytes |
| `database-characters-k35-taxonomy-projection-validation.json` | exact K35 validation bytes |
| `database-characters-k35-taxonomy-projection-manifest.json` | exact K35 manifest and complete source lineage |
| `database-characters-k36-taxonomy-projection-delivery-receipt.json` | deterministic stopped local receipt |
| `.database-characters-k36-taxonomy-projection-delivery-ready.json` | commit marker written last |

The receipt records every K35 member hash and size, raw payload hash and size,
full K35 lineage, source-bound K32/K34 checks, the local budget and all stopped
readiness gates. It contains no operational timestamp or caller path. The
marker binds the receipt and all four K35 members by name, SHA-256 and size,
declares the exact six-name inventory, and is written only after the first five
files have been exclusively created, fsynced and reopened.

The release is create-only. Existing release directories and member names are
never replaced. On a failed owned creation, cleanup removes only members whose
identity and exact bytes are still proved; foreign or changed files are left
untouched. An existing content-addressed directory causes the invocation to
fail rather than becoming an overwrite or reuse path.

## Validation and budgets

The reader requires `outputRoot`, a canonical release ID and all seven K35
lineage roots. It validates lexical containment plus `realpath` for the output,
namespace, release and every member; all files must be regular, non-links with
`nlink == 1`. It checks the marker, closed inventory, hashes, sizes and local
budget before source-bound K35 validation. After K35 rebuilds the four exact
members, K36 rebuilds the receipt and marker, compares every byte, reopens all
six files and rechecks all directory identities.

The complete release must remain strictly below 512 KiB. Receipt and marker
are each limited to 64 KiB. Process RSS is sampled at checkpoints and through
the operating system's process high-water mark, which also captures peaks while
synchronous work blocks the event loop. It must remain strictly below 1 GiB;
the package script fixes old-space at 768 MiB. Public error text is
capped at 512 characters. Two in-memory constructions must be byte-identical
before the first write.

Portable Node does not provide `openat`-style binding for all directory and
pathname operations. K36 therefore retains the K35/K32 threat model that the
caller controls a stable namespace during each operation; it does not claim
confinement against malicious concurrent same-user A-B-A replacement.

## Verification

Nine focused synthetic tests exercise the exact CLI opt-in, all explicit roots,
two independent byte-identical releases, closed inventory, marker-last claim,
source-bound calls before and after copying, byte/hash and lineage mutation,
existing destinations, unrelated-file preservation, traversal and absolute
release IDs, missing output roots, hard links, and symlink/junction rejection
when the platform permits link creation. Static checks confirm that no weak
writer/builder export, `Character` consumer, publisher import, URL or `fetch`
path exists. One file-symlink regression is pending because Windows denied the
test fixture with `EPERM`; the real junction and hard-link cases passed.

Two full real runs, each with source-bound K35 reconstruction before and after
copying, produced the same release ID
`4a6dcfa4b8818abbd070bad2a1318eec5df9a2b1b306286adfec5fadee8ddfe4`
and six byte-identical files totaling 262,186 bytes. The stopped receipt is
6,011 bytes with SHA-256
`67c99c56f23890c91cb552c40e303fc7269cacdccc65769b3125ddfc3b6d8f13`;
the 2,440-byte marker SHA-256 is
`d185d8603698664be99f5c7443bb61ba28a1bfb91ff6c1885aa513f6b2e98d2f`.
Peak RSS was 661,557,248 and 662,052,864 bytes. No network operation,
publisher, R2 command, Android change or production action was run.

## Readiness

| Scope | Decision |
| --- | --- |
| explicitly opt-in offline local materialization | **GO** |
| offline source-bound release validation | **GO** |
| network or fetch | **NO-GO** |
| Wrangler/S3, publisher or R2 | **NO-GO** |
| Android or any consumer | **NO-GO** |
| `Character[]` read/return/write | **NO-GO** |
| apply/overlay or authority | **NO-GO** |
| production | **NO-GO** |

The deterministic receipt ends at `STOPPED_LOCAL_ONLY`. It is not a dry-run,
publication plan, remote inventory, authorization or production readiness
claim.
