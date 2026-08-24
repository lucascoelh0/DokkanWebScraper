# ADR-0006: Separate staging and production dataset channels

**Date**: 2026-08-23
**Status**: accepted
**Deciders**: Lucas Coelho, Codex

## Context

Production Android clients load the mutable Characters and Team Analysis
manifests directly from R2. Publishing a new parser output to those paths can
therefore affect installed clients before the matching Android validation has
been exercised against the real CDN. The project needs a remote pre-production
path that preserves the production delivery contract, supports exact-pair
testing, and cannot be selected accidentally by a release build.

## Decision

We keep two explicit dataset channels in the same R2 bucket and public domain:
`production` and `staging`. Production retains the existing root manifest and
payload namespaces. Staging uses manifest and content-addressed payload keys
under `staging/`, with separate local publisher state.

Characters and Team Analysis are tested and promoted as an exact compatible
pair. Remote production writes require the additional explicit
`--promote-production` flag. Android release builds are hard-coded to
production; debug builds also default to production and can opt into staging
only through `-PdebugDatasetChannel=staging`. Dataset managers allowlist the
known manifest keys and enforce that each manifest references a payload from
its own channel.

Portrait keys are not yet channel-scoped. Staging Character publication must
therefore use `--skip-portraits` until portraits are isolated or made safely
content-addressed. Each app release also receives a branch or tag so that its
code and data compatibility can be reproduced when diagnosing production.

## Alternatives Considered

### Alternative 1: Publish candidates directly to production

- **Pros**: No additional channel or operational workflow.
- **Cons**: Installed clients consume unverified parser changes immediately.
- **Why not**: A data-only change can break production independently of a Play
  release and without a safe remote smoke-test window.

### Alternative 2: Use a separate staging bucket and domain

- **Pros**: Strong infrastructure-level separation.
- **Cons**: Additional credentials, DNS, configuration, and duplicated storage
  policy for the current scale of the project.
- **Why not**: A namespaced channel in the existing bucket provides sufficient
  isolation when publishers and clients enforce typed keys fail-closed.

### Alternative 3: Share mutable manifest and payload paths

- **Pros**: Fewer object keys and no Android channel configuration.
- **Cons**: Staging and production bytes can be mixed or promoted implicitly.
- **Why not**: Manual discipline alone does not provide a reliable release
  boundary.

## Consequences

### Positive

- Candidate data can be exercised from the real CDN without changing
  production manifests.
- Release APKs cannot opt into staging through a Gradle property.
- Exact compatible Character and Team Analysis bytes can be promoted after
  validation.
- Release branches or tags preserve a reproducible production checkpoint.

### Negative

- Publishers and clients must maintain two manifest namespaces and publisher
  state files.
- Staging consumes additional R2 storage and requires its own cleanup policy.
- Portrait changes cannot yet be validated through staging publication.

### Risks

- A manifest could reference the wrong channel. Mitigate this with typed channel
  configuration, finite key allowlists, and payload-prefix validation on both
  publisher and Android.
- Staging releases could accumulate. Mitigate this with projected-byte dry-runs
  and the same conservative bucket budget used for production.
- A release checkpoint could drift from the promoted data. Mitigate this by
  promoting only an already validated exact pair and recording its hashes with
  the release branch or tag.
