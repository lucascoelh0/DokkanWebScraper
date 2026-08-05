# ADR-0003: Distribute datasets through versioned R2 manifests

**Date**: 2026-07-26
**Status**: accepted
**Deciders**: Lucas Coelho, Codex

## Context

This record documents the production hosting decision made after the character
dataset exceeded GitHub's 100 MB file limit. The app needs independent data
updates without a Play Store release, reliable cached fallback, and integrity
checks. The deployment must also remain comfortably inside Cloudflare R2's
10 GB free storage allowance.

## Decision

We publish datasets and mirrored assets to Cloudflare R2 behind
`assets.dkbcompanion.com`. Every mutable dataset has a `no-store` manifest with
schema version, dataset version, file name, byte size, and SHA-256. Payloads
and content-stable assets use cache-appropriate object keys. Publishers run a
dry-run first, enforce storage budgets, upload the payload before the manifest,
and preserve the last known-good release on failure.

Small optional datasets with content-hashed payload keys, beginning with Team
Analysis, retain a bounded window of two verified releases: the active release
and its immediately previous valid release. Cleanup beyond that window happens
only after manifest promotion. Rollback is an explicit operational manifest
promotion to the retained immutable key; publishers do not perform destructive
automatic rollback.

## Alternatives Considered

### Alternative 1: Commit generated data to GitHub

- **Pros**: Familiar history and distribution.
- **Cons**: Hard file-size limits, repository growth, and unsuitable binary
  asset storage.
- **Why not**: The production character artifact already exceeded GitHub's
  limit.

### Alternative 2: Bundle datasets only in the APK

- **Pros**: Simple runtime and offline-first installation.
- **Cons**: Every data refresh requires a new app release.
- **Why not**: Game data changes much more often than application code.

### Alternative 3: Fetch directly from source websites at runtime

- **Pros**: No hosted dataset pipeline.
- **Cons**: Unstable contracts, network fan-out, source rate limits, and no
  atomic version or integrity guarantee.
- **Why not**: Scraping and normalization belong outside the mobile client.

## Consequences

### Positive

- New data can ship without updating the APK.
- Android can validate downloads and keep a usable cached dataset.
- Publication is atomic from the app's perspective because the manifest moves
  last.

### Negative

- Each dataset needs publisher, manifest, cache, and rollback logic.
- R2 state and public endpoints require operational verification.

### Risks

- Accumulated releases or assets could exceed the free allowance. Mitigate this
  with projected-byte dry-runs, managed-prefix cleanup, conservative budgets,
  and no unbounded version retention.
- A bad manifest could strand clients. Mitigate this by validating size and
  SHA-256 before upload and never deleting the last known-good payload first.
