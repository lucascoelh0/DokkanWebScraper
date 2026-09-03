# Dokkanpanion Project State

**Last updated**: 2026-08-27

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
- `D:\Dokkan\Dokkanpanion` owns the Android consumer. Remote `master` contains
  the reviewed rematerialization checkpoint at
  `5afa5ee3de25755c9fffdfcd2f1fc3293d56b26a`. The user's dirty original
  checkout remains intentionally untouched at its earlier local commit; no
  Leader shadow consumer is integrated or authorized.
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
- K59 adds a fixed remote read-only preflight over the source-bound K58 plan.
  It performs exactly four immutable-object GETs plus one fixed mutable-manifest
  GET against `assets.dkbcompanion.com`, then the bounded fixed command
  `r2 bucket info dokkanpanion-data --json`. Production exposes no injectable
  source, transport, URL, bucket, command or report. It revalidates K58/K56
  after all reads and persists only one local observational report.
- The real K59 run observed all four immutable objects and the mutable manifest
  as missing, with no conflicts or failures. Five bounded 404 bodies totaled
  135,750 bytes. Bucket usage reported `364 MB`, conservatively bounded at
  365,000,000 bytes; including 227,309 prospective bytes gives a projected
  upper bound of 365,227,309 bytes, strictly below 10 GB. The 5,951-byte report
  has SHA-256
  `b9455a59fd0983bfeadacadf8b92bc65ecc2f1ab6f0e9f266e23dd0f1c22cf9b`.
  Remote read-only preflight is GO. Publication, R2 mutation, authority,
  production and Android remain NO-GO; a future publisher must rerun freshness
  and strong-ETag CAS immediately before any authorized mutation.
- K60 implements the conditional publisher behind mutually exclusive explicit
  `--dry-run` and `--publish` modes. Every invocation runs a fresh real K59
  first, then source-binds K58/K56 and joins candidate, plan, receipt, marker,
  full-artifact and lineage identities. The deterministic publication ID
  excludes observation time and remote statuses. Dry-run cannot accept a
  confirmation, construct the S3 client or read credentials; publish requires
  the exact publication ID before any local persistence or client construction.
- The future mutation protocol is create-only `If-None-Match: *` for missing
  immutable objects, exact verified reuse for present immutable objects and a
  fresh strong nonempty ETag `If-Match` CAS for a different mutable manifest.
  Source validation and all immutable rereads precede the final manifest
  reread/CAS; the manifest is always last and finally reread. Unconditional
  writes, deletes, copies and multipart operations are forbidden. A separate
  content-addressed publication receipt can be created only after final remote
  verification and does not claim RSS authority.
- The real K60 dry-run checked at `2026-08-16T10:13:56.648Z` completed with
  exit 0. All five objects remained missing and all modeled actions remained
  conditional create-if-absent. The stable publication ID is
  `a23bda883f00c24ff9732ad3a57fbece890670b6a14f0377725d2b855e99e286`.
  The 7,575-byte report has SHA-256
  `04bfece327902c2019941ddca348d34f1f460f2c0466a1c9c20902197a245274`;
  no publication summary or receipt was produced, client/credential access was
  NOT_EXECUTED and remote writes were zero. Maximum individual-process RSS was
  1,024,901,120 bytes. Focused K58-K60 checks passed 31/31 and the compiled
  `database-characters` suite passed 321 tests with 9 platform-dependent tests
  pending. Combined process-tree RSS, R2 mutation, authority, production and
  Android remain NO-GO.
- The explicitly authorized K60 publication checked at
  `2026-08-16T14:56:00.523Z` completed with exit 0 and empty stderr. Fresh K59
  still observed all five keys missing. K60 created four immutable objects with
  `If-None-Match: *`, revalidated K58/K56, reread every immutable, created the
  mutable manifest last with `If-None-Match: *`, and verified its final bytes.
  Publication ID remained
  `a23bda883f00c24ff9732ad3a57fbece890670b6a14f0377725d2b855e99e286`.
  Zero unconditional writes, deletes, copies or multipart operations occurred.
- The 7,575-byte prepublication report has SHA-256
  `ba6a5d86bffc2f7fbfd1076dacff3ec057ec9bd6a1a3fb0abdd8b96d90dfaa29`;
  the 1,596-byte post-publication receipt has SHA-256
  `d56dd4bdb6a46570d687709acc687ae67a270908c1666c3f495e5ca29b901a68`.
  Independent unauthenticated GETs returned HTTP 200 for all five public keys
  and matched every expected byte, SHA-256, size, content type and cache
  control. Post-publication bucket info reported 5,391 objects and 364 MB.
- The public mutable bytes remain the exact 11,561-byte K58 candidate manifest,
  SHA-256
  `370dc7026c4523d509a403a2fbfa91009d1bb9452f7ab277f9c6aaebb8a1441e`.
  Its own K58 policy remains `candidateOnly: true`; this is transport/public
  delivery, not silent dataset authority or a productive Android contract.
  Maximum individual-process RSS was 1,058,193,408 bytes. Combined process-tree
  RSS, authority, production and Android remain NO-GO.
- K61 adds a credential-free, stdout-only public candidate shadow. It runs two
  real K58 source-bound validations around exactly six public GETs: mutable
  manifest, four ordered content-addressed K56 members, then mutable manifest
  again. Every response must match exact bytes, SHA-256, size, content type and
  cache control; redirects and encoded responses are blocked. The final
  manifest must be byte-identical to the first.
- K61 reconstructs the exact public K56 bundle, uses the K57 private consumer
  indexes and audits reference/state/card/effect lookups through deep-frozen
  clones. It preserves 12,265 references, 7,248 states, 3,434 cards and 3,836
  effects. The 17 conditional effects and 45 references remain excluded as
  `runtime_deck_index_unresolved`; the user-confirmed rule remains
  coverage-only and non-authorizing.
- The real K61 run checked at `2026-08-16T16:00:10.344Z` completed with exit 0
  and empty stderr. Six GETs read 238,870 bytes; public delivery, source-bound
  stability and all four shadow lookup dimensions were GO. The 4,364-byte
  report has SHA-256
  `4b2a5ed42ab5cf4d73cb40d5a40818a19e3eeab6daef01ab5755cf700bd71838`.
  Maximum individual-process RSS was 1,022,099,456 bytes. Focused checks passed
  16/16 and the compiled suite passed 328 tests with 9 pending. The public
  manifest remains candidate-only; persisted consumer, authority, production,
  Android, UI, authenticated network and R2 mutation remain NO-GO.
- K62 adds an offline/default-off productive compatibility audit over the exact
  K61 candidate. It source-binds K58/K56, losslessly reconstructs K56, pins the
  K57/K59/K60/K61 reports plus K60 publication receipt, and verifies the
  current scraper/Team Analysis and Android wire/domain/evaluator source
  identities without modifying Android or making a request. The public
  manifest remains `candidateOnly: true`; 3,836 effects, 12,265 references and
  four indices are preserved, while the 17/45 conditionals remain excluded as
  `runtime_deck_index_unresolved`.
- Structural `cardId` parity against the exact productive `Character[]` joins
  8,893 references over 2,265 cards and leaves 3,372 references over 1,169
  cards unjoinable. Those joins are identity agreements and representation
  gains only: comparable values and confirmed conflicts are both zero, all
  12,265 values/lifecycle outcomes remain unknown, and zero conflict is not
  completeness. The productive pin contains zero structured Leader-detail
  records; text is baseline only and never identity.
- The 18-dimension matrix classifies six dimensions directly representable,
  seven as requiring an additive contract, three as lossy in the current
  model, lifecycle/timing as blocked unknown, and missing runtime dimensions as
  runtime-context-required. Every one of the 3,836 supported whole effects
  requires a separate additive contract for lossless shadow storage. This is
  sufficient for a documented K63 design GO: a separate optional data sidecar
  mapped to separate immutable domain evidence, absent-compatible with old
  caches and the existing fallback, never replacing effective values or UI.
- The real K62 run performed two byte-identical materializations and a
  source-bound post-write reconstruction. The 850,319-byte raw report and
  19,032-byte gzip have SHA-256
  `23c03e337c6c04066da06bb63bf33dc4b283a571a72182c527e4ec297383845f`
  and `39fd57186bf78afce2cc2baaa8764725715e787e45cd0aa0ff6361d32d6d9edb`.
  Coverage, validation and manifest hashes are respectively
  `a3b8788907aaa51320b439850dd8032a0bdf23a82d6ebb5fd232cf655fb067bb`,
  `bc85a5b3f13d7ba0c7b1c12929ebe4ee4b3254bfdfea04b926019d95ff23bc43`
  and `b28f410f3676af76adfced9f12b2fd3f47be9e4e2ed7ac09801eaccaca86eb33`.
  Maximum individual-process RSS was 1,039,409,152 bytes, below 1 GiB by
  34,332,672 bytes; process-tree RSS remains unmeasured/NO-GO. K62 audit and
  K63 additive design are GO; current-contract consumption, authority,
  production, Android implementation, UI, runtime context and K63 execution
  remain NO-GO. Focused K62 checks passed 5/5, the compiled
  `database-characters` suite passed 333 tests with 9 pending, and independent
  contract review found no P0-P2.
- K62.1 replaces materialized Android-worktree pins with the exact repository
  URL, commit `5afa5ee3de25755c9fffdfcd2f1fc3293d56b26a`, relative paths, Git blob
  IDs, sizes and SHA-256 values for nine Android sources. Bytes are read only
  from the local Git object database with lazy fetching disabled; checkout
  bytes are neither evidence nor authority.
- Contract `1.2.0` records source stability conservatively as
  `CHECKPOINTED_PERSISTENT_DRIFT_ONLY`; transient A-B-A mutation detection is
  `NO-GO`. One source-bound K58/K55 load is bracketed by fingerprinted receipts,
  then two byte-identical K62 materializations are written create-only, read,
  reconstructed and compared across payload, coverage, validation and manifest.
- The accepted real K62.1 run exited 0 with empty stderr. It preserved 3,836
  effects, 12,265 references, 8,893 joinable and 3,372 unjoinable references;
  the 18-dimension classification remains 6 directly representable, 7 additive,
  3 lossy, 1 blocked unknown and 1 runtime-context-required. Raw/gzip SHA-256 are
  `1ba112d7b4e08ceebeb590976b8d1b7c1d726064cba094ef050db237aadaef4f`
  and `b0a01eda8fedf56f6d7320d725fdcf45170f6ac380175bb8ea21f51fa00abd18`.
- An external whole-process-tree observer measured a 1,071,194,112-byte peak,
  2,547,712 bytes below the exclusive 1 GiB boundary, with exit 0 and no
  measurement error. Focused K62 checks passed 14/14; the compiled
  `database-characters` suite passed 341 tests with 11 pending. Contract review
  found no P0-P2. Direct current-contract consumption, authority, production,
  Android implementation, UI, R2 mutation and publication remain NO-GO.
- Android K63 is integrated at commit
  `f148a66d9911c2667caafd47bbd522b5fe00c4e6` as a separate immutable domain
  evidence model, strict local gzip/manifest loader and repository disabled by
  default. It has no Room, network, startup, UI or effective-value path. Its
  mandatory six-field provenance pin is supplied outside artifact bytes.
- K64 materializes the exact K56 supported-only corpus into that K63 `1.0.0`
  wire shape offline. It preserves 7,248 ordered states, 12,265 effect
  occurrences and 31,478 typed filters, including category exclusions,
  sequential AND, empty identity, duplicates and multiplicity. Percentage and
  flat operations retain the common modifier; no boost or combat value is
  calculated.
- The accepted K64 run completed with exit 0 and empty stderr. Two generations
  and the post-write reconstruction were byte-identical. Raw/gzip sizes are
  8,082,196 / 416,285 bytes; gzip SHA-256 is
  `0bf70708b14224867546a76c8cd2521ce00489f2eae5cbea0d7693dc6e67e150`.
  The 898-byte Android manifest SHA-256 is
  `7aa2b54655c4cc5750269e01d7e63756357b2b10894d0f9bc0ea0da4a9d9062d`.
  The separately compiled accepted provenance-pin SHA-256 is
  `88a62688150ece1f06bc91bfd2832c78780e392be7622cfe560bf1a9148d4e8d`;
  the bundle copy is candidate-only and cannot self-authorize. Observed K64
  process peak RSS was 296,194,048 bytes. The real Android K63 loader accepted
  the generated bytes and reconstructed the exact inventory.
- K64 offline production, persisted reconstruction and Android wire
  compatibility are GO. Android runtime acquisition/consumption, authority,
  production, publisher, network, R2, UI, combat calculation, transient A-B-A
  detection and concurrent same-user ancestor replacement remain NO-GO.

## World Tournament WT0-WT6 checkpoint (2026-08-16)

- The WT campaign ancestry is pinned to exact
  `3222f2eeede2b70bafbf1b6c00f2c6a521b74485`. The capture execution itself did
  not perform repository integration; reviewed offline/default-off
  infrastructure integration is GO.
- WT0-WT6 completed an offline, fail-closed audit of the external 7,087,930-byte
  HAR (`70ce81581e9237fb1b9a8da7dd0db1c24dd397dc329cc57cca468705265d66cd`).
  The HAR and its source lock are not tracked. The scanner catalogued 19,572
  scalar observations across headers, cookies, URL paths, query names/values,
  URL credentials and every non-empty request/response JSON or textual body
  leaf. The scanner classifies every literal/contextual match;
  the final candidate derived 6,097 total matches: 6,059 permitted
  protocol structures, 38 permitted public first-party game structures, zero
  prohibited sensitive matches and zero unresolved matches. The three auth
  mutation-body matches are the exact public app identity proven independently
  from the pinned first-party APK; effectively sensitive account payload and
  opaque credential counts remain zero. It examined 3,708 targets/3,462 unique
  blobs across the complete corrected tip and every old/new changed blob in the
  twelve-commit candidate range, with zero
  prohibited/unresolved matches and zero captured/raw HAR targets. Compact long
  hexadecimal, UUID, base32/base64/base64url, decimal and alphabetic values use
  context-independent literal scanning without a character-class diversity
  requirement. Short values require JSON shape/path/type or header, cookie,
  URL/query and exact textual context. JSON, text-body and raw `text_exact`
  projections remain separate. The two
  former synthetic-fixture HAR-shaped historical targets are pinned by exact
  category-bound fingerprints; missing, additional or tip structure fails closed.
- The public app-identity proof uses schema 2 and private open-handle snapshots:
  the pinned APK and `aapt` are each opened once, streamed into exclusive
  read-only material below the ignored runner-controlled root, and never used
  again through their external pathnames. Only the private executable and APK
  path are passed to the no-shell bounded process. Identity, containment,
  type, link count, stable timestamps, size and SHA-256 are checked before and
  after execution; cleanup removes only a proved-owned namespace. This covers
  external pathname replacement and A-B-A, but not a malicious same-OS-identity
  process mutating the discovered private namespace, a compromised
  kernel/filesystem or an already-loaded executable image.
- Source ingestion requires an absolute external non-reparse root and a strict
  relative child path; realpath containment and every path component are
  revalidated before and after reading. Absolute, traversal, UNC, drive-relative,
  mixed-separator, symlink and junction escapes fail closed.
- Contracts now cover event/lifecycle, account entry/status, maps, ranks,
  rankings, borders, friends, box ranking, schedules, briefing/supporters,
  advantageous cards, mission relation and the opaque start envelope. HTTP 200
  proves acceptance/order only; sign semantics and crash causality are unknown.
- Structural shadow parity is 1 agreement, 4 coverage gaps, 1 unknown and 7
  unjoinable cells. The older pinned database roots do not contain the observed
  event, mission or box-ranking identities. Reward definitions and grants stay
  separate.
- Two complete generations of 21 WT0-WT6 files were byte-identical. Maximum
  observed process-tree working set was 595,144,704 bytes. GO is limited to
  reviewed offline/default-off infrastructure and completely synthetic fixtures. Replay,
  authenticated automation, missing finish/results, sign decoding, Android,
  R2, publisher, production and source replacement remain NO-GO.
- Consolidated evidence and integration guidance are in
  `docs/game-db/specs/database-world-tournament-capture-wt0-wt6.md`.

## Typed passive-marker publication checkpoint (2026-08-21)

- Characters `2026-08-21T18:18:39.394Z` is public with delivered payload
  SHA-256 `97d8d7c90eb64af8c717bcdbaefc194406452f679f21142fc86770dba7d1b18b`.
- Team Analysis `2026-08-21T18:18:39.394Z:parser-1.7.3` is public with
  payload SHA-256
  `8ab89556d0ecc8a339963519f9b23fd9723592200e1dc3e7a2b688f927d88dc1`.
  Its source version and payload SHA match the public Characters manifest
  exactly; the post-publication dry-run reports zero writes and retains the
  immediately previous verified Team Analysis release for rollback.
- Typed passive markers preserve exact display positions for `once`,
  `forever`, `up_g`, `down_r`, and `down_y`. Android rejects unknown tokens or
  contradictory token/kind pairs instead of inferring markers from display
  text. Pan (GT) `1024991` EZA was verified on the emulator with value-up arrows
  at their source positions.
- Team Analysis release-state selection is conservative: release dates alone
  never promote base combat text, EZA-only evidence never fabricates SEZA, and
  empty detail fields fall back only to material release-specific legacy
  sources. Focused scraper tests pass 312/312; the Android wire-model test and
  debug assembly pass.

## Release-specific Unit Super Attack checkpoint (2026-08-21)

- Characters `2026-08-21T21:05:24.053Z` is public with payload SHA-256
  `3ed38f273405fa4f06e73fdd4180143de6625d8cb721aeefc91f479b9f61c7bf`.
  The K28 publication uploaded 12 missing immutable objects, found zero
  conflicts or failed reads, verified 1,629 objects including the manifest,
  and promoted `characters-manifest.json` last. The dry-run projected
  374,257,659 bytes at peak against the 10 GB bucket limit.
- Team Analysis `2026-08-21T21:05:24.053Z:parser-1.7.3` is public with payload
  SHA-256
  `bfb6908fc9b5850fe6df5833d3bd7db9351b03e6c51b1549e87a8ffeed26aab3`.
  Its source Characters version and SHA-256 exactly match the public
  Characters manifest. The first Unit Super Attack Team Analysis artifact was
  incorrectly linked to the pre-delivery Characters payload hash; Android
  rejected that auxiliary update and retained its compatible cache. The
  artifact was regenerated from the exact public Characters payload and
  manifest, republished, downloaded by Android without clearing app data, and
  Pan (GT) EZA was then verified with all three Unit Super Attacks. The
  immediately previous verified release remains available for rollback.
- Wrangler 4.118.0 reported the newly uploaded Team Analysis payload missing
  through `r2 object get` immediately after its successful `r2 object put`.
  Publication failed closed before manifest promotion. Direct public HTTPS
  then proved HTTP 200, the exact 2,735,738 bytes and SHA-256, gzip content
  type, and immutable cache metadata. The documented
  `--skip-upload-verification` recovery path was used only after that proof;
  the manifest was then promoted and independently re-read with `no-store`.
- `unitSuperAttacks` remains the base list and the additive
  `ezaUnitSuperAttacks` field carries the EZA list. SEZA inherits the EZA list;
  EZA and SEZA never fall back to base Unit Super Attacks. Pan (GT) `1024991`
  was verified with three distinct base and three distinct EZA Unit Super
  Attacks in both Characters and Team Analysis artifacts.
- The Android integration branch `codex/master-consolidation-k66` consumes the
  additive field through Room schema 11, preserves old caches through an
  additive 10-to-11 migration, and rematerializes Characters at marker 5.
  Focused migration instrumentation passed 6/6; domain/app unit tests and the
  debug assembly pass. An emulator upgrade exposed a nullable legacy-row
  converter crash that schema-only migration tests did not exercise; the Unit
  Super Attack converter now accepts null/blank columns, has a focused
  regression test, and successfully reopens the same preserved database.
- Android `master` was consolidated locally on 2026-08-21. Its prior 10-file
  working-tree delta was preserved first as commit `2ac119a` on
  `codex/local-master-wip-20260821`, then reapplied without manual conflicts as
  `ec1dd6e` after the 34-commit fast-forward through `a60a549`. The follow-up
  `6dec6cc` removes redundant type, rarity, class and cost metadata from the
  character-detail identity block while retaining the portrait and typed rail.
  Domain/app unit tests and the debug assembly pass; Pan (GT) EZA was verified
  on the emulator, including a 200% font-scale check of the identity block.
  Remote `master` remains unchanged pending a separate explicit push.

## Typed Active Skill local checkpoint (2026-08-21)

- The FYI and first-party game-DB projections now preserve every distinct
  Active Skill by stable ID instead of collapsing the payload to the first
  localized string. Ordered effect rows retain typed target/calculation fields,
  raw `values` and `efficacyValues` JSON separately, and source provenance.
- Projection-time deduplication is identity-based only. No effect, multiplier,
  timing or display semantics are inferred from prose or regular expressions;
  the legacy effect and condition strings remain available for old consumers.
- Focused TypeScript compilation and the two projection suites pass 33/33.
  Matching tracked `lib/` output is generated locally. No Characters artifact
  or R2 object containing this additive contract has been published yet.
- Android `master` consumes and persists the optional contract through Room
  schema 12 and Characters materialization marker 6. Old cached payloads keep
  using legacy strings, while stable IDs are normalized defensively on ingest.
  The duplicate Active Skill block was removed from Character Details; the
  existing Domain-aware block is now the single presentation owner.

## Typed Active Skill publication checkpoint (2026-08-21)

- The mapped-character cache contract is now centralized in
  `fyi-mapped-character-cache.ts` at exact version 11. Version 10 entries are
  rejected and rebuilt so newly projected typed Active Skills cannot be hidden
  behind structurally valid stale mapped characters. The focused cache,
  scraper, and game-DB projection suites pass 34/34; contract review found no
  remaining P0-P2 issue.
- Characters `2026-08-22T01:54:55.262Z` is public with delivered payload
  SHA-256
  `e02372a12d0cab5950635c448f0ca9ad04fabc5cd7cc40c4c4edf97a7cf95f8e`,
  2,167,952 compressed bytes and 1,436 characters. The payload has 202 base
  states with typed Active Skills; the current source has no EZA-specific or
  multi-Active-Skill state, so multi-skill behavior remains covered by
  fixtures rather than production data.
- Team Analysis `2026-08-22T01:54:55.262Z:parser-1.7.3` is public with payload
  SHA-256
  `1ad274d14599a6249b83d0eb2122edea3b96ee73234b3a6fe8935be8139caabe`,
  2,735,739 compressed bytes and 2,287 states. Its source Characters SHA-256
  exactly matches the public delivered payload. Both releases passed the
  required dry-runs and remain far below the 10 GB bucket allowance.
- Wrangler 4.118.0 again failed its immediate Team Analysis read-after-write
  verification after a successful put, before manifest promotion. Direct
  public HTTPS proved the exact size, SHA-256, gzip content type and immutable
  cache metadata; only then was the documented skip-verification recovery used.
  The promoted manifest was independently re-read with `no-store`.
- Android validated the release twice: first as an in-place cached upgrade and
  then after clearing only the debug app's emulator data. Both paths fetched
  the exact public Characters and Team Analysis hashes, validated Team Analysis
  in about one second and launched without an app fatal error. The prior
  duplicate repro character now renders one named `ACTIVE SKILL` block.

## Passive continuation Team Analysis checkpoint (2026-08-22)

- Team Analysis `2026-08-22T01:54:55.262Z:parser-1.7.4` is public with payload
  SHA-256
  `a26556bf2247c57450c164f70c1f7ff6afe8e0522bdafd9f3af36e3bcb2a8e2a`,
  2,754,560 compressed bytes and 2,287 states. Its source Characters SHA-256
  exactly matches the public `2026-08-22T01:54:55.262Z` payload.
- The parser now consumes `passiveDetails.sections` only when those structured
  entries form an ordered, non-overlapping, lossless partition of the raw
  passive source. Invalid or incomplete section structure fails closed instead
  of emitting an orphan condition such as `BASIC EFFECTS / when receiving an
  attack`.
- The required remote dry-run projected 2,755,260 new bytes, an 8,226,737-byte
  managed peak and a conservative 378,754,560-byte global upper bound, below
  the 10 GB limit. The active parser-1.7.3 payload remains retained for
  rollback.
- Wrangler again failed immediate payload read-after-write before manifest
  promotion. Direct public HTTPS proved status 200, the exact payload size and
  SHA-256, gzip content type and immutable cache metadata; only then was the
  documented skip-verification recovery used. The promoted manifest was
  independently re-read with `no-store` and exact content.

## Typed Active Skill ultimate-attack checkpoint (2026-08-22)

- The additive Active Skill contract now preserves `ultimateAttack` with its
  stable `ultimateSpecialId`, multiplier, target scope and first-party row
  provenance. It remains optional so old Characters payloads and caches keep
  materializing without the enrichment.
- The DB semantics are pinned against Global database `1782367825` and the FYI
  cache: Pan `1024991` joins active set `156` to ultimate `36`, whose
  `increase_rate=600` and `aim_target=0` match FYI `600/false`; Vegeta
  `1020341` joins set `83` to ultimate `12`, whose `440/1` match FYI
  `440/true`. The first-party values were re-read from
  `database.decrypted.sqlite`, not inferred from prose.
- Android materialization marker 8 preserves the optional object and forces a
  one-time rebuild where needed. Presentation is fail-closed: it exposes a
  multiplier only when the outer and nested ultimate IDs are both nonblank,
  equal and the multiplier is positive. No regex participates in the path.
- The approved Android UI reuses the existing Active Skill hierarchy with a
  compact `DETAILS` group after `CONDITION`, matching the established Super
  Attack grammar. It renders a normal-size bullet and highlights only the
  typed percentage in warning amber; absent or ambiguous enrichment produces
  no empty group. The instrumented compact-width fixture passes and was
  visually inspected on the Pixel 10 Pro emulator.

## Typed Active Skill ultimate-attack publication checkpoint (2026-08-22)

- Scraper commits `0ebbabe` and `e49f1bd` are on `origin/main`; Android commits
  `59c564d` and `61d5c25` are on `origin/master`.
- Characters `2026-08-22T12:48:30.694Z` is public with delivered payload
  SHA-256
  `e635aed4abe5b4afba37b9f7d09182513470c9d1b85ea235aa2228436917ca88`,
  2,184,898 compressed bytes and 1,436 characters. Its public manifest and
  immutable payload were independently fetched with `no-store`; size, SHA-256,
  gzip content type and cache metadata match exactly. Pan `1024991` carries
  typed ultimate ID `36`, multiplier `600` and single-target scope.
- The required Characters dry-run found 1,622 matching objects, six missing
  objects, zero conflicts and zero failed reads. It projected 2,237,895 new
  bytes and a conservative 378,237,895-byte bucket upper bound. K28 uploaded
  all six objects, directly verified 1,629 objects and promoted the manifest
  last.
- Team Analysis `2026-08-22T12:48:30.694Z:parser-1.7.4` is public with payload
  SHA-256
  `d2e0a8dceff42eb7c1522a706c914f2bfa3591e6450ce934c22ad252c13d4c88`,
  2,754,557 compressed bytes and 2,287 states. It was regenerated from the
  exact public Characters bytes; its source version and SHA-256 match the
  promoted Characters manifest.
- The Team Analysis dry-run projected 2,755,257 new bytes, an 8,245,556-byte
  managed peak and a conservative 378,754,557-byte global upper bound. The
  publisher retained both parser-1.7.4 releases and removed the older
  parser-1.7.3 rollback payload after manifest promotion.
- Wrangler again failed immediate payload read-after-write before manifest
  promotion. Direct public HTTPS proved status 200, the exact payload bytes and
  SHA-256, gzip content type and immutable cache metadata; only then was the
  documented skip-verification recovery used. The final public manifest and
  payload were independently re-read with `no-store` and exact content.
- The current Android `master` debug APK was rebuilt and installed over the
  existing emulator app. It downloaded the promoted datasets and Pan (GT) EZA
  rendered `CONDITION` before `DETAILS`, with `Increases ATK by 600%` sourced
  from the typed enrichment.

## Character Details completion checkpoint (2026-08-22)

- Scraper commit `764526c` adds typed Super Attack effect rows for exact stat
  values, durations, stun, seal and action break while retaining row-level
  provenance. Structured FYI/DB fields remain authoritative; a conservative
  one-to-one merge fills only missing fields from explicit text and preserves
  unmatched parsed effects instead of silently discarding them.
- Android commit `64fbab4` carries that optional contract through the wire and
  domain models and presents the approved effect rows with the supplied Dokkan
  status icons. Old cached payloads without effects or provenance remain
  compatible, and malformed provenance degrades to `UNKNOWN` without dropping
  the effect.
- Android commit `af45193` finishes the approved Character Details discovery
  polish: Applicable Support Memories use a three-item progressive disclosure,
  and category chips are consistently styled, accessible navigation controls
  that open the existing category catalog and return to the preserved detail
  position.
- Focused scraper suites pass 347 tests; Android domain/app unit tests and the
  debug assembly pass. The support-memory disclosure and category round trip
  were visually verified on the emulator. Contract review found no remaining
  P0-P2 issue. At that checkpoint the commits were still local and no R2
  publication had been done; the following checkpoint records their delivery.

## Super Attack level-curve delivery checkpoint (2026-08-22)

- Scraper commit `02e95ef` and Android commit `45a4458` are pushed, together
  with the preceding Character Details checkpoints, to `origin/main` and
  `origin/master`. The FYI mapper now preserves the typed level-1 percentage,
  maximum-level percentage and maximum Super Attack level for normal, Ultra,
  Extra and Unit Super Attacks across initial, EZA and transformed states.
  Team Analysis parser `1.9.0` carries this additive field without regex;
  Android consumes it directly and retains the old exact-descriptor fallback
  for cached datasets that predate the field.
- Characters `2026-08-22T15:28:45.905Z` is public with payload SHA-256
  `485a72ce7d89bb5c968a2c3d29b0bb6c24e2e58cf229daacc9a3513a4f0ad279`,
  2,340,541 compressed bytes and 1,436 characters. The required dry-run found
  1,626 matching objects, two missing objects, zero conflicts and zero failed
  reads; it projected 2,350,569 new bytes and a conservative 381,350,569-byte
  bucket upper bound. The post-publication dry-run found all 1,628 objects and
  the mutable manifest matching, with zero planned uploads.
- Team Analysis `2026-08-22T15:28:45.905Z:parser-1.9.0` is public with payload
  SHA-256
  `d2a50a366395b1499ebac11b6664beea013cf38b00f143a0069ba29f600693bd`,
  2,934,016 compressed bytes and 2,287 states. It was generated from the exact
  public Characters bytes and its source version and SHA-256 match the public
  Characters manifest. Metal Cooler EZA carries `200 -> 320` at level 25 for
  its normal Super Attack and `250 -> 490` for its Ultra; Pan EZA carries
  `150 -> 500` at level 15 and each of its three Unit Super Attacks carries
  `130 -> 480`.
- The Team Analysis dry-run projected 2,934,716 new bytes, an 8,443,833-byte
  managed peak and a conservative 381,934,016-byte bucket upper bound. Wrangler
  again failed its immediate payload read-after-write before manifest
  promotion. Public HTTPS independently proved status 200, exact size and
  SHA-256, gzip content type and immutable cache metadata before the documented
  skip-verification recovery promoted the manifest. A final public no-store
  reread proved the manifest, payload and Characters lineage exactly; the
  previous Team Analysis release remains retained for rollback.

## First-party release-state refresh checkpoint (2026-08-22)

- The official Global game DB pulled from LDPlayer was promoted as first-party
  export `glb-db-1787282006` with asset version `1787281486`; no website
  scraping was used. The final pull was byte-identical to the earlier complete
  pull, proving that the missing EZA was a projection gap rather than an
  incomplete download.
- The game-DB projection now models `initial`, `eza` and `seza` as typed release
  states. It selects the final growth step by rarity, inherits unchanged leader
  and passive sets, and selects the Super Attacks valid at each state's maximum
  SA level. First-party passive markers retain DB provenance, and the audited
  typed `197 + 3` normal-SA compensation displays the intended `200 -> 320`
  curve without changing the raw source operands.
- A fresh, isolated candidate pipeline overlays only explicitly targeted cards
  on the current Character payload, generates Team Analysis from those exact
  bytes, verifies manifest version/SHA lineage, and writes its final report
  marker only after both artifacts pass. Output is restricted to fresh children
  of `game-db/data/game-db-character-release-candidate/`.
- The published Characters release is
  `2026-08-22T21:14:10.019Z`, SHA-256
  `34b2ce3918d0497b458f106f4e00b50cb039f0a280ef6bfe45c0ca76ee1a84bd`,
  2,342,162 compressed bytes and 1,436 characters. It was built over the exact
  prior public SHA `485a72ce7d89bb5c968a2c3d29b0bb6c24e2e58cf229daacc9a3513a4f0ad279`;
  only card `1028061` changed. The Character payload now uses the same
  content-addressed object-key shape as the versioned publisher.
- Team Analysis `2026-08-22T21:14:10.019Z:parser-1.9.0` is public with SHA-256
  `d7a8461c41484b0e25f61131476006b18eadad71c6bac265e7f0e289e7a96237`,
  2,937,851 compressed bytes and 2,288 states. It adds only
  `1028061:eza`, is bound to the exact Characters SHA above, and exposes the
  EZA normal/Ultra SA curves `200 -> 320` and `250 -> 490` at level 25.
- The required dry-runs projected 2,342,607 managed Character bytes and
  2,938,551 new Team Analysis bytes, with an 8,627,124-byte managed peak and a
  conservative 383,937,851-byte bucket upper bound. Wrangler repeated its
  known immediate payload verification delay; public HTTPS proved exact bytes,
  SHA-256 and immutable metadata before the documented recovery promoted the
  Team Analysis manifest. Final public reads proved both payloads and their
  lineage, and the local `data/fyi-characters/latest` artifacts were synced to
  the published bytes.
- Character publication now supports an expected-public-baseline SHA guard and
  fails closed if the mutable remote manifest no longer matches the payload
  used to build a candidate. The publisher also validates the local gzip bytes,
  sizes, count, checksum and canonical filename before deriving an object key,
  requires an explicit value for that baseline guard, and retains prior
  immutable Character releases plus their portraits for rollback. Cleanup now
  requires a separate release-aware garbage-collection policy. Every remote
  run now reads Wrangler's full bucket size and adds prospective uploads using
  a conservative rounding bound, failing closed when usage is unavailable or
  would reach 10 GB. Ordinary future EZA/SEZA data should therefore flow through
  without per-card code; a game schema change or genuinely new mechanic still
  requires a new audited mapper.
- Publication authorization does not authorize Git integration or delivery;
  committing and pushing the implementation and matching tracked `lib/`
  output remain separate, explicitly authorized actions.

## Team passive-analysis clarity checkpoint (2026-08-23)

- Local Team Analysis parser `1.9.1` recognizes the official Global passive
  descriptions for Entrance Animation team-category requirements and Active
  Skill activation as typed predicates. The grammar is deliberately exact and
  fails closed for noncanonical wording. Ultimate Gohan EZA's Entrance now
  resolves from another `Bond of Parent and Child` ally instead of being
  reported as missing condition data; TEQ Beast's Active Skill/18 Ki
  alternative remains honest runtime battle context.
- The complete local artifact contains 2,288 states, 2,938,665 compressed
  bytes, 54,393,578 uncompressed bytes and SHA-256
  `f400fdd475d2e79119881ad21a75bc840da46dc9fc260e93772c471af7c96457`.
  It is bound to public Characters version `2026-08-22T21:14:10.019Z` and SHA
  `34b2ce3918d0497b458f106f4e00b50cb039f0a280ef6bfe45c0ca76ee1a84bd`.
  This candidate was validated only in the local Android emulator; no R2
  dry-run or publication has been authorized or performed.
- Android presentation now keeps atomic rules for evaluation but groups them
  back into their shared first-party source clause. The Team Builder counts
  conditions rather than duplicated effects, distinguishes battle context
  from missing typed data, shows typed matching-member evidence and application
  timing, and reuses Character Details percentage emphasis plus once/forever
  and value-direction icons. Incomplete drafts use lower/upper count bounds, so
  a known matching ally can prove a presence condition without empty slots
  forcing an unknown result.
- Focused parser tests, the full 325-test Team Analysis suite, Android domain
  and app unit suites, debug assembly and focused instrumentation passed before
  final delivery review. The final cross-repository contract review found no
  P0-P2 issue; its only residual risk is conservative fallback if future
  official wording or malformed legacy source anchors no longer match the
  current exact grammar. Git commit/push and R2 publication remain separate
  operations requiring explicit authorization.

## Team passive availability refinement checkpoint (2026-08-23)

- Local Team Analysis parser `1.9.2` adds a first-party, recursive Active Skill
  activation-condition contract sourced from the official Global game DB
  `skill_causalities` rows. Battle-turn, rotation-category-count and enemy-count
  predicates retain their exact DB operands and row provenance; unknown
  causality types or modes remain unknown. Release-state selection and the
  two-card overlay preserve existing localized Character content and add only a
  matching typed condition, failing closed on missing, ambiguous or divergent
  Active Skill identities.
- Android keeps the conservative exact condition result and derives a separate
  glance-first availability state. Normal progression and player actions such
  as turns, attacking, Super Attacking, attack counts and Ki thresholds are
  `AVAILABLE`; a proved team-composition blocker is `UNAVAILABLE`; incoming
  attacks, enemies and other runtime facts are `BATTLE_CONTEXT`; incomplete
  typed semantics are `CONDITION_DATA`. OR expressions become unavailable only
  when every route is proved unavailable, preventing a battle-dependent Active
  Skill alternative from becoming a false red result.
- Ultimate Gohan EZA's Active Skill set `174` now has a deliberately narrow
  first-party correlation for causality row `2025`: exact set, compiled AST,
  category `88` (`Super Heroes`) and official condition description are all
  pinned before the three-allies-in-rotation predicate becomes supported. This
  does not promote type-34 mode-2 globally. Android consumes leaf evidence
  independently, so the supported turn-3 + three-Super-Heroes route can prove
  availability while the alternative enemy-count route remains incomplete.
  Missing leaf evidence still fails closed.
- The passive parser now detects a malformed structured section that swallowed
  the following title-cased logical header and falls back to the lossless raw
  header/bullet boundaries. This fixes TEQ Beast's `For every attack performed`
  stack being attached to `When receiving a normal attack` while preserving a
  known lowercase inline continuation fixture.
- The complete local candidate is Characters
  `2026-08-23T04:51:53.794Z`, SHA-256
  `469e9df38f8ae35521bc4fca1324a5b47391ada2b0c0b79cdc34ea44d8d605cb`,
  2,342,759 compressed bytes and 1,436 characters, plus Team Analysis
  `2026-08-23T04:51:53.794Z:parser-1.9.2`, SHA-256
  `8739a397e8e674026299b54e0977f04fcdb0655a1e61712cb16aea643551b27a`,
  2,924,529 compressed bytes, 53,779,641 uncompressed bytes and 2,288 states.
  It was installed only in the Android Studio emulator. The real TEQ Beast and
  Ultimate Gohan draft showed attack/Ki/progression clauses as available and
  incoming-attack or unresolved enemy/rotation routes as battle-dependent.
  No R2 dry-run or publication, Git commit, or push was performed for this
  checkpoint.

## Team passive runtime-reachability checkpoint (2026-08-23)

- Team Builder now answers whether the selected composition permits a passive
  clause, not whether every live battle fact is true at that instant. HP,
  enemy state, attack targeting, Ki, slot/order and similar runtime conditions
  are presented as `Available with this team`; an attached unmet character,
  category, class or type requirement still wins as `Not available with this
  team`. The exact domain evaluator remains tri-state for future scenario and
  damage-calculation work, while genuinely unsupported typed data remains
  `Condition data missing`.
- Local Team Analysis parser `1.9.3` adds explicit source-neutral contracts for
  final attack Ki while targeted and for the first/second/third Ki Sphere
  collection order. It also preserves exact conjunctions between incoming
  attacks, Ki Sphere thresholds and attack-Ki thresholds. In the complete
  candidate, all 17 collection-order predicates, all 22 targeted attack-Ki
  predicates and all five wrapped targeted/Ki-Sphere predicates are typed;
  none of those audited phrase families remains an unknown condition.
- The complete local candidate is Characters
  `2026-08-23T05:35:48.096Z`, SHA-256
  `469e9df38f8ae35521bc4fca1324a5b47391ada2b0c0b79cdc34ea44d8d605cb`,
  2,342,759 compressed bytes and 1,436 characters, plus Team Analysis
  `2026-08-23T05:35:48.096Z:parser-1.9.3`, SHA-256
  `7e46293e7ebcf23dde1a7bb4889d6e94af5828c26f50a084a13b1b4d34d48fd0`,
  2,926,764 compressed bytes, 53,816,979 uncompressed bytes and 2,288 states.
  This is local validation material only; no R2 dry-run, upload, Git commit or
  push was authorized by this checkpoint.
- The preserved seven-character emulator draft now reports `45 Active`,
  `0 Inactive` and `0 Needs info`; Piccolo (Red Ribbon Army) reports all seven
  clauses available. Android rejects unknown/new attack-Ki moments and invalid
  collection positions instead of promoting corrupt or future cache fields,
  and a proved composition blocker wins over runtime reachability inside a
  grouped source clause. Focused and broader Android checks passed, and the
  final cross-repository contract re-review found no remaining P0-P2 issue.

## Team passive potential and disclosure checkpoint (2026-08-23)

- Local Team Analysis parser `1.9.5` preserves `Every time ... performs N or
  more attacks in battle` as a typed `repeated_threshold` combat-event mode,
  distinct from an ordinary accumulated count. Start-of-turn attacker-position
  clauses now retain a typed `battle_slot` plus `start_of_turn` evaluation
  moment instead of leaving the timing suffix unknown. The corresponding
  catalog-wide pass moved 33 conditions to supported, reduced unknown
  conditions by 19 and partial conditions by 14, and retained fail-closed
  validation for unsupported modes and invalid slot moments.
- Android distinguishes passive availability from rotation potential.
  Category-ally scaling can report full or partial potential with its capped
  compatible-member count. Lists longer than three matches are now collapsed
  behind `Show N compatible characters`; expansion lists names without
  repeating `Matched by`, and the disclosure has a 48dp button target and an
  explicit expanded/collapsed state.
- The complete local candidate is Characters
  `2026-08-23T15:30:29.958Z`, SHA-256
  `469e9df38f8ae35521bc4fca1324a5b47391ada2b0c0b79cdc34ea44d8d605cb`,
  2,342,759 compressed bytes and 1,436 characters, plus Team Analysis
  `2026-08-23T15:30:29.958Z:parser-1.9.5`, SHA-256
  `31b29126f3a6e318a902c0a58a3fe8c0aed9b606ff2c6050e559a7c3ec67c46a`,
  2,934,341 compressed bytes, 53,918,987 uncompressed bytes and 2,288 states.
  It is installed only in the Android Studio emulator; the public R2 manifest
  remains parser `1.9.0`.
- The preserved DAIMA draft now reports `45 Active`, `0 Inactive` and
  `0 Needs info`: Super Saiyan 3 Vegeta moved from `5/6` to `6/6`, and Supreme
  Kai (Mini) moved from `6/9` to `9/9`. All 943 Team Analysis tests, focused
  Android wire/evaluator tests, Android debug/test compilation and debug
  assembly passed. The team-draft file SHA remained
  `cfbed0b1595df46a9c643c36d7ec6ad48612f8f8cf22570baaaa646918a9cf6d`.
  No R2 dry-run, upload, Git commit or push was authorized by this checkpoint.

## Team passive start-of-turn and HP-scaling checkpoint (2026-08-23)

- Local Team Analysis parser `1.9.6` recognizes the exact official headers
  `At the start of each turn`, `The more HP remaining` and `The less HP
  remaining`. Start-of-turn effects carry an explicit `per_turn` application
  trigger. Simple bounded HP-dependent Ki, ATK, DEF and HP effects retain a
  typed `hp_remaining` scaling contract with direction and team-HP context;
  their stated maximum remains the effect value rather than being confused
  with an accumulation cap. Near-matching or more complex wording still fails
  closed.
- Android consumes the new HP-scaling contract and `per_turn` trigger without
  inferring a live combat value. Team Builder therefore reports whether the
  effect is available to the selected composition and presents its
  start-of-turn timing, while keeping the quantitative maximum and scaling
  direction available for future scenario or damage-calculation work.
- Against the same 2,288 official Global states, supported passive rules moved
  from 9,160 to 9,277, partial rules from 2,417 to 2,368 and unknown rules from
  134 to 66. Supported conditions moved from 10,687 to 10,808 and unknown
  conditions from 808 to 687. The artifact contains 93 typed HP-scaled effects
  and 171 per-turn effects; none of the three targeted header families remains
  an unknown condition. Three irregular HP-dependent effects remain
  deliberately partial at the effect level instead of receiving a fabricated
  numeric model.
- The emulator-compatible candidate is Team Analysis
  `2026-08-23T15:30:29.958Z:parser-1.9.6`, SHA-256
  `492c61afcf25ab05c9f0c5f75f7e01d206ae2f053f9a143133ecbecf052fd819`,
  2,935,954 compressed bytes, 53,976,026 uncompressed bytes and 2,288 states.
  It is bound to Characters version `2026-08-23T15:30:29.958Z` and payload SHA
  `469e9df38f8ae35521bc4fca1324a5b47391ada2b0c0b79cdc34ea44d8d605cb`.
  The Android Studio emulator validated and loaded this local cache; its
  preserved DAIMA draft still reports `45 Active`, `0 Inactive` and `0 Needs
  info`, and the draft SHA remains
  `cfbed0b1595df46a9c643c36d7ec6ad48612f8f8cf22570baaaa646918a9cf6d`.
- All 340 TypeScript Team Analysis tests, the focused Android wire-model test,
  Android debug assembly and joint delivery validation passed. The public R2
  manifest remains parser `1.9.0`; no R2 dry-run, upload, commit or push was
  authorized for this checkpoint.

## Team passive composition-contract checkpoint (2026-08-23)

- Local Team Analysis parser `1.9.7` types the remaining high-value
  team-composition families covered by this slice: all-Super/all-Extreme
  teams, all five Extreme Types, same-member category plus name requirements,
  per-class allies, per-name allies, per-category-and-name allies, and the
  larger of category/class or category/category member groups. The contracts
  retain scope, class, names, categories, caps and self-exclusion explicitly;
  exact grammar and validators continue to fail closed for unsupported
  variants.
- Android maps and evaluates those source-neutral contracts directly. Category
  plus name is matched against the same character rather than two unrelated
  team members, union-category potential deduplicates characters, and team or
  rotation capacity respects clauses that exclude the passive owner. Existing
  full/partial potential and compatible-character disclosure are reused, so
  this parser expansion does not introduce a separate UI interpretation.
- Across the same 2,288 official Global states, supported passive rules moved
  from 9,277 to 9,441, partial rules from 2,368 to 2,211 and unknown rules from
  66 to 59. Supported conditions moved from 10,808 to 11,001 and unknown
  conditions from 687 to 489. The artifact contains 110 typed class/type
  presence predicates, seven same-member category/name predicates, 42
  per-class, 30 per-category-and-name, five per-name and 20
  per-category-or-class scaled effects.
- The emulator-compatible candidate is Team Analysis
  `2026-08-23T15:30:29.958Z:parser-1.9.7`, SHA-256
  `8551584c6bfa777d53a3979af7ed3f4d55e7c453e54b5f16ec03873c8eac1937`,
  2,942,462 compressed bytes, 54,102,541 uncompressed bytes and 2,288 states.
  It remains bound to Characters version `2026-08-23T15:30:29.958Z` and SHA
  `469e9df38f8ae35521bc4fca1324a5b47391ada2b0c0b79cdc34ea44d8d605cb`.
  The Android Studio emulator validated the exact gzip and loaded the selected
  six states; the preserved draft still reports every displayed character at
  full active count and its SHA remains
  `cfbed0b1595df46a9c643c36d7ec6ad48612f8f8cf22570baaaa646918a9cf6d`.
- All 349 TypeScript Team Analysis tests, focused Android wire/evaluator tests,
  Android debug assembly and joint delivery validation passed. The public R2
  manifest remains parser `1.9.0`; no R2 dry-run, upload, commit or push was
  authorized for this checkpoint.

## Team passive official-name identity checkpoint (2026-08-23)

- Local Team Analysis parser `1.9.8` binds name predicates to the official
  Global DB identity dictionaries `card_unique_infos` and
  `card_unique_info_set_relations`, using the typed skill-causality joins for
  team, rotation and enemy scopes. Runtime matching no longer depends on
  localized display-name substring checks. Exact-name clauses prefer the
  narrowest unique official set, `includes` clauses prefer the broadest unique
  official set, and ambiguous or absent bindings fail closed.
- The official Goku identity set used by clauses such as `name includes Goku
  (Youth, Captain Ginyu, Jr., etc. excluded)` contains 98 canonical identities
  and includes canonical Goku ID `3`, while excluding Goku (Youth) `84`, Ginyu
  (Goku) `235`, Goku Black `305` and Goku Jr. `332`. The exact-Goku contract
  used by Piccolo Jr. is a separate official set with six canonical identities.
  Android receives these canonical IDs in the wire model and resolves every
  selected team member to its canonical identity before evaluation; old cached
  name predicates without this contract remain safely unavailable.
- A full audit found 348 emitted name predicates: 347 carry an official
  identity binding. The sole unbound predicate is Fasha EZA's Bardock clause,
  where the first-party causality scope conflicts with the localized condition;
  it deliberately remains fail-closed instead of selecting one source by
  assumption.
- Against the same 2,288 official Global states, the artifact contains 9,544
  supported, 2,110 partial and 57 unknown passive rules. The jointly validated
  local candidate is Team Analysis
  `2026-08-23T17:34:24.129Z:parser-1.9.8`, SHA-256
  `49e333e675d85b30feb3fb58d882220f4d4d0fc2443d2c09666595d663154426`,
  2,979,467 compressed bytes and 54,430,390 uncompressed bytes. It is bound to
  Characters version `2026-08-23T17:34:24.129Z`, payload SHA
  `469e9df38f8ae35521bc4fca1324a5b47391ada2b0c0b79cdc34ea44d8d605cb`.
- TypeScript compilation and 371 focused parser/export tests passed. The 55
  focused Android wire/evaluator tests and the Android debug assembly passed.
  The Android Studio emulator validated and loaded the exact local payload,
  showed the preserved DAIMA draft at `45 Active`, `0 Inactive`, `0 Needs
  info`, and retained draft SHA
  `cfbed0b1595df46a9c643c36d7ec6ad48612f8f8cf22570baaaa646918a9cf6d`.
  The public R2 manifest remains parser `1.9.0`; no R2 dry-run, upload, Git
  commit or push was authorized by this checkpoint.

## Team passive official runtime and scaling checkpoint (2026-08-23)

- Local Team Analysis parser `1.9.9` treats the compiled first-party Global DB
  causality as the authority for runtime identity and scope. A uniquely matched
  first-party ally-name binding may therefore reconcile localized wording
  across team and rotation scopes, while ambiguity or an enemy/ally boundary
  still fails closed. Fasha EZA's displayed Bardock wording is preserved, but
  its official identity set and rotation scope now drive evaluation.
- Runtime predicates now cover guard activation, own or allied Revival,
  activated or unactivated Finish Effects, named Domains, character K.O. and
  incoming Super Attacks. Additional typed scaling covers turns passed,
  existing enemies, final attack Ki and non-Type Ki Spheres; exact repeated
  combat thresholds, start-of-turn slot clauses and the remaining safe direct
  name/category variants are also retained. Malformed or semantically
  incomplete source fragments remain partial or unknown rather than receiving
  inferred behavior.
- Android maps the new wire contracts without changing old-cache tolerance.
  `After guard is activated` is evaluated as a dependency on another passive
  rule that actually grants guard: unconditional guard is available, a
  composition-gated guard inherits its team result, circular self-dependencies
  are ignored, and guard with no provable passive source remains contextual
  rather than being falsely rejected. The Team Builder continues to present
  runtime-reachable clauses as availability instead of pretending to know a
  live battle value.
- Across the same 2,288 official Global states, supported passive rules moved
  from 9,544 to 9,830, partial rules from 2,110 to 1,840 and unknown rules from
  57 to 41. Supported conditions moved from 11,129 to 11,469, partial
  conditions from 154 to 69 and unknown conditions from 428 to 173. The
  remaining unknowns are primarily malformed source fragments or causal
  families that still lack a safe typed contract.
- The jointly validated local candidate is Characters
  `2026-08-23T18:40:00.672Z`, SHA-256
  `469e9df38f8ae35521bc4fca1324a5b47391ada2b0c0b79cdc34ea44d8d605cb`,
  2,342,759 compressed bytes and 1,436 characters, plus Team Analysis
  `2026-08-23T18:40:00.672Z:parser-1.9.9`, SHA-256
  `873e7306b77bb33ed88b365c0f1151f0c696ae78acd230e51c8fd52ad48dae27`,
  2,988,074 compressed bytes, 54,583,462 uncompressed bytes and 2,288 states.
- TypeScript compilation and 373 parser/export/candidate tests, focused Android
  wire/evaluator and presentation tests, Android debug assembly and joint
  delivery validation passed. The Android Studio emulator rebuilt the exact
  local Characters version, validated Team Analysis and displayed the
  preserved DAIMA draft at `45 Active`, `0 Inactive`, `0 Needs info`; all seven
  entries report full counts (`7/7`, `5/5`, `6/6`, `5/5`, `6/6`, `9/9`,
  `7/7`). Draft SHA remains
  `cfbed0b1595df46a9c643c36d7ec6ad48612f8f8cf22570baaaa646918a9cf6d`.
  The public R2 manifest remains parser `1.9.0`; no R2 dry-run, upload, Git
  commit or push was authorized by this checkpoint.

## Team passive universal-composition checkpoint (2026-08-23)

- Local Team Analysis parser `1.9.10` adds explicit contracts for conditions
  that are fully decidable from the selected team: the current character is
  the only member of a named category, every selected member belongs to either
  of two named categories, and every selected member belongs to a named
  category or class. The category-or-class contract is evaluated per member;
  it cannot be satisfied by counting unrelated category and class groups.
- Entrance conditions with a named enemy category or another same-category
  rotation ally are represented as a typed alternative. The composition side
  can prove the ally branch, while the enemy branch remains runtime-reachable;
  no localized text heuristic was added to Android.
- Across the same 2,288 official Global states, supported passive rules moved
  from 9,830 to 9,848 and partial rules from 1,840 to 1,822. Supported
  conditions moved from 11,469 to 11,489, partial conditions from 69 to 64 and
  unknown conditions from 173 to 158. The artifact contains six typed
  self-category predicates and five universal category-or-class predicates.
- The jointly validated local candidate is Team Analysis
  `2026-08-23T19:31:37.713Z:parser-1.9.10`, SHA-256
  `434b2a0e2fddae43e252b3b13fcd0ba99780ad5c48db251d158d148cb6a78723`,
  2,988,607 compressed bytes, 54,591,101 uncompressed bytes and 2,288 states.
  It is bound to Characters version `2026-08-23T19:31:37.713Z`, payload SHA
  `469e9df38f8ae35521bc4fca1324a5b47391ada2b0c0b79cdc34ea44d8d605cb`,
  2,342,759 compressed bytes and 1,436 characters.
- TypeScript compilation and 378 parser/identity/candidate tests, focused
  Android wire/evaluator tests, Android debug assembly and joint delivery
  validation passed. The Android Studio emulator rematerialized Characters and
  accepted the exact Team Analysis gzip; the saved draft remained byte-stable
  at SHA
  `cfbed0b1595df46a9c643c36d7ec6ad48612f8f8cf22570baaaa646918a9cf6d`.
  The public R2 manifest remains parser `1.9.0`; no R2 dry-run, upload, Git
  commit or push was authorized by this checkpoint.

## Team passive first-party enemy-status checkpoint (2026-08-23)

- Local Team Analysis parser `1.9.11` preserves the official Global DB
  `passiveImg` status markers as typed first-party evidence instead of losing
  them during text projection. ATK Down, DEF Down, stun and Super Attack seal
  now survive as `enemy_status` predicates, including conditions embedded in
  an effect line and compound HP/Ki alternatives. No Dokkan.fyi or DokkanInfo
  scraping was introduced.
- Kyawei EZA now yields two supported condition groups: 12 or more Ki plus
  ATK Down/DEF Down/Super Attack sealed, and 12 or more Ki plus stun. Its typed
  effects retain DEF/effective-against-all-Types and critical/additional Super
  Attack respectively. Yakon's HP-or-enemy-status condition and Krillin
  (Youth)'s sealed-enemy condition are also represented without empty marker
  text. Across 2,288 states, the artifact contains 9,871 supported, 1,800
  partial and 40 unknown passive rules.
- Character Details and Team Analysis share the same typed presentation:
  explicit condition wording, local status icons with accessible text labels,
  visible `or`/`and` connectors, and typed effect reconstruction that removes
  residues such as `status: , or` without mutating the raw source. Percent and
  effect emphasis continue to use the established passive presentation.
- The jointly validated local candidate is Characters
  `2026-08-23T20:26:24.615Z`, SHA-256
  `578fe9ca44dafb9037ce35e3b88a57f12d315fd5ab39ba91837023f39eca6d53`,
  2,343,298 compressed bytes, 28,940,068 uncompressed bytes and 1,436
  characters, plus Team Analysis
  `2026-08-23T20:26:24.615Z:parser-1.9.11`, SHA-256
  `013cd5ce9e903040ee745bad53ba4480eef96ed4cae809d7b6c08b4b2fa9b125`,
  2,990,889 compressed bytes, 54,608,701 uncompressed bytes and 2,288 states.
- TypeScript compilation and 387 focused parser/projection tests passed, as
  did the focused Android presentation tests and debug assembly. The clean APK
  and exact local candidate were installed on `emulator-5554`; Kyawei EZA was
  visually verified with explicit status groups and no empty marker residue.
  The saved draft remained byte-stable at SHA
  `cfbed0b1595df46a9c643c36d7ec6ad48612f8f8cf22570baaaa646918a9cf6d`.
  Public R2 remains parser `1.9.0`; no R2 dry-run/upload, commit or push was
  authorized for this checkpoint.

## Team passive residual-condition mapping checkpoint (2026-08-23)

- Parser `1.9.12` audits every non-supported passive condition against the
  exact first-party Global candidate rather than relying on manual character
  sampling. It fixes logical line boundaries before adding semantics: a
  lowercase inline condition remains attached to its effect, while a complete
  condition followed by a new real header is separated. This removes false
  combinations such as Dr. Wheelo's target HP clause being attached to the
  following enemy-count block.
- Existing typed contracts now cover first/ordinal/repeated attack events,
  parenthesized attack counters, combined performed/received histories,
  final-blow timing, after-attack Ki, Ultra/Unit/styled Super Attack variants,
  ally-or-enemy name alternatives, ally-only Revival, qualified Ki plus team
  gates, HP-at-start plus received-attack history, mixed Type/Rainbow Ki
  Spheres, excluded Type Ki Spheres and counted rotation names. Enemy Super
  Attacks launched at the character and Super Attacks performed at a required
  Ki value are represented as typed per-event scaling rather than fake
  conditions.
- Across 11,693 passive rules, supported conditions moved from 11,515 to
  11,624, partial conditions from 55 to 40 and unknown conditions from 141 to
  29. Supported/partial/unknown rules are now 9,943 / 1,744 / 6. The 69
  remaining non-supported condition instances are explicitly inventoried:
  delayed next-attacking-turn lifecycle gates; special or comparative Ki
  Sphere semantics; all-rotation collection state; transformation completion;
  individually qualified multi-name selectors; and malformed or truncated
  source/projection fragments. They remain fail-closed instead of receiving
  inferred behavior.
- The validated local Team Analysis candidate is
  `2026-08-23T20:26:24.615Z:parser-1.9.12`, SHA-256
  `e80954bf4f6c953307f75ba278cc2319e88995670039cfefeaec03fe8784b954`,
  2,994,258 compressed bytes, 54,720,077 uncompressed bytes and 2,288 states.
  It remains bound to Characters SHA-256
  `578fe9ca44dafb9037ce35e3b88a57f12d315fd5ab39ba91837023f39eca6d53`.
  TypeScript compilation and 402 focused parser/projection/candidate tests
  passed. No Android wire change was required because this slice uses existing
  typed contracts; public R2 remains parser `1.9.0`, and no upload, commit or
  push of this new slice was authorized.

## Team passive complete-condition contract checkpoint (2026-08-23)

- Parser `1.9.13` completes the residual condition inventory against the same
  first-party Global candidate. Typed contracts now retain next-attacking-turn
  event gates, all-rotation Ki Sphere collection, Giant Form completion,
  Sweet Treat Ki Spheres, comparative/per-Type Ki Sphere scaling, shared
  counted Category alternatives, mixed name/Category alternatives and the
  remaining exact temporal/combat combinations. A standalone personality
  switch is preserved as an action fragment instead of being misclassified as
  a condition.
- The full candidate contains 11,691 passive conditions: 11,691 supported,
  zero partial and zero unknown. This closes passive-condition parsing without
  claiming complete calculation support for every passive effect: rule status
  is 10,000 supported, 1,691 partial and zero unknown, while effect status is
  10,000 supported, 1,011 partial and 680 unknown. The distinction is
  intentional and keeps unsupported effect math fail-closed.
- A separate runtime-availability audit found 41 states whose passive refers
  to Active Skill activation: Gohan (Beast) has a supported first-party
  activation tree, both Ultimate Gohan states retain one partial enemy-count
  branch, and 38 states still lack a first-party activation tree because their
  cards were not part of the selected character overlay. These can still cause
  `Condition data missing` and are the next Team Builder data-contract slice;
  they are not hidden by the zero passive-parser residual count. Separately,
  52 Unit Super Attack condition records still preserve raw activation text
  without a typed condition tree.
- Android wire/domain contracts accept the new predicate kinds, evaluation
  moments, combat-relative timings, Sweet Treat Ki Spheres and Ki Sphere
  scaling selectors. The Team Builder continues to collapse live-battle facts
  into `Available with this team`, while composition requirements can still be
  rejected and incomplete contracts remain distinguishable from availability.
- The validated local Team Analysis candidate is
  `2026-08-23T20:26:24.615Z:parser-1.9.13`, SHA-256
  `69bb7a946ea40d8fceb6dbee1eee74b87a165c506a78475ad14eb6ce19f4a472`,
  2,998,882 compressed bytes, 54,798,703 uncompressed bytes and 2,288 states.
  It remains bound to Characters SHA-256
  `578fe9ca44dafb9037ce35e3b88a57f12d315fd5ab39ba91837023f39eca6d53`.
  TypeScript compilation and 403 focused parser/projection/candidate tests,
  focused Android wire/evaluator tests and Android app debug compilation
  passed. Public R2 remains parser `1.9.0`; no R2 dry-run/upload, commit or push
  of this slice was authorized.

## Team passive Active Skill causality checkpoint (2026-08-23)

- Parser `1.9.14` builds a catalog-wide Active Skill activation contract
  directly from first-party Global `card_active_skills`, `active_skill_sets`,
  `skill_causalities` and `card_categories`. The contract is keyed by the exact
  DB card/form id and is injected into Team Analysis without modifying or
  broadening the explicitly selected Characters overlay. Cards with multiple
  semantically different activation trees remain omitted rather than having a
  branch guessed.
- The previous Ultimate Gohan-only exception was removed. General typed
  causality covers battle and entry turns, HP, enemy count/HP, team or rotation
  Category/Class counts, all-team Category/Class requirements, performed,
  received and evaded attack histories, Revival, next-attacking-turn timing
  and first-party runtime gates. Unsupported causality types remain unknown;
  a weaker DB tree cannot replace a better condition already carried by the
  Characters payload.
- The first-party snapshot yields 586 unambiguous form bindings: 520 supported
  and 66 unknown. Every state whose passive actually refers to Active Skill
  activation is covered: 41/41 states have supported trees and zero unsupported
  leaves, including both Ultimate Gohan release states and the recent DAIMA
  cards. Composition requirements can now evaluate as available/unavailable;
  live battle predicates remain available-in-principle in the Team Builder.
- Android wire/domain models decode the generalized causal vocabulary and
  preserve old-cache tolerance. A runtime gate is typed separately from data
  absence, so it cannot regress into `Condition data missing` merely because
  the live battle has not happened yet.
- The validated local Team Analysis candidate is
  `2026-08-23T20:26:24.615Z:parser-1.9.14`, SHA-256
  `0f9e3c74e96119d43388852fa3d5d0b48b53b3e5bd5c251b60c941c848a805b7`,
  3,077,757 compressed bytes, 55,433,108 uncompressed bytes and 2,288 states.
  It remains bound to Characters SHA-256
  `578fe9ca44dafb9037ce35e3b88a57f12d315fd5ab39ba91837023f39eca6d53`.
  TypeScript compilation and 416 focused parser/contract/candidate tests,
  focused Android wire/evaluator tests and Android app debug compilation
  passed. Public R2 remains parser `1.9.0`; no R2 dry-run/upload, commit or push
  of this slice was authorized.

## Dataset staging-channel foundation checkpoint (2026-08-23)

- Characters and Team Analysis publishers now accept only the typed
  `production` or `staging` channel. Production keeps the existing root
  manifests and payload namespaces; staging uses `staging/` manifests,
  content-addressed payload namespaces and independent ignored state files.
  A real remote production write additionally requires the explicit
  `--promote-production` flag. Staging Character publication refuses to touch
  non-channel-scoped portraits and therefore requires `--skip-portraits`.
- Android release builds are hard-coded to the production manifest object
  keys. Debug builds remain production by default and may opt into staging
  only with `-PdebugDatasetChannel=staging`. Character and Team Analysis
  managers allowlist those two manifest paths, retain their existing local
  cache names, and accept the corresponding staging payload namespace without
  weakening host, traversal, size, SHA or exact cross-dataset compatibility
  checks.
- Publisher compilation and 50 focused delivery tests passed. Android focused
  Character/Team Analysis manager tests and debug compilation passed. Generated
  BuildConfig evidence proved that the same staging property produces staging
  paths for debug while release still contains production paths.
- Read-only remote dry-runs found no existing staging manifests. The Characters
  candidate would add 2,343,751 managed bytes with zero portrait mutations;
  Team Analysis parser `1.9.14` would add 3,078,468 managed bytes. Wrangler
  reported the bucket as 383 MB, yielding conservative projected upper bounds
  of 386,343,751 and 387,078,468 bytes for the individual plans. No R2 object,
  manifest, local publish state or production endpoint was changed.
- The scraper checkpoint through `481eaac` is pushed to `origin/main`. This
  staging foundation is captured as separate scraper and Android checkpoints.
  The first staging publication using that foundation is recorded below;
  production remains isolated from it.

## First remote staging publication checkpoint (2026-08-23)

- The staging-only compatible pair is now public without changing either
  production manifest:
  - Characters `2026-08-23T20:26:24.615Z`, 1,436 characters, payload
    2,343,298 bytes, SHA-256
    `578fe9ca44dafb9037ce35e3b88a57f12d315fd5ab39ba91837023f39eca6d53`;
  - Team Analysis `2026-08-23T20:26:24.615Z:parser-1.9.14`, 2,288 states,
    payload 3,077,757 bytes, SHA-256
    `0f9e3c74e96119d43388852fa3d5d0b48b53b3e5bd5c251b60c941c848a805b7`.
- Public no-cache verification returned `200`, `application/json` and
  `Cache-Control: no-store` for both staging manifests. Both public gzip sizes
  and hashes matched their manifests exactly. Team Analysis references the
  exact staging Character version and payload SHA.
- The pre-upload dry-runs projected 5,422,219 combined new managed bytes, no
  cleanup and no portrait upload or deletion. All planned remote keys were
  under `staging/`.
- The first Team Analysis post-upload read through Wrangler briefly reported
  the new payload as missing. The publisher failed closed before writing its
  manifest. The object was already available through the public domain and
  became readable through Wrangler shortly afterward with the exact local size
  and SHA; rerunning the publisher then promoted and verified the manifest.
  Add bounded retry/backoff to immutable payload verification before the next
  publisher change so a transient read-after-write miss does not require a
  manual rerun.
- Public production remains Characters `2026-08-22T21:14:10.019Z` with SHA
  `34b2ce3918d0497b458f106f4e00b50cb039f0a280ef6bfe45c0ca76ee1a84bd`
  and Team Analysis parser `1.9.0` with SHA
  `d7a8461c41484b0e25f61131476006b18eadad71c6bac265e7f0e289e7a96237`.
- Next: build/install a debug APK with `-PdebugDatasetChannel=staging`, verify
  initial download, compatible Team Analysis activation, cached restart and
  production/debug coexistence before considering any promotion.

## Consumer contract-lane decision checkpoint (2026-08-23)

- ADR-0007 makes the existing root production manifests the durable `v1`
  consumer lane for Android 2.0.8. The next breaking Android/data contract uses
  explicit `v2/` manifests; staging mirrors them as `staging/v1/` and
  `staging/v2/`. The currently published unversioned staging pair must not be
  promoted directly to the production root.
- One official-DB import and canonical model feed lane-specific projectors. The
  v1 projector keeps new characters available to old installations while
  omitting or degrading unsupported enrichment to its existing partial/unknown
  boundary. Characters and Team Analysis remain exact version/SHA-compatible
  pairs within each lane.
- Compatibility must be proved against a frozen Android 2.0.8 consumer contract
  and a minified staging smoke. Retaining the same parser, rules or schema label
  is not sufficient evidence by itself.
- Android In-App Updates is a product backlog item that can reduce delayed app
  adoption but cannot guarantee it. Contract lanes remain the fail-safe for
  declined updates, offline devices, unsupported Play flows and sideloaded
  builds. The feature is documented in the Android repository and requires
  Intent + Impeccable review before UI implementation.
- Next implementation order: freeze the v1 contract, audit parser `1.9.14`
  against it, add typed lane-scoped publisher keys/state, add v1/v2 projectors,
  then wire the next Android release to v2. No production manifest changes are
  authorized by this decision.

## Android 2.0.8/v1 static compatibility audit checkpoint (2026-08-23)

- The complete public production and staging corpora were compared against the
  Android `6ac55fe` manifest reader, wire DTOs, enum fallbacks, payload limits
  and minified keep rules. No common JSON path changes type. Characters removes
  no production path and adds only 44 descendants of the optional Active Skill
  activation condition on cards `1025561` and `1034341`; the old Gson consumer
  ignores those fields.
- Team Analysis staging remains inside every 2.0.8 manifest limit and introduces
  no identified hard deserialization or R8 failure. Its 199 new paths are
  optional, while new string discriminators map to old `UNKNOWN` fallbacks.
  This makes a hard startup failure unlikely but does not make the contract
  semantically compatible.
- Android 2.0.8 ignores the new Active Skill activation conditions on 343 Team
  Analysis states. Stable-rule comparison found 810 old-unknown rules that the
  new corpus improves, 437 that remain outside the old model and 314 newly using
  at least one construct absent from it. The user-visible condition boundary is
  88 newly unsupported predicate rules across 66 states; new effect scaling,
  per-turn triggers and timing values also degrade to old `UNKNOWN` models.
- The unprojected staging pair remains a v2 candidate and must not be promoted
  to root v1. The minimal v1 projector removes Active Skill activation
  conditions, explicitly downgrades unsupported predicates/scaling/triggers
  while preserving source text, and retains required v1 shapes. A frozen full-
  corpus 2.0.8 decoder and minified staging smoke remain mandatory before the
  first legacy refresh.
- Detailed evidence and counts are in
  `docs/specs/android-2.0.8-contract-v1-audit.md`. Next: implement the frozen v1
  consumer harness before changing publisher lane keys or generating v1 bytes.

## Android 2.0.8/v1 executable consumer checkpoint (2026-08-23)

- Android now owns an isolated executable harness at
  `scripts/compat/android-v1-6ac55fe/`. The runner verifies the full commit
  `6ac55fe20872d8c3ee1678d4e34fc010243ebb51`, archives that exact snapshot into
  an ignored temporary directory, injects one corpus test, and executes only
  the frozen `domain` consumer. Current Android decoder code is not compiled by
  this gate.
- The Character path uses the frozen `RoomCharacterDatabaseGateway.openPayload`
  implementation, including complete Gson seed decoding, count/ID validation,
  Character and Transformation materialization, normalization and derived
  leader-boost work. Team Analysis uses the frozen payload validator followed
  by full ordinal loading and wire-to-domain conversion for every state.
- The public production pair passed: Characters
  `2026-08-22T21:14:10.019Z`, 1,436 characters, SHA
  `34b2ce3918d0497b458f106f4e00b50cb039f0a280ef6bfe45c0ca76ee1a84bd`;
  Team Analysis parser `1.9.0`, 2,288 states, 11,694 passive rules, 2,703 Super
  Attacks, SHA
  `d7a8461c41484b0e25f61131476006b18eadad71c6bac265e7f0e289e7a96237`.
- The unprojected staging pair also decoded completely: Characters
  `2026-08-23T20:26:24.615Z`, 1,436 characters, SHA
  `578fe9ca44dafb9037ce35e3b88a57f12d315fd5ab39ba91837023f39eca6d53`;
  Team Analysis parser `1.9.14`, 2,288 states, 11,691 passive rules, 2,703
  Super Attacks, SHA
  `0f9e3c74e96119d43388852fa3d5d0b48b53b3e5bd5c251b60c941c848a805b7`.
- This closes the non-minified full-corpus decoder gate only. Parser `1.9.14`
  remains a v2 candidate because unsupported v1 semantics still require a
  projector. The harness does not exercise the old private production URL/key
  validator against staging-prefixed transport paths. Exact manager/cache
  integration and an R8-minified APK smoke remain required before any root-v1
  promotion.
- No publisher, lane key, production manifest or R2 object changed. Next:
  specify and implement the minimal typed v1 projector before altering publisher
  routing; run its output through this harness, then the minified smoke.

## Android 2.0.8/v1 typed projector checkpoint (2026-08-24)

- The scraper now contains a local-only compatibility serializer for the exact
  Android `6ac55fe20872d8c3ee1678d4e34fc010243ebb51` contract. It consumes an
  explicitly supplied canonical Character/Team pair, validates every manifest,
  payload hash/size/count and cross-dataset binding, and writes only to a fresh
  local directory. It has no publisher, R2 or network path.
- Character projection omits the v2 Active Skill activation-condition block at
  top-level, EZA and transformation nesting. Team Analysis omits its state-level
  counterpart, converts v2-only condition leaves/enum values to v1 `unknown`
  with source text, converts unsupported scaling and application-trigger
  discriminators to their old unknown representations, preserves supported
  siblings/composite structure and recalculates passive-rule status totals.
- Projecting the public staging `1.9.14` corpus omitted 2 Character and 343 Team
  Active Skill conditions, downgraded 214 condition nodes, 765 scalings and 210
  per-turn triggers. The local v1 pair is Characters SHA
  `039a87def97b0f0772301cb5ca8779370d3c9176a5b040aadd50a7844521ec25`
  (2,342,681 bytes) plus Team Analysis SHA
  `61b90af9f9a254f915844b185e43482c945f060fc2ff4cdc4377bc32b72c327e`
  (2,970,224 bytes), with exact projected Character-SHA binding.
- Four focused projector tests passed. The frozen 2.0.8 consumer then decoded
  and materialized all projected bytes: 1,436 Characters, 2,288 states, 11,691
  passive rules and 2,703 Super Attacks. This closes the non-minified projector
  gate without changing any publisher, object key, R2 object or production
  manifest.
- Remaining before a first root-v1 refresh: exercise these projected bytes via
  the archived R8-minified 2.0.8 manager/cache path, then add and separately
  verify typed publisher lane routing. No production publication is authorized.

## Android 2.0.8/v1 minified consumer checkpoint (2026-08-24)

- Android now owns a second isolated harness at
  `scripts/compat/android-v1-6ac55fe-minified/`. It archives the exact
  `6ac55fe20872d8c3ee1678d4e34fc010243ebb51` source, creates a debug-signed
  `compatV1` app ID that inherits release shrinking/optimization, requires a
  non-empty R8 mapping and forces the dataset base URL blank.
- The generated Activity is compiled into the minified main APK. It seeds the
  exact projected pair into the real legacy cache layouts, executes
  `DatabaseBootstrapper`, queries the rebuilt Room Character repository,
  refreshes `TeamAnalysisRepository` and requests every state key through the
  minified Team Analysis mapper. The isolated package is removed after success
  and does not touch the production app's data.
- The R8 smoke passed on `emulator-5554`: 1,436 Characters, 2,288 Team Analysis
  states, 11,691 passive rules and 2,703 Super Attacks. It verified projected
  Character SHA
  `039a87def97b0f0772301cb5ca8779370d3c9176a5b040aadd50a7844521ec25`
  and Team SHA
  `61b90af9f9a254f915844b185e43482c945f060fc2ff4cdc4377bc32b72c327e`.
- The local projector remains publisher-neutral. The smoke changes only copied
  manifest `fileName` fields to the root-v1 content-addressed format already
  required by Android 2.0.8; payload bytes and all integrity/pairing fields are
  unchanged. This exposed and documented the transport constraint that the v1
  publisher must satisfy.
- This closes the frozen non-minified and R8-minified consumer gates. Remaining:
  implement typed root-v1/staging-v1 publisher routing, validate it locally and
  run the mandatory byte-report dry-run. No publisher, R2 object or production
  manifest changed, and no publication is authorized.

## Android 2.0.8/v1 typed publisher dry-run checkpoint (2026-08-24)

- Characters and Team Analysis publishers now require an explicit typed
  contract lane. Production v1 preserves the existing root keys; production v2,
  staging v1 and staging v2 route to `v2/`, `staging/v1/` and `staging/v2/`.
  Default state files are lane-scoped while the existing root-v1 production
  state path remains compatible with its historical state.
- A v1 plan is fail-closed without the projector report. The publishers match
  its version, frozen `6ac55fe20872d8c3ee1678d4e34fc010243ebb51` consumer,
  exact output manifests and Character/Team SHA binding. Canonical v2 delivery
  retains its strict current semantic validator; projected v1 delivery uses the
  projector's bounded v1-shape assertions plus the same gzip, metadata, hash,
  size, count, identity and pairing checks.
- Fifty-seven focused projector/proof/publisher tests passed. The tracked
  `lib/` output was rebuilt from the changed TypeScript sources.
- Read-only remote dry-runs planned only `staging/v1` keys. Characters would add
  2,343,137 bytes and Team Analysis 2,970,938 bytes, 5,314,075 bytes combined.
  Wrangler reported `388 MB`; the combined conservative upper bound is
  394,314,075/10,000,000,000 bytes.
- No R2 object, manifest, local publisher state or input artifact changed. The
  next separately authorized gate is an actual paired `staging/v1` publication,
  followed by public no-store/hash verification and the frozen minified
  consumer over downloaded bytes. Production remains untouched.

## Android 2.0.8/v1 staging publication checkpoint (2026-08-24)

- The projected pair was published only to `staging/v1`. Characters is version
  `2026-08-23T20:26:24.615Z`, 2,342,681 bytes, SHA
  `039a87def97b0f0772301cb5ca8779370d3c9176a5b040aadd50a7844521ec25`.
  Team Analysis is version `2026-08-23T20:26:24.615Z:parser-1.9.14`,
  2,970,224 bytes, SHA
  `61b90af9f9a254f915844b185e43482c945f060fc2ff4cdc4377bc32b72c327e`.
  Its source Character version and SHA match the published Character manifest
  exactly.
- Public HTTP verification returned `Cache-Control: no-store` for both
  manifests and `public, max-age=31536000, immutable` for both payloads. The
  downloaded sizes and SHA-256 values match the manifests exactly. A final
  publisher dry-run is idempotent: no Character upload, no Team payload or
  manifest update, and no planned writes.
- The frozen R8-minified Android `6ac55fe` manager/cache harness passed on
  `emulator-5554` with the payload bytes downloaded from R2: 1,436 Characters,
  2,288 states, 11,691 passive rules and 2,703 Super Attacks. The later public
  HTTP downloads were byte-identical by SHA-256.
- Wrangler 4.118.0 twice returned `Upload complete` for the Team payload while
  subsequent Wrangler and public reads proved the object absent. The publisher
  failed closed before manifest promotion. Wrangler 4.125.0 stored the same
  immutable bytes correctly and made them immediately readable; the dependency
  and lockfile are now updated to `^4.125.0`.
- Production remains Characters SHA
  `34b2ce3918d0497b458f106f4e00b50cb039f0a280ef6bfe45c0ca76ee1a84bd`
  and Team Analysis SHA
  `d7a8461c41484b0e25f61131476006b18eadad71c6bac265e7f0e289e7a96237`.
  The older unversioned staging pair also remains unchanged at Characters SHA
  `578fe9ca44dafb9037ce35e3b88a57f12d315fd5ab39ba91837023f39eca6d53`
  and Team SHA
  `0f9e3c74e96119d43388852fa3d5d0b48b53b3e5bd5c251b60c941c848a805b7`.
  No production or v2 object was written.

## Android v2 staging lane end-to-end checkpoint (2026-08-24)

- The canonical pair is public only under `staging/v2`. Characters is version
  `2026-08-23T20:26:24.615Z`, 1,436 characters, 2,343,298 bytes and SHA-256
  `578fe9ca44dafb9037ce35e3b88a57f12d315fd5ab39ba91837023f39eca6d53`.
  Team Analysis is version `2026-08-23T20:26:24.615Z:parser-1.9.14`, 2,288
  states, 3,077,757 bytes and SHA-256
  `0f9e3c74e96119d43388852fa3d5d0b48b53b3e5bd5c251b60c941c848a805b7`.
  Its Character version/SHA binding is exact.
- The mandatory dry-run projected 5,422,225 new managed bytes. Wrangler
  reported a 394 MB bucket, giving a conservative combined upper bound of
  399,422,225/10,000,000,000 bytes. Both manifests and payloads were then
  verified publicly for exact name, size and SHA; manifests use `no-store` and
  payloads use immutable one-year caching. Final dry-runs were idempotent.
- Android now has one typed route for production/staging and v1/v2. A manifest
  and its payload must remain within the same route. Debug defaults to
  production/v1 and can explicitly select staging/v2; the next release build
  is explicitly wired to production/v2. Compatible local caches remain
  contract-neutral so an upgraded app can start offline, while an online v2
  refresh remains authoritative and replaces the old cache only after complete
  validation.
- Focused Character and Team Analysis manager tests passed, including all route
  combinations, cross-lane rejection and legacy-cache offline/online migration.
  Debug and R8-minified release builds passed; generated BuildConfig evidence
  showed `staging/v2` for the selected debug build and `production/v2` for
  release. The release mapping was non-empty. The release workflow now runs a
  read-only public production-v2 preflight before its signed build job; it
  verifies both manifests, same-lane payloads, exact byte hashes/sizes,
  Character/Team binding and cache headers. Until production v2 exists, the
  workflow intentionally fails before producing a release artifact.
- A clean staging/v2 debug install on `emulator-5554` downloaded and stored the
  exact pair, rebuilt the Character database and activated Team Analysis. A
  cached restart passed. An airplane-mode restart retained the catalog and
  validated Team Analysis from cache while showing the expected non-blocking
  update warning; networking was restored afterward.
- Team Analysis publication now retries only post-upload exact-read
  verification within a bounded 30-second window. It still requires exact size
  and SHA-256, promotes the manifest only after verified payload readiness, and
  writes local state/starts cleanup only after the manifest itself verifies.
  Real remote writes now reject both legacy skip-verification flags; they remain
  available only for local or read-only dry-run diagnostics. Forty-two focused
  publisher tests cover delayed payload/manifest visibility, retry exhaustion
  and remote bypass rejection; tracked `lib/` matches the TypeScript. Four
  focused release-preflight tests passed, and the same script verified the
  complete public staging-v2 pair.
- Production remains unchanged at Characters SHA
  `34b2ce3918d0497b458f106f4e00b50cb039f0a280ef6bfe45c0ca76ee1a84bd`
  and Team Analysis SHA
  `d7a8461c41484b0e25f61131476006b18eadad71c6bac265e7f0e289e7a96237`.
  No v2 production manifest exists or was written. The Android v2 routing and
  publisher retry changes remain local checkpoints pending a separate commit
  request.

## Team lifecycle management checkpoint (2026-08-24)

- The Team Builder now distinguishes New team, Save as new team and Update
  saved team before writing. The compact command bar retains its previous
  height and three visible icon targets; Share current team and the lifecycle
  commands live in a labelled overflow instead of adding more fixed chrome.
- Starting a new team preserves every saved snapshot, clears the active saved
  identity and resets the draft only after persistence succeeds. Unsaved work
  receives an explicit confirmation; a clean saved snapshot can start a new
  draft directly. Failure paths keep or restore the prior active identity.
- Remove all characters clears owned and Friend members without deleting the
  saved record or resetting Basic/Rotations and its rotation plan. The existing
  dismissible snackbar provides Undo using the exact applied/previous draft
  guard.
- Focused ViewModel tests passed, Android instrumented-test compilation passed,
  and all five new Compose lifecycle cases passed on `emulator-5554`. The full
  57-case Builder class completed 55 cases and exposed two older layout tests
  outside this slice that could not locate below-header content; one reproduced
  in isolation and remains separate test-debt evidence.
- The debug build was installed and visually inspected on the Android Studio
  emulator. The user approved the Intent + Impeccable result. No commit, push,
  R2 object or production endpoint changed. The next recommended Team Builder
  slice is the candidate-picker discovery foundation.

## Team candidate-picker discovery checkpoint (2026-08-24)

- The Team Builder candidate picker now exposes a typed, combinable discovery
  contract for full Leader/Friend coverage, categories with Any/All matching,
  type, class, rarity and BASE/EZA/SEZA release state. Dimensions combine with
  AND, selected values within ordinary dimensions use OR, partial coverage does
  not satisfy a full-coverage filter, and category options come from the loaded
  catalog rather than text parsing.
- Hard duplicates are excluded by default and restored fail-soft as an explicit
  opt-in independent from the main filter value. Each fresh picker defaults
  full coverage to the resolved Leader and/or Friend roles currently present;
  neither coverage constraint is applied when neither role is available.
  Applied-filter state is consolidated in the fixed Filters entry and its sheet
  instead of occupying a second removable-chip row above the results. A compact
  Clear filters action remains directly available beside the result count when
  any filter or hard-copy override is active. Sorting is one mutually exclusive
  segmented control rather than three independent filter-like pills. Clear all,
  Clear search and dedicated zero-result recovery remain distinct actions.
- Search and sort chrome now collapse while the user browses results and do not
  reopen on a small reverse scroll away from the absolute top. A Back to top
  action returns the list and header together. The title, target role and filter
  entry remain available while the result chrome is collapsed.
- Candidates can be inspected through View details without selecting them or
  closing the picker. Returning preserves the draft, target slot, filters,
  query, sort and list state. Ranking semantics themselves remain unchanged and
  are intentionally a later slice.
- Seventy-four focused ViewModel tests and five focused Compose picker tests
  passed on `emulator-5554`. Debug and Android-test Kotlin compilation passed,
  the final debug APK installed successfully, and the filter sheet,
  absolute-top collapse behavior, Back to top and detail-return flow were
  inspected in the running staging/v2 debug app. The subsequent consolidated
  filter layout was also inspected at compact width; a resolved Leader opened
  the next-slot picker with only Leader coverage selected and no redundant
  active-chip row. Unit fixtures cover the resolved Leader + Friend, Leader
  only, Friend only and neither-role defaults. The older 200%-font
  below-header Builder test debt recorded in the previous checkpoint remains
  separate and was not introduced here.
- Intent + Impeccable guided the hierarchy, copy and accent restraint. Final
  user visual acceptance is pending. No commit, push, R2 object, publisher or
  production endpoint changed.

## Team Analysis identity/status staging checkpoint (2026-08-24)

- The first-party card identity contract now comes from the official Global DB
  `cards.id`, `card_unique_info_id` and `character_id` fields. It is applied to
  both the Character catalog projection and every Team Analysis state before
  catalog fallback. The generated corpus has zero states or cards without a
  canonical identity; the previous corpus had seven.
- Android now fails closed when a static exact-name passive condition cannot be
  evaluated because a relevant team member lacks canonical identity. A missing
  identity can no longer turn a known team restriction green. With official
  identity present, Panzy is canonical character `910`, Masked Majin (Panzy) is
  `873`, and neither satisfies the official DAIMA/Glorio name sets.
- Passive target-enemy status conditions recover typed `atk_down`, `def_down`,
  `stunned` and `super_attack_sealed` evidence from the already validated
  structural markers. Card `1032391` now carries all four typed status choices,
  so both Character Details and Team Builder can render the existing icons.
- The new pair is public only in `staging/v2`. Characters is version
  `2026-08-24T16:26:58.136Z`, 1,436 characters, 2,343,283 bytes and SHA-256
  `4260712cc058ca06364d38a19de75f1e9280769dbeaebed3d8e35a37f9932643`.
  Team Analysis is version `2026-08-24T16:26:58.136Z:parser-1.9.15`, 2,288
  states, 3,078,302 bytes and SHA-256
  `da9c9128b1857904ea8f49b15592d8fb0c4a38fa7cea4cf54497690e374a3b6e`.
  Its Character version/SHA binding is exact.
- Both mandatory pre-publication dry-runs passed. The Team payload upload was
  initially followed by a bounded visibility-verification failure, so its
  manifest remained on the prior release. A read-only public download then
  proved the immutable object exact; the idempotent retry reused it without an
  upload and promoted only the staging/v2 manifest. Final dry-runs plan zero
  writes. Public payload sizes/hashes and cache headers match exactly;
  manifests use `no-store` and payloads use immutable one-year caching.
- Focused scraper tests passed 414 cases and the Android evaluator regression
  test passed. The broad scraper suite had 1,822 passing and 13 pending cases;
  its 19 failures are unchanged test-environment/lineage prerequisites (17
  require Node `--expose-gc`, two are the existing DD6 source-identity lock).
  Tracked `lib/` was rebuilt from the changed TypeScript sources.
- A debug build explicitly routed to `staging/v2` was installed on
  `emulator-5554`. It opened normally, downloaded both exact new payloads and
  stored matching manifests; Team Analysis validation completed successfully.
  The remaining manual product check is the Panzy + Masked Majin draft without
  a Friend: the DAIMA/Glorio condition must be unavailable and the four enemy
  status icons must be visible.
- Production remains unchanged at Characters SHA
  `34b2ce3918d0497b458f106f4e00b50cb039f0a280ef6bfe45c0ca76ee1a84bd`
  and Team Analysis SHA
  `d7a8461c41484b0e25f61131476006b18eadad71c6bac265e7f0e289e7a96237`.
  The scraper and Android implementation changes in this checkpoint are kept
  in separate repository commits. The Android fail-closed evaluator is
  `87d3729`; its Basic-header interaction follow-up is `aca3fb9`.

## Team Builder Basic header regression checkpoint (2026-08-24)

- The Basic-mode collapsible header again expands only after the actively
  scrolled content returns to its absolute top. A small reverse scroll while
  browsing owned slots, Friend or passive analysis no longer reopens the full
  workspace header. Compact and both expanded-width Basic columns use the same
  typed scroll policy; Rotations preserves its existing behavior.
- The already approved candidate-picker absolute-top behavior now shares that
  policy instead of carrying a duplicate conditional implementation. Focused
  state tests cover collapse, reverse scroll away from the top and expansion at
  the top. Android test compilation passed.
- The staging/v2 debug APK was reinstalled on `emulator-5554`. A real gesture
  pass proved the header remained collapsed after a short reverse scroll deep
  in the Basic list and restored `Current draft` only after returning to the
  top. Intent + Impeccable treated this as a narrow interaction refinement; no
  layout, copy, new control, dataset or R2 endpoint changed.

## Dataset download consent checkpoint (2026-08-25)

- First install now inspects manifests before any payload transfer and presents
  the exact combined compressed size and included datasets. An unverifiable
  size fails closed with Retry/Cancel rather than offering an unmeasured
  download.
- Tools > Data > Check for updates is now a manifest-only inspection. Current
  data reports up to date; changed datasets require a separate Download Data
  action, while Not now performs no payload request.
- Confirmation is bound to the exact dataset entries shown: kind, manifest
  object key, version, payload key, SHA-256 and compressed byte count. Character
  and all auxiliary downloaders reject a changed manifest before requesting its
  payload. Persisted first-install consent propagates the freshly revalidated
  plan after process death, and generic MANUAL calls cannot bypass the required
  plan.
- Manual byte totals compare remote entries with validated persisted auxiliary
  cache manifests, so unchanged datasets remain excluded after a process
  restart instead of relying on volatile in-memory status.
- Focused contract tests and the complete Domain/App debug unit suites passed.
  A debug APK explicitly routed to `staging/v2` built successfully, installed
  on the user's Galaxy A56 at `192.168.18.181:46669`, launched as
  `com.luminay.dokkanpanion.debug`, and produced no AndroidRuntime fatal. Manual
  first-install and Tools confirmation review on-device found and isolated a
  manual auxiliary single-flight race: an active startup refresh could cause
  the approved auxiliary round to be skipped, while the UI returned before
  auxiliary completion and retained the prior availability card.
- The local follow-up serializes a confirmed manual operation behind any active
  auxiliary round, awaits its own approved auxiliary round, then reinspects the
  validated persisted cache. The final Data screen therefore reports up to
  date or the exact entries still pending instead of returning silently.
  Coordinator regressions cover startup-to-manual and two distinct concurrent
  approved plans; the complete Domain/App debug unit suites pass. Contract
  re-review found no P0-P2. The final staging/v2 debug APK was installed over
  the existing app data on the user's Galaxy A56, launched without a runtime
  fatal, and Tools > Data > Check for updates deterministically reported
  **Data is up to date** instead of retaining the prior 5.3 MB card.
- Intent + Impeccable governed the approved inline confirmation hierarchy and
  failure copy. A read-only contract re-review found no P0-P2. No commit, push,
  R2 object, publisher or production endpoint changed.

## Android physical-device acceptance checkpoint (2026-08-25)

- The user approved the final staging/v2 debug build on the Galaxy A56 after
  checking Team lifecycle actions, Remove all + Undo, Leaders hard-copy
  deduplication, the six-character Links geometry, candidate discovery and the
  deterministic Recommended ordering.
- The manual dataset flow also reports the persisted staging/v2 pair as up to
  date after the auxiliary single-flight fix. No further Team Builder ranking,
  passive-analysis or Rotations evaluation is required for this checkpoint.
- Google Play's flexible in-app update lifecycle remains a later internal-track
  verification because a sideloaded debug APK cannot exercise that Play-owned
  flow. No commit, push, R2 object or production endpoint changed.

## Play In-App Update acceptance checkpoint (2026-08-25)

- Two minified release-class bundles were generated for Google Play Internal
  App Sharing with package `com.luminay.dokkanpanion`, production/v1 data and
  version codes 17 and 18. Bundletool validation and local signature checks
  passed for both; neither artifact entered a Play testing or production track.
- The base bundle installed from Play detected the higher-version sharing
  artifact. The user verified the top banner, dismissed it without affecting
  app usability, reopened the process and confirmed the offer returned, then
  approved the behavior.
- This proves the Play-owned availability path that cannot run in the sideloaded
  `.debug` package. A short internal-track smoke remains for the eventual
  release candidate. No commit, push, R2 object or production endpoint changed.

## Android delivery checkpoint (2026-08-25)

- The approved Team Builder recommendation, presentation, dataset-consent and
  flexible in-app-update work was committed and pushed to `origin/master`.
  The delivered Android range is `f01423c..21e00b6`: recommendation quality
  (`f01423c`, `c11c64b`), ranking performance (`c76cd64`), Leaders/Links
  presentation (`4b2b4ab`) and consented data plus Play updates (`21e00b6`).
- Complete Domain/App debug unit suites, two minified release bundle builds,
  bundletool validation, signature checks and the physical-device acceptance
  described above all passed before delivery. Local `.scratch/` and generated
  APK/AAB artifacts were not committed.
- This delivery did not publish R2 data, alter the production/v1 dataset lane,
  create a Play track release or promote anything to production.

## Team Builder Rotations clarity checkpoint (2026-08-25)

- Rotations now explains the plan before the six-turn schedule: Rotation 1 is
  labelled as turns 1/3/5, Rotation 2 as turns 2/4/6, and each floater carries
  its exact pair of turns. Fixed pairs show a compact shared-Link count with
  optional exact names derived from the existing selected-state/same-name/
  transformation linking contract; unresolved members fail closed instead of
  being shown as zero links.
- The link-only suggestion sheet is now labelled `Most shared links` rather
  than implying a broader best team. Both candidate plans summarize their two
  proposed pairs and shared-Link counts before the portrait breakdown while
  ranking details remain behind disclosure. Rotation-specific passive scoring
  remains excluded until a typed formation-aware contract is proven.
- Manual move-sheet changes and drag swaps persist first and then expose a
  dismissible guarded Undo. Basic and Rotations both have Back to top, and
  Rotations now shares Basic's absolute-top header policy: a small reverse
  scroll in the middle of the list cannot reopen the full workspace header.
- Intent + Impeccable guided the hierarchy and wording. Both changed layout
  files returned zero detector findings. The focused ViewModel suite, Android
  test compilation, the Rotations/Basic/suggestion/undo Compose cases, and a
  real emulator gesture/visual pass succeeded. The debug APK is installed on
  `emulator-5554`; the user still needs to review this visual slice. No commit,
  push, dataset, R2 lane or production endpoint changed.

## Team Builder transformed-candidate checkpoint (2026-08-25)

- The candidate picker now evaluates BASE and every typed transformation state
  before collapsing results to one hard-copy row per recruitable card. An
  inline BASE/Form control changes the portrait, effective name, type/class
  coverage, Links, passive fit and Character Details destination without
  selecting the card. Character Details opened from an already selected slot
  also preserves the slot's exact form and release state.
- Selecting a previewed form persists its exact card ID, transformation index
  and release state. Replacement recognizes only that exact tuple as the
  current variant; hard-copy filtering and duplicate prevention continue to
  use the base card ID across all forms.
- Search plus type/class filters use the effective transformed values. Focused
  domain tests cover transformed Links, exact current-form identity and
  transformed type/class coverage; ViewModel coverage proves grouped forms and
  exact selection persistence; the Compose regression exercises preview and
  selection on the emulator.
- The current first-party dataset types the skills belonging to each form but
  does not expose a complete dedicated contract for every transformation's
  activation condition. The app therefore labels this as form-level potential
  in **Why this fits** and does not parse prose or claim the path is satisfied.
  No dataset, R2 lane, publisher or production endpoint changed.

## Typed transformation-feasibility checkpoint (2026-08-26)

- The local parser contract is now `parser-1.9.16` and emits a typed optional
  `transformationActivationCondition` for transformed Team Analysis states.
  Paths are joined from first-party passive, Active Skill, Standby, Finish,
  giant/exchange and transformation-chain records; condition expressions reuse
  the existing typed Team Analysis AST and never infer game semantics from
  display prose.
- A full official-DB corpus audit covered 190 of 191 transformed forms across
  2,288 states with no validation issue: 83 contracts are supported, 75 are
  partial and 32 unknown. The sole absent form is Nappa `1005130`, whose
  first-party relation targets `4005130` while the release payload contains
  `4005131`; it intentionally remains fail-closed rather than guessing the
  join.
- Android decodes the optional contract without breaking old cached datasets
  and reuses the Team Builder's typed passive-condition evaluator. Candidate
  forms are classified as available, possibly available, unavailable or not
  verifiable; exact supported paths affect Recommended ordering, while
  multi-step chains remain not verifiable because intermediate release-state
  bindings cannot yet be preserved losslessly.
- **Why this fits** presents that result with the existing Instrument status
  hierarchy and concise disclosure copy. Intent + Impeccable guided the
  presentation; the changed screen returned zero detector findings. Exact
  Initial/EZA/SEZA alternatives, partial/legacy data, complete-team failures
  and multi-step chains have focused regression coverage.
- Leader/Friend replacement filters are role-aware: the role being replaced is
  removed from the automatic coverage requirement, while the other resolved
  role remains required. This prevents replacing a lone Leader from producing
  an empty candidate list merely because the old Leader no longer participates
  in its own replacement evaluation.
- TypeScript build plus 1,103 focused parser/Team Analysis tests, Android wire
  and recommendation tests, the complete Team Builder ViewModel test class,
  app compilation and Android-test compilation passed. The existing exact R8
  rule for `TeamAnalysis*Wire` covers the new nested wire models. No commit,
  push, R2 object, staging lane, production endpoint or Play release changed.

## Android dataset-environment variants checkpoint (2026-08-26)

- Dataset routing no longer depends on remembering debug Gradle properties.
  `productionDebug` is fixed to production/v2 and installs as
  `com.luminay.dokkanpanion.debug`; `stagingDebug` is fixed to staging/v2 and
  installs as `com.luminay.dokkanpanion.staging.debug`. Their Android storage,
  cached manifests, drafts and preferences are therefore isolated and both
  apps can coexist on one device.
- Launcher labels expose the environment as `DkB Companion PROD` and
  `DkB Companion STG`; staging also has a distinct orange launcher background.
  Intent + Impeccable treated this as environment wayfinding rather than a
  product rebrand, preserving the production name and icon unchanged.
- `stagingRelease` is disabled. The only release variant is
  `productionRelease`, still minified, signed through the existing release
  configuration and hardcoded to production/v2. Legacy dataset-route Gradle
  properties are rejected, so neither a local signed build nor CI can silently
  redirect a named variant to another lane. GitHub Actions now invokes
  `bundleProductionRelease` and reads its flavor-specific AAB and R8 mapping
  paths.
- Both debug APKs assembled; their packaged application IDs, labels and exact
  BuildConfig manifest keys were inspected. The Team Builder ViewModel suite
  passed under both environments, the obsolete-property failure path was
  exercised, and a complete minified `bundleProductionRelease` succeeded.
  `stagingDebug` is installed beside the
  existing production debug app on `emulator-5554`. No R2 object, dataset lane,
  Play track, commit or push changed.

## Transformation and dataset-variant delivery checkpoint (2026-08-26)

- The typed transformation-activation pipeline was committed and pushed to
  `origin/main` as `a4958ef` (`feat: type transformation activation contracts`).
  The tracked `lib/` output matches the changed TypeScript; the focused
  transformation and Team Analysis suites passed 410 cases immediately before
  delivery.
- Android transformation-aware recommendation and role-aware Leader/Friend
  replacement were committed and pushed to `origin/master` as `0498909`
  (`feat: evaluate transformation-aware team candidates`). Explicit isolated
  staging/production variants followed as `dbf7faf`
  (`build: isolate staging and production datasets`).
- Focused Android wire-model, recommendation and Team Builder ViewModel tests
  passed. Both debug variants and the complete minified `productionRelease`
  bundle built successfully; the final `stagingDebug` remained installed beside
  `productionDebug` on `emulator-5554`.
- Local attachments, review logs and Android `.scratch/` were not committed.
  No R2 object, dataset manifest, Play track or production endpoint changed.

## Transformation contract staging/v2 publication checkpoint (2026-08-26)

- The official Global DB export remains `dbVersion 1787282006`; the overlay was
  still restricted to cards `1034341`, `1025561` and `1022721`. Characters is
  version `2026-08-26T03:51:45.330Z`, 1,436 characters, 2,343,283 bytes and
  SHA-256 `4260712cc058ca06364d38a19de75f1e9280769dbeaebed3d8e35a37f9932643`.
  Its bytes are unchanged from the previous staging/v2 release.
- Team Analysis is version
  `2026-08-26T03:51:45.330Z:parser-1.9.16`, 2,288 states, 3,152,060 bytes and
  SHA-256 `389159f4f2360a9f1b756090a5c28bcbcc40ec76dd165961f551a2610663d456`.
  Its Character version/SHA binding is exact. The generated corpus contains
  transformation activation contracts for 190/191 transformed states: 83
  supported, 75 partial and 32 unknown. Nappa `1005130 -> 4005131` remains the
  sole intentionally absent fail-closed join.
- Mandatory final dry-runs projected 2,343,739 managed Character bytes and
  3,152,774 new Team bytes. The Team namespace peak was 9,308,833/50,000,000
  bytes and the conservative whole-bucket upper bound was
  408,152,060/10,000,000,000 bytes.
- The Team publisher now has a `--retain-all-releases` mode.
  It retains every verified state-tracked immutable payload while preserving
  the 50-release bound, namespace/global byte limits, payload verification and
  manifest-last ordering. Its 43 focused tests passed and contract review found
  no P0-P2. Publication used this mode: parser 1.9.14, 1.9.15 and 1.9.16 remain
  available, with no cleanup candidate or delete.
- Both staging/v2 manifests and payloads were fetched publicly after
  publication and matched exact names, sizes and SHA-256 values. Manifests use
  `no-store`; payloads use one-year immutable caching. Post-publication dry-runs
  are idempotent with zero new bytes or writes. Production and Play were not
  changed.
- The final `stagingDebug` APK was reinstalled and launched on
  `emulator-5554` without clearing its isolated app data. Physical-device
  acceptance followed in the checkpoint below.

## Transformation contract physical-device acceptance (2026-08-26)

- The isolated `stagingDebug` package was installed without clearing data on
  the user's Galaxy A56 and launched successfully beside the production app.
- The app consumed the published staging/v2 dataset and the user reported the
  transformation-aware Team Builder flow as working correctly on the physical
  device. This closes the manual acceptance gate for parser `1.9.16` and the
  Android transformation-feasibility consumer.
- Production/v1, production/v2 and Google Play were not changed.

## Official portrait source and static-composition checkpoint (2026-08-26)

- The portrait badge defect is data-side rather than Android-side: the public
  staging/v2 corpus carried Super-style `1x` specs for every top-level card.
  A complete first-party join now covers all 1,627 portrait references,
  including transformations and awakenings. Exactly 854 specs require repair;
  the official visual inventory is 372 classless, 773 Super and 482 Extreme.
- Raw official `cards.element` is authoritative for visual class/type. Gameplay
  class cannot replace it because low-rarity cards may intentionally use a
  classless `0x` badge. Typed overlay code joins exact IDs, validates rarity,
  handles nested references and proves that no non-portrait field changes.
- Official `cards.resource_id` owns shared portrait identity when present;
  otherwise the exact card ID is used before normalizing the final decimal
  digit. This resolves 27 shared-resource cards, including Bota Magetta and
  special 2xxxxxx/3xxxxxx rows, without name exceptions. The corpus therefore
  has 1,596 unique thumb assets for 1,627 card references.
- Official Global 6.5.0 downloaded CPKs provide every static layer: the shared
  `layout/en/image/character.cpk` owns frames, rarities and badge variants, and
  each official resource owns an exact 250x250 thumb CPK. A source-only local CPK
  reader enumerated and extracted representative bytes; no community host
  supplied an asset.
- A deterministic local compositor produced accepted-geometry 150x150 samples
  for Extreme INT LR Metal Cooler Army and classless AGL SR Cell (1st Form).
  EZA has no distinct frame or decoration. LR and SEZA effects remain a later
  motion/performance gate after static delivery.
- Exact CPK hashes and residual asset-manifest lineage are recorded in
  `docs/game-db/official-portrait-compositor-report.md`. No R2 object, dataset
  lane, Android code, production endpoint or Play release changed.

## Official portrait local staging-candidate checkpoint (2026-08-26)

- All 1,596 required thumb CPKs were present in the installed official Global
  asset store. Together with the shared `character.cpk`, they produced a
  bounded 39,822,848-byte archive whose Android and local SHA-256 both equal
  `853bca55395067b8ae3382f1c4a0bfeb9b54d489f2a932f453b05b75c29d74a9`.
  Extraction yielded 280 shared members and 1,596 exact thumb PNGs without a
  missing file or collision.
- A new fail-closed local builder hashes the archive, selected CPK inventory and
  every extracted input layer; pins the exact APK, Global `cards.csv`,
  DB/asset/APK versions and canonical real paths; overlays first-party
  element/rarity/resource identity; and atomically creates 1,627 deterministic
  150x150 portraits under channel-scoped `staging/v2/images/v4/`
  content-addressed keys. No community site supplied asset bytes. Shared
  official thumbs across cards or types remain valid; typed frame/rarity/badge
  layers are composed independently for each card. The compositor consumes the
  exact canonical bytes already hashed by the inventory rather than reopening
  lexical paths.
- The candidate contains 1,436 characters. Its gzip is 2,346,736 bytes with
  SHA-256 `672b6fc2fe3712c8530a13ef0561a0a44d857e0bc6c48ddfec6b6b0a92c3965f`;
  generated portraits total 17,438,290 bytes. Two complete generations with the
  same timestamp produced 1,630 files each and zero byte differences.
- A provenance-strengthened replay rejected substituted APK, DB and extracted
  layer fixtures before output creation. Its manifest and all 1,628 object
  files were byte-identical to the original candidate; the report alone gained
  the stronger provenance evidence.
- Classless, Super, Extreme and shared-resource samples were visually checked.
  TypeScript compilation, 12 focused checks and the broader applicable suite
  passed; the latter reported 1,851 passing and 13 expected pending under
  `--expose-gc`. The historical DD6 HEAD-blob lock was omitted because this
  checkpoint documentation remains intentionally uncommitted. Final read-only
  contract re-review found no remaining P0-P2 issue. The
  local report marks only the portrait candidate `GO`; Team Analysis rebind,
  Android staging validation, publisher dry-run, publication, production and
  R2 mutation remain `NO-GO`.
- The next gate is to bind Team Analysis to this Character payload and validate
  the complete candidate through the isolated Android staging consumer before
  any separately authorized R2 dry-run. No remote data, Android source, Play
  track or production endpoint changed.

## Official portrait paired Android staging checkpoint (2026-08-26)

- The local portrait Character candidate was rebound to Team Analysis using the
  complete first-party Global export and parser `1.9.16`. The 2,288-state gzip
  is 3,152,060 bytes with SHA-256
  `8d39b8d932df4830906fffb7138ba7d6980d844e577cd90f8176fae71e09ed4b`;
  its source version and SHA bind exactly to Character version
  `2026-08-26T14:05:24.714Z` and SHA-256
  `672b6fc2fe3712c8530a13ef0561a0a44d857e0bc6c48ddfec6b6b0a92c3965f`.
  A complete replay reproduced payload, manifest and coverage bytes exactly.
- An isolated Android `stagingDebug` build downloaded the complete local pair
  after showing the verified 12 MB initial-consent total. On-device Character
  and Team payload sizes and SHA-256 values matched the manifests. Team Builder
  loaded the analysis with zero `needs info` in the smoke draft, and catalog/
  Team screenshots verified Super, Extreme, classless and legitimate
  shared-thumb/different-type portraits.
- The temporary local transport is unavailable to production: only the
  disabled-release `staging` flavor enables loopback HTTP in Team Analysis,
  only `stagingDebug` packages cleartext exceptions for `10.0.2.2`, localhost
  and `127.0.0.1`, and generated production configuration keeps the flag false
  with cleartext disabled. Focused Team Analysis tests and the staging APK build
  passed; final contract review found no P0-P3 issue.
- No R2 object, public manifest, publisher, production endpoint, Play track,
  commit or push changed. The next separately authorized gate is a staging
  publisher dry-run and byte report; publication remains `NO-GO`.

## Official layered portrait publisher dry-run checkpoint (2026-08-26)

- The self-contained staging candidate is Character version
  `2026-08-26T20:58:47.619Z`, 1,436 characters, 2,554,009 compressed
  bytes and SHA-256
  `403b40ce911147899986b8c7c618acbc40af8f67973793e63aab58281beb79f4`.
  It references 1,627 content-addressed static portraits and 1,656
  deduplicated typed layer objects (20 backgrounds, 1,579 thumbs and 57
  overlays), 3,283 visual objects total.
- Its exact Team Analysis pair is version
  `2026-08-26T20:58:47.619Z:parser-1.9.16`, 2,288 states, 2,962,029
  compressed bytes and SHA-256
  `43a01d5efb74241fdd1661b92adb1d8fb961f1c68098b68003e36909265bc550`.
  The manifest binds the Character version and SHA exactly.
- The Character publisher now accepts an already channel/lane-scoped immutable
  candidate payload while preserving legacy local manifests. It recursively
  collects base, transformation and awakening portrait layers, validates
  containment, structural object keys and embedded SHA-256 values, rejects
  cross-channel/lane references, and refuses `--skip-portraits` for layered
  payloads. Legacy unscoped staging portraits still require the skip mode.
- Remote state can suppress an asset upload only after the exact remote length
  and SHA-256 are reread successfully. Missing/corrupt objects are replanned;
  authentication, transport, malformed-manifest and other non-404 failures are
  fail-closed. State is bound to bucket, target, channel and contract lane.
  Assets and immutable payload remain before the mutable no-store manifest;
  release-aware GC is still future work.
- Compiled focused validation passed 25 delivery/compositor/candidate checks.
  The broader suite reached 1,861 passing and 13 expected pending; its two DD6
  failures are the known committed-HEAD documentation lock, while the one WT
  two-second timeout passed all 43 cases on a bounded rerun. Final read-only
  contract re-review found no remaining P0-P2 issue.
- The read-only remote Characters dry-run planned 3,283 visual uploads,
  69,484,222 managed bytes and a conservative whole-bucket upper bound of
  480,484,222/10,000,000,000 bytes. The exact Team dry-run planned 2,962,743
  new bytes, retained all four tracked releases, no cleanup, and a
  12,270,862/50,000,000-byte namespace peak. Executed together against the
  current bucket, the conservative combined upper bound is
  483,446,965/10,000,000,000 bytes.
- This checkpoint changed no R2 object, mutable manifest, production endpoint,
  Android source, Play track or production data. Remote staging upload is the
  next separately authorized gate and must promote Characters + Team Analysis
  as the exact validated pair; production remains `NO-GO`.

## Official layered portrait staging publication checkpoint (2026-08-27)

- The separately authorized `staging/v2` publication promoted the exact pair
  from the preceding dry-run. Characters is version
  `2026-08-26T20:58:47.619Z`, 1,436 characters, 2,554,009 compressed bytes and
  SHA-256
  `403b40ce911147899986b8c7c618acbc40af8f67973793e63aab58281beb79f4`.
  Team Analysis is version
  `2026-08-26T20:58:47.619Z:parser-1.9.16`, 2,288 states, 2,962,029 compressed
  bytes and SHA-256
  `43a01d5efb74241fdd1661b92adb1d8fb961f1c68098b68003e36909265bc550`.
  The Team manifest binds the Character version and payload SHA exactly.
- Characters uploaded all 3,283 referenced visual objects: 1,627 static
  portraits plus 1,656 deduplicated typed layers (20 backgrounds, 1,579 thumbs
  and 57 overlays). The payload and immutable assets were ready before the
  mutable Character manifest; the paired Team payload was ready before its
  manifest. No delete or release cleanup was requested.
- Complete post-publication remote verification reread all 3,283 visual objects
  and proved exact size and SHA-256. Its final dry-run planned zero uploads,
  zero deletes and no dataset write. The exact Team rerun likewise planned no
  payload, manifest, state or cleanup mutation and retained all four tracked
  Team releases.
- Public no-store reads returned both promoted manifests. Public payload
  downloads matched their declared sizes and SHA-256 values exactly. Public
  samples of a static portrait plus background, thumb and overlay layers were
  byte-identical to the local candidate and returned
  `public, max-age=31536000, immutable`.
- Wrangler reports the bucket at approximately 469 MB; the conservative
  post-publication whole-bucket upper bound is 470,000,000/10,000,000,000
  bytes. Publisher remote reads now retry only bounded transient transport and
  rate-limit failures, remain fail-closed for other errors, and use bounded
  Windows cleanup retries. Twenty-two focused publisher tests pass.
- This publication changed only `staging/v2`. Production manifests, production
  payloads, Android source, Play tracks and the store release were not changed.
  A final public no-store read confirmed production still points to Characters
  `2026-08-22T21:14:10.019Z` / SHA-256
  `34b2ce3918d0497b458f106f4e00b50cb039f0a280ef6bfe45c0ca76ee1a84bd`
  and Team Analysis `2026-08-22T21:14:10.019Z:parser-1.9.0` / SHA-256
  `d7a8461c41484b0e25f61131476006b18eadad71c6bac265e7f0e289e7a96237`.
  Promotion to production remains `NO-GO` without a separate compatible
  release gate and explicit authorization.

## Catalog batch-add and typed display-semantics checkpoint (2026-08-27)

- Catalog multi-selection now fails atomically when the selected addable units
  exceed the remaining owned-team slots: no partial mutation occurs, the
  selection stays active and a dismissible message reports the available slot
  count. Duplicate IDs are still deduplicated before capacity is evaluated.
- The obsolete catalog Help dialog and menu item were removed. Its instructions
  described navigation and interactions that no longer exist; a general Tools
  help surface remains a future option only when there is current, actionable
  guidance to present.
- The catalog's community-facing leader label now uses the maximum positive
  ATK/DEF percentage on an ordered leader path, plus compatible additional
  clauses, rather than averaging HP, ATK and DEF. The local 1,436-character
  candidate therefore reports Panzy and Dr. Arinsu at 220%, Gamma 2 + Piccolo
  at 220%, and Glorio at 200%. Actual leader coverage calculations are
  unchanged.
- Team Analysis parser `1.9.17` preserves an explicit stack cap across a
  standalone inline attack-phase qualifier. The Android evaluator derives the
  effective potential maximum from the typed `stackCap / per-member value`,
  bounded by physical roster capacity. The affected `Per Extreme Class ally`
  rule is consequently full at five increments instead of incorrectly showing
  6/7 partial.
- The exact local Character/Team pair is version
  `2026-08-27T05:25:00.000Z` / parser `1.9.17`; pair validation passed for all
  1,436 characters and 2,288 states. TypeScript parser suites passed 439 tests,
  focused Android domain and staging app tests passed, final contract review
  found no P0-P2 issue, and a stagingDebug APK
  using the loopback-only local dataset endpoint was installed on the user's
  Galaxy A56 without clearing app data.
- No R2 object, public manifest, production endpoint, Play track, commit or
  push changed. The local dataset and APK remain staging-only.

## Ally-stack availability corpus checkpoint (2026-08-27)

- Catalog batch-add capacity is evaluated against actual new owned characters,
  not selections already present in the draft. With one slot open, selecting
  one new and one existing character adds the new character atomically and now
  reports that the other selection was already in the team.
- Team Analysis parser `1.9.18` preserves typed caps across `at the start of
  turn`, `before attacking`, attacker-position qualifiers and flat numeric
  limits. Unsupported attacker-position semantics remain partial rather than
  being silently promoted to supported.
- A complete corpus audit found 374 ally-scaling groups, 176 with explicit
  caps, zero invalid caps and zero remaining ally-scaling `up to` clauses
  without a typed cap. Five previously missed source formats are now covered.
- The Android Team Builder derives adjusted displayed caps with
  `ceil(stackCap / per-member value)` only for typed ally scaling with one
  member per increment. It uses the largest requirement across grouped effects,
  retains physical capacity for uncapped grouped effects and fails closed when
  the declared cap would require more members than the typed roster permits.
  This is availability presentation only and is not a combat-damage formula.
- The exact local pair remains Character version
  `2026-08-27T05:25:00.000Z` / SHA-256
  `36f25f2cf957349b4fe4aa3f1428cfe95282546d396bd009bd3516c613f2f508`;
  regenerated Team Analysis is parser `1.9.18`, 2,288 states, 2,960,290 bytes
  and SHA-256
  `5e099ec5935cb84b7ee390a0b75da8e650e47dc7f0f773095fcaf5b6a73d9bc5`.
  Pair validation, 1,119 parser tests and focused Android domain/app tests
  passed. Final contract review found no P0-P2 issue.
- No R2 object, public manifest, production endpoint or Play track changed.
  The regenerated pair remains local and staging-only.

## Ordered Leader Skill path evaluation checkpoint (2026-08-27)

- The production-v2 Character dataset was current at version
  `2026-08-27T05:25:00.000Z`; Glorio already carried the correct top-level
  `200%` display boost. The Android Leaders surface regressed because its
  structured evaluator selected the largest base clause globally and then
  added every matching additional clause globally, producing an impossible
  `200% + 30% = 230%` combination across different ordered alternatives.
- Android now evaluates each primary/secondary clause together with only the
  additional clauses that follow it, applies exclusions to that whole path and
  chooses the strongest complete matching path. Legacy cached payloads remain
  compatible by deriving canonical `Category characters excluded` clauses from
  their raw text when the typed field is absent.
- The TypeScript contract now emits `excludedCategories` separately and removes
  excluded names from positive category targets. A full 1,436-character corpus
  audit found four such Leader Skills: SSB Goku & Vegeta, Fusion Zamasu, Master
  Roshi and Glorio; all four parse into non-overlapping positive/excluded sets.
- Focused parser tests passed 34/34 and the complete Android domain suite passed.
  A productionDebug `2.0.9 (17)` candidate was installed over the existing app
  without clearing data. No dataset, R2 object, public manifest or Play track
  changed.

## Open technical debt — first-party Support Memory and Stage sources (2026-08-27)

- After the current app release, replace the community-derived Support Memory
  and Stage pipelines with first-party game database/API projections, following
  the structural-ID and field-scoped provenance approach already used for
  Characters. This is a future source-migration gate, not authorization to
  acquire, publish or promote data now.
- The current Dokkan.fyi category projection is not authoritative for Support
  Memory targets. Its live category `98 / DAIMA` payload incorrectly associates
  `50015 / Broly's Inner Power`, whose player-facing effect targets only
  `Movie Bosses` and `Revenge`. A local 75-memory audit found 29 apparent extra
  and 14 missing category relations when compared with recognized category
  names explicitly quoted in effect descriptions.
- Support Memories remains staging-only: every production Android variant
  disables its Tools entry, character-detail recommendations and dataset
  updates. The staging consumer temporarily derives catalog filters, search
  labels and detail category links only from recognized quoted category names
  inside explicit plural `Category allies` / `Category enemies` target clauses.
  It excludes singular `Category ally` / `Category enemy` condition clauses.
  This compatibility projection deliberately ignores the source-provided
  `categoryNames` authority and must be removed once structural first-party
  target IDs are delivered. Existing character-applicability joins remain
  source-derived and require a separate audit during that migration.
- Exit criteria: define first-party structural identities and provenance for
  Support Memory targets/effects/duration/enhancement/acquisition and for Stage
  identity/relations/enemies/rewards; compare the replacement against the
  current delivered contracts; preserve old-cache compatibility in Android;
  then remove text-derived target parsing and community-source authority.

## Production v2 release preflight (2026-08-27)

- A production-v2-only Character candidate was projected from the reviewed
  staging-v2 pair. It changes only the 3,283 portrait delivery references from
  `staging/v2/images/...` to `v2/images/...`; the referenced content-addressed
  object bytes are unchanged. The resulting 1,436-character payload is
  2,550,114 bytes with SHA-256
  `22532366108020106b10a2db50c1245d13c4c5831ded9fd859149102b03b2687`.
- Team Analysis was regenerated from that exact Character payload at parser
  `1.9.18`. The 2,288-state payload is 2,960,290 bytes with SHA-256
  `2dd7364a74cb3b7af9d454b27be409231bda6c05a4d8a324df08f68f0c1afc94`;
  local pair validation passed.
- The Characters publisher now verifies the exact remote payload bytes, size
  and SHA-256 before reuse and again before manifest promotion, then verifies
  the uploaded manifest bytes. Every uploaded portrait is also read back and
  checked by size and SHA-256 before manifest promotion. Remote writes require
  exactly one baseline pin; first publication pins manifest absence with
  `--expect-remote-manifest-absent`.
- The Team Analysis publisher now refuses writes unless the corresponding
  Character manifest and payload are already public and exactly match its
  local source pair. It repeats that check immediately before promoting the
  Team Analysis manifest, and its own remote manifest requires the same
  SHA-or-absence baseline pin.
- Hardened remote dry-runs found both `v2` manifests absent and planned 3,283
  portrait uploads, zero deletes and 72,441,315 combined new bytes. From the
  same Wrangler-reported 483 MB bucket baseline, the conservative combined
  upper bound was 556,441,315 bytes against the 10 GB limit. The v1 keys are
  outside the `v2/` namespace and were not part of either plan.
- Commit `75f1825` added the production-v2 candidate and hardened publishers.
  It was pushed to `origin/main` before publication. Build and 72 focused
  delivery tests passed; final contract review found no P0/P1 blocker.
- Production v2 was published with Characters first. All 3,283 portraits were
  uploaded and read back with exact size/SHA verification, with zero deletes,
  before `v2/characters-manifest.json` was promoted. The public Character
  payload was then downloaded independently and matched the expected 2,550,114
  bytes and SHA-256 exactly.
- Team Analysis was published only after the remote Character manifest and
  payload matched its local source pair. Its payload and manifest were
  verified before and after promotion; an independent public download matched
  the expected 2,960,290 bytes and SHA-256, and its source Character version
  and SHA matched the public Characters manifest.
- Post-publication dry-runs are idempotent: Characters reports zero payload or
  portrait uploads and zero deletes after rereading all 3,283 remote portraits;
  Team Analysis reports no payload/manifest update, no cleanup and zero new
  bytes. Production v1 remains separate and unchanged.

## Coordinated passive percentage parsing (2026-08-28)

- Team Analysis parser `1.9.19` recognizes coordinated critical-hit chance,
  evasion chance and damage-reduction phrases whose single trailing percentage
  applies to the whole list. The grammar is effect-based and contains no card
  IDs or character-specific overrides.
- A trailing stack cap is consequently attached to every coordinated effect.
  Metal Cooler Army now emits `10%` with a `50%` cap for critical chance,
  evasion chance and damage reduction, so every grouped potential has the
  correct five-member ceiling. The same correction improves 12 other rules;
  capped Chiaotzu and King Cold cases are covered by the same grammar.
- The complete Team Analysis test file passed 409/409. The production-v2
  candidate was regenerated from the exact public Character pair and validated
  all 2,288 states. Its 2,959,042-byte payload has SHA-256
  `5c053970f970193c8dbf17f95c0bc96c9c2677aebc777b3336746e45df022955`,
  with 9,798 supported, 1,893 partial and zero unknown rules.
- The mandatory baseline-pinned dry-run projected 2,959,748 new bytes, zero
  deletes, a 5,920,038/50,000,000-byte managed namespace peak and a
  558,959,042/10,000,000,000-byte conservative bucket upper bound. Production
  v2 publication verified the public Character pair, uploaded and read back the
  immutable payload, then promoted and verified the manifest last. The prior
  parser-`1.9.18` payload remains retained.
- An independent public download matched the new payload size and SHA exactly,
  remained bound to Character SHA-256
  `22532366108020106b10a2db50c1245d13c4c5831ded9fd859149102b03b2687`,
  and confirmed every Metal Cooler Army grouped effect has a five-member
  ceiling. The post-publication dry-run is idempotent with zero new bytes,
  uploads, manifest changes, cleanup candidates or deletes. Generated `data/`
  remains untracked.

## Official DB 1787900894 character refresh and dual-lane publication (2026-08-29)

- The Global Dokkan `6.5.0` / version-code `342` database was acquired from
  the installed game, decrypted and exported as first-party DB version
  `1787900894` with asset version `1787810936`. The resulting SQLite has
  SHA-256 `571efa97333bf4fc74a983d24cc5dd9d56c5246a56606e445ff48edfdc0d9feb`.
  Binary CPK output must be written on-device and pulled with ADB; redirecting
  binary stdout through PowerShell corrupts it.
- The refresh added six primary characters (`1033971`, `1034001`, `1034031`,
  `1034661`, `1034691`, `1034701`), four structurally related forms
  (`4033981`, `4034041`, `4034671`, `4034711`) and the first-party SEZA state
  for `1009381`. Wording-only changes on `1022631` and `1022751` were not
  classified as new EZA states.
- Official category `99` is **Golden Fighters**, not Golden Warriors. Its
  first-party memberships were added to 261 existing characters; new Goku
  `1034031` brings the delivered total to 262. Seven also belong to Planet
  Namek Saga and 255 depend on Golden Fighters alone. No card-ID correction,
  legacy-category alias or `UNKNOWN` wildcard was introduced.
- The frozen Android 2.0.8 consumer decoded the complete v1 pair and retained
  catalog, detail, manual team, save and legacy-category behavior. Its expected
  limitation is that Golden Fighters is absent from the enum/UI and the new
  Goku's leader coverage cannot include the 255 Golden-only characters.
  Android 2.0.10 preserves raw `categoryLabels`, so leader coverage,
  Recommended and Autobuild can match the future category text; adding the
  enum, picker/filter and detail link remains an Android follow-up.
- Production v1 Characters is version `2026-08-29T14:49:35.960Z`, 1,442
  characters, 2,361,715 bytes and SHA-256
  `dd1ce5b5e89affb9209dd8465ff6feb43f2803f4eec45e8748286f204b16e21e`.
  Its parser-`1.9.19` Team pair contains 2,299 states, 3,078,143 bytes and
  SHA-256 `3b52d6bcd1e9f4ec59dc00be0e662a9ed0436d24e1623f9e233bbdf9dbf838e2`.
- Production v2 Characters is version `2026-08-29T14:49:52.832Z`, 1,442
  characters, 2,572,246 bytes and SHA-256
  `6da0b011bc933ed111ef0706a31215a3fa9da883261d66ab7ced8d03c1b4a2ef`.
  Its parser-`1.9.19` Team pair contains 2,299 states, 3,181,518 bytes and
  SHA-256 `c7dfd4bebdbce444661e16fef75f08462cbf832831cbd730f5465af20d750f48`.
  Public manifests, payload sizes/SHA values, all six characters, all four
  forms, the SEZA, 262 memberships and every new portrait/layer were verified.
- Both Team publications used `--retain-all-releases` and deleted nothing.
  The bucket remains approximately 558 MB with a conservative post-refresh
  upper bound near 562 MB of the 10 GB allowance. The publication is complete;
  no repeat upload is authorized or needed.
- Operational debt remains in the Character publisher preflight: it starts one
  Wrangler process per portrait and rereads remote objects for size/SHA proof.
  Concurrency 24 and 8 eventually received HTTP 429, while concurrency 4 was
  stable (about 8–9 minutes for v1 and 16–20 minutes for v2). Future work should
  add bounded backoff plus connection/inventory reuse without weakening
  fail-closed byte verification, typed v2 layer delivery or manifest-last
  promotion.
- The reusable refresh generator resolves category targets by official ID and
  records ID/name provenance, seals all 33 first-party CSVs plus the exact
  portrait inputs by size/SHA-256, detects table mutation during generation,
  and emits the frozen Android-v1 projection inside a v1 run. A post-review
  replay reproduced the public Character SHA exactly in both lanes; generated
  replay directories remain ignored under `game-db/data/`.
- Final contract re-review found no P0-P3 issue. The tracked TypeScript build
  passed and the focused parser/materializer/validation suite passed 726 tests.
  The remaining provenance risk is external to this generator: it proves the
  exact local bytes consumed, but a future acquisition contract may add an
  independently signed first-party chain-of-custody anchor.

## Official super-attack categories and awakening dates refresh (2026-08-29)

- The first-party export now includes `special_views` and
  `special_categories`. Super-attack types are resolved structurally through
  `card_specials.view_id -> special_views.special_category_id ->
  special_categories.raw_attribute`, mapping official values to Ki Blast,
  Unarmed, Armed or Other without relying on community data.
- EZA and SEZA dates are now derived from exact final steps in
  `CardAwakeningRoute::Optimal`, with awakening type 1 for EZA and type 2 for
  SEZA. These dates propagate through the release projection, materializer and
  overlay so recent awakenings sort by their actual release-state date.
  Fail-closed validation rejects a new first-party EZA/SEZA super attack whose
  official type could not be resolved.
- The regenerated 35-table first-party export and both delivery lanes contain
  1,442 characters and 2,299 Team Analysis states. Six new primary characters,
  four forms and Frieza `1009381` SEZA were checked against the source DB;
  relevant required fields were present. Focused validation passed 774 tests.
  The broader suite passed 1,895 tests with 13 pending and only the two known,
  unrelated DD6 project-state identity failures.
- Production v1 Characters is now version `2026-08-29T21:37:02.958Z`,
  2,361,771 bytes and SHA-256
  `6423bc90508b45fae36967b7f0c07919ca02b0d5b5be53f47a6fc45df2ec4ea2`.
  Its parser-`1.9.19` Team Analysis payload is 3,078,273 bytes with SHA-256
  `42d9fe1daabf30da991527df708dbe8e5a3f6d6639067288fe20c6fceb9bc361`.
- Production v2 Characters is now version `2026-08-29T21:36:08.245Z`,
  2,572,330 bytes and SHA-256
  `7c77f40158f3ac04c086660f521dd3ac160fe2bffcb81e42a2d5e80049f7bd1c`.
  Its parser-`1.9.19` Team Analysis payload is 3,181,653 bytes with SHA-256
  `77d9776fc66fa87a0957f381128cfcfc14e0b724c5f2f63f76aa1275cfeb11ff`.
- Mandatory dry-runs projected zero portrait uploads and zero deletes in both
  lanes. The live publishers reread all 1,637 v1 and 3,303 v2 portrait
  references, uploaded only the immutable Character/Team payloads and promoted
  each manifest last. Both Team publications retained all four tracked
  releases and deleted nothing. The conservative post-publication bucket upper
  bound is 574,181,653 bytes against the 10 GB allowance.
- An independent post-publication R2 download verified all four payloads byte
  for byte and confirmed that all four public manifests contain the expected
  metadata and versioned object keys. The first v1 attempt encountered one
  transient Wrangler OAuth 401 during read-only portrait verification and
  aborted before writes; the authenticated retry completed successfully.

## Android Autobuild set diversity and runtime correction (2026-08-29)

- LDPlayer screenshots proved that all three Autobuild alternatives could
  contain the exact same added cards in different owned-slot orders. The
  installed APK matched the latest local productionDebug artifact byte for
  byte, so this was a current algorithm defect rather than an old build or data
  issue.
- Android now identifies an in-progress or final Autobuild team by the
  unordered set of added card IDs. Slot permutations no longer consume beam
  width or preview alternatives, and the flow returns fewer than three options
  when fewer than three distinct teams survive.
- The five-empty-slot seed phase now performs one full-catalog Recommended
  evaluation instead of five equivalent evaluations. Its bounded pool expands
  from the effective old 12 candidates to 36 when three or more slots are open,
  and repeated rotation/Link/contribution comparator facts are cached per beam
  state. Contextual Recommended ranks guide ordinary additions while hard
  coverage and typed causal enablers retain priority.
- New regressions cover distinct five-card sets, repeated contextual
  Recommended parity and a contextual enabler initially below the former
  top-12 cutoff. The complete Android domain suite passed 533 tests with zero
  failures, Team Builder ViewModel passed 87 tests, productionDebug assembled,
  and the replacement APK installed and launched on LDPlayer without clearing
  data. Android Lint remains unavailable because its Compose detectors reject
  Kotlin metadata 2.2 while supporting only 2.0; the crashes occurred in
  unrelated `DatabaseBootstrapper.kt` and
  `LeaderCategoryDictionaryRuntimeTest.kt`.
- Tank, damage-dealer and slot-role semantics remain future work. They require
  an explicit typed combat-calculation contract for pre/post-attack defense,
  guard, damage reduction, evasion, stacking, build assumptions, enemy/event
  context and rotation duration; no role is inferred from prose in this change.

## Transformed awakening inheritance and Team Builder clarity (2026-08-29)

- Release-state lane refreshes now project every existing related form of a
  targeted base card before overlaying official EZA/SEZA fields. Transformation
  passive evidence is rebound from the standalone form identity to the owning
  `base:form:release` identity, and a missing form awakening date inherits the
  owning release date only when the first-party projection proves that release
  state.
- The Dokkan.fyi fallback also inherits an owning EZA for a form only when the
  form contains an awakened payload. It deliberately does not infer an owning
  SEZA because that generic form payload cannot distinguish an EZA revision
  from a SEZA revision.
- A real v2 candidate generated from DB version `1787900894` confirmed Gohan
  root `1024291`, form `4024301`, EZA date
  `2025-04-03T05:00:00.000Z`, populated EZA passive evidence keyed as
  `1024291:4024301:eza`, and the matching Team Analysis state. No R2 object was
  published.
- Android keeps runtime-only battle-context clauses green and available from
  the team's point of view. Its separate Partial metric is reserved for
  quantified team/rotation potential below the known maximum, so effects such
  as Arinsu's category-ally scaling remain partial without implying that
  attacking or receiving an attack is a roster failure. Autobuild previews use
  `Slot N · Added`. The five-open-slot `1034031` Leader/Friend scenario
  completed on LDPlayer in 19.26 seconds after independent beam evaluations
  were parallelized without changing the ranking or beam contracts.
- Focused scraper validation passed 45 tests, including fail-closed coverage
  for a form without an awakened payload and deduplication when a related form
  is also an explicit release target. The correct `--expose-gc` broad
  run passed 1,898 tests with 13 pending; its only two failures are the known
  DD6 source-lock checks caused by the intentionally edited project-state
  checkpoint. Android passed all 533 domain tests, all 87 Team Builder
  ViewModel tests and both focused Compose instrumentation regressions.

## Canonical dates for alternative-art cards (2026-08-29)

- The official DB can add a new card ID and `open_at` for an alternative art
  while leaving the complete gameplay record unchanged. Treating that art date
  as a new unit release incorrectly promotes an old card in catalog freshness
  and Autobuild ranking.
- Snapshot generation now groups only exact gameplay-equivalent records: the
  shared card identity plus rarity/type, stats, levels, growth, Leader/Passive,
  Links, Ki meter, awakening and potential-board fields must match. It then
  uses the earliest release among those equivalent variants. Cards that merely
  share a character identity keep independent dates.
- A complete scan of selected primary cards found two alternative-art date
  corrections: Super Saiyan God Goku `1034461` resolves to the original
  `2023-03-18T06:18:00.000Z`, and Super Saiyan 3 Goku (Angel) `1034481`
  resolves to `2024-04-26T04:00:00.000Z`. Unrelated older records sharing the
  same character identity were not collapsed. A recent real EZA/SEZA date can
  still refresh either card's effective freshness independently.
- A local v2 lane candidate targeted both alternative-art IDs and carried the
  canonical base dates into the existing baseline. No R2 object was published.
- The release overlay can now carry a changed canonical base date into an
  existing v2 baseline. Focused snapshot and overlay validation passed 738
  tests after compilation, and the tracked `lib/` output matches the changed
  TypeScript sources.
- The final broad scraper suite passed 1,901 tests with 13 pending. Its only
  two failures remain the known DD6 project-state source-lock checks caused by
  this intentionally edited checkpoint, not runtime or dataset assertions.

## Canonical alternative-art dates production-v2 publication (2026-08-30)

- The separately authorized production-v2 publication promoted the validated
  canonical-date pair. Characters version
  `2026-08-30T02:57:02.108Z` contains 1,442 characters in a 2,576,426-byte
  payload with SHA-256
  `27cfa4d59fdef27b415600ccd40ef1cca3b2c6e7754cfbd1cc70c7248e1a493c`.
- Team Analysis version
  `2026-08-30T02:57:02.108Z:parser-1.9.19` contains 2,301 states in a
  3,187,894-byte payload with SHA-256
  `793b42e7351e9b1336e03a08765e9408a9961969abbaa21157a5adecea52e002`.
  Its manifest is bound to the exact Character version and SHA above.
- The mandatory remote dry-runs projected zero portrait uploads and zero
  deletes. They retained all tracked releases and produced a conservative
  whole-bucket upper bound of 585,187,894/10,000,000,000 bytes.
- Characters and Team Analysis were promoted manifest-last. Independent R2
  downloads after publication reproduced both advertised payload sizes and
  SHA-256 values and confirmed the cross-manifest Character binding.
- The same exact pair was downloaded through a loopback-only `stagingDebug`
  build on LDPlayer. Android persisted both content-addressed payloads, loaded
  the catalog and requested the new portraits successfully. Production Android
  binaries and Play tracks were not changed by this dataset publication.

## Staging v2 passive-mode dataset publication (2026-08-31)

- The validated `mode-passive-local-v2-20260831-v5` pair was projected to the
  staging-v2 delivery namespace without semantic Character or Team Analysis
  changes. Only portrait references changed from `v2/images/...` to
  `staging/v2/images/...`; Team Analysis retained its exact 10,251 supported,
  1,602 partial and zero unknown rules and was rebound to the channel-specific
  Character payload SHA.
- The mandatory Character dry-run verified all 3,303 referenced portraits and
  projected 20 portrait uploads, zero deletes, 69,920,337 managed bytes and a
  conservative whole-bucket upper bound of 590,990,580/10,000,000,000 bytes.
  The first write attempt aborted before manifest promotion after a transient
  Wrangler OAuth 401 while rereading one uploaded portrait. Authentication
  remained valid; the baseline-pinned retry verified 20/20 portraits, uploaded
  the immutable payload and promoted the Character manifest last.
- Public staging-v2 Characters is version `2026-08-31T03:58:32.844Z`, contains
  1,442 characters in 2,581,517 bytes and has SHA-256
  `da568f833c2da3a050cb96d49da639ff0875d3030f86cda2fa7ec1bba2afb6a3`.
- The Team Analysis dry-run retained all five tracked releases, planned zero
  deletes, 15,462,164 managed bytes and a conservative bucket upper bound of
  591,191,302 bytes. Publication verified the public Character pair, uploaded
  and reread the immutable payload, then promoted the Team manifest last.
- Public staging-v2 Team Analysis is version
  `2026-08-31T03:58:32.844Z:parser-1.10.0`, contains 2,301 states in 3,191,302
  bytes and has SHA-256
  `2c372d2b7e7577f29c80d59a548796636d93aff968d4ca52be2b8925968403e0`.
  Independent public downloads reproduced both advertised payload sizes and
  SHA-256 values and confirmed the Team-to-Character version/SHA binding.
  Production v1 and v2 were not changed.

## Production dual-lane Created Domain and passive-mode publication (2026-08-31)

- Commit `7a96450` repaired the first-party Created Domain path and was pushed
  to `origin/main` before publication. Current snapshot projection audits all
  15 official Active Skill-to-field relations, enriches both inherited
  baseline cards and additions, and fails closed on structural or descriptive
  drift. The lane loader now materializes every inventoried Dokkan Field table;
  a real generation attempt exposed and blocked the formerly omitted tables
  before any R2 write, and a regression test now pins that boundary.
- The generated v1 and v2 pairs each contain 1,442 Characters, 2,301 Team
  Analysis states, 15 audited Domain relations and 10 Character Domain patches.
  Omega Shenron carries `Earth Shrouded in Minus Energy`, Cell Max carries
  `New Red Ribbon Army's Base (Ruined)`, and Ginyu (Goku) carries additive
  `standard` plus Dokkan Frontier-only `survival` passive modes. The v1 legacy
  fallback preserves the complete Domain name and effect text.
- Exact consumer checks passed before publication. Android 2.0.8 commit
  `6ac55fe20872d8c3ee1678d4e34fc010243ebb51` decoded the complete pair in the
  frozen JVM harness and in an R8-minified LDPlayer smoke. The Play-review
  2.0.11 tag at `5e387374b5ac5a2e82959b7919cb51980ea6b96e` and current Android master at
  `077a70cc5da2d0d841c89b906d6dd5df985e21ef` each decoded all 1,442 Characters
  and 2,301 states from the exact v2 pair. Current master passive-mode wire,
  evaluator, dataset-audit and Character Overview tests also passed.
- Mandatory remote dry-runs verified all 1,637 v1 and 3,303 v2 portrait
  references, planned zero portrait uploads and zero deletes, and retained all
  tracked Team Analysis releases. The largest conservative whole-bucket upper
  bound was 597,191,302/10,000,000,000 bytes. Both live Character publishers
  repeated the full remote verification, uploaded only their immutable gzip,
  and promoted their mutable manifest last; Team Analysis was published only
  after its corresponding public Character pair matched exactly.
- Production v1 Characters is version `2026-08-31T17:45:52.288Z`, 2,369,207
  bytes and SHA-256
  `eecdff48285d18bb06138228b5b45e311a58a1a001fb324e3f65bfa891d67f8c`.
  Its parser-`1.10.0` Team Analysis payload contains 2,301 states, is 3,087,703
  bytes and has SHA-256
  `c2676051a87fe91d91aa18276f8c46cf9476bb929e25aca81cd0832fc2678e2a`.
- Production v2 Characters is version `2026-08-31T17:45:31.293Z`, 2,580,807
  bytes and SHA-256
  `53b7eb745b67259dd14f224ee8dcff8b0dfa7d21cb0277d116508c75c28bddfb`.
  Its parser-`1.10.0` Team Analysis payload contains 2,301 states, is 3,191,302
  bytes and has SHA-256
  `2a3477edb7b9a7468e91c705f32825fbb7522b5764a11c01c72d7a053ef57878`.
- Independent no-cache public downloads reproduced all four advertised sizes
  and SHA-256 values, confirmed exact Team-to-Character version/SHA binding,
  and found the expected Omega, Red Ribbon and Ginyu mode contracts in both
  lanes. No portrait or historical Team Analysis release was deleted.

## First-party Support Memory candidate (2026-08-31)

- The first migration slice is implemented locally and has not been published.
  First-party exports now inventory the Support Memory, structural target and
  mission tables. `run:game-db-support-memory-candidate` consumes those CSVs,
  the exact delivered Character artifact and the previous Support Memory
  payload, then emits a wire-compatible candidate plus a field-scoped audit and
  SHA-256 manifest.
- The projector no longer parses category names from prose. It joins
  `support_memory_skills.sub_target_type_set_id` to `sub_target_types` and uses
  the native-proven value types: 1/2 are category include/exclude and 4/5 are
  card-unique-info-set include/exclude. Filters within one set compose as AND;
  targetable cards from separate effects are unioned and intersected with the
  2,629-card consumer artifact.
- A real read-only projection from Global DB snapshot `1787900894`, SHA-256
  `571efa97333bf4fc74a983d24cc5dd9d56c5246a56606e445ff48edfdc0d9feb`,
  produced 76 roots from 191 memory rows and 115 enhancement edges. It adds
  `20024 / Vow to Return`, released `2026-08-22T05:00:00.000Z`, with the
  official Saiyan Saga target and mission. It removes no existing root.
- The only core changes among the previous 75 entries are newly discovered
  level-2/3 chains and official descriptions for `20005 / Power Level 530000`
  and `20006 / Warrior Awakened through Fury`. Six memories lose false
  category relations caused by treating a card-unique-info set ID as a category
  ID: 30006, 40007, 40009, 50003, 50006 and 50015. Broly's Inner Power now has
  only Movie Bosses/Revenge and 372 applicable delivered cards instead of the
  source-derived 396.
- Official mission joins cover 57 roots; the other 19 are reported as
  unresolved and use `film-only`/`unknown` without copying acquisition,
  navigation, image, stage, or URL fields from the comparison dataset. The
  previous payload is now comparison-only.
- The installed Global 6.5.0 package supplied 76 numeric animation CPKs plus
  the static and enhancement CPKs. A pinned CriFsV2Lib reader at commit
  `169b001c748dfffc28c9fc14fcec269dd45e6eec` extracted and audited them.
  The official-only candidate contains 76 presentations, 1,970 unique assets,
  and 317,375,873 bytes. All 1,970 on-disk sizes and SHA-256 values match the
  audit. The `20011 -> sm20010` non-identity animation join is explicit.
- The compatible JSON property remains named `dokkanInfo`, but all of its
  values now come from game DB rows or official CPK bytes and entries carry
  `presentationSource: game-assets`. The payload contains zero Dokkan.fyi,
  DokkanInfo, HTTP, navigation, stage-reference, or legacy presentation URLs.
- Focused TypeScript validation passes 23 candidate, acquisition, asset,
  managed-path, publisher, and fail-closed scenarios. The committed acquisition
  command reproduced all 78 archive hashes and all 2,056 extracted file hashes
  from the independently collected bundle. Android domain tests pass the
  additive source marker.
  Current master and the exact Play-review 2.0.11 tag both built and rendered
  the real 76-memory candidate in LDPlayer, including Vow to Return's image,
  three official descriptions, film, enhancement items, and completed image.
  No R2 object or public manifest changed.

## First-party Stage candidate (2026-08-31)

- The local, non-production `run:game-db-stage-candidate` lane now projects
  Stage topology directly from the Global game database. Its first real run is
  bound to snapshot `1787900894` and SQLite SHA-256
  `571efa97333bf4fc74a983d24cc5dd9d56c5246a56606e445ff48edfdc0d9feb`.
- The candidate contains 5,391 bound quest levels, 146 explicitly unbound map
  rows, 6,635 battles, 9,503 rounds, 13,925 ordered enemy positions, 5,390
  referenced enemy skills and 31 round-skill sets. It also projects official
  cut-ins, Chapter/Story joins, map presentation IDs, Link Skill level-up rate,
  clear rewards, boss drops, displayed drops and category bonuses.
- Z-Battle projection covers 234 stages, 254 enemy ranges, 932 checkpoints and
  5,503 first-reward levels. Base stats, escalation curves, card/skill changes,
  thresholds, stamina/key costs and reward items are preserved as structured
  first-party rows. Their final application formula remains explicitly
  unproved.
- Standard quest enemy HP, ATK, DEF, attacks per turn and runtime scaling are
  absent from the SQLite contract. Player-card stats are never substituted;
  each enemy records `unavailable-in-game-db`. Exact runtime values require a
  separately proven official briefing/start API contract or native formula.
- One shared structural mission resolver now supplies both directions of the
  Support Memory relation without regex or localized text. The real candidate
  has 481 identical forward/inverse relation keys covering 52 memories: 427
  quest-level and 54 area relations. The five default elemental memories
  remain valid without a specific Stage relation.
- The previous 1,477 Stage entries all exist in the candidate and have zero
  mismatches in stamina, keys, Rank EXP, Zeni, Link Skill level-up rate, quest
  ID or area ID. The previous dataset is comparison-only; the candidate
  contains no Dokkan.fyi, DokkanInfo or HTTP source.
- The product delivery and staging-only Android consumer are now implemented
  locally. Schema 2 points to a 181,245-byte searchable catalog and 14
  content-addressed detail shards; the largest shard expands to 2,096,949
  bytes under the 2 MiB fail-closed limit. The complete delivery represents
  5,625 typed routes and 481 Support Memory relations in 1,215,406 compressed
  bytes without constructing the full detail graph at startup.
- Z-Battle delivery now joins escalated card and enemy-skill IDs back to their
  official rows, preserving card names plus skill names, descriptions, raw
  effect kinds and raw values. Android renders these separately from raw base
  stats, curves and thresholds and continues to label the final formula as
  unproved.
- Focused TypeScript contract/CLI tests pass 10 scenarios. Android mapper,
  repository-manager, initial-download and ViewModel tests cover strict
  contracts, on-demand single-flight loading, verified offline cache and
  filtering. A real local staging build loaded the catalog and quest/Z-Battle
  shards in LDPlayer, including offline cached details and graceful uncached
  failure. No R2 object, staging pointer or production lane changed.

## DokkanStats Support Memory enrichment (2026-09-02)

- An authorized, optional DokkanStats sidecar now collects the English Support
  Memory catalog and every root detail page. It remains separate from the
  first-party consumer payload and cannot override game-database identity,
  gameplay, targeting, enhancement requirements, or game-asset presentation.
- The parser joins strictly by numeric Support Memory ID, requires every live
  catalog row to belong to exactly one root/enhancement chain, verifies each
  detail payload against its catalog record, and rejects duplicate identities,
  broken level chains, catalog/detail drift, malformed sources, and unknown
  acquisition kinds.
- The first complete live run produced 76 roots, 191 total levels, and 328
  acquisition sources for 75 memories: 285 mission sources and 43 stage-drop
  sources. `10003 / Training Complete!` explicitly exposed no acquisition
  source. The 76 roots match the first-party candidate exactly by ID, English
  name, and maximum level.
- Responses use the shared 168-hour mapped cache and a default 500 ms delay.
  Six focused parser/contract tests, TypeScript compilation, and the complete
  live collection passed. Generated `data/` remains local; nothing was
  published or promoted.
- A fail-closed promotion lane now reconciles the sidecar with the first-party
  Support Memory and Stage candidates. Its real run preserved 1,061 official
  mission-source occurrences, added the 43 official Support Memory boss drops,
  and produced 540 acquisition groups. All 285 DokkanStats mission occurrences
  and all 43 stage drops matched; no DokkanStats source or first-party stage
  drop was unmatched. DokkanStats contributes only banner, category,
  availability, and source-link presentation metadata.
- The Android consumer now renders `How to get` by event with an optional wide
  banner, an availability label, up to three compact mission rows, and group or
  exact-stage navigation. Missing group data keeps the previous flat-source
  rendering, missing banners are omitted, and film-only acquisition remains
  visible. Focused domain/app tests and a staging debug build pass; LDPlayer
  loaded the real promoted candidate and rendered a live DokkanStats banner.
- Stage drops now group by event area plus quest instead of difficulty-specific
  map ID. The real candidate collapsed 21 duplicate Normal/Z-Hard blocks (540
  acquisition groups to 519) while preserving all 43 exact drop sources. The
  event banner/title navigates to the area-filtered Stage catalog and each
  difficulty row navigates to its exact quest level. Android also consolidates
  the prior per-map group shape so compatible old caches remain readable.

## Stage and Support Memory staging checkpoint (2026-09-02)

- The isolated `staging/v2` R2 channel now carries the promoted Support Memory
  candidate and canonical first-party Stage delivery. Production object roots
  were not changed. The Support Memory manifest points to version
  `2026-09-02T15:24:48.033Z`, payload SHA-256
  `fe05d8066b50901295f8ce201106a00f76001bdd97c34e7a96e9fac2426994c3`,
  76 roots, and 1,970 official assets totaling 317,375,873 bytes.
- The Stage manifest points to version `2026-09-02T16:30:00.000Z` from Global
  snapshot `1787900894`. It contains 5,391 quest levels, 234 Z-Battles, 481
  Support Memory relations, one searchable catalog and 15 on-demand shards.
  The current catalog object SHA-256 is
  `5a378b3843734d8c07f95b5f98465b5aa7b09b3edab96801d84e44abf8741503`.
- Both publishers accept a validated object prefix, upload immutable objects
  before the mutable manifest, enforce byte budgets, and persist resumable
  checkpoints. Stage gzip objects are stored over HTTP as
  `application/gzip` without `Content-Encoding`; their manifest keeps the
  logical JSON/gzip metadata used by Android. This preserves the compressed
  bytes that Android validates before manually inflating them.
- Staging Android builds route Support Memory and Stage manifests to
  `https://assets.dkbcompanion.com/staging/v2`. A clean-device verification
  reproduced both advertised payload hashes, loaded the Stage catalog, fetched
  a detail shard on demand, and produced no Stage manager error. Memory 20009
  rendered one stage-drop group with its event banner and exact Normal/Z-Hard
  rows; the event and Stage 7 routes both opened successfully.
- Stage image identity remains database-driven while bytes currently come from
  the DokkanStats asset CDN through the remotely delivered `assetBaseUrl`.
  Moving these assets to R2 later requires a dataset publication, not an app
  release. Quest Mode classification is structural and Chapter-grouped; event
  cards no longer display a misleading aggregate Link Skill rate.
- Feature-closure backlog: after Support Memories, Missions and Stages behavior,
  navigation and dataset coverage are stable, mirror every referenced event
  and Stage presentation asset locally, not only Z-Battle images. Coverage must include
  Frontier, Quest Mode chapters, DB Story, Story, Bonus, Growth, Limited,
  Challenge, Z-Battles, and the event imagery reused by Mission and Support
  Memory acquisition surfaces. It must also include enemy thumbnail layers,
  reward-card layers, item icons and item backgrounds so transparent assets are
  composited from owned bytes. Validate every mirrored byte size and SHA-256,
  publish content-stable bytes under owned R2 keys, switch the remotely
  delivered asset roots to the owned R2 namespace, and let Android retain the
  verified files in its on-device cache. Keep the Android last-known-good cache
  and old-dataset compatibility. This is the final hardening step for this
  feature, before production promotion; it must not require an app release.
- The Event Missions tab still exposes only mission-shaped Support Memory
  acquisition sources. The first-party snapshot already contains the complete
  event mission rows and rewards (for example, area 335 contains 13 missions
  and 29 rewards), but the Stage delivery contract does not project them yet.
  Add a bounded, backward-compatible mission delivery before describing the tab
  as complete or publishing the final production lane.
- On 2026-09-03 the staging Stage lane was refreshed from the current Global
  6.5.5 LDPlayer database, DB version `1788329250`, asset version `1788327754`,
  and decrypted SQLite SHA-256
  `7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495`.
  The published manifest version is `2026-09-03T02:50:29.873Z`; it contains
  5,394 quest levels, 235 Z-Battles, 481 Support Memory relations and no Stage
  removals relative to the prior staging payload. Its catalog object is 193,368
  bytes with SHA-256
  `b4c92399628ee7c233df7c26db94ae49c875091551c0225b29f72ecacd2299ce`.
  A no-cache public download reproduced the advertised size and hash. The new
  Z-Battle is `211 / Planet Namek Saga 2`; three quest-level IDs were added.
- Stage Treasure rewards now join `treasure_items` by structural item ID and
  carry the official name plus `image_suffix_number`. This corrects area 335
  Stage 4 from the stale external `TreasureItem:8 / 3rd Anniversary Coin`
  interpretation to the first-party `Kachi Katchin` identity and suffix `13`.
  Character boss drops in the refreshed payload also carry the exact card
  rarity/type and canonical awakened detail ID; Zarbon `1022990` resolves to
  detail character `1023001`. Android still needs the final owned R2 asset
  mirror to remove external image latency and make item/card/enemy rendering
  independent from third-party hosts.

## Stage missions and owned asset mirror staging checkpoint (2026-09-03)

- The local Stage candidate for Global snapshot `1788329250` now projects the
  complete first-party event-mission surface: 7,137 missions across 412 event
  areas, including official rewards and exact Stage targets. The manifest binds
  the mission count, Android validates it before accepting a catalog, and old
  cached catalogs still fall back to the previous Support Memory-derived view.
- A deterministic owned-asset mirror now covers the presentation bytes used by
  Stage events, Quest chapters, DB Story, Z-Battles, Frontier, missions,
  rewards, card frames and enemy portraits. The accepted candidate contains
  6,143 verified files totaling 133,074,775 bytes with inventory SHA-256
  `ee05a1477dd80dfc007bd89cd56cbf510d292f5a1d23da165f33ae58dd1523b1`.
  Android rewrites both `/assets/global/en/` and `/assets/en/` source forms to
  the remotely delivered owned asset root.
- The mirror fails closed on source gaps. This snapshot has 66 explicit missing
  paths: 65 retired historical banners absent from all configured source CDNs
  and one invalid zero-byte placeholder card extracted from the official CPK.
  Their exact sorted path set is bound to a tracked, snapshot-specific
  acceptance record; any added, removed or changed gap invalidates generation
  and publication.
- Remote upload is resumable without silently trusting a partial local state:
  immutable asset writes use create-only semantics and reconcile a pre-existing
  object by exact size, content type, cache policy and SHA-256 metadata. Object
  paths and provenance URLs are canonicalized and validated before upload.
- Pipeline contract tests, Android domain/app tests, Android lint and the
  staging debug assembly pass. The final remote dry-run projects 136,022,482
  bytes for the asset mirror and 1,784,116 bytes for the Stage dataset. Both
  candidates are published under `staging/v2`; the public asset manifest
  SHA-256 is
  `314115b6e05555823147e7a34bcb679a98cdf478fe5b46ad9848190f272b5ffb`,
  the Stage manifest SHA-256 is
  `31b89d4f1b52129b97d2d7827b644b774065428bb18b4e56c3979d441760f9e5`,
  and the public catalog reproduces its advertised 413,651 bytes and SHA-256
  `e342158f361efb5d4c2628a3dbc8da6b1e18687e22608334e15a2fa0b0ca93f5`.
  Public event-banner, character-thumb, medal and Frontier samples also match
  their inventory hashes. No branch was pushed.

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
