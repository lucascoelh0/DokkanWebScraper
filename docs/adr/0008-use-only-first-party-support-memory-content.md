# ADR-0008: Use only first-party Support Memory content

**Date**: 2026-08-31
**Status**: accepted
**Deciders**: Lucas Coelho, Codex

## Context

Support Memories originally combined gameplay rows with community-derived
acquisition and presentation fields. A merge fallback silently retained old
values when an official join was absent, which made provenance ambiguous and
could keep stale data alive after a game update. The installed game contains
the authoritative database rows, static images, enhancement icons, film icons,
and per-memory animation CPKs needed by the product.

## Decision

Support Memory candidates use only the official Global game database and bytes
acquired from the installed Global package. Missing official acquisition joins
remain absent and are audited as unresolved. Previous datasets may be supplied
only for compatibility comparison and never as content inputs.

We retain the existing `dokkanInfo` JSON property as a legacy wire envelope so
Android 2.0.11 and old caches remain compatible. New entries identify its
official replacement content with `presentationSource: "game-assets"`. Every
source archive and delivered asset is inventoried by stable identity, size, and
SHA-256 before publication.

## Alternatives Considered

### Keep a field-level community fallback

- **Pros**: More acquisition links and fewer visibly missing fields.
- **Cons**: Mixed authority, stale values, and provenance that depends on the
  previous payload.
- **Why not**: Completeness must not masquerade as official correctness.

### Rename the presentation contract immediately

- **Pros**: Cleaner terminology for new clients.
- **Cons**: Breaks the Play-review 2.0.11 consumer and old cached datasets.
- **Why not**: The source boundary can change without forcing an app release.

## Consequences

### Positive

- New Support Memories can be delivered from official data without waiting for
  a Play Store update or community scraper support.
- Missing joins are explicit and measurable instead of silently inherited.
- Assets are reproducible and independently integrity-checkable.

### Negative

- Some memories have no direct mission presentation until the official DB
  exposes a matching reward relation.
- Official animation bytes materially increase the auxiliary asset footprint.

### Risks

- A future package can change CPK layout or `script_name` conventions. The
  versioned source identity, exact archive inventory, fail-closed extractor,
  non-identity join test, and publisher dry-run mitigate this risk.
