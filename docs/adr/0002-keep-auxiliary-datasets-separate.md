# ADR-0002: Keep auxiliary datasets separate

**Date**: 2026-07-26
**Status**: accepted
**Deciders**: Lucas Coelho, Codex

## Context

This record documents a decision established while the character dataset grew
beyond GitHub's file limit and gained support memories, stages, items, summons,
missions, categories, and media. These domains update at different rates and
are not required for every app workflow. Embedding all of them into the
character payload would increase download, parsing, database-rebuild, and
compatibility costs.

## Decision

We keep the character dataset focused on character-owned data and publish
auxiliary domains as separate versioned datasets. Cross-domain relationships
use stable IDs and app-facing join models. Android downloads an auxiliary
dataset when a feature needs it and tolerates missing optional enrichment.

## Alternatives Considered

### Alternative 1: One complete JSON bundle

- **Pros**: One download and no cross-file lookup.
- **Cons**: Large updates, expensive parsing, duplicated data, and a broad
  failure surface.
- **Why not**: A small change to one domain would require replacing everything.

### Alternative 2: Resolve all joins at Android runtime from raw source data

- **Pros**: Smaller scraper output and flexible client queries.
- **Cons**: Pushes normalization cost, source knowledge, and inconsistency into
  the mobile app.
- **Why not**: Shared joins should be computed and validated once in the data
  pipeline.

### Alternative 3: Bundle all auxiliary data in the APK

- **Pros**: Immediate offline availability.
- **Cons**: Data updates require Play Store releases and increase APK size.
- **Why not**: Dokkan data changes independently from app code.

## Consequences

### Positive

- Features and datasets can evolve and publish independently.
- Startup and refresh work can stay proportional to the feature being used.
- Large media and catalogs do not bloat the character database.

### Negative

- The app needs per-dataset managers, manifests, caches, and loading states.
- Cross-dataset IDs and schema compatibility require dedicated tests.

### Risks

- A dataset can reference an unpublished entry in another dataset. Mitigate
  this with referential-integrity checks before publication and non-clickable
  UI when a target is unavailable.
