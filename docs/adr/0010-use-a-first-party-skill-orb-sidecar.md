# ADR-0010: Use a first-party Skill Orb sidecar

**Date**: 2026-09-05
**Status**: accepted
**Deciders**: Lucas Coelho, Codex

## Context

The Global game database snapshot `1788329250` contains a complete Equipment
Skill Item catalog with 8,751 items, 14,021 ordered effects and four structural
limitation families. Characters and Stages need to link to the same detail,
but embedding the catalog in Characters would inflate its hot-path payload and
expanding it through Stage rewards would make acquisition surfaces an
incomplete authority.

The Android app must remain usable with an old cache or no Skill Orb dataset.
Stage rewards already carry a smaller optional `equipmentSkill` enrichment and
that compatibility fallback must remain intact.

## Decision

We deliver Skill Orbs as an independent, optional, first-party sidecar. A small
mutable manifest identifies one immutable gzip payload by exact byte size and
SHA-256. The payload binds the database snapshot, SQLite SHA-256 and parser
version; normalizes limitation sets once; and keeps deterministic reverse
indexes for exact-card and structurally expanded character-family eligibility.

All identity joins use source IDs. `CardLimitation` alone populates the exact
card index. `CardUniqueInfoSetLimitation` alone populates the family index by
joining `card_unique_info_set_relations` to `card_unique_infos` and `cards`.
Category names, card names, titles and localized descriptions are presentation
only. Element eligibility preserves the official bitpattern and proven native
type/class codes.

The sidecar reuses the Stage asset namespace for content-identical official
bytes. Its inventory is deduplicated by path and binds every asset size and
SHA-256. Level overlays remain derived only from the proven native layout and
first-party font/base assets. The manifest is promoted only after payload and
asset availability in any future separately authorized publication.

Android loads, verifies and caches the sidecar independently. Failure or
absence cannot break Characters or Stages; Stage's existing inline enrichment
continues to render when catalog resolution is unavailable.

## Consequences

- Character startup, parsing and database rebuild remain independent from the
  8,751-item catalog.
- Stages and Characters share one Skill Orb detail without making either
  dataset authoritative for the catalog.
- Exact exclusivity and character-family eligibility cannot drift into
  text-based matching.
- The app needs a separate manager, loading/error/offline states and cache
  migration behavior.
- A future R2 publication must run a dry-run, verify projected bytes, upload
  immutable assets and payload first, and promote the mutable manifest last.

## Rejected alternatives

- Embedding every orb in Characters: excessive hot-path size and update
  coupling.
- Treating Stage rewards as the catalog: incomplete coverage and acquisition
  semantics outside this slice.
- Runtime joins by names or description text: localized, lossy and not an
  identity contract.
- Using third-party catalog data or assets as authority: inconsistent with the
  first-party source boundary.
