# Dokkanpanion Project State

**Last updated**: 2026-08-10

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

### K10–K17 — field-scoped and compact character product shadow

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
