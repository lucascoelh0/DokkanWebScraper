# Dokkanpanion Project State

**Last updated**: 2026-08-16

This is the concise operational checkpoint for future sessions. Durable
decisions live in [`adr/`](adr/), and current workflow instructions live in
[`AGENTS.md`](../AGENTS.md).

## Repository Checkpoints

- `D:\Dokkan\DokkanWebScraper` owns the TypeScript data pipeline.
  Its integrated history includes E0–E9, H0–H13, F0–F6 and M0–M6, together
  with the DB0–DB50/C1–C5 database-first foundation and the AQ0–AQ6/DQ0–DQ6
  offline acquisition/derived-lineage infrastructure.
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

- AQ0–AQ6 is implemented, validated and integrated in the history lineage
  containing this checkpoint as an offline-by-default, manual and fail-closed
  acquisition boundary. Integration does not authorize acquisition or
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
  pathname. The productive wrapper pins a 112 MiB SQLite ceiling, streams 64 KiB
  chunks with backpressure, limits stdout/stderr to 8/1 MiB, enforces a 120-second
  timeout plus bounded forced termination, and accepts only `AbortSignal` for
  cancellation. It verifies the
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
  A decrypted loose SQLite has no authority. DQ0-DQ4 supplies the bounded
  derived lineage/store contract, DQ5 adds local read-only C4 compatibility
  consumption, and DQ6 adds a fail-closed runtime-selection boundary plus a
  test-only synthetic process harness. Productive process execution, key supply
  and real decryption remain separate future gates.
- Offline descriptor/artifact validation remains the only reviewable AQ path.
  With integration complete, the next separate gate is one explicitly
  authorized real manual acquisition. No real acquisition was authorized or
  executed in this lineage. Official download, decryption, refresh,
  publication, production promotion and Android otherwise remain NO-GO pending
  independent gates.

### DQ0–DQ6 — derived SQLite lineage, fail-closed runtime boundary and local inspection

- DQ0-DQ6 is integrated in this history as an offline, production-shaped
  derived commit boundary from a fully revalidated AQ identity into a separate
  content-addressed store. It has no arbitrary input path mode and does not
  mutate AQ commits.
- Deterministic metadata binds the parent AQ identity/source SHA/size/state,
  transform kind, pinned implementation identity/version/hash, canonical
  non-secret parameters and plain-SQLite output SHA/size/state. Timestamps and
  results live only in separate sanitized operational receipts.
- The runner still accepts an injected secret provider and transformer. DQ6
  supplies no executable transformer: its runtime-selection factory has an
  empty reviewed allowlist and always fails before filesystem or process access.
  Tests retain a compiled synthetic fixture and pending Python bridge. Injected
  transformers receive a
  sequential 112 MiB sink plus `AbortSignal`, with a bounded 120-second maximum;
  raw output handles are not exposed. Sentinel tests cover metadata, markers,
  receipts, output, filenames, results and errors.
- The productive DQ6 module imports no process launcher and receives neither AQ
  source nor secret. Caller executable hashes, commands, arguments and bridge
  paths have no authority. Portable Node cannot execute a validated descriptor;
  reopening a private snapshot pathname still admits A-B-A substitution, so the
  former process guarantee was withdrawn instead of weakened.
- Only the spec launches the current test runtime with operation-local JavaScript
  emitted from tracked TypeScript source text excluded from compiled/published
  `lib/`. Its grace/force waits are bounded;
  missing `close` quarantines test staging, and pre-assignment failures clean it.
  Python immutable/driver key copies are not claimed zeroized and remain TBC.
  The real SQLCipher bundle allowlist is empty; the historical argv-key helper
  is a retired fail-closed stub, and no `sqlcipher3`, real key or real DB was
  used.
- Output is capped at 112 MiB, hashed, checked as structurally plain SQLite and
  copied independently into a create-only marker-last commit. Same-output reuse
  requires full material validation; corrupt destinations fail closed and prior
  valid commits remain intact.
- The strict derived validator requires both the derived and AQ trust roots and
  materially revalidates parent identity/SHA/size/state. A derived root alone is
  insufficient. DQ5 C4 accepts exactly one derived identity with both roots,
  binds its own private snapshot to the DQ output and revalidates the exact DQ
  material and AQ parent after inspection. AQ-direct reports remain `1.2.0`;
  DQ-derived reports use `1.3.0` and distinguish the inspected derived output
  from parent AQ lineage.
- Only the fail-closed DQ6 selection boundary, test harness and local read-only C4
  compatibility inspection of a fully validated DQ commit are GO. Real
  process-bound adapter execution, SQLCipher execution, real keys or secrets, decryption,
  export, refresh, production, publication, R2 and Android remain NO-GO.

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

### K10–K51 — field-scoped shadow, state/form consumption and leader native semantics

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
- K29-K31 adds an explicit opt-in, offline structural-field authority audit for
  exactly `characterClass`, `categories` and `links`. It validates the pinned
  K11/K2/current productive lineage before parsing payloads. K11/K2 evidence
  binds `cardId`/`stateId`/`stateKey`; productive `Character[]` exposes only
  `cardId`, so productive comparisons are explicitly card-ID-only and
  productive state binding is unavailable. Ordered IDs, raw values and
  productive property-presence bits are preserved, and no apply, writer,
  consumer or publisher exists.
- The real audit contains 17,277 facts over 5,759 database cards and 1,623
  card-ID comparisons per field. It found zero confirmed conflicts. Categories
  have 1,406 same-set/different-order mismatches; links have 1,516; class has
  373 preserved `unawakened` representation mismatches. The four productive
  card IDs outside the pinned database snapshot are reported without inferred
  joins. Every supported audit candidate is authority-ineligible and
  Character-unpatchable until productive state lineage is proved.
- The canonical K29-K31 report is 87,339,470 bytes with SHA-256
  `ffeec955522b415e787b560d1a156c3ea80352aad1535efc9279da930ac39a9e`.
  Two independent runs each generated twice byte-identically; serialization
  was RSS-sampled while live, with peaks of 774,496,256 and 775,049,216 bytes.
  Controlled-root validation has a documented local namespace TOCTOU residual.
  Audit execution is GO; authority promotion, production mutation, consumer,
  publisher, R2 and Android remain NO-GO for all three fields.
- K32 adds a separate compact structural identity sidecar over the exact pinned
  K2 taxonomy. It preserves class raw/value/status, ordered category assignment
  identities and ordered link slots/columns for all 5,759 database cards.
  Current productive Characters contributes card-ID coverage only; labels are
  optional presentation evidence and never identity. The sidecar has no
  consumer, apply, publisher, R2 or Android path.
- K32 requires explicit opt-in and caller-supplied K2, productive and output
  roots. It writes only a fixed manifest-last four-file inventory below the
  validated output root. Authoritative validation requires all three roots,
  reloads the pinned source bytes and rebuilds and compares the exact payload,
  coverage, validation and manifest bytes. The integrity-only helper cannot
  produce GO: embedded metadata marks it `NON_AUTHORITATIVE`, and only the
  source-bound validator result reports GO after exact reconstruction. Offline
  generation/source-bound validation are GO; publication,
  R2, Android, authority, gameplay semantics and Character apply remain NO-GO.
- Two real K32 invocations produced identical four-file outputs. The payload is
  706,128 gzip bytes / 24,686,675 canonical bytes with SHA-256
  `241b135ac88aad2a242a6abb81ab22b099ff25257cb0c8f0f5f7e82f888cb718`;
  peak RSS was 521,138,176 and 520,015,872 bytes. Productive card-ID coverage is
  1,623 covered and 4,136 uncovered database cards, plus the four known current
  IDs outside K2. The 30 empty category and 139 empty link containers remain
  unknown absence claims rather than supported empty assignments.
- K32's output namespace threat model is caller-controlled and stable throughout
  the operation. Portable Node provides no `openat`-style binding for all
  create/link/unlink steps, so K32 does not claim confinement against concurrent
  same-user namespace replacement or same-user hardlink attacks. Create-only
  final targets and manifest-last promotion remain enforced inside that model.
- K33 adds a separate, explicitly opt-in offline shadow consumer over the exact
  source-bound K32 artifact and productive Characters pin. It joins only by
  `cardId`, marks every comparable top-level or transformation record with its
  exact JSON path and unavailable release-state binding, preserves order and
  duplicates, and emits only bounded aggregate evidence to stdout. It has no
  apply, `Character[]` return, artifact writer, publisher, R2 or Android path.
- Repeated real K33 executions produced byte-identical 15,695-byte reports with
  SHA-256 `b685b9ac9d1608bcb7ab5d1d7d7aeacef1d8c638296ad7edb2012d44a27ce7ab`;
  after releasing productive snapshots before the second source-bound K32
  validation, externally sampled peak RSS was 724,344,832 bytes. The 1,623
  comparable card IDs yielded 1,250 class agreements and 373 preserved
  representation mismatches; categories yielded 12 ordered agreements, 1,406
  same-multiset/different-order results and 205 unknowns; links yielded 46,
  1,516 and 61 respectively, with zero different representations. Zero
  confirmed conflicts does not establish completeness. Offline shadow
  consumption is GO; state lineage, authority, apply, production, publisher,
  R2, Android and FYI/DokkanInfo removal remain NO-GO.
- K34 adds one explicit-opt-in, offline, stdout-only gate over the exact pinned
  SQLite, DB1, K2, ELF and native-layout evidence. Exact schema proof records
  that optimal-awakening growth rows contain no class/category/link replacement
  columns, but stability is accepted only when the native constructor and
  consumer paths also close the same dimension through hash-pinned code bytes,
  decoded branches, symbols, PLT relocations and the Card element vtable slot.
  Names and labels never participate in identity.
- The real K34 audit joined all 5,759 DB1/K2 cards, 54,072 category assignments,
  34,018 links and 4,895 optimal-awakening states over 4,874 distinct growth
  rows. Its byte-identical 7,140-byte report has SHA-256
  `a34afd7895d40dbdfd085c7c1b5af1304247b4e7476e89bec6c81e17758f638a`;
  maximum measured peak RSS was 566,599,680 bytes. Class, category and link
  scope are supported only for the exact pinned profile. Report
  execution is GO; productive state binding, authority, apply/Character
  mutation, publisher, R2, Android and
  FYI/DokkanInfo removal remain NO-GO.
- K35 adds an explicitly opt-in, offline-only compact taxonomy projection over
  the source-bound K32 artifact and the exact K34 card-scope gate. It retains
  every K32 `cardId`, includes each class/category/link dimension only when its
  structural evidence is supported, removes labels and presentation text, and
  never reads or writes `Character[]`. Empty/unknown dimensions are omitted,
  not converted into supported empty arrays.
- The real K35 payload contains 5,759 cards, all 5,759 class facts, 54,072
  category assignments across 5,729 cards and 34,018 links across 5,620 cards.
  It omits 30 unknown category dimensions and 139 unknown link dimensions,
  with zero partial or structural-unjoinable cases. Its 247,261-byte gzip has
  SHA-256
  `7e5c9fa501c8401489e8e6c0a057b1ecf01037d7969091ed88c0df73547f19e8`;
  the 4,228,101-byte canonical raw payload has SHA-256
  `c740d4874118c65f94588594f6b745146c506dd78a73fd605bbf40abf28d168a`.
  Two separate complete runs were byte-identical and peaked at 652,185,600 and
  651,706,368 bytes, below the exclusive 1 GiB limit.
- K35 validates K32 through its existing source-bound API and executes K34
  in-process both before generation and during final source-bound artifact
  reconstruction. Offline generation and validation are GO. Every consumer,
  authority/apply path, production use, publisher, R2, Android, FYI removal and
  DokkanInfo removal remains NO-GO.
- K36 adds an explicitly opt-in, offline and local-only delivery boundary for
  the exact four K35 files. It validates K35 only through the existing
  source-bound API with all roots explicit, creates one fixed-namespace
  content-addressed release, records complete hashes/sizes/lineage in a
  deterministic stopped receipt and writes a separate commit marker last.
- The K36 reader requires the content-addressed ID plus every source root,
  rejects traversal, links, `nlink != 1`, realpath escape, unexpected members
  and byte or lineage drift, then revalidates K35 source-bound from the release
  and reopens all six members. The release is create-only under a caller-owned
  stable output root and stays strictly below 512 KiB and 1 GiB RSS limits.
  Two real runs produced the same release ID
  `4a6dcfa4b8818abbd070bad2a1318eec5df9a2b1b306286adfec5fadee8ddfe4`
  and six byte-identical files totaling 262,186 bytes. Receipt SHA-256 is
  `67c99c56f23890c91cb552c40e303fc7269cacdccc65769b3125ddfc3b6d8f13`;
  marker SHA-256 is
  `d185d8603698664be99f5c7443bb61ba28a1bfb91ff6c1885aa513f6b2e98d2f`.
  Peak RSS was 661,557,248 and 662,052,864 bytes. Network, fetch, Wrangler/S3,
  publisher, R2, Android, consumer, `Character[]`, apply/overlay, authority and
  production remain NO-GO.
- K37 adds an explicitly opt-in, offline and local-only object plan over the
  source-bound K36 reader. It derives exactly four immutable, content-addressed
  K35 object keys under the new `database-characters/taxonomy-projection/v1`
  namespace and a separate `no-store` mutable-manifest candidate with complete
  K36/K35 hashes, sizes and lineage. K36 is revalidated before and after plan
  construction; the local plan, candidate and stopped receipt are committed
  create-only with a closed marker-last inventory.
- K37 reserves a conservative 65,536 bytes for the mutable manifest and limits
  worst-case namespace growth to 50,000,000 bytes. The 10,000,000,000-byte
  bucket ceiling is recorded, while current usage, projected usage and bucket
  compliance remain `UNKNOWN` until a separate remote preflight. Two real runs
  produced plan ID
  `7411a1c5b3220e5acf248fb5e670c03c437c699cb2b765fab0aa50fd9001d204`,
  four byte-identical local files and a 319,271-byte worst-case remote plan.
  Plan SHA-256 is
  `19c2293c3d0ece19f9210eb1489bff16abdfe035450533bfabeec29193664a0c`;
  manifest-candidate SHA-256 is
  `9f803eb8eba00f2b7f49681b379fb3fe71eb08d551dc69cab03204542ec6e1e8`.
  Peak RSS was 666,722,304 and 671,862,784 bytes. No remote operation was used.
  Remote inventory/preflight, network, publication, R2, Android, consumers,
  `Character[]`, apply/overlay, authority and production remain NO-GO.
- K38 adds default-off remote read-only preflight infrastructure over only the
  source-bound K37 reader. The productive API has no injected reader, bucket
  result or report-authority path; it revalidates K37 before transport and
  after all reads. It can issue GET only to the fixed public endpoint for the
  exact four immutable keys plus the mutable manifest and can run only the
  fixed bounded Wrangler `r2 bucket info dokkanpanion-data --json` command.
- K38 treats immutable conflicts/failures, manifest failure, unknown bucket
  usage, a namespace plan at or above 50 MB, and a conservative projected
  bucket size at or above 10 GB as NO-GO. Its bounded create-only operational
  report is explicitly non-authoritative; a future publisher must rerun K38
  and still requires separate publication authorization. Eleven synthetic
  transport, protocol, drift, budget and filesystem tests passed without real
  network or Wrangler execution; Windows denied the file-symlink fixture while
  the junction and hard-link cases passed. Real remote preflight, publication, R2 mutation,
  Android, consumers, authority and production remain unexecuted and NO-GO.
- The first authorized real K38 attempt completed all five fixed GETs but
  stopped fail-closed because the local Wrangler entrypoint was unavailable.
  After dependencies were restored from the local npm cache without lockfile
  changes, the authorized retry completed the same five GETs and the fixed
  read-only bucket-info command. All four immutable taxonomy objects and the
  mutable manifest were missing with zero conflicts or failures. Wrangler
  reported 364 MB; K38 conservatively bounded current usage at 365,000,000
  bytes and projected 365,260,894 bytes. The source-bound K37 plan was GO
  before and after the reads. The 5,205-byte operational report has SHA-256
  `03c22dfc42006eeb6f0dc6d88af859fb898d7abded4046a97df4e4a714f63046`.
- K39 adds a closed, explicitly opt-in publisher dry-run boundary. It
  productively reruns K38 with every explicit root and ID, rejects any K38
  NO-GO, and source-bound revalidates K37 around plan construction. Its
  productive API exposes no transport injection, saved-report authority,
  credentials, AWS/S3 writer, upload, delete or manifest-promotion path.
- K39 maps each K38-missing immutable object to a prospective
  `If-None-Match: *` create, preserves exact hashes, sizes, order, content types
  and immutable cache policy, requires direct post-create byte/metadata
  verification, and places the `no-store` mutable manifest last. A future
  replacement requires a fresh direct ETag and `If-Match`; no overwrite or
  delete is planned. These are non-authoritative future semantics only.
- The real K39 dry-run at `2026-08-14T20:28:40.470Z` planned four missing
  immutable creates plus one missing mutable-manifest create, with zero
  overwrite/delete and the same 365,260,894-byte conservative bucket
  projection. Its 8,591-byte content-addressed report has SHA-256
  `1193690e3b9aa7ecccd48e2e6d869e84fd40971515835a8cc880a1b003fd7ef8`;
  the nested current K38 report has SHA-256
  `6923d7027da97ecbd39476c1396870da36e2ca3c1d1d3bc8842474bdab010274`.
  The nine focused K39 tests passed and the file-symlink fixture was pending on
  Windows. The final domain suite passed 165 tests with eight Windows symlink
  fixtures pending, and final contract review found no remaining P0-P2.
  K39 dry-run is GO; publisher writes, publication, R2 mutation, Android,
  consumers, authority and production remain NO-GO.
- K40 adds a conditional publisher behind exact dry-run/publish CLI modes and a
  deterministic publication ID. The ID binds the fixed bucket, exact K37/K36
  lineage, four ordered immutable objects and bytes, content types, cache
  metadata, mutable candidate, conditional policies, verification order,
  budgets and no-delete/no-authority rules. It excludes operational timestamps
  and current remote observations so idempotent reruns retain one ID.
- K40 productively reruns K39/K38, revalidates K37/K36, binds and rereads the
  exact four regular single-link K36 members, and persists a bounded create-only
  dry-run report. Dry-run returns before reading credential environment or
  constructing S3. The internal, unexecuted publish path uses direct bounded
  S3 reads, exact byte/content-type/cache-control checks, `If-None-Match: *`
  immutable creates in K37 order, post-create verification, complete immutable
  reread, complete local source revalidation and a final fresh manifest reread.
  The manifest is always last and uses create-only or fresh-ETag `If-Match`
  compare-and-swap. Conditional races are accepted only after exact direct
  reread; no delete, copy, multipart or rollback path exists.
- The authorized real K40 dry-run at `2026-08-14T20:52:37.491Z` again found all
  four immutable objects and the mutable manifest missing, with the same
  365,260,894-byte conservative projection. Its deterministic publication ID
  is `ae0b1626a7ec8de4f42c1d48524bb19966274504644021fc66c681ecebe36804`.
  The 13,599-byte report has SHA-256
  `987ab02c256a577fe1d2194d445295ad852b23be8283a673f4295ecc79838bc4`;
  the current nested K39 and K38 report hashes are respectively
  `de48aac21751fa7bf8a8be992e7ce490a869a2a4cdb4189b1a1ff115905da29a`
  and `56e9f18d317110baa32b396737c053b4cdf689b29c0dfb369215474dc8678f3e`.
  The 13 focused tests and the final 178-test domain suite passed, with eight
  Windows symlink fixtures pending; final read-only contract review found no
  P0-P2. K40 dry-run is GO.
- The separately authorized K40 publication at `2026-08-14T21:01:58.257Z`
  rebuilt publication ID
  `ae0b1626a7ec8de4f42c1d48524bb19966274504644021fc66c681ecebe36804`,
  conditionally created and directly verified all four immutable objects
  (253,735 bytes), then conditionally created and directly verified the mutable
  manifest last. The result was `COMPLETED_CONDITIONALLY`, with zero deletes
  and no rollback attempt. The pre-write K40/K39/K38 report hashes were
  `10b50453916048e3d238d4f593ae289bb406f0da78417ee1f4b11c82e65dcdbc`,
  `125813a33a676306047b73d46f1ea9538c7cde10baeb4c7ad11669b2c325501d`
  and `b4d4bf99279ec001af6e143b892013c85dec33f621d417c2e1708b79351fe02a`.
- The first public post-publish preflight encountered a transient cached 404
  for the newly created gzip payload while the other three immutables and
  manifest already matched. A read-only direct retry returned the expected
  247,261-byte gzip with `CF-Cache-Status: EXPIRED`; no repair write occurred.
  The final full read-only K40 rerun at `2026-08-14T21:07:41.393Z` found all
  four immutable objects and the mutable manifest matching, with zero missing
  immutable bytes and a conservative projected bucket upper bound of
  365,007,159 bytes. Its K40/K39/K38 report hashes were
  `b1d720580242a459f5f7d444a222d1486faf25237f3c50020681fa2552ec13ba`,
  `41e4e3ee69a83e5d87484cf09813e7df00e94b9918d7bf75bb5d10cc286456f8`
  and `ddd68ba68a9034ae1c44edcbcf18a9a9a50eb1331717e0ec5af202769b06eec3`.
  K40 publication and public verification are GO. Android, consumers,
  authority and production remain NO-GO; any further R2 mutation remains a
  separate action requiring authorization.
- K41 adds an explicitly opt-in, unauthenticated and strictly read-only public
  shadow consumer over that exact release. It GETs only the fixed no-store
  manifest and its four ordered content-addressed objects, blocks redirects,
  bounds every response below 1 MiB and aggregate bytes below 5 MiB, validates
  hashes/sizes/cache metadata, bounded-decompresses the payload and reproduces
  all four exact K35 artifact byte sequences through the supported-only
  validator. It exposes only a cloned, memory-only `cardId` lookup and preserves
  omitted unknown dimensions; there is no `Character[]`, persistence, apply,
  overlay, credential, publisher, Android or remote mutation path.
- The final real K41 read-only run at `2026-08-14T21:23:32.815Z` completed five GETs
  and read 260,894 bytes. It verified 5,759 records, 5,759 supported classes,
  54,072 category assignments on 5,729 cards with 30 unknowns omitted, and
  34,018 links on 5,620 cards with 139 unknowns omitted. Four portable focused
  tests cover the fail-closed integrity and lookup boundary; a fifth
  integration test passed against the exact K36/K37 bytes in memory. Public
  delivery and remote shadow lookup are GO; persisted consumption,
  `Character[]`, apply/overlay,
  Android, authority, production and FYI/DokkanInfo removal remain NO-GO.
  The final domain suite passed 183 tests with eight Windows symlink fixtures
  pending. A conditional-fixture coverage P2 was corrected with the portable
  4+1 test split, and contract re-review found no remaining P0-P2.
- K42 adds an explicit-opt-in, offline, stdout-only supported state/form product
  scope audit over exact K0/K1/K2/K7, productive and FYI pins. It reloads all
  sources after evaluation, requires unchanged identities and a complete
  structural fingerprint, and cross-checks every K1 state against the matching
  K0 state/evidence. It reads no presentation text for scope, writes no
  artifact, returns no `Character[]` and has no apply, authority, production,
  network, publisher, R2 or Android path.
- The first real K42 attempt rejected the drifted current FYI `latest`. The
  successful exact-pin runs used the preserved 1,211,389-byte FYI payload with
  SHA-256 `56681e7327c56bce7becbda72ee507b77d964f449fd1862012d4e751b801b499`.
  K42 included 10,651 supported known-release states, 4,892 supported release
  transitions, 6,905 supported awakenings and 374 supported passive-bound form
  transitions. It excluded three unknown states/transitions, two partial
  awakenings and 184 partial form bindings. K7's 4,296 agreements and 1,463
  unjoinables remain coverage only. Two complete executions produced identical
  5,660-byte reports with SHA-256
  `e56a39cdc4b420a8eb58f6a075021e75b7b45eb5d3b4c9e9b658d6f3bc6d929e`.
  Scope audit and the next supported-only projection gate are GO; product
  projection is not executed and every consumer/authority/production boundary
  remains NO-GO. The final domain suite passed 188 tests with eight Windows
  symlink fixtures pending. A documentation P2 about the legacy loader's
  presentation-field parsing was corrected; contract re-review found no
  remaining P0-P2.
- K43 adds an explicit-opt-in, offline, local supported-only state product
  projection over the exact K42 GO inputs. It emits only structural IDs and
  known supported state, release, awakening and form records; K7 remains
  lineage/coverage only. `partial`, `unknown`, presentation data and
  `Character[]` are excluded. No consumer, apply/overlay, authority,
  production, publisher, network, R2 or Android path exists.
- The create-only writer requires a separate existing non-link output root,
  rejects containment or aliasing with every source root, writes a
  content-addressed gzip payload plus fixed coverage and validation members,
  and commits the fixed manifest last. The source-bound validator reconstructs
  all bytes from the pinned sources and rereads the complete artifact set.
- Two independent real K43 runs produced four byte-identical members. The
  5,397,155-byte canonical JSON has uncompressed SHA-256
  `cb059f931ecc0f40e53e3b25ba2fcd10ac347c71c065c63dbca2224ab1f813c8`;
  the 332,720-byte gzip has SHA-256
  `a136f631ed0fa1880f6a82af72ab2c429b547165945c09a13514c67f07925179`.
  Metadata totals 4,646 bytes and the fixed 1,931-byte manifest has SHA-256
  `8416d7005d2a087897c121da9fd632d2b9be47c0fc6414049429903295ba87a8`.
  Peak RSS was 1,000,423,424 and 1,005,903,872 bytes, both below 1 GiB.
  Offline generation and source-bound validation are GO; all downstream
  consumption, authority, production, delivery and Android gates remain
  NO-GO.
- K44 adds an explicit-opt-in, stdout-only local shadow consumer over the exact
  source-bound K43 artifact. It validates K43 before building private indexes,
  returns only deep-frozen clones, then repeats source-bound validation and
  requires the artifact fingerprint to remain exact before returning the
  consumer. Direct factories remain `NOT_EXECUTED`; only the private runner
  finalization can report GO. There is no persisted consumer, `Character[]`,
  apply/overlay, authority, writer, network, publisher, R2 or Android path.
- The real shadow indexes 10,651 states across 5,759 card IDs and 12,171
  release/awakening/form transitions across 4,497 participating card IDs.
  Real state and transition lookups returned frozen structural clones. Two
  independent canonical reports were byte-identical at 3,774 bytes with
  SHA-256
  `bd8a8e1479ebf174331a17c87687a8a0221d5304f80969c26a3e488ed8fb69a8`.
  Measured peak RSS was 1,052,553,216 and 1,051,172,864 bytes; the post-review
  verification measured 1,047,080,960 bytes, all below the exclusive 1 GiB
  ceiling. Local shadow consumption is GO; persistence and every authority,
  production, delivery and Android boundary remain NO-GO.
- K45 adds an explicit-opt-in, offline/stdout-only leader structural scope
  audit over exact source-bound K43 plus the pinned K3 skill sidecar. All
  10,651 supported K43 states join exactly to K3 by state ID, source state key,
  card ID and release state; the only excluded K3 states are the same three
  `unknown` growth states. Every included state has a leader set.
- The K45 scope contains 3,506 unique leader-set rows, 49,435 effect references,
  34,914 target references and 9,405 opaque structured-percent values. These
  values are inventoried, not interpreted. OR-versus-sum semantics, localized
  text, product replacement, consumers and authority remain NO-GO. The 59 C3
  unknown rules belong to the passive C2/C3 comparison and do not filter leader
  scope or change K9 readiness.
- K45's public report factory remains `NOT_EXECUTED`; only the private runner
  can return GO after K43 source-bound validation before/after and two exact K3
  loads with stable compact fingerprints. K3 member reads use exact-size
  allocation, no-follow handles, single-link/identity checks and pinned hashes.
  Two post-hardening real runs produced identical 5,429-byte reports with
  SHA-256
  `23679af6c9b208ed66aebc032548545c5d4b922dd8c5e27973bcd1a33c218b34`.
  Measured peak RSS was 1,010,200,576 bytes, below 1 GiB. Structural scope and
  the next ID-only projection are GO; all semantic, presentation, production,
  delivery and Android boundaries remain NO-GO.
- K46 materializes that supported leader scope as a source-bound local
  content-addressed projection containing only state identities and structural
  row references. It preserves K3 source order and multiplicity: all 49,435
  effect references are distinct per state, while the 34,914 target references
  contain 12,720 repeated occurrences created by the source effect-to-target-set
  expansion. K46 does not deduplicate them or claim effect-target association.
- Two real K46 roots produced byte-identical members. The canonical payload is
  5,817,631 bytes (SHA-256
  `98c752e2b15676d1221dfec10e313c01b842c2f197d0e7f99e49885346208500`),
  and the 204,314-byte gzip has SHA-256
  `7ff068201c07560ead8c392e3e859fbcb889530844d04609701562788bbcf9fd`.
  The manifest SHA-256 is
  `079486e41b880206263d9c7f8e1cde7b1fc419f84e31b0b42deef5fde0d41e9b`;
  metadata totals 3,928 bytes. Peak RSS values were 889,372,672 and
  896,233,472 bytes. Offline generation and source-bound validation are GO;
  consumers, effect-target association, clause semantics, presentation,
  production, delivery, R2 and Android remain NO-GO.
- K47 reconstructs the structural `leader_skill` to target-set to target-row
  joins from the exact pinned K3 raw IDs and proves them against source-bound
  K46. All 49,435 effect associations reproduce the 34,914 flattened targets
  byte-for-byte and in source order. The 12,720 repeated occurrences are
  explained completely by repeated target-set expansion; missing effect rows,
  missing target rows and mismatched states are all zero.
- Two K47 runs produced the same canonical 5,304-byte stdout report with
  SHA-256
  `7841d8ad3e82756847a0c2186ed78f6f74d4d75c4b73c8c2765865326352e59b`.
  The K3 association-input fingerprint is
  `a92f8558fa47bddc244ad229db2ff0bcd56def25a0d00ef6020dfe8e0ff3e62b`,
  and measured peak RSS was 916,099,072 bytes. Structural association scope
  and the next ID-only association projection are GO; semantics, presentation,
  product projection/consumer, production, delivery, R2 and Android remain
  NO-GO.
- K48 materializes the K47-proven structural association per supported state:
  each source-ordered `leader_skills` ref carries its structural target-set ID
  and source-ordered `sub_target_types` refs. The redundant flat target array,
  percentages, text, raw rows, values and `Character[]` are absent. Validation
  preserves 49,435 effects, 34,914 targets and 12,720 explained repetitions,
  with zero missing rows, flatten mismatch, presentation fields or invalid
  null-target-set associations.
- Two source-bound K48 roots produced byte-identical members. Canonical JSON is
  7,774,315 bytes (SHA-256
  `628a5910530c2b43482b80762dc60ef780f60048b2733caca26c5accf4680525`),
  and the 224,154-byte gzip has SHA-256
  `c0409ba742f2ea875d29bc66d7ebec411c37487ff56192dce371b3d2baa36361`.
  The manifest SHA-256 is
  `64a6a7b4de421b29265115717c1f1d5a26d726b1f19f275af57499fc60a3c5d4`;
  metadata totals 5,186 bytes. Peak RSS values were 983,306,240 and
  981,798,912 bytes. Offline generation and source-bound validation are GO.
  Advancing from structural refs to a useful leader product now requires an
  explicit semantic decision about values/percentages and clause behavior;
  presentation, consumer, authority, production, delivery, R2 and Android all
  remain NO-GO.
- K49 adds an explicit-opt-in, offline/stdout-only semantic scope audit over
  exact source-bound K48 plus the pinned K3 skill sidecar. It compacts the eight
  typed `leader_skills` fields, loads K3 twice, validates K48 before/after and
  requires stable identities and fingerprints. Description text is reduced to
  an audit-only boolean and is never emitted or used as identity/join input.
- Of 16,119 unique effect rows and 49,435 included references, K49 labels only
  3,848 rows and 12,296 references as `partial`: exact type-82 shapes whose
  vector position 1 matches an exact HP/ATK/DEF percentage phrase. Five type-82
  outliers remain unknown, as do the other 12,266 rows; total unknown coverage
  is 12,271 rows and 37,139 references. Missing rows and structural mismatches
  are zero.
- The first real attempt failed closed on multi-clause descriptions. After the
  classifier was corrected to inspect every exact phrase-bound occurrence, two
  complete runs produced identical 7,708-byte reports with SHA-256
  `bf80061b70ac9630cee74b7bffebb34a440e4fabda98fa3e4e69c76a3af31844`.
  Contract review found no remaining P0-P2. Leader-value scope audit is GO;
  opaque projection, HP/ATK/DEF and selector semantics, clause composition,
  consumer, authority, production, delivery, R2 and Android remain NO-GO.
- K50 binds K49 and source-bound K48/K3 to the exact 95,662,296-byte AArch64
  `libcocos2dcpp.so` (SHA-256
  `7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a`).
  The offline audit pins eight native code regions, the 15-entry
  `TeamingPower` efficacy dispatch initializer, seven `LeaderSkill` SQLite
  column bindings and the battle ability factory's runtime-field transfer.
- Native type 82 is now structurally supported as an element-or-awakening
  bitmask in vector position 0 plus a common HP/ATK/DEF modifier in position 1;
  position 2 is not read by that handler. The four `calc_option=0` rows are
  flat-point bonuses and the 3,849 `calc_option=2` rows are proportional
  modifiers divided by 100. All 3,853 rows and 12,310 K48 references validate,
  with 38 mask values, 36 modifier values and zero invalid vectors.
- Two complete source-bound runs produced identical 8,001-byte reports with
  SHA-256
  `27b484577e2727805b6b9aeae7861f4f00cf2ee18f357f173ffe613e39595802`
  and empty stderr. Native/type-82 field semantics are GO as evidence only.
  Target-type names, sub-target domain meanings, the behavior of the 17
  non-null causalities, battle lifecycle, battle stacking/composition, product
  projection, authority, production, delivery, R2 and Android remain NO-GO.
- K51 bridges the K50 LeaderSkill runtime path to the already pinned generic
  ability target dispatch and sub-target filter factories. The bridge is
  code-bound end to end: `createLeaderSkill` calls the passive-status factory,
  the manager vtable binds its add-status call, the passive-status vtable binds
  target/sub-target getters plus `exec`, and exact PLT/GOT bindings prove
  `exec -> process -> AbilityEfficacyCore::callEfficacyFunc`. For efficacy type
  82, raw target `2` is team allies, `12` is super-class allies and `13` is
  extreme-class allies. Sub-target value type `1` includes a structural card
  category ID and type `2` excludes it; filters form a sequential `AND` chain,
  an empty set is identity and duplicate filters are reapplied.
- The exact type-82 corpus contains 625 nonzero target sets and 1,588 joined
  rows: 883 category inclusions, 705 exclusions and zero partial/unsupported
  value types. Of 12,310 K48 effect references, 9,040 carry a set, 3,270 use
  the empty identity and their expansions contain 15,988 target occurrences.
  The target raw-enum corpus is 3,788 / 37 / 28 rows for values 2 / 12 / 13.
- Two complete source-bound runs produced identical 7,875-byte reports with
  SHA-256
  `f14fb07fa68ca36dcae121c741281d58e335658a9daf1c3392b2681c742da063`
  and empty stderr. Type-82 target/category-filter semantics are GO as native
  evidence only. Causality, battle lifecycle, battle stacking/composition,
  product projection, authority, production, delivery, R2 and Android remain
  NO-GO.
- K52 closes the observed type-82 causality shape as structural evidence only.
  K3 contains 17 non-null compiled conditions (12 scalar and five binary `&`
  conjunctions) across 45 K48 references, but omits all six referenced
  `skill_causalities` rows. K52 discloses that gap and separately binds the
  exact 95,428,608-byte first-party SQLite by a protected descriptor, SHA-256
  `3654eb7db9e18dfe4c238abd02bcc06a688ffa6f30aa1ad93fd108dcfeb78265`.
  The six tuples are all type 35 with zero `cau_val2/3`; missing K48 effects,
  missing database rows, unsupported expressions and type mismatches are zero.
- Native evidence pins seven code regions, seven exact call/PLT/GOT bindings,
  the full causality dispatch table and its type-35 handler slot. The supported
  statement is limited to every requested bit being witnessed by an eligible
  card in the runtime-inspected collection; scalar IDs are single predicates
  and `["&", left, right]` requires both. No human names are attached to the
  four observed masks. Complete party context, lifecycle, timing, recurrence,
  reset, duration and stacking remain unknown/NO-GO.
- Two complete canonical K52 runs produced byte-identical 8,029-byte reports
  with SHA-256
  `03886cc00ded6b85b7c5de82a867087812235c848c7616572f599473c908f157`
  and empty stderr. An enforcement run measured peak RSS at 1,010,421,760
  bytes, below the exclusive 1 GiB limit. Structural causality and the observed
  type-35 condition are GO as evidence only; product projection, consumer,
  authority, production, delivery, R2 and Android remain NO-GO.
- K53 binds the type-35 handler's candidate collection selector without
  generalizing it to a generic team. `deckIndex=0` scans exactly seven indexed
  player character records in `InGameData`; `deckIndex=1` scans the runtime
  puzzle-enemy vector and an empty vector makes the condition false. Other deck
  indices are unsupported. Each candidate resolves to a master `Card` and uses
  its structural element and awakening-element getters against the selected
  bit. The audited handler/helper has no explicit alive, active, category or
  target filter, but this local negative result does not establish lifecycle.
- The K53 evidence pins six code regions, six instruction fragments, six exact
  PLT/GOT calls, two complete vtables and three ABS64 bindings. It wraps a real
  K52 execution with native proof before/after, while the effective branch used
  by observed leaders remains NO-GO. Two real runs produced byte-identical
  11,807-byte reports with SHA-256
  `7458e885f9a8621528042a57ea3719e7c2a7849255842a283e094b4f512399c3`
  and empty stderr under the exclusive 1 GiB ceiling. Candidate-collection and
  deck-index 0/1 structural semantics are GO; human names, lifecycle,
  death/removal, stacking, product, authority, production, delivery, R2 and
  Android remain NO-GO.
- K54 proves why the effective K53 branch cannot be selected from the database.
  `AbilityManager::createLeaderSkill` receives `deckIndex` as its first runtime
  argument, writes it to create-status `+0x0c`, and the base constructor copies
  it to `AbilityStatus+0x10`; `getDeckIndex` reads that field. `target_type`
  independently travels from `LeaderSkill+0x40` through create-status `+0x2c`
  to `AbilityStatus+0xe0`. Thus it does not select `deckIndex` in the audited
  creation chain, and no source-row/static-caller binding supplies the runtime
  argument for the 17 observed rows.
- K54 pins 11 code regions, 11 instruction fragments, one direct call, six
  PLT/GOT calls, three vtables and four ABS64 bindings. Two complete real runs
  produced byte-identical 16,255-byte reports with SHA-256
  `33442f73e3795ded886cfa70371c6f654676aa4a511c59e965fab6f10ab620af`
  and empty stderr under the exclusive 1 GiB limit. Runtime-argument provenance
  and field independence in the audited chain are GO; effective/data-level
  branch selection, lifecycle, stacking, product, authority, production,
  delivery, R2 and Android remain NO-GO.
- K55 adds a source-bound native structural audit over a complete real K54
  execution. It binds one status construction/registration per iterated leader
  source row, the shared start-turn executor calls with their exact raw
  arguments, additive matching type-82 contributions, the `calc_option=0`
  integer conversion and the `calc_option=2` division by 100 at the handler.
  These post-condition facts do not depend on type-35, but they authorize only
  the 3,836 unconditional effects and 12,265 references. The 17 conditional
  effects and 45 references remain excluded as
  `runtime_deck_index_unresolved`.
- K55 deliberately leaves single versus repeated evaluation, duration,
  reset/removal results, enter/exit behavior, Leader + Friend composition,
  final stacking/order/rounding and transformation/death/revive/exchange/
  standby behavior unknown and NO-GO. The native evidence is 11,356 bytes
  (SHA-256
  `136d7792840ddb716a7d601b561bed56b7dda37297f4029480a605b6c1a95ec8`).
  Two complete reports were byte-identical at 21,674 bytes with SHA-256
  `c2131742d621c71ce12b9e1a379a4ad4ca7f1e38482445e692fb2bd1444459ab`,
  empty stderr and an externally sampled peak working set of 1,012,617,216
  bytes. Offline structural audit is GO; product projection, authority,
  production, delivery, R2 and Android remain NO-GO.
- K56 materializes the first-party-supported portion as a local, default-off
  projection. It preserves source order and occurrence identity for 3,836
  unconditional type-82 effects and 12,265 references. The exact 17
  conditional rows (`5266`, `5271`, `5276`, `5281`, `5986`, `5991`, `5996`,
  `6001`, `8071`, `10036`, `11861`, `11863`, `10326202`-`10326602`) and 45
  references remain excluded as `runtime_deck_index_unresolved`.
- The user-confirmed all-five-types/Friend/awakening domain rule is stored only
  as corroborative coverage with provenance `user_confirmed_domain_rule`. It
  separates current element type, battle class, selected awakening state,
  team-including-Friend condition scope and eligible effect targets. It is not
  first-party `deckIndex` evidence, does not authorize the 17 rows and is absent
  from the payload. No runtime instrumentation was performed.
- Two complete K56 roots produced byte-identical members. Canonical JSON is
  12,847,768 bytes (SHA-256
  `345f7ab587fe893c58971799e220548896f2bf803b667b18a70595f32ac78154`),
  and the 185,908-byte gzip has SHA-256
  `5579ed50704453cae29e97d770c05b02492c4f5130d2e4075da1e961817f2473`.
  Coverage, validation and manifest hashes are respectively
  `e8e7a372d87ee3fc0b7393a15e83a191290cee61f88c303c25178504dffd6a8f`,
  `c24b898cbbd4da324ac4cf83068f2d9ec9603b3276993f48736a40fa99eddf4e`
  and `e5213cc11b141e585eff1cffdfd3043e790cff718569367e26c5dd581bdd1546`.
  Peak RSS was 1,067,995,136 and 1,067,003,904 bytes, only 5,746,688 and
  6,737,920 bytes below 1 GiB. Offline generation and source-bound validation
  are GO; conditional runtime selection, combined value, authority,
  production, delivery, R2, Android and concurrent ancestor replacement
  protection remain NO-GO.
- K56 RSS hardening moves each real K55 audit into a serial, bounded Node child
  with explicit arguments, no shell, limited output, canonical-envelope
  validation, timeout, termination escalation and final fail-closed
  settlement. The public source-bound validator still runs K55 itself and
  cannot accept an injected report. Two hardened real runs preserved every
  artifact hash. Maximum individual-process RSS was 1,018,998,784 and
  1,023,991,808 bytes. RSS authority is explicitly per-process; combined
  process-tree RSS is unmeasured and remains NO-GO.
- K57 adds a local, stdout-only shadow consumer over the exact K56 artifact.
  It validates K56 source-bound before and after the lookup audit, pins all
  five member identities, and requires the complete artifact fingerprint
  `807a98ae37cd17a68a7f3f3544c1f14b4f4bfab9f75c9b627cca23cbab41e3b3`
  plus lineage fingerprint
  `132c1e858ed5fdb6bdc97f3c5e0313c865c7bf0ee7367e1ad1453b89e280fa5f`
  to remain stable. Private indexes cover 12,265 references across 7,248
  states, 3,434 cards and 3,836 effect rows; exact-reference, state, card and
  effect lookups return deep-frozen clones while preserving source order and
  multiplicity.
- Two real K57 runs produced the same report after normalizing only
  observational RSS measurements (normalized compact SHA-256
  `cc2188a45f78b61f5bc2bcc2cd748417720bf988ec9464661df36377b086db8c`).
  Raw reports were 4,291 bytes with empty stderr. Maximum individual-process
  RSS was 1,017,950,208 and 1,025,351,680 bytes; parent K57 peaks were
  993,509,376 and 995,381,248 bytes. Local shadow consumption is GO.
  Persistence, the 17 conditionals, Leader + Friend composition, final combat
  calculation, authority, production, delivery, R2 and Android remain NO-GO;
  process-tree RSS remains unmeasured and NO-GO.
- K58 adds a deterministic, offline-only publication plan for the exact K56
  bytes. It models four immutable physical objects in order (payload,
  coverage, validation and K56 source manifest) under
  `database-characters/leader-supported/v1`; the raw JSON remains lineage-only.
  The fixed mutable manifest candidate is last and future-only conditional
  semantics require create-if-absent or a fresh ETag CAS. K58 constructs no
  client, reads no credentials and performs no network or R2 operation.
- Two real K58 runs produced byte-identical candidate, plan, receipt and marker.
  The plan is 13,134 bytes (SHA-256
  `49d6d520753f8d4591740ccccc86664fec7e675ac2f8054be1b715c762bcd632`)
  and the candidate is 11,561 bytes (SHA-256
  `370dc7026c4523d509a403a2fbfa91009d1bb9452f7ab277f9c6aaebb8a1441e`).
  Projected remote bytes are 227,309 across four immutable objects plus the
  mutable manifest candidate. Maximum individual-process RSS was
  1,025,556,480 and 1,025,581,056 bytes. Local dry-run is GO; bucket use and
  headroom remain UNKNOWN, remote preflight is NOT_EXECUTED, and publication,
  R2 mutation, production and Android remain NO-GO.

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
