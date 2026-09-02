# ADR-0009: Use authorized Support Memory acquisition presentation

**Date**: 2026-09-02
**Status**: accepted
**Deciders**: Lucas Coelho, Codex

## Context

The Global game database contains the authoritative mission rewards and all 43
Support Memory stage drops, but it does not contain every player-facing event
banner, source classification, or useful availability label. DokkanStats
exposes those presentation fields and its owner authorized automated use.

ADR-0008 correctly removed community data as a fallback for identity, gameplay,
mechanics, and official game assets. Its blanket prohibition also prevents a
strictly reconciled presentation enrichment from making acquisition paths easy
to scan.

## Decision

Support Memory acquisition facts remain first-party. An optional DokkanStats
sidecar may add only acquisition presentation metadata after exact joins:

- missions join by Support Memory ID and mission ID;
- stage drops join by Support Memory ID, map ID, and drop type;
- root name and maximum level must match the first-party candidate exactly;
- every DokkanStats stage drop must match a first-party boss drop, and every
  first-party Support Memory boss drop must match DokkanStats.

The enrichment may supply event banners, source category labels, availability,
and source URLs. It cannot override identity, gameplay effects, quantities,
mission ownership, stage topology, item relations, or official game assets.
Missing enrichment remains valid and Android must retain its old-cache fallback.

This supersedes ADR-0008 only for reconciled acquisition presentation metadata.
ADR-0008 continues to govern all other Support Memory content.

## Consequences

### Positive

- The app can group acquisition sources by event with recognizable banners and
  compact mission previews.
- Stage-drop completeness is checked against both sources instead of assumed.
- A missing or changed third-party response cannot silently change game facts.

### Negative

- The candidate build now has an additional optional collection and promotion
  step.
- External banners can disappear; the app therefore omits failed banners rather
  than displaying a broken-image placeholder.

### Risks

- DokkanStats can change its relative asset paths or source schema. Typed source
  parsing, exact identity checks, parity audits, focused tests, and fail-closed
  promotion limit the impact.
