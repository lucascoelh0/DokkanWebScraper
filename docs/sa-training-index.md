# Optional SA training index — local Slice B

Status: local candidate and Android staging flow validated and approved by Lucas
on his phone. Commit/push authorized; no data publication or production release.
The Android transport verifies this candidate and golden cases, with percentage-
grouped clickable portraits. No roster, Team Analysis, Stage or Awakening payload
was changed. Treasure Exchange materials remain a future backlog enrichment.

## Contract

Producer: `game-db/game-db-sa-training.ts`; local CLI:
`game-db/game-db-sa-training-run.ts`. Contract `dokkan-sa-training` 1.0.0,
rules `reference-5.31-v1`. The rules are reference-supported, not a recovered
game formula. Unknown cells remain null; observed zero is not null. Same-path
means guaranteed transfer, different-path success means one level.

Manifest `sa-training-manifest.json` pins exact primary/Stage/Awakening versions
and hashes, the DB snapshot/hash and the inventory hash of the three consumed
first-party tables. An immutable `sa-training/objects/<sha>.json.gz` contains:

- Cards: exact IDs, name identity IDs, actual rarity and supported-target flag.
- Paths: ordinary linear Z/Dokkan edges expressed as ordered card IDs; initial
  target rarity chooses the reference profile. Names are not family keys.
- Materials: actual reward card ID and every forward prepared form, with exact
  Stage/mission IDs. Join the original reward rows by card ID to retain quantity,
  difficulty and reward ordinals. Prepared forms are not claimed as direct drops.
- Quarantines, coverage and versioned rule provenance.

Limits: manifest 64 KiB, compressed object 1 MiB, expanded object 8 MiB. Producer
and consumer must validate hashes and bounds before activation. Missing or stale
optional data must not block existing character details or change team rosters.

Use `createSaTrainingEvaluator(payload)` once per coherent version. `evaluate`
separates same-path/compatible/incompatible/insufficient-evidence; compatible
chance may be null. `findMaterials` returns source-form alternatives, not a
precomputed all-pairs matrix or an already deduplicated UI list.

## Fail-closed boundaries and known assumptions

- Branches, merges, cycles, ordinary self-edges, dangling endpoints, conflicting
  route IDs and unknown route types are quarantined. Optimal edges do not change
  family identity. Raw battle-only singleton rows are not automatically targets.
- Out-of-battle name identity intersection is the approved reference model.
  Do not split joint names or add transformation/exchange-only names. Broader
  complex game semantics were not reverse engineered in this slice.
- Dokkan paths may decrease displayed rarity (Z-awakened UR to a new SSR base).
  Actual examples include R Goku's later forms and Frieza → Golden Frieza; an
  increasing-rarity invariant would incorrectly delete valid paths.
- Selling-only rows are excluded. Kai exclusion uses a documented structural
  heuristic (`cost=99`, `exp_type=5`, `training_exp=10`), not a claimed official
  classification enum. All excluded reward IDs/reasons are in the audit report.
- No cap/quantity/inventory calculator, live competitor query, active-event
  assertion, universal repeatability claim, publisher or production feature flag
  wiring is introduced here. The consumer integrates this as staging-only optional data.

## Local verification, 2026-09-08

Candidate: `game-db/data/sa-training/candidate-local-v2`.

| Inventory | Count |
| --- | ---: |
| Official card rows inspected | 17,380 |
| Distinct Stage/mission reward card IDs | 344 |
| Retained ordinary material sources | 331 |
| Unique reachable prepared forms | 925 |
| Supported target IDs | 4,191 |
| Quarantined card IDs | 19 |
| Excluded reward IDs (six selling-only, seven training signature) | 13 |

Payload: 69,666 compressed bytes / 702,916 expanded bytes. All nine target
examples returned materials: God Goku, Manga Goku, Nuova, R Goku, SR Goku before
and after Z awakening, N Tien, N Red Ribbon Soldier, Trunks exchange. Nuova has
only its own source recorded here; compatible summon-only Nuova cards are not
recommended merely because their probabilities are supported.

23 focused tests passed, including a real-candidate test with 21 exact-ID golden
cases at `game-db/fixtures/sa-training/reference-cases.json`. The same 23 tests
passed against compiled JS. TypeScript typecheck passed; generated `lib/` files
are limited to the four new source/test files. Existing source artifacts were
rehashed unchanged. Independent contract review found no residual P1 after the
reported fixes; that reviewer did not execute tests.

First local v1 candidate is retained as diagnostic evidence, not for use: its
over-strict rarity-order check omitted R Goku. Use v2 only.

Android cross-language check: five domain unit tests passed with zero skipped,
including the exact v2 compressed hash/size and all 21 golden cases. This is not
device/offline-cache/UI verification; those integration layers are not yet wired.

## Reproduction

Run `node lib/game-db/game-db-sa-training-run.js` with mandatory paired flags
`--first-party-dir`, `--primary-manifest`, `--primary-payload`, `--stage-manifest`,
`--stage-catalog`, `--awakening-manifest`, `--awakening-payload`, `--output-dir`,
and canonical ISO `--generated-at`. Output must be a fresh child directory under
`game-db/data/sa-training`; existing directories are never overwritten.

Set `SA_TRAINING_CANDIDATE` to the candidate root, then run:

```text
node node_modules/mocha/bin/mocha.js --no-config --no-package lib/game-db/game-db-sa-training.spec.js lib/game-db/game-db-sa-training-run.spec.js
```

Without the environment variable, the real-candidate test is explicitly skipped.
R2 dry-run/publication, commit, push, Android installation and production
promotion have not been performed.
