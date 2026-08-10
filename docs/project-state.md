# Dokkanpanion Project State

**Last updated**: 2026-08-10

This is the concise operational checkpoint for future sessions. Durable
decisions live in [`adr/`](adr/), and current workflow instructions live in
[`AGENTS.md`](../AGENTS.md).

## Repository Checkpoints

- `D:\Dokkan\DokkanWebScraper` owns the TypeScript data pipeline. At the
  database-first integration gate, `main == origin/main == ba29759`; this
  context-only follow-up intentionally advances `main` beyond that checkpoint.
- `D:\Dokkan\Dokkanpanion` owns the Android consumer. Its synchronized
  `master` checkpoint is `fe58fe1`.
- Both repositories were synchronized at this checkpoint; no older commits
  remain local-only.
- The project uses Codex exclusively. Provider-neutral workflow, verification,
  repository and publication rules are defined in `AGENTS.md`.

## Database-first Checkpoint

- The database-first Character and Team Analysis campaign DB0–DB50 and its
  integration campaign C1–C5 are merged as one dependency-complete unit.
- The database-first sidecar is optional, additive, absent-compatible and
  disabled by default. Production generation, contracts, publishers, R2 and
  Android do not consume it.
- Current decisions are **GO** only for the reviewed infrastructure and for
  optional generation against the exact C4-pinned SQLite, ELF and semantic
  evidence identity.
- Current decisions remain **NO-GO** for R2 publication, Android shadow
  consumption, authoritative combat calculation and full simulation.
- Supported-only projection excludes every `partial` or `unknown` dimension;
  joins use structural IDs rather than names or localized text.

Shadow parity joins 571 of 575 sidecar states. The four known unjoinable states
remain explicit and non-blocking while the infrastructure is disabled:

- `1017121:4017141:initial`;
- `1024381:4024401:initial`;
- `1028161:1028161:eza`;
- `1032710:1032710:initial`.

The durable decision is recorded in
[`ADR-0005`](adr/0005-use-an-optional-database-first-team-analysis-sidecar.md),
and detailed evidence remains in the database-first frontier report and C1–C5
specifications.

## Android Checkpoint

- Android `master` includes the Team Analysis foundation (`0f0d88f`) and cache
  transition hardening (`fe58fe1`).
- Android continues to preserve usable cached data across invalid, missing or
  older datasets.
- Database-first shadow consumption is not implemented or authorized.

## Offline Capture Checkpoint

- H13 corrected the H11 gasha comparison on `codex/database-server-capture-audit` without requests, replay or production changes.
- The 627 unique legacy conflict facts resolve to 612 representation mismatches, 15 coverage gaps and zero confirmed conflicts.
- The old 1,254 figure is a non-exclusive comparison-cell total, not a distinct-fact total.
- H12 readiness remains 2 GO and 5 NO-GO; scraper replacement, authenticated refresh, R2, Android shadow and community-source retirement remain disabled.

## Next Independent Domain

The next independent data domain is events, stages, enemies and bosses. It
should begin on a new branch from the current scraper `main`, without activating
the database-first sidecar or expanding its production authority.

## Operating Constraints

- Read this checkpoint before reconstructing broader project context.
- Keep verbose output in ignored `.agent-logs/` and start with focused checks.
- Do not commit generated `data/` artifacts; keep only matching tracked `lib/`
  output for changed TypeScript sources.
- Treat commit, push, R2 publication and Android changes as separate actions
  requiring explicit authorization.
- Run an R2 publisher dry-run and inspect projected bytes before any upload.
- Preserve unrelated user changes in both repositories.

## Maintenance Rule

Update this file after a major integration, publish, cutover or user-visible
milestone. Keep low-level evidence in the relevant report/specification and
create or supersede an ADR when a durable decision changes.
