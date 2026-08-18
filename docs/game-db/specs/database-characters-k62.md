# Database Characters K62 - productive Leader compatibility audit

Status: the historical offline/default-off K62 compatibility audit is GO for
the exact K61 public candidate shadow. K62.1 replaces the mutable Android
checkout evidence boundary with reproducible Git-object provenance. The real
K62.1 materialization, double generation, post-write reconstruction and
external process-tree RSS gate are GO for the exact inputs recorded below.
Direct consumption by the productive scraper/Android Leader contracts remains
NO-GO. A future additive, absent-compatible K63 shadow contract is
documentarily GO. Contract version `1.2.0`.

## Boundary and lineage

K62 performs no HTTP request, authenticated operation, publisher execution or
R2 mutation. K62.1 reads Android source bytes only from a pinned commit in the
local Git object database. It never reads those bytes from the index or working
tree and never checks out a commit. Android, `Character[]`, Team Analysis and
UI are not modified.

### K62.1 Android source identity

The Android repository identity is exactly:

- repository URL: `https://github.com/lucascoelh0/Dokkanpanion.git`;
- commit: `5afa5ee3de25755c9fffdfcd2f1fc3293d56b26a`;
- access: bounded, no-shell `git` argument arrays against the local object
  database only.

The verifier requires the canonical repository root, exact `remote.origin.url`,
the exact direct commit and `commit^{commit}`, then checks each commit path with
`ls-tree`. Each resulting object must be the pinned blob, report type `blob`,
have the exact size, and return bytes with the exact SHA-256 through
`cat-file blob`. Commands run serially with fixed time/output limits and reject
nonempty stderr. The bounded environment removes ambient `GIT_*` overrides,
then fixes `GIT_NO_LAZY_FETCH=1`; a missing promisor object therefore fails
without network hydration. `GIT_OPTIONAL_LOCKS=0` suppresses optional locks for
these read-only commands but is not treated as an additional identity proof. A
missing commit/path/object or any repository, lineage, type, size, blob-ID or
content-hash divergence fails closed.

| Commit path under `domain/src/main/java/com/luminay/domain/` | Blob ID | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `models/CharacterModel.kt` | `d38b261714a9fc67f08cefbe146c03d0b18264a6` | 4,127 | `e1ab8d11fc4d5f402b57653f13f55f9a6fa68ed1c6e82ce05d10faee96298cd7` |
| `models/LeaderSkillDetailsModel.kt` | `bac4997dabaf3db783f3d934ca2a29720d1fa939` | 1,101 | `c16cbf0f82862f700f68c6c77c4d30c5389439bea299cfdc38f845b08d74a228` |
| `models/ParsedLeaderSkill.kt` | `f7f1a83c35afd17bd7a358686d8e703e73147d50` | 490 | `520ad50c9b4e05f004a966557b0c5b1dd12664c6d18ef328815f9a1a19f46735` |
| `models/team/LeaderCoverage.kt` | `201b56d283a5a14ed4ced1e64e64af795f08362e` | 1,930 | `6889f228be2fbe5c670250c154c940d8c3936af9e2228245f2e0018817c6111d` |
| `utils/LeaderCoverageEvaluator.kt` | `33d1f7adf512abcffd4251f05bde050550f60881` | 17,201 | `a5c1d6e47a425c74b0d47441b8106f9b5dc4e0499c1d34f8cf24b2ceccbbf7d9` |
| `startup/RoomCharacterDatabaseGateway.kt` | `1e14e40e0c0ecb614131a1b65fc761632ce347f9` | 13,695 | `1db369fd1404302e111035aec0ba2a52e6b33a1251d1f430e4db34df039fbf64` |
| `startup/TeamAnalysisManifest.kt` | `3ccaff9c39ec37d929f267bb86d2d35e4f310bb0` | 1,051 | `0cedbd5c918a6d131888d7dbf71e11ea2f63699ea894ba0e2f0126e799014590` |
| `startup/TeamAnalysisWireModels.kt` | `c122f3bfb2cbd4f2cf13a768c7ea2e8d854e937b` | 30,228 | `acf2f62e3091258de282c67041a1dbe1fb12bbddf69f73cac72a467526db2f17` |
| `models/teamanalysis/TeamAnalysisModels.kt` | `9060450a447475e6cbc01dc99af392d26fae4919` | 15,693 | `66b60584fe49a84ffd4eb1517f62fbfd63ca85a8ebaf3f46babaf4bb343f98ef` |

The K62.1 report exposes repository URL, commit, path, blob ID, size and
SHA-256, plus a fingerprint over that provenance. It does not expose source
bytes. These pins are compatibility evidence only: they can fail the audit but
can never authorize or supply materialized product bytes. Dirty, divergent or
even malicious checkout bytes are irrelevant because the checkout is never a
source.

K62.1 captures bounded, fingerprinted source receipts before the single heavy
K58/K55 load, after that load and after create-only output. Persistent drift
between checkpoints fails closed. This is explicitly
`CHECKPOINTED_PERSISTENT_DRIFT_ONLY`: a transient A-B-A mutation wholly between
checkpoints is not detected and remains `NO-GO`. The runner therefore claims
`sourceBoundReconstruction: GO`, not immutable source stability across the
audit.

The runner revalidates the exact K58 bundle source-bound, which reconstructs
K56 through K55. It then losslessly reconstructs K56 locally and joins pinned
K57, K59, K60 and K61 reports plus the K60 post-publication receipt. The chain
retains:

- 3,836 supported effects and 12,265 references;
- 7,248 states, 3,434 cards and four lookup indices;
- 17 effects and 45 references excluded as
  `runtime_deck_index_unresolved`;
- full artifact fingerprint
  `807a98ae37cd17a68a7f3f3544c1f14b4f4bfab9f75c9b627cca23cbab41e3b3`;
- lineage fingerprint
  `132c1e858ed5fdb6bdc97f3c5e0313c865c7bf0ee7367e1ad1453b89e280fa5f`;
- public manifest SHA-256
  `370dc7026c4523d509a403a2fbfa91009d1bb9452f7ab277f9c6aaebb8a1441e`,
  still `candidateOnly: true`.

K59 is used only as its pinned publication-time read-only observation, K60 as
its pinned verified publication receipt, and K61 as its pinned public shadow
report. K62 neither repeats their network operations nor republishes anything.

## Structural parity

Joins use only `stateId`/`sourceStateKey`, `cardId`, `releaseState`, Leader set/
effect/occurrence IDs and corresponding first-party IDs. Names, titles, raw
text and descriptions are never identity.

Against the exact 121,390,313-byte productive `Character[]` pin:

| Metric | References |
| --- | ---: |
| structurally joinable by `cardId` | 8,893 |
| structurally unjoinable | 3,372 |
| identity agreement | 8,893 |
| structural representation gain | 8,893 |
| representation mismatch on comparable values | 0 |
| comparable value references | 0 |
| confirmed conflicts | 0 |
| value/lifecycle unknown | 12,265 |

The joins cover 2,265 distinct productive cards; 1,169 projected card IDs are
unjoinable. All 8,893 joined references have text available only as baseline.
The pinned productive dataset has zero `leaderSkillDetails`/
`ezaLeaderSkillDetails` records, so no K61 numeric value is declared comparable.
Zero conflicts therefore does not mean completeness or authority.

The current Team Analysis contract has structural card/release identities and
reusable provenance/unknown patterns, but no Leader Skill channel and no exact
K61 state identity. The current Android model has percentage/flat Leader
clauses and an absent-details fallback, but no first-party effect IDs,
exclusions, field-scoped provenance or lossless ordered filter composition.
Its coverage evaluator produces effective values by selecting alternatives and
aggregating clauses; it is not a lossless K61 evidence store.

## Compatibility matrix

Every dimension has exactly one classification:

| Dimension | Classification | Affected references | Reason |
| --- | --- | ---: | --- |
| state/card/release identity | `current_model_lossy` | 12,265 | Product has `cardId`, but not exact K61 state/source/release identity. |
| Leader set/effect/occurrence IDs | `additive_contract_required` | 12,265 | First-party identities are absent. |
| structural mask | `additive_contract_required` | 12,265 | The opaque mask has no lossless current field. |
| operation | `directly_representable` | 12,265 | Existing boost forms distinguish percentage and flat. |
| common modifier | `current_model_lossy` | 12,265 | Expanding to three stat scalars loses common identity/provenance. |
| flat points | `directly_representable` | 12 | Existing flat form and numeric range suffice for storage. |
| proportional percentage | `directly_representable` | 12,253 | Existing percentage form stores the numerator, without final arithmetic authority. |
| target team | `directly_representable` | 11,971 | Allies scope exists; the independent structural selector remains additive. |
| target Super Class | `directly_representable` | 161 | Super exists in the current target domain. |
| target Extreme Class | `directly_representable` | 133 | Extreme exists in the current target domain. |
| included categories | `current_model_lossy` | 7,292 | Current any-match lists cannot preserve sequential AND semantics. |
| excluded categories | `additive_contract_required` | 4,614 | No exclusion operation exists. |
| sequential AND composition | `additive_contract_required` | 9,038 | Composition, empty identity and duplicate policy are absent. |
| order | `additive_contract_required` | 12,265 | Source order is not retained by the effective model. |
| multiplicity | `additive_contract_required` | 12,265 | Occurrence identity/multiplicity needs separate evidence. |
| provenance | `additive_contract_required` | 12,265 | K56-K61 field/source lineage has no Leader wire field. |
| lifecycle/timing | `blocked_unknown` | 12,265 | Start-turn invocation is known; recurrence, duration/removal and lifecycle outcome are not. |
| missing runtime dimensions | `runtime_context_required` | 12,265 | Leader+Friend, final stacking/rounding and form/death lifecycle require runtime context. |

At whole-effect granularity, all 3,836 supported effect IDs are
`additive_contract_required`: no current model can hold a complete effect
losslessly, but the K61 supported structure is sufficient for a separate
non-effective shadow evidence model. The 17 conditional effects are not
reclassified because they remain outside the K62 corpus.

## K63 proposal (documentation only)

The smallest safe K63 is a separate optional data-side sidecar and separate
domain evidence model. It must not add fields to `CharacterEntity`, rewrite
Team Analysis, or feed `LeaderCoverageEvaluator` effective values.

- A missing manifest means the existing fallback runs byte- and semantically
  identically.
- Old caches remain readable and are not migrated or invalidated by absence.
- Only supported records load; conditional/partial/unknown effects remain out.
- The record preserves state/card/release and Leader set/effect/occurrence IDs,
  mask, operation, calculation, ordered filters, multiplicity and provenance.
- Unknown runtime/lifecycle dimensions are explicit nullable/sealed evidence,
  never numeric zero or Boolean false.
- The repository exposes immutable shadow evidence only. It does not replace
  `receivedBoost`, `offeredBoost` or any effective value.
- No UI surface changes in K63.

This is a K63 design GO, not authorization to implement Android or consume the
public candidate.

## Historical K62.0 real result

The earlier contract `1.0.0` compiled run performed two byte-identical
materializations and a source-bound post-write reconstruction. Stderr was
empty and exit code was 0. These are historical K62.0 bytes, not K62.1 output.

| Member | Bytes | SHA-256 |
| --- | ---: | --- |
| canonical raw report | 850,319 | `23c03e337c6c04066da06bb63bf33dc4b283a571a72182c527e4ec297383845f` |
| gzip payload | 19,032 | `39fd57186bf78afce2cc2baaa8764725715e787e45cd0aa0ff6361d32d6d9edb` |
| coverage | 2,589 | `a3b8788907aaa51320b439850dd8032a0bdf23a82d6ebb5fd232cf655fb067bb` |
| validation | 824 | `bc85a5b3f13d7ba0c7b1c12929ebe4ee4b3254bfdfea04b926019d95ff23bc43` |
| manifest | 1,217 | `b28f410f3676af76adfced9f12b2fd3f47be9e4e2ed7ac09801eaccaca86eb33` |

Per-process peaks were 1,021,419,520 and 1,039,409,152 bytes for the two
K58/K55 validations and 1,023,676,416 bytes for the K62 parent. The maximum
individual-process peak was 1,039,409,152 bytes, 34,332,672 bytes below the
exclusive 1 GiB limit. Combined process-tree RSS was unmeasured in K62.0.

## K62.1 real result

The accepted candidate ran from `2026-08-18T00:38:18.4893784-03:00` through
`2026-08-18T00:47:13.9273756-03:00`, exited 0 and wrote no stderr. It performed
one source-bound K58/K55 validation, two byte-identical materializations,
create-only output, lossless post-write reconstruction and comparison of all
four persisted members, then rechecked the checkpointed source receipt. It
reports `sourceBoundReconstruction: GO`; transient A-B-A drift detection remains
explicitly `NO-GO`.

| Member | Bytes | SHA-256 |
| --- | ---: | --- |
| canonical raw report | 853,720 | `1ba112d7b4e08ceebeb590976b8d1b7c1d726064cba094ef050db237aadaef4f` |
| gzip payload | 20,200 | `b0a01eda8fedf56f6d7320d725fdcf45170f6ac380175bb8ea21f51fa00abd18` |
| coverage | 5,728 | `fcb5de3e517d813c833725a4061e577a0b3134b12bdc2caa4462eb8700b5682c` |
| validation | 963 | `71087ad11527637e80c0c9ec67733c120ff5ca74e9c0b6803cd86af9b65c8870` |
| manifest | 1,217 | `b48646293afb53309940bc17233e216a82c3b570d69e38a84cac70084a4ded06` |

The canonical result preserves 3,836 effects and 12,265 references, with 8,893
joinable and 3,372 unjoinable references. Its 18 dimensions remain exactly six
`directly_representable`, seven `additive_contract_required`, three
`current_model_lossy`, one `blocked_unknown` and one
`runtime_context_required`.

The K62.1 memory reformulation uses one K55 subprocess with a fixed 608 MiB V8
heap ceiling, `--expose-gc`, no-shell spawning, a ten-minute timeout and bounded
termination. The runner performs mandatory GC after the initial receipt and
before K55. Isolated diagnostics all exited 0 and produced the same canonical
K55 report SHA-256
`126ae31e74422ed88cb9f35175f2e562ae3eb40ef828a8f0c3982128faf888fe`:

| K55 V8 heap ceiling | Peak process RSS bytes |
| ---: | ---: |
| 768 MiB | 1,018,134,528 |
| 736 MiB | 1,008,304,128 |
| 672 MiB | 998,010,880 |
| 640 MiB | 992,808,960 |
| 608 MiB | 985,780,224 |

For the accepted full run, K55 reported a 996,798,464-byte individual peak and
the K62 parent reported 984,895,488 bytes. An external Windows process-tree
observer polled the root and all discovered descendants through CIM for 6,433
samples. The aggregate peak was 1,071,194,112 bytes, 2,547,712 bytes below the
exclusive 1 GiB limit, with no measurement error. The deterministic runner
still records external process-tree measurement as `NOT_EXECUTED`; only the
separate observer supplies this GO evidence.

TypeScript `--noEmit` and source-to-`lib` build passed. Focused K62 validation
passed 14/14; the compiled `database-characters` suite passed 341 tests with 11
platform-dependent tests pending. Independent contract review found no P0-P2.

## Readiness

| Scope | Decision |
| --- | --- |
| historical offline K62.0 compatibility audit | **GO** |
| K62.1 Git-object source boundary and mocked tests | **GO** |
| real K62.1 materialization | **GO** |
| complete local K56-K61 lineage | **GO** |
| double generation / checkpointed source-bound lossless reconstruction | **GO** |
| future additive K63 shadow contract | **GO (design only)** |
| direct current-contract consumption | **NO-GO** |
| 17 conditional effects / `deckIndex` | **NO-GO / unknown** |
| Leader + Friend / stacking / rounding / combat | **NO-GO / unknown** |
| authority, production, Android or UI | **NO-GO** |
| network, publisher or R2 mutation | **0 / NOT_EXECUTED** |
| historical K62.0 per-process RSS below 1 GiB | **GO** |
| K62.1 process-tree RSS below 1 GiB | **GO — external observer, 1,071,194,112 bytes** |
| transient A-B-A source drift detection | **NO-GO** |
| concurrent output-ancestor replacement | **NO-GO** |
