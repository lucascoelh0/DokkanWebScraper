# ADR-0007: Version production datasets by consumer contract lane

**Date**: 2026-08-23
**Status**: accepted
**Deciders**: Lucas Coelho, Codex

## Context

Installed Android 2.0.8 clients always read the current root production
manifests and cannot negotiate a new wire contract after installation. Pointing
those manifests at incompatible bytes could break or silently degrade existing
clients, while freezing them would prevent older installations from receiving
new characters. Parser, schema or minimum-app metadata inside a manifest cannot
protect a client that does not already enforce that metadata.

## Decision

We version production delivery by consumer contract lane. The existing root
Characters and Team Analysis manifests remain the `v1` lane for Android 2.0.8;
the next Android contract reads explicit `v2/` manifests. Staging mirrors each
lane under `staging/v1/` and `staging/v2/`.

A single official-DB import produces one source-neutral canonical model.
Lane-specific projectors serialize that model into compatible Characters and
Team Analysis pairs. Unsupported v1 enrichment is omitted or represented by
the existing partial/unknown boundary instead of emitting a v2-only shape.
Each lane is validated against its frozen consumer contract and promoted
independently. A breaking change creates a new lane; an additive change remains
in an existing lane only after consumer-compatibility evidence passes.

The root v1 lane remains updated while Android 2.0.8 has supported active
installations. If a release cannot be projected safely, its previous v1
manifest remains active rather than accepting incompatible bytes. In-app update
guidance may reduce version lag, but it does not replace lane isolation as the
safety boundary.

## Alternatives Considered

### Alternative 1: Keep one additive universal contract

- **Pros**: One payload pair and one production manifest per dataset.
- **Cons**: Every future change must be harmless to every historical decoder,
  materializer and minified build.
- **Why not**: Compatibility would depend on assumptions about old clients
  rather than a bounded, testable contract.

### Alternative 2: Freeze data for old app versions

- **Pros**: No compatibility projector or legacy publication work.
- **Cons**: Older installations stop receiving newly released characters.
- **Why not**: Character freshness is a core product expectation even when a
  user delays an app update.

### Alternative 3: Route dynamically by app version

- **Pros**: One public entry point selected by a server.
- **Cons**: Existing clients use fixed static URLs and do not provide a trusted
  contract identity for routing; it also adds runtime backend complexity.
- **Why not**: It cannot safely retrofit negotiation into Android 2.0.8.

### Alternative 4: Maintain two complete parsers

- **Pros**: Each app line could evolve independently.
- **Cons**: Duplicated DB interpretation can drift and doubles maintenance.
- **Why not**: Compatibility belongs at the serialization boundary, after one
  canonical interpretation of the official data.

## Consequences

### Positive

- Old clients can continue receiving compatible character updates.
- New clients can adopt richer typed contracts without risking Android 2.0.8.
- A failed legacy projection blocks only that lane, not newer clients.
- One canonical parser keeps official DB semantics consistent across lanes.

### Negative

- Each supported lane needs a projector, validation fixtures, manifests,
  publisher state and retention accounting.
- Unsupported mechanics may appear less richly in old clients.
- Lane retirement becomes an explicit product and operations decision.

### Risks

- A projector could claim compatibility while emitting a new wire value.
  Mitigate this with a frozen v1 consumer harness, full-corpus decoding and a
  minified staging smoke before promotion.
- Contract lanes could accumulate indefinitely. Mitigate this by supporting
  lanes according to active Play installations and retaining bounded immutable
  releases inside each lane.
- A publisher could mix Character and Team Analysis lanes. Mitigate this with a
  typed contract-lane option, lane-scoped keys/state and exact source
  version/SHA validation for every pair.
