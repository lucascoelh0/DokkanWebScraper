# First-party Character detail enrichment for the full Awakening Route

Status: the pipeline selection and contract were expanded locally on 2026-09-08;
generation and deterministic replay of a new candidate remain a primary-session
gate. The Android consumer integration is saved separately at `661111df`, but no
new R2 object, manifest, APK, release, publication, commit, or push was produced
by this pipeline slice.

## Problem and reproduced boundary

Character detail navigation uses exact card identity and traverses only
`z-awaken` / `dokkan-awaken` edges for card-form navigation. The primary
Characters catalog has 1,442 product-selected cards, while the approved
Awakening graph has 4,162 card identities and 6,979 relations. Graph identity
and portrait data are sufficient for the existing fallback, but they do not
contain complete skill details. Restricting enrichment to Stage/Mission reward
paths therefore leaves valid route identities such as Piccolo `1029760` on the
graph-only fallback.

Zarbon reproduces the original acquisition-path gap without ambiguity:

- reward identity: SSR Zarbon `1022990`;
- official lineage: `1022990` -> `1022991` -> `1023001`;
- primary detail identity: Zarbon & Dodoria `1023001`;
- `1022990` has its own leader skill, passive and Super Attack in the official
  database, but the regular Character materializer rejects it because its
  pre-Z-Awakening `cards.element` has no Super/Extreme class yet;
- borrowing `1023001`'s class or skills would therefore corrupt both card form
  and release-state identity.

The new detail materializer keeps exact official fields while omitting values
that the source does not prove. It does not export third-party art URLs, legacy
empty-string/zero fallbacks, potential/rainbow stats, Ki meter or Ki multiplier.
An absent battle class stays absent. The incumbent primary Character
materializer retains its strict playable-class requirement.

## Semantic contract

Contract: `dokkan-character-detail-enrichment` version `1.0.0`.

The four identities are intentionally independent:

| Concern | Contract owner | Meaning |
| --- | --- | --- |
| Card identity | `identity.cardId` | Exact `cards.id`; only lookup key for a detail record |
| Character identity | `identity.characterId` | Exact `cards.character_id`; descriptive, never a navigation alias |
| Card form | `form` | Incoming/outgoing normal Awakening card IDs; not an in-battle transformation |
| Release state | `availableReleaseStates` | `base`, optionally `eza` and `seza`, for that exact card form |
| Navigation | `canonicalNavigation` | Always the exact `cardId`, initially at `base` |

`detail.transformations` contains only semantically resolved in-battle forms.
Relations projected as `unknown` from normal Awakening routes stay exclusively
in `form.previousCardIds` / `form.nextCardIds`. This candidate contains two real
Giant Ape transformations and does not turn any Awakening into a transformation.

The detail body is an additive, partial Character-shaped object so Android can
reuse its existing leader/passive/typed-Super-Attack models. Optionality is
semantic: absence means unknown or unsupported and must not be converted into a
different form's value.

`sourceRoles` remains additive metadata. Every enrichment record has
`awakening-path`; `stage-drop` and `event-mission` are present only when those
sources independently prove direct acquisition. Neither acquisition role is an
inclusion requirement.

## Full graph-only selection and acquisition coverage

Selection is structural, not name-based:

1. take every exact ID in approved `routeGraph.cards`;
2. remove every exact ID already present in the primary Character catalog;
3. materialize each remaining card from its own first-party rows;
4. use only `z-awaken` and `dokkan-awaken` edges for
   `form.previousCardIds` / `form.nextCardIds`;
5. independently audit Stage/Mission rewards and their reward-to-primary paths
   as acquisition evidence, never as a selection filter.

The exact graph-only count is 2,768, not the initial estimate of 2,720. Of the
1,442 primary cards, 1,394 are graph members and 48 are outside the approved
route graph; those 48 remain primary cards and are listed explicitly in the
candidate report. The enrichment still never changes the roster, search, Team
Builder or Team Analysis inputs.

For additive compatibility with the Android 1.0 validator,
`relevantPathCardCount` now carries the complete selected graph total and
`primaryPathCardCount` carries its primary-member partition; their invariant
remains `relevantPathCardCount = primaryPathCardCount + detailCardCount`.
Acquisition-path meaning is owned only by the explicit `acquisition*` fields.
`intermediateOnlyDetailCount` continues to count the 323 indirect forms inside
that acquisition subset, while `graphOnlyWithoutAcquisitionPathCount` reports
the separate 2,196 forms without known Stage/Mission path evidence.

| Measurement | Count |
| --- | ---: |
| Approved Awakening graph identities | 4,162 |
| Primary identities in the graph | 1,394 |
| Primary identities outside the graph | 48 |
| Graph-only enrichment selection | 2,768 |
| Distinct Stage/Mission Card reward IDs | 344 |
| Reward IDs in the Awakening graph | 318 |
| Reward IDs outside the graph | 26 |
| Cards on supported reward-to-primary paths | 839 |
| Primary cards on those paths | 267 |
| Graph-only cards on acquisition paths | 572 |
| Graph-only cards without an acquisition path | 2,196 |
| Baseline enrichment detail cards (preserved subset) | 572 |
| New-candidate materialization totals/gaps | pending generation |
| Baseline details with no pre-Z-Awakening battle class | 219 |
| Direct Stage-drop details | 220 |
| Direct Event Mission details | 188 |
| Intermediate-only Awakening details | 323 |
| Baseline Base / EZA / SEZA detail states | 572 / 0 / 0 |

All 572 baseline records remain selected. Their first-party leader skill,
passive and typed Super Attack evidence remains bound to the exact form. The
2,768 graph-only identities comprise 46 R, 221 SR, 1,241 SSR and 1,260 UR cards;
1,501 are targets of a Z-Awakening edge and 235 are targets of a Dokkan
Awakening edge. No LR card and no EZA/SEZA self-edge is graph-only in this
snapshot, so those states remain covered by the primary catalog rather than
being fabricated in enrichment. A missing source card or unsupported exact-form
materialization is a fail-closed gap with an explicit card ID, reason code and
detail; it is never filled from a successor/final form.

## Source provenance

- First-party Global database export:
  `game-db/data/first-party-complete-source/1788329250-awakening-routes-v1`
- DB version: `1788329250`
- asset version: `1788327754`
- APK version: `6.5.5`
- database SHA-256:
  `7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495`
- required-table inventory SHA-256:
  `10cc99965967a0606001481f5a693539a83223daf01807a96fb20d7e94dac0cd`
- primary Characters: version `2026-09-07T05:07:31.020Z`, 1,442 cards,
  SHA-256 `57d02c518634574311b471fb77e0c084996f1a32cb3d341d9a25a262da02c9c3`
- Stage catalog: version `2026-09-04T12:00:00.000Z`, SHA-256
  `8464bf2a6962c85ce26a1f51f7f1f3f6c8cfa6d2d51388e7dbedba1175c15677`
- Awakening graph: version `1788329250-8ca948a09592`, SHA-256
  `51db2a4cb97ec711eb5394c290a609c6f804f1856514f3444e872e18a42ad5f3`

The generator rejects a Stage/Awakening database mismatch, a primary or source
payload hash mismatch, duplicate IDs, missing shards, non-exact navigation,
invented legacy fields and source-table drift.

## Existing acquisition-path baseline candidate

The existing candidate remains unchanged and may still be served by the local
server on port 8765:

`game-db/data/character-detail-enrichment/candidate-how-to-get-1788329250-first-party-v1`

- dataset version: `1788329250-358b7920f558862b`;
- manifest: 15,004 bytes, SHA-256
  `ad209737cba7af640c1cef1c5532c7fc10a7c5cedb7d80d9c03327e6c5f216b4`;
- catalog: 12,281 gzip / 241,858 raw bytes, SHA-256
  `d44b859812fb17674e7c8ac4eba7e0c88ac656bc67d35ccddaa922570f5d7bf4`;
- five detail shards: 28,713–45,229 gzip bytes each and at most 522,948
  expanded bytes;
- catalog plus all shards: 204,259 gzip / 2,767,414 raw bytes;
- complete local candidate including manifest and report: 247,194 bytes.

Downloading every optional payload would add 7.85% relative to the 2,602,097-byte
primary Character gzip. Normal startup needs only the optional manifest and
catalog (27,285 bytes combined, 1.05% of the primary gzip), followed by one
28–46 KB shard when a missing exact card is opened. No shard is a bootstrap
requirement and no consumer must fetch all five.

The same inputs and fixed `generatedAt` were generated into
`candidate-how-to-get-1788329250-first-party-v1-replay`. All eight files matched
by relative path, byte count and SHA-256 (`differences=0`).

It is evidence for the preserved 572-card subset, not the full graph-only
candidate. The expanded runner requires a fresh output directory and refuses to
overwrite either baseline directory. The new deterministic compact UTF-8
manifest is rejected if it exceeds the Android 64 KiB limit; compact encoding
keeps the repeated per-shard card-ID coverage while avoiding whitespace cost.
Catalog and shards retain their existing content hashes and expanded-byte
limits.

A structural projection using all 2,768 exact IDs estimates 37,794 bytes for a
25-shard manifest and 39,384 bytes for 30 shards, both comfortably below
65,536 bytes. These are projections only; the candidate report records and the
runner enforces the exact serialized size.

### Zarbon record

`1022990` resolves from catalog shard `0004` as SSR TEQ, with absent class,
exact Base navigation, next Awakening card `1022991`, leader
`"Space-Traveling Warriors" Category Ki +2 and HP, ATK & DEF +30%`, passive
`Able Right-Hand Man`, and Super Attack `Elegant Blaster` (`Ki Blast`, 12 Ki,
source attack `8672`). It does not contain any field borrowed from `1023001`.

### Assets

No new asset download or upload is required. The contract reuses the exact
`portraitSpec` and `assetBaseUrl` already approved for the Awakening graph:
`https://assets.dkbcompanion.com/staging/v2/game-assets`.

The 572 details reference 290 unique thumb IDs. All 290 are present in the
snapshot-matched Awakening Route portrait inventory (1,641/1,641 found, zero
missing). Sixteen projections whose generic fallback used `cards.id` are
explicitly rebound to the graph's `cards.resource_id`-aware portrait spec;
their IDs are recorded in the candidate report. Rarity/type badges and frame
backgrounds continue through the existing four-layer Android compositor, so
the approved portraits and badges do not change.

## Baseline verification previously performed

```powershell
npm run build
npx mocha --no-config `
  lib/game-db/game-db-character-materializer.spec.js `
  lib/game-db/game-db-character-detail-enrichment.spec.js
```

- TypeScript compilation: passed.
- Focused tests: 9 passed.
- Real candidate validation: 572 records, zero primary overlaps, zero forbidden
  fallback fields, zero passive-evidence identity mismatches, 572/572 leader,
  passive and typed Super Attack records.
- Deterministic replay: eight files, zero byte/hash differences.
- Asset validation: 290/290 required thumbs covered, zero new downloads.
- Panzy, Mamba and Kyawei remain in the unchanged hash-bound primary payload;
  their existing leader/passive/Super Attack sentinels were inspected and no
  enrichment record can overwrite them.

Verbose evidence is under `.agent-logs/character-detail-*`. The released
2.0.11/2.0.12 APKs were not installed or executed. No Android Gradle task or
emulator/device action was run in this pipeline-only scope.

## Expanded implementation verification

The focused source test covers selection independent from rewards (including
Piccolo `1029760`), preservation of the previous acquisition subset, primary
exclusion, exact form navigation, canonical release-state sequences, duplicate
IDs, missing shard coverage and graph/transformation separation. TypeScript
`--noEmit` and the focused Mocha source test pass. A real full candidate,
deterministic replay, exact materialization counts, shard sizes and manifest
size remain for the primary session; no generated `lib/` or `data/` output was
created in this slice. The updated validator also accepts the complete existing
572-card/5-shard 1.0 candidate, preserving local-cache compatibility.

## Exact Android integration boundary

1. Add a dedicated optional Character-detail manifest key/base configuration.
   Do not add it to `DatabaseBootstrapper`, the primary Character consent size,
   or the Room roster rebuild.
2. Implement a fail-closed parser for the manifest, catalog and one selected
   shard. Bind snapshot/database SHA to the active Stage and Awakening catalogs,
   and bind `sourceBindings.primaryCharacters` to the active primary Character
   manifest. On any mismatch, retain the existing graph-only fallback.
3. Cache the manifest/catalog and content-addressed shards in their own
   last-known-good namespace. Fetch a shard only after an exact missing card ID
   is requested; never require or prefetch all shards.
4. Introduce a presentation-only `CharacterDetailRecord` mapper. Do not insert
   records into `CharacterDao`, `allCharacters`, catalog search, leader
   selection, Team Analysis or Team Builder. Reuse the existing typed leader,
   passive, status-marker, Active Skill and Super Attack adapters.
5. Preserve nullable `characterClass`. Do not route a missing class through
   `CharacterEntity.toModel()`, which currently defaults null to `SUPER`. Hide
   class-dependent presentation for neutral pre-Z-Awakening forms.
6. Treat omitted potential/rainbow/Ki fields as unavailable and hide those rows;
   do not materialize zeroes. Use `portraitSpec` plus the manifest
   `assetBaseUrl` with the existing Awakening Route compositor; do not substitute
   `portraitURL` or a final-form portrait.
7. Resolve Character Details in this order: exact primary card, exact optional
   detail record, current graph-only fallback. Acquisition navigation must pass
   `canonicalNavigation.cardId` unchanged. Keep How to Get before Awakening
   Route, with Awakening Route last, and do not change the approved header,
   portraits or badges.
8. Add focused Android tests for: exact Zarbon SSR fields and Base-only state;
   lazy single-shard fetch; missing/mismatched optional data fallback; old cache
   compatibility; no roster/search/team visibility; neutral class behavior;
   exact typed Super Attacks and status evidence; and unchanged Panzy, Mamba and
   Kyawei primary details. Then run the real-candidate fixture by explicit path
   before any emulator acceptance.

The local Android integration implementing this boundary is saved at
`661111df`. It does not authorize publication. A publisher dry-run,
review/authorization and remote verification remain separate future gates.

## Files changed by the original baseline slice

- `game-db/game-db-character-materializer.ts` and focused spec;
- `game-db/game-db-character-detail-enrichment.ts` and focused spec;
- `game-db/game-db-character-detail-enrichment-run.ts`;
- corresponding tracked `lib/game-db/` JavaScript and source maps;
- `package.json` script;
- this report.

## Files changed by the full-route expansion slice

- `game-db/game-db-character-detail-enrichment.ts`;
- `game-db/game-db-character-detail-enrichment-run.ts`;
- `game-db/game-db-character-detail-enrichment.spec.ts`;
- this report.

No tracked `lib/` file is generated by the delegated slice. The primary session
owns compilation and review of the matching generated JavaScript/source maps.

## Fresh local candidate command

After compiling the reviewed TypeScript, the primary session can generate a
new local candidate without replacing the baseline currently served on port
8765:

```powershell
npm run run:game-db-character-detail-enrichment -- `
  --first-party-dir game-db/data/first-party-complete-source/1788329250-awakening-routes-v1 `
  --primary-manifest game-db/data/game-db-character-release-candidate/character-regression-staging-20260907-v3/characters-manifest.json `
  --primary-payload game-db/data/game-db-character-release-candidate/character-regression-staging-20260907-v3/characters.json.gz `
  --stage-manifest game-db/data/stage-delivery/candidate-how-to-get-1788329250-verified/stage-details-manifest.json `
  --stage-catalog game-db/data/stage-delivery/candidate-how-to-get-1788329250-verified/stage-details/objects/8464bf2a6962c85ce26a1f51f7f1f3f6c8cfa6d2d51388e7dbedba1175c15677.json.gz `
  --awakening-manifest .scratch/awakening-medals-route-1.1-final/awakening-medals-manifest.json `
  --awakening-payload .scratch/awakening-medals-route-1.1-final/awakening-medals.json.gz `
  --output-dir game-db/data/character-detail-enrichment/candidate-full-route-1788329250-first-party-v2 `
  --generated-at 2026-09-08T12:00:00.000Z
```

The output directory must not already exist. The command performs local reads
and writes only; it does not publish, promote, mutate R2 or change the candidate
served on port 8765.

## Repository status boundaries

### Primary integration verification — 2026-09-08

The primary session compiled only the three owned enrichment TypeScript modules
and their source maps, then ran the candidate command above successfully.
`candidate-full-route-1788329250-first-party-v2` contains 2,768 graph-only
forms with zero materialization gaps, in 26 lazy shards. Catalog plus shards
total 1,091,535 compressed bytes (14,491,332 expanded bytes); the manifest is
38,114 bytes, within the Android 64 KiB limit. All 572 baseline records compare
identically to their corresponding expanded records.

The compiled materializer/enrichment suites passed all 12 tests. Android passed
19 focused enrichment tests with both real candidates supplied, including parsing
every one of the 2,768 expanded records through its production parser. The exact
user-reported Piccolo UR, ID 1022441 (Fighting in One's Homeland), now displays
leader skill, Super Attack details and passive in LDPlayer. The separate
enrichment contract and primary roster boundary are unchanged.

The new candidate is served locally on host port 8767; LDPlayer device port
8765 is reversed to that port. The previous candidate server remains available
on host port 8765. The HTTP smoke fetched the manifest, catalog and one shard,
not all shards. No APK runtime changes or reinstall were needed for this pass.
Evidence: Android `.agent-logs/full-route-piccolo-ready.png` and
`full-route-android-candidate.log`; pipeline `.agent-logs/full-route-generation.log`
and `full-route-compiled-tests.log`. No new commit, push or remote publication
was performed. Visual acceptance beyond the inspected Piccolo remains with the
user; parsing coverage is not a manual semantic audit of every skill.

Initial scraper checkpoint: `main` at
`65a4042e8a4e15a53d8fc2b718dc994d0a292db3`. Existing user changes in
`AGENTS.md`, `README.md`, `docs/project-state.md`, `database-events`, the item
publisher, the materializer and their existing generated files were present
before this expansion slice and were not edited or reverted. Android remained
outside this worker's write scope; the primary session saved its independent
consumer work at `661111df`.

Final pipeline status remains uncommitted and unpublished. The full-route slice
changed only the four files listed above and created only ignored focused-test
logs; the pre-existing dirty files remain outside its integration boundary.
