# Architecture Decision Records

This directory contains durable architectural decisions for the Dokkanpanion
data pipeline and its Android consumer. Mutable progress belongs in
[`project-state.md`](../project-state.md), not in ADRs.

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-use-source-neutral-domain-contracts.md) | Use source-neutral domain contracts | accepted | 2026-07-26 |
| [0002](0002-keep-auxiliary-datasets-separate.md) | Keep auxiliary datasets separate | accepted | 2026-07-26 |
| [0003](0003-distribute-datasets-through-versioned-r2-manifests.md) | Distribute datasets through versioned R2 manifests | accepted | 2026-07-26 |

## Usage

- Add an ADR only for a decision with a meaningful long-term trade-off.
- Do not rewrite accepted decisions to match later choices. Supersede them with
  a new ADR and update the status in this index.
- Use the next available four-digit number.
- Keep each record short enough to read in a few minutes.
