# Database Characters K18-K20 - FYI candidate overlay and readiness

Status: implementation, independent contract review and offline validation are
present in this history. Candidate generation is explicitly opt-in and no
production, publisher, R2 or Android activation is authorized.
Contracts use version `1.0.0`.

## K18 - pure field-scoped overlay

`createCharacterCompactRarityOverlay(Character[], validatedK15Projection)` is
a synchronous, I/O-free API. It deep-clones both the productive shape and the
selected transformation paths. Neither input is mutated.

Structural binding is unchanged from K17:

1. one top-level state wins over nested forms;
2. equal repeated nested states select the first JSON path;
3. duplicate top-level or divergent nested states are ambiguous.

`id` is only a binding key. `type` is agreement-only. `rarity` is fillable only
when the selected target value is null or absent. Any missing/ambiguous
binding, missing/different type, or non-null rarity difference is a blocker.
One blocker suppresses every patch globally and returns an unchanged clone.

The result contains the clone, the complete deterministic rarity proposal set
and a bounded decision report. It exposes no generic merge, write, fallback or
catalog API. K17 now delegates its in-memory evaluation to K18 while retaining
its existing public runner/report shape, candidate canonicalization and
deterministic pinned result.

## K19 - explicit FYI candidate generation

The normal `run:fyi-character-dataset` command remains default-off with respect
to K15. It does not resolve or read K15 and keeps the existing sequence and
`data/fyi-characters/latest` outputs.

Candidate mode requires the literal `--candidate-k19` flag. The optional CLI
names are allowlisted to `candidate-k19` and `compact`; absolute, traversal,
drive-relative, UNC, mixed-separator and reparse escapes are rejected. No
environment variable can enable or limit candidate mode. The legacy dataset
limit environment variable remains effective only for the unchanged normal
mode.

The candidate flow is:

1. require a complete FYI scrape;
2. localize portrait references;
3. validate the pinned K15 compact artifact;
4. derive a target-scoped K15 view by intersecting K15 `cardId` with every
   structural top-level/transformation ID in the FYI `Character[]`;
5. apply K18 to that view in memory and fail before portrait or candidate
   writes if any scoped blocker exists;
6. revalidate the complete K15 object graph;
7. reserve a new candidate directory with exclusive `mkdir`, populate only that
   reservation, and commit it by writing a content-addressed ready marker last.

The target scope is a catalog boundary, not an authority claim. K15 records
outside the FYI catalog are `excludedByTargetCatalog`; FYI states absent from
K15 are `targetStatesNotCovered`. Neither class is counted as an agreement or
a blocker. Inside the selected intersection, K18 remains globally fail-closed.
K17 itself is not relaxed and still evaluates every record in the projection
it receives.

The fixed candidate directory is `data/fyi-characters/candidate-k19`. Portrait
filenames must match the canonical `portrait_<numeric-id>` form before any path
is resolved. The directory
contains a baseline bundle from the same localized in-memory run, the overlaid
candidate bundle, both manifests, the FYI run report and the bounded K19
lineage/report. Exclusive reservation prevents replacement across platforms;
the `.candidate-k19-ready.json` marker hashes the fixed inventory and is written
only after all inventory and candidate-local portraits complete. K20 rejects a
missing, stale or mismatched marker. Failed owned reservations, including nested
portrait output, are removed without touching a path whose identity changed.
`latest`, `data/latest`, publishers, Android and R2 are not written.

## K20 - offline compare/readiness

K20 requires `--opt-in-k20`, reads only the fixed candidate inventory and the
pinned K15 directory, and writes nothing. K15 is validated before and after.
The comparison independently rebuilds the target-scoped view and K18 overlay;
it does not trust K19's decision.

The deterministic report verifies:

- baseline and candidate manifest file names, sizes, compressed SHA-256,
  uncompressed sizes and cardinalities;
- K19 baseline/candidate/K15 lineage;
- the K19 runtime contract, full K15 contract/dataset/manifest/payload lineage,
  before/after K15 validation and in-memory-only safety declarations;
- the candidate commit marker and all six content hashes/sizes;
- exact equality with a fresh K18 candidate;
- byte-equivalent pretty JSON after reversing only authorized rarity paths;
- no type or other-field changes;
- top-level and transformation cardinality, structural IDs and order;
- portrait URL, filename and portrait-spec references;
- K19's disabled production/publisher/Android/R2 boundary.

Failure examples are limited to five fixed check names. `GO` means only that
candidate generation and validation succeeded. Promotion, production,
publisher, Android and R2 remain `NO-GO` in every report.

## Audited local baseline

The exact FYI payload lineage is SHA-256
`56681e7327c56bce7becbda72ee507b77d964f449fd1862012d4e751b801b499`,
1,211,389 gzip bytes, 1,434 top-level records, dataset/generated timestamp
`2026-08-04T22:43:50.776Z`. With the exact pinned K15 release, offline
in-memory validation produced:

| Measure | Count |
| --- | ---: |
| FYI structural states | 1,625 |
| target-scoped K15 records | 1,576 |
| K15 records excluded by the FYI catalog | 2,720 |
| FYI target states not covered by K15 | 49 |
| type agreements / differences | 1,576 / 0 |
| rarity agreements | 1,387 |
| rarity null fills / non-null differences | 189 / 0 |
| scoped blockers | 0 |

These counts are enforced only when the complete FYI lineage above and the
K15 pin both match. They do not imply that K15 or FYI is complete for all game
cards. No real FYI scrape, portrait download, candidate directory, publish or
network request was performed while validating this implementation.

## Authorization boundary

K18 pure evaluation, explicitly requested K19 candidate generation, and K20
offline validation are the only proposed `GO` scope. Integration of this
worktree, running a real candidate generation, promotion to `latest`, any
publisher/R2 action and all Android work remain separate user-authorized gates.
