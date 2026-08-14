# Database Characters K33 - opt-in structural shadow consumer

Status: offline shadow consumer GO; state lineage, authority, apply, production
and delivery remain NO-GO. Contract version `1.0.0`.

## Boundary

K33 is an explicitly opt-in, offline, report-only consumer of the exact K32
sidecar and the exact productive `Character[]` pin already bound by K32. It
measures representation without selecting an authority, changing a value,
returning a `Character[]`, writing an artifact, applying an overlay or exposing
a publisher, R2 or Android path.

The runner requires exactly one `--opt-in-k33` and all three explicit roots:

```text
npm run audit:database-characters-structural-shadow -- --k32-root <root> --k2-root <root> --productive-root <root>
```

There are no repository-relative or machine defaults. Unsupported flags,
missing values and duplicate flags fail closed. The runner emits one bounded,
deterministic JSON report to stdout and has no output-path option.

## Source gate

K32 can authorize K33 only through
`validateCharacterStructuralSidecarArtifact({ artifactRoot, k2Root,
productiveRoot })`. K33 calls that source-bound API before and after evaluation
and compares the complete returned manifest, sidecar, coverage, validation and
source-bound result. It never calls or imports the integrity-only helper as an
authorization boundary. K32 source reconstruction and exact artifact-byte
matching must report `GO` both times.

After source-bound validation, K33 independently reopens only the literal K32
productive members:

| Member | SHA-256 | Bytes |
| --- | --- | ---: |
| `characters-manifest.json` | `ae634968dd3349cec2b6ac16d7df2bcdcf9306afaf897cb475011fbd8f22c610` | 445 |
| `characters.json.gz` | `de6268219039f0bbafda7b01b473e957e0cd5442682caab361a32470a2a2e899` | 1,460,373 |

The productive dataset version is `2026-08-13T03:49:01.219Z`; decompression
must end at exactly 15,720,450 bytes and the top-level array must contain 1,436
records. The caller-supplied root is canonicalized as a regular non-link
directory. Each member is resolved as a contained literal path, opened through
a read-only `FileHandle`, and checked as a regular non-link, single-link file.
Path identity and handle metadata are checked before and after each read; the
same members are reopened and compared byte-for-byte after both evaluations.
Decompression is streamed and aborted before it can exceed the pinned raw
size.

## Comparison contract

The only join key is `cardId`. Productive names, titles, category labels and
link labels never identify a record. Every top-level and recursively nested
transformation record receives its exact JSON path, a `recordKind` of
`top_level` or `transformation`, and
`releaseStateBinding: unavailable`. Duplicate K32 IDs or any duplicate
productive ID across either record kind are ambiguous and fail the complete
run. K33 does not infer initial, EZA or SEZA state. Presence of keys beginning
with `eza` or `seza` is counted only in explicitly non-exclusive diagnostics.

`characterClass` is comparable only when K32 reports `supported` and the
productive representation is present and recognized. Exact values agree;
every divergence among `unawakened`, `Super` and `Extreme` is a
`representation_mismatch`, never a confirmed conflict.

`categories` and `links` are comparable only when the K32 collection, every
assignment or entry, and every presentation-only label mapping are supported,
and the productive field is a string array. K32 empty and absent containers,
unresolved labels, missing productive fields and malformed productive arrays
remain `unknown`. For comparable arrays K33 preserves source order and
duplicates and classifies exactly one of:

- `ordered_agreement`;
- `same_multiset_different_order`;
- `different_representation`.

It does not deduplicate, canonicalize, sort, compute active links or compute
shared links. Labels are used only to measure the two existing
representations, never to select authority.

## Report contract

Dimension totals are exclusive. Unknown reasons and EZA/SEZA field-presence
counts are explicitly non-exclusive. Each dimension retains at most five
non-agreement examples. An example includes only `cardId`, exact productive
path, record kind, unavailable state binding, classification and bounded
scalar or ordered-value count/hash summaries; it never emits an unbounded
collection. All comparable records carry the metadata envelope during
evaluation, while the report records bounded examples plus kind and binding
counts.

The runner evaluates the same parsed inputs twice and requires byte-identical
evaluation JSON. It also checks content fingerprints proving that neither
parsed input was mutated. After productive members and parsed characters are
revalidated, their retained buffers are released before the second source-bound
K32 validation. A live RSS guard enforces an exclusive 1 GiB ceiling; the
package script constrains the Node old-space limit to 768 MiB and exposes GC for
this release boundary. Dynamic RSS observations are intentionally excluded from
stdout so they cannot make the report nondeterministic.

## Real result

Two sequential executions against the exact local K32, K2 and productive pins
produced byte-identical stdout:

| Property | Value |
| --- | ---: |
| report bytes | 15,695 |
| report SHA-256 | `b685b9ac9d1608bcb7ab5d1d7d7aeacef1d8c638296ad7edb2012d44a27ce7ab` |
| post-hardening sampled peak RSS | 724,344,832 bytes |

The sidecar contained 5,759 records. Productive traversal found 1,627 unique
records, of which 1,623 joined K32 by card ID; 4,136 K32 cards had no productive
record and four productive IDs were outside K32. The comparable records were
1,432 top-level records and 191 transformations.

| Dimension | Agreement | Order-only / mismatch | Different | Unknown |
| --- | ---: | ---: | ---: | ---: |
| `characterClass` | 1,250 | 373 representation mismatches | 0 confirmed conflicts | 0 |
| `categories` | 12 ordered | 1,406 same-multiset/different-order | 0 | 205 |
| `links` | 46 ordered | 1,516 same-multiset/different-order | 0 | 61 |

Category unknowns comprise 14 empty K32 containers and 191 transformation
records without a productive category field. Link unknowns are 61 empty K32
containers. EZA-prefixed fields were present on 660 comparable records and
SEZA-prefixed fields on 34; these counts provide no state binding. Zero
confirmed conflicts does not establish completeness, state equivalence or
authority readiness.

## Readiness

| Scope | Decision |
| --- | --- |
| explicitly opt-in offline shadow consumer | **GO** |
| productive state lineage | **NO-GO** |
| authority promotion or apply | **NO-GO** |
| production use | **NO-GO** |
| publisher or R2 | **NO-GO** |
| Android | **NO-GO** |
| FYI removal | **NO-GO** |
| DokkanInfo removal | **NO-GO** |

K33 is evidence only. Its principal residual is deliberate: productive
`Character[]` still supplies no first-party state lineage, so card-ID
representation agreement cannot authorize state-level value promotion.
