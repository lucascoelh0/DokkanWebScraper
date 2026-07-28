# ADR-0001: Use source-neutral domain contracts

**Date**: 2026-07-26
**Status**: accepted
**Deciders**: Lucas Coelho, Codex

## Context

This record documents a decision established during the 2026 scraper
migration. No single external source has the best coverage for every Dokkan
domain. `dokkan.fyi` exposes strong structured gameplay data, DokkanInfo has
useful media and enrichment, and the Global game database is a future path to
first-party data. Coupling the app contract to any one source would make source
changes expensive and leak scraper details into Android.

## Decision

We define source-neutral domain contracts and keep source adapters explicit.
Each field or dataset has one authoritative owner, optional enrichment records
its provenance, and a source can be replaced without changing unrelated app
models. The current production pipeline may use `dokkan.fyi` as canonical data
and DokkanInfo as enrichment while the game-database pipeline proves parity.

## Alternatives Considered

### Alternative 1: Use only dokkan.fyi

- **Pros**: One integration and strong structured character mechanics.
- **Cons**: Missing or weaker media, item, and presentation metadata.
- **Why not**: It would discard useful coverage and make a site outage a
  complete pipeline outage.

### Alternative 2: Expose source payloads directly to Android

- **Pros**: Less mapping work in the scraper.
- **Cons**: Source schema changes would become Android migrations and cached
  payload compatibility problems.
- **Why not**: The app should depend on Dokkan concepts, not website internals.

### Alternative 3: Wait for a complete first-party database pipeline

- **Pros**: Better long-term authority and independence.
- **Cons**: Delays the app while decoding, acquisition, and validation remain
  incomplete.
- **Why not**: The existing adapters already provide a usable production path.

## Consequences

### Positive

- Sources can be compared, replaced, or combined behind stable contracts.
- Optional enrichment does not block canonical dataset generation.
- Android models remain focused on product behavior.

### Negative

- The scraper owns additional normalization, provenance, and join logic.
- Contract tests are required to prevent source-specific fields from leaking.

### Risks

- Conflicting sources can silently overwrite data. Mitigate this with explicit
  ownership rules, provenance fields, golden fixtures, and validation reports.
