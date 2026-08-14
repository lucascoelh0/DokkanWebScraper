# Dokkanpanion Project State

**Last updated**: 2026-08-13

This is the concise operational checkpoint for future sessions. Durable
decisions live in [`adr/`](adr/), and current workflow instructions live in
[`AGENTS.md`](../AGENTS.md).

## Repository Checkpoints

- `D:\Dokkan\DokkanWebScraper` owns the TypeScript data pipeline.
  Its integrated history includes E0–E9, H0–H13, F0–F6 and M0–M6, together
  with the DB0–DB50/C1–C5 database-first foundation.
- This history line also contains the reviewed K0–K9 character-productization
  checkpoint, reapplied in order from the historical campaign and followed by
  artifact-path hardening. Exact branch pointers remain operational Git state,
  not a durable project-state assertion.
- The historical `codex/database-character-productization` branch remains
  intact as the original campaign record.
- `D:\Dokkan\Dokkanpanion` owns the Android consumer. Its synchronized
  `master` checkpoint remains `fe58fe1`; no database-first shadow consumer is
  implemented or authorized.
- The project uses Codex exclusively. Provider-neutral workflow, verification,
  repository and publication rules are defined in `AGENTS.md`.

## Database-first Foundation

- Character and Team Analysis DB0–DB50 and integration C1–C5 are integrated as
  one dependency-complete unit from the `ba29759` checkpoint.
- The database-first sidecar is optional, additive, absent-compatible and
  disabled by default. Production generation, contracts, publishers, R2 and
  Android do not consume it.
- `supported`, `partial` and `unknown` remain distinct. Supported-only
  projections exclude every partial/unknown dimension; joins use structural
  IDs rather than names or localized text; provenance is field-scoped.
- The durable decision remains
  [`ADR-0005`](adr/0005-use-an-optional-database-first-team-analysis-sidecar.md).

## Current Campaign Checkpoints

### AQ0–AQ6 — manual official SQLite acquisition infrastructure

- AQ0–AQ6 is implemented and validated in the history lineage containing this
  checkpoint as an offline-by-default, manual and fail-closed acquisition
  boundary. Integration into `main` remains subject to its independent review
  gate; this state record does not assert the current branch pointer. Presence
  after a future fast-forward likewise does not authorize acquisition or
  production.
  It validates an externally supplied Global EN
  `/client_assets/database` descriptor or inspects an already downloaded local
  artifact bound to that descriptor; import, parsing and dry-run issue no
  requests.
- A future separately authorized download is restricted to one exact official
  HTTPS CDN URL, redirects disabled, streamed under a hard byte/timeout limit,
  SHA-256 validated locally and committed marker-last into ignored immutable
  content-addressed storage with an append-only, create-only pointer journal.
- Immutable artifact metadata/identity remain deterministic and timestamp-free.
  Download and offline-validation times live only in separate sanitized local
  operational receipts and never affect content addressing, markers or reuse.
- Acquisition remains separate from SQLCipher decryption, first-party export,
  C4/C1–C3 shadow refresh, authenticated refresh, publisher/R2, production and
  Android. No real API/CDN request or decryption was executed in AQ0–AQ6.
- The SQLite compatibility gate reports exact profile match, schema-compatible
  evidence refresh required, incompatible or unknown. It never reuses pinned
  ELF/DB48/DB49/DB50 evidence automatically, including on an exact SQLite-only
  match. Its source boundary opens the validated AQ database once, copies that
  exact descriptor into an exclusive private read-only snapshot, reads the
  inspection bytes from that still-open handle so the bridge never reopens its
  pathname, verifies the
  snapshot SHA-256/size before and after SQLite inspection, and revalidates the
  source AQ commit before reporting. Its productive TypeScript/JavaScript API accepts only an AQ store plus
  committed identity, or an explicit fully revalidated `latest`; it accepts no
  arbitrary SQLite path, baseline, inspection, hook or Python-command injection
  and uses only the tracked C4 baseline plus the production read-only adapter.
- The artifact store pins the canonical root and controlled-directory
  identities, rejects symlink/junction substitutions and revalidates durable
  boundaries. Before promotion it holds open and binds `database.db`,
  `metadata.json` and `commit-marker.json` to one material snapshot. Promotion
  reserves the final identity exclusively and installs those same members with
  independent create-only handle copies, marker last, followed by fsync, exact
  size/SHA validation, `nlink == 1` and read-only enforcement; no hard links are
  created. A raced destination is never overwritten and can win only if it
  validates as the exact complete commit. A failed owned
  reservation is quarantined by its pinned directory identity, so invalid
  promoted content cannot retain the legitimate content-addressed name.
- Each promotion creates its own immutable pointer record. Records name the
  commit, its validated predecessor and an explicit `(databaseVersion,
  artifactIdentity)` order. Consumers enumerate and validate the journal,
  revalidate every materialized commit and select the deterministic maximum;
  concurrent writers never replace one shared pointer pathname. `latest.json`,
  if present from an older checkout, is a dispensable cache and has no authority.
- AQ0–AQ6 ends at the official acquired artifact, which may remain encrypted.
  A decrypted loose SQLite has no productive lineage contract yet. A future
  separately reviewed derivation gate must bind its output commit to the parent
  AQ identity, pinned tool/version, non-secret parameters and result SHA/size/state
  before that derived commit can enter C4.
- Offline descriptor/artifact validation remains the only reviewable AQ path.
  Before integration, the next gate is the independent integration decision;
  after integration, the next separate gate is one explicitly authorized real
  manual acquisition. No real acquisition was authorized or executed in this
  lineage. Official download, decryption, refresh, publication, production
  promotion and Android otherwise remain NO-GO pending independent gates.

### E0–E9 — events, stages, enemies and bosses

- E0–E9 `1.0.0` is complete, experimental, optional and non-production.
- E9 permits only reviewed disabled infrastructure and generation with the
  exact audited profile. Scraper replacement, R2, Android, event screens,
  beneficial-character calculation and boss/damage simulation remain NO-GO.
- E9 payload SHA-256 is
  `f7a111572485e0c55758a186d753e40eebf59f2de4c262c192a5ad5cf0cf781c`;
  the full sequential refresh was deterministic and peaked at 847,204,352
  bytes, below 1 GiB.

### H0–H13 — offline server captures

- H0–H13 is integrated as offline, additive, default-off capture evidence.
  It adds no credential acquisition, replay, scheduler, publisher, Android
  consumer or production switch.
- H12 remains two GO decisions (reviewed disabled infrastructure and ignored
  sanitized local fixtures) and five NO-GOs: authenticated refresh, scraper
  replacement, R2, Android shadow mode and FYI/DokkanInfo retirement.
- H13 corrects H11 without changing H0–H10: the 627 unique gasha facts are 612
  representation mismatches and 15 coverage gaps, with zero confirmed
  conflicts. The former 1,254 count is a non-exclusive comparison-cell total.

### F0–F6 — Frontier capture audit

- F0–F6 is complete as offline-only, additive, default-off and fail-closed
  evidence. It cannot replay or automate battle traffic.
- Only disabled infrastructure and synthetic fixtures are GO. Real-body
  decoding, E0–E9 replacement, Android, R2, automated refresh, protocol
  consumption and replay/automation remain NO-GO.
- F6 artifact SHA-256 is
  `6280ec896beda1150df84a1933f6f76ece28e278ba47a310922cfac6d28c8f63`;
  two reconstructions were byte-identical and peak memory was 488,800,256
  bytes.

### M0–M6 — Pettan/Burst special-mode captures

- M0–M6 is complete with current evidence as optional, offline-only,
  default-off infrastructure. It has no request/replay/mutation, Android, R2,
  publisher or production capability.
- Only disabled infrastructure and synthetic fixtures are GO. Pettan battle,
  Burst gameplay/scoring, opaque start configuration, E/S/H replacement,
  Android, R2, production and request/replay automation remain NO-GO.
- M6 artifact SHA-256 is
  `bc4978334f5ad14f68b4af9e502a250cc2ede9bff74e572516c0a68b86fd0751`;
  two reconstructions were byte-identical and peak memory was 258,596,864
  bytes.

### K0–K9 — reviewed character productization checkpoint

- K0–K9 evidence, contracts and matching compiled outputs are present on this
  history line. The infrastructure remains optional, additive,
  absent-compatible, default-off and non-production; no Android, R2, publisher
  or productive dataset was added.
- Only merging the disabled infrastructure and pinned optional generation are
  GO. Every authority promotion or consumer path remains NO-GO, including
  production replacement, FYI/DokkanInfo removal, asset delivery, Android,
  Team Builder and combat calculation.
- K7 preserves the four field-scoped conflicts rather than selecting a winner:
  FYI reports `maxLevel=120` and `maxSALevel=10` for EZA cards `1027621` and
  `1028161`, while first-party EZA step-7 growth rows report `140` and `15`.
  Both snapshot/state/growth-row provenances remain explicit.
- Dynamic acquisition and availability remain server-owned; asset delivery,
  portrait/card-art roles, unproved presentation mappings and runtime/combat
  semantics remain unknown or unsupported.
- K9 payload SHA-256 is
  `db0f86e858b091521ab72ae72b89d2531abb0fcd1bf684877bcb991197d5ff85`;
  K0–K9 generation evidence is deterministic and every recorded peak stays
  below 1 GiB (K1 is the maximum at 899,956,736 bytes).

### K10–K20 — field-scoped compact shadow and FYI candidate implementation

- The reviewed K10–K14 infrastructure is present in this history, remains
  disabled and is available for offline audit. Presence in the repository is
  not production activation or authority promotion.
- The optional shadow contains 109,421 field projections over 5,759 database
  cards, preserves 4,296 production joins and 1,463 unjoinables, and creates no
  `Character` records or production writes.
- Its canonical matrix covers all `Character` fields, and every joined external
  comparison records the exact top-level/nested JSON path selected under a
  fail-closed, payload-independent authority policy.
- `id`, `rarity` and `type` satisfy field-evidence readiness only. K14 does not
  authorize a data consumer, publication or authority promotion.
- The four K7 conflicts on `1027621` and `1028161` remain unresolved and retain
  exact EZA growth-row provenance. They are not K0-K2 value inputs.
- K11 is audit-only: its 511,791,355 raw bytes must not be read by Android,
  runtime consumers, opt-in consumers or publishers. Its payload SHA-256 is
  `baa78b0cb06ec404eb6df3b008a27e746b82e0f6601dd6622e8d6cb6ab46b074`;
  two complete generations were byte-identical and peak RSS was 715,735,040
  bytes.
- K15 now implements offline-only generation and validation of a compact,
  supported-only `cardId`/`stateId`/`rarity`/`type` projection. It contains
  4,296 deterministic records, excludes the 1,463 unjoinables, creates or
  removes no `Character`, and carries K0-K2/K11-K14 plus productive
  `Character[]` lineage only in its header/manifest.
- The K15 payload is 29,902 gzip bytes / 558,190 raw bytes with SHA-256
  `803346fc61a7e659ccb8aeea62c273fcdf24ef3d66d3d03564a6fad29627c81f`.
  Two complete generations were byte-identical and peak RSS was 248,946,688
  bytes. Generated `data/` remains ignored and unpublished.
- K16 now adds an explicitly opt-in, offline K15-only compare-shadow consumer.
  It validates K15 before and after use, reads only the exact 121,390,313-byte,
  4,090-record productive `Character[]` pin, compares all 4,296 compact records
  by structural ID and emits a bounded deterministic stdout report. It has no
  writer, apply, merge, catalog mutation, K11 payload reader or K0-K14 sidecar
  input. The pinned real-data result is 4,296 `id` agreements, 4,296 `type`
  agreements and 4,085 `rarity` agreements plus 211 productive-null
  differences, with zero missing or ambiguous bindings.
- K17 now adds an explicitly opt-in, offline and memory-only promotion overlay
  proof over those same exact pins. It proposes 211 `rarity` null fills, permits
  zero `type` changes, applies only to selected paths in a deep clone, and proves
  4,296 all-field agreements with zero blockers. The complete canonical
  candidate-list SHA-256 is
  `da56af2745acd0a0791b9df659da7148d8784d88c658cbf4a6ab33cbadc65b71`;
  two bounded stdout reports were byte-identical with SHA-256
  `3b75e45ee9f117e49519cda81468d89e7bda6f5366c13e6ee7e7550bb95280fc`.
- K15 generation/validation, K16 offline compare-shadow and K17 in-memory
  overlay proof are GO. Authority promotion, persisted/effective production
  changes, publisher, R2, Android and FYI/DokkanInfo removal remain
  disabled/NO-GO.
- K18-K20 are present in this history as a reviewed, default-off checkpoint: a
  pure K18 field-scoped overlay API, an explicit K19 FYI candidate path and an
  offline K20 compare/readiness gate. Presence is not production activation or
  authority promotion.
- K19 scopes validated K15 records to structural IDs actually present in the
  FYI target catalog. Against the exact current FYI payload pin, 1,576 of 4,296
  K15 records are in scope, 2,720 are `excludedByTargetCatalog`, and 49 of
  1,625 FYI states are not covered by K15. The selected scope has 1,576 type
  agreements, 1,387 rarity agreements, 189 null fills and zero blockers.
  Out-of-scope and uncovered states are neither agreements nor authority.
- A subsequent explicit real K19 run produced 1,436 characters, 1,627
  structural states and 1,627 referenced portraits. K20 independently rebuilt
  the candidate in memory and returned GO with 189 authorized rarity fills and
  zero type, non-rarity, cardinality, ID, order or portrait-reference changes.
  The real candidate remains ignored and has not replaced `latest`,
  `data/latest`, any publisher input, R2 or Android data.
- Candidate persistence is fail-closed: portrait filenames are canonicalized,
  the fixed directory is reserved exactly once, and a content-addressed commit
  marker is written last. K20 validates that marker plus the complete K19/K15
  contract, lineage and safety declaration before it can return GO.
- K21-K23 are a local-only, default-off delivery checkpoint. K21 re-runs K20,
  materializes an immutable content-addressed release containing the exact
  candidate payload and referenced portraits, and writes its commit marker
  last. K22 produces a deterministic object/budget plan under a proven 50 MB
  local namespace guard and records the 10 GB bucket ceiling as unknown until
  remote usage is inspected. K23 binds both artifacts in a stopped
  receipt. No module imports Wrangler or the production publisher; remote
  inventory, publication, production, Android and R2 remain NO-GO. Stable
  portrait keys require remote hash proof before any future upload.
- K24 is the separately opt-in remote read-only preflight. It revalidates the
  complete K21-K23 release, GETs every immutable payload/portrait key from the
  fixed public asset domain, observes the mutable manifest, and runs only the
  fixed Wrangler bucket-info command. Hash conflicts, read failures, unknown
  bucket usage, or a projected conservative upper bound at or above 10 GB fail
  closed. K24 has no upload/delete/promotion command; publication still needs
  explicit authorization and remains a separate gate.
- The first real K24 run inspected all 1,628 immutable objects with zero read
  failures: 1,568 matched, five were missing and 55 stable `images/v2` portrait
  keys contained different pixels. Bucket capacity is not a blocker (about
  345.3 MB projected versus the 10 GB ceiling), but immutable-key collisions
  make this release NO-GO. Android already resolves arbitrary relative portrait
  paths, so the next safe gate is content-addressed portrait delivery rather
  than overwriting any existing `images/v2` object.
- K25-K27 implement that stopped, read-only correction. K25 derives a new
  payload in memory and proves that only `portraitURL` values changed. K26
  plans a new content-addressed payload plus `images/v3/portrait_<id>.<sha>.png`
  objects while reusing the validated K21 portrait bytes locally. K27 GETs
  every planned immutable key and reads bucket usage conservatively. There is
  still no writer, publisher import, manifest promotion, production switch,
  Android change or R2 mutation; those require a separate authorized gate.
- The first real K27 run found all 1,628 versioned immutable objects missing,
  with zero conflicts and zero failures. Publication would add 18,797,554
  bytes and conservatively project the bucket to 362,797,554 bytes, safely
  below 10 GB. This makes the versioned delivery plan ready for a separately
  reviewed publisher gate, but does not authorize or perform publication.
- K28 adds that publisher behind exact dry-run/publish CLIs, a required
  delivery-ID confirmation and bucket-scoped R2 S3 credentials. It repeats
  K27, directly validates every immutable object and its cache metadata, uses
  `If-None-Match: *` for immutable creates, and promotes the manifest last with
  ETag-based `If-Match` or create-only semantics. It implements no delete or
  production switch. Merging K28 did not authorize its write path.
- The separately authorized K28 publication completed on 2026-08-11. It
  uploaded 1,628 immutable objects (18,797,554 bytes), verified all 1,628 plus
  the promoted manifest, and changed `characters-manifest.json` last through
  ETag compare-and-swap. The public manifest is 445 bytes with SHA-256
  `8413123534ec16fb2f1e2ee3d9cbe5e8392abce5c410e40a4e25b8c0d16f24ff`;
  it exposes dataset version `2026-08-11T00:56:35.327Z`, 1,436 characters and
  payload SHA-256
  `e6c7770f8db88412879ee92ed12731e874463557eb94f2e326871af1b7725275`.
- The immediate post-publication dry-run found 1,628 matches, zero missing,
  zero conflicts, zero failed reads and zero bytes left to upload. Wrangler
  reported approximately 352 MB in the bucket; the conservative upper bound
  was 353,000,000 bytes, safely below the fixed 10 GB ceiling. Existing
  Android clients may discover this release through the unchanged manifest
  URL, but no Android code or UI changed during publication.
- The separately authorized 2026-08-13 refresh repeated the complete K15-K28
  production path. K15 was regenerated byte-identically from the pinned
  database shadow. Within the same 2026-08-13 collection baseline, the K15
  overlay changed only 189 missing `rarity` values; K20 proved zero type,
  non-rarity, cardinality, ID, order or portrait-reference changes for that
  overlay boundary.
- The complete delta from the previous public Characters release is broader
  than the K15 overlay: the mapper now separates BASE/EZA/SEZA combat fields,
  720 structural states changed, two were added, two were removed, and 111
  portrait references changed. K28 uploaded 114 new immutable objects /
  2,619,762 bytes, verified all 1,628 immutable objects plus the manifest and
  promoted the manifest last with compare-and-swap. The public manifest now
  exposes dataset version `2026-08-13T03:49:01.219Z`, 1,436 characters, 1,627
  structural states, a 1,460,373-byte payload and payload SHA-256
  `de6268219039f0bbafda7b01b473e957e0cd5442682caab361a32470a2a2e899`.
  Its SHA-256 is
  `ae634968dd3349cec2b6ac16d7df2bcdcf9306afaf897cb475011fbd8f22c610`.
  The post-publication dry-run found 1,628 matches, zero missing, zero
  conflicts, zero failed reads and zero bytes left to upload. Wrangler
  reported 361 MB in the bucket, below the fixed 10 GB ceiling.
- Characters is correctly published and must not be rolled back or
  republished. The public Team Analysis manifest still identifies the
  2026-08-04 Characters lineage and reports 1,625 states. Because Android
  requires exact equality for both source Characters version and payload
  SHA-256, that sidecar is incompatible with the current Characters release
  until a separately generated and authorized Team Analysis publication
  follows the new lineage.

## Operating Constraints

- Read this checkpoint before reconstructing broader project context.
- Keep verbose output in ignored `.agent-logs/` and start with focused checks.
- Do not commit generated `data/`, SQLite, ELF, APK or raw capture artifacts;
  keep only matching tracked `lib/` output for changed TypeScript sources.
- Treat commit, push, R2 publication and Android changes as separate actions
  requiring explicit authorization.
- Run an R2 publisher dry-run and inspect projected bytes before any upload.
- Preserve unrelated user changes in both repositories.

## Maintenance Rule

Update this file after a major integration, publish, cutover or user-visible
milestone. Keep low-level evidence in the relevant report/specification and
create or supersede an ADR when a durable decision changes.
