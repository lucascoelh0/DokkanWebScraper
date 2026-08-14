# Database Characters K35 - supported-only card taxonomy projection

Status: offline generation and source-bound validation GO. Consumption,
authority, apply/overlay, production, publication, R2, Android and source
removal remain NO-GO. Contract version `1.0.0`.

## Boundary

K35 emits a new compact, deterministic projection of only the first-party
taxonomy facts authorized by K32 and scoped to the exact pinned Card by K34.
It is an offline generation/validation artifact and does not read, return or
write `Character[]`. In particular, it does not overwrite or propose values
for `Character.characterClass`, `Character.categories` or `Character.links`.

`cardId` is the only record key. Names, labels, titles and presentation text
are absent from the payload and never identify or authorize a record. Every
K32 card remains represented, but each dimension is independently included
only when its K32 structural status is `supported`:

- class contains the exact K32 `raw` value and `normalized` value;
- categories contain `categoryId` plus the minimum structural assignment
  provenance, `relationRowId`, ordered by numeric category ID and then relation
  row ID;
- links contain only `slot` and `linkSkillId`, ordered by slot.

An unknown or partial dimension is omitted from that card. Empty or absent K32
containers never become an authoritative empty array. Cards are not dropped
because one dimension is omitted. Structural unjoinables are also dimension
exclusions; the pinned K32/K34 profile has zero such cases. Productive card-ID
coverage has no filtering or fallback role in K35.

## Source gates

The compiled runner requires one `--opt-in-k35` and eight explicit roots:

```text
npm run run:database-characters-taxonomy-projection -- \
  --k32-root <root> \
  --k2-root <root> \
  --productive-root <root> \
  --sqlite-root <root> \
  --db1-root <root> \
  --elf-root <root> \
  --native-evidence-root <root> \
  --output-root <existing-controlled-root>
```

There are no defaults. Unsupported or duplicate flags, missing values, missing
roots and non-regular roots fail closed.

K32 is loaded only through
`validateCharacterStructuralSidecarArtifact({ artifactRoot, k2Root,
productiveRoot })`. The runner calls that source-bound API before generation.
The final K35 source-bound validator calls it again after writing and rebuilds
the exact K35 bytes from the newly revalidated K32 result. K35 has no
integrity-only authorization API. The public dataset builder, materializer and
writer always enforce the pinned sources and release identity; the only
source-agnostic helper returns pure projected records and coverage and cannot
create lineage, validation receipts or writable artifacts.

K34 is run in-process through `runCardScopeAudit` against the explicit SQLite,
DB1, K2, ELF and native-evidence roots before generation and again during final
source-bound validation. K35 accepts only the exact 7,140-byte K34 report with
SHA-256
`a34afd7895d40dbdfd085c7c1b5af1304247b4e7476e89bec6c81e17758f638a`,
all three conclusions equal to `stable_for_exact_pinned_profile`, report
execution GO, and every productive K34 gate NO-GO.

## Fixed lineage

The payload and manifest bind:

- K32 manifest SHA-256
  `91c2d76f38fd3a0b5eddd5e0db9651af5f7df852065a0fea7a1fc804dec3ae21`
  / 2,358 bytes, payload SHA-256
  `241b135ac88aad2a242a6abb81ab22b099ff25257cb0c8f0f5f7e82f888cb718`
  / 706,128 bytes, canonical raw SHA-256
  `a910cc5b2363f24326b58174c18ce8dc85669d26e73c54544a101ffecfdfd403`
  / 24,686,675 bytes, plus K32 coverage and validation hashes/sizes;
- the complete K2 manifest/payload/coverage/validation lineage, including the
  pinned SQLite and DB1 hashes;
- the exact K34 profile and report hash/size;
- SQLite SHA-256
  `3654eb7db9e18dfe4c238abd02bcc06a688ffa6f30aa1ad93fd108dcfeb78265`
  / 95,428,608 bytes;
- DB1 SHA-256
  `0afae38e1a80e55bc5d8a137f945727149f44403bf1670e830d3ef6f3650e547`
  / 11,217,031 bytes;
- ELF SHA-256
  `7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a`
  / 95,662,296 bytes;
- native layout SHA-256
  `463dc1c5405a14a32efd4d024dfcae01c146801d746b4e2e2ddb9297e677eb68`
  / 761 bytes.

K32 and K34 must also agree on K2, SQLite and DB1 identities. Any source,
cardinality, supported-status, conclusion or gate drift fails the whole K35
run.

## Artifact contract

The caller supplies an existing regular non-link output root which remains
stable and controlled for the operation. K35 writes exactly four files:

| File | Role |
| --- | --- |
| `database-characters-k35-taxonomy-projection.<sha256>.json.gz` | compact canonical JSON, level-9 deterministic gzip and content-addressed payload |
| `database-characters-k35-taxonomy-projection-coverage.json` | per-dimension included/excluded facts, reasons and bounded examples |
| `database-characters-k35-taxonomy-projection-validation.json` | deterministic budgets, safety counters, source-gate policy and readiness receipt |
| `database-characters-k35-taxonomy-projection-manifest.json` | complete lineage and output hashes/sizes; commit marker promoted last |

All final names must be absent. Files are created in a private staging
directory below the output root, fsynced, and promoted create-only with a
same-root hard link followed by staging unlink. The manifest is promoted last.
Traversal, absolute names, symlink/junction roots, linked final files and root
identity changes are rejected. Portable Node still cannot claim protection
against a malicious same-user A-B-A namespace replacement; the threat model is
`caller_controlled_stable_during_operation`.

Canonical raw JSON is limited to 8 MiB, gzip to 1 MiB, and process RSS must stay
strictly below 1 GiB. The guard includes the operating system's process
high-water mark, so synchronous work cannot hide a transient peak from the
event-loop sampler. The package script fixes Node old-space at 768 MiB.
Failure reasons and per-reason examples are capped at five. Two complete
materializations must be byte-identical before any write. Final validation
reopens the artifact, bounds decompression, verifies canonical JSON and
reproducible gzip, reruns K32/K34 source gates, rebuilds all four files and
compares exact bytes, then reopens all members to reject mutation.

## Real generation

Two separate real runs, each including two internal materializations and full
post-write source-bound reconstruction, produced byte-identical inventories:

| File | SHA-256 | Bytes |
| --- | --- | ---: |
| payload gzip | `7e5c9fa501c8401489e8e6c0a057b1ecf01037d7969091ed88c0df73547f19e8` | 247,261 |
| manifest | `a157c322f6d246c817e2af998ef908f17b39978282ced9ccda5a304d6298445c` | 3,558 |
| coverage | `e734cd83c3bcecbc978caac50f5e49f4914a060bf486d9752177c853e4b269ec` | 1,492 |
| validation receipt | `e4719f02dc9f30ae90a97212ef7a5e1d94218e8299311f148b8422caa5fe4664` | 1,424 |

The canonical raw payload is 4,228,101 bytes with SHA-256
`c740d4874118c65f94588594f6b745146c506dd78a73fd605bbf40abf28d168a`.
The final two observed peaks were 652,185,600 and 651,706,368 bytes.

The payload has 5,759 records and all 5,759 supported class facts. Categories
are included for 5,729 cards with 54,072 assignment facts; 30 empty/unknown
dimensions are omitted. Links are included for 5,620 cards with 34,018 facts;
139 empty/unknown dimensions are omitted. There are zero partial or structural
unjoinable exclusions, zero invented empty arrays, zero labels/presentation
fields and zero duplicate/order/slot failures.

## Readiness

| Scope | Decision |
| --- | --- |
| explicitly opt-in offline generation | **GO** |
| source-bound offline validation | **GO** |
| any consumer or new effective model use | **NO-GO** |
| authority or apply/overlay | **NO-GO** |
| `Character` mutation | **NO-GO** |
| production or publication | **NO-GO** |
| publisher or R2 | **NO-GO** |
| Android | **NO-GO** |
| FYI removal | **NO-GO** |
| DokkanInfo removal | **NO-GO** |

K35 prepares evidence for a future additive Android model only. That model,
its delivery path and every consumer remain separate gates.
