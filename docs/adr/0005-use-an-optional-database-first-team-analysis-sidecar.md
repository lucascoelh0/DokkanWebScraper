# ADR-0005: Use an optional database-first Team Analysis sidecar

**Date**: 2026-08-07
**Status**: accepted
**Deciders**: Lucas Coelho, Codex

## Context

DB0–DB50 established a first-party character and Team Analysis model with explicit `supported`, `partial` and `unknown` boundaries. The production Team Analysis contract still comes from the current source-neutral pipeline and must remain compatible with existing Android caches. Directly merging experimental fields into that contract would couple production to incomplete lifecycle, probability, attack-kind and final-HP semantics.

## Decision

We introduce a separately versioned, optional database-first sidecar. Its identity is exclusively structural: snapshot, card, state, form, release state, passive-skill ID, rule ID, efficacy type and effect ordinal. Names and localized text are never join keys.

The canonical sidecar keeps status per independent dimension and an audit channel with raw fields, source-projection hashes and SQLite/runtime provenance. A separate consumable projection may copy a dimension only when its status is exactly `supported`. `partial` and `unknown` values never receive product defaults and remain outside the consumable channel.

The sidecar is absent-compatible: existing production generation, delivery and Android behavior do not require it. It will remain under the experimental data root until publication and client adoption receive separate approval.

## Consequences

- First-party mechanics can be integrated incrementally without changing the current Team Analysis payload.
- Source disagreements can be measured in shadow mode without treating the text parser as authority.
- Consumers must join by structural IDs and tolerate the sidecar being completely absent.
- Audit and consumable artifacts evolve independently but share exact snapshot and source hashes.
- Publishing, Android consumption and replacement of the current source remain separate future decisions.
