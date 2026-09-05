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

## SKO-02 publication protocol

The dedicated publisher is `game-db/game-db-skill-orb-publisher.ts`. It accepts
only one explicit mode and one explicit candidate root. There is no production
mode in this slice.

Local source-bound validation performs no remote operation:

```text
npm run publish:game-db-skill-orbs-r2 -- --candidate data/skill-orbs/candidate-sko01-1788329250-v5 --local-validate
```

The required staging preflight performs paginated LIST plus bounded HEAD/GET
verification, but no PUT, DELETE, cleanup or state write:

```text
npm run publish:game-db-skill-orbs-r2 -- --candidate data/skill-orbs/candidate-sko01-1788329250-v5 --dry-run-staging-v2
```

An independently authorized staging publication must use the live-only mode
and confirm the exact dataset version. Merely running the package script or a
dry-run cannot enter the write path:

```text
npm run publish:game-db-skill-orbs-r2 -- --candidate data/skill-orbs/candidate-sko01-1788329250-v5 --publish-staging-v2 --confirm-dataset-version 1788329250-1.0.0-95d9a82403610974
```

The live protocol reruns source validation and the complete remote plan. It
pins the mutable-manifest baseline immediately before the first write, creates
missing assets and payload with `If-None-Match: *`, reads every written object
back in full, revalidates every immutable object and the local source, then
rereads the manifest baseline and complete bucket inventory. The final
inventory plus the remaining manifest byte delta must still be strictly below
the 10 GB ceiling. The manifest is the final conditional write:
create-only when absent, or strong-ETag `If-Match` when replacing different
bytes. Existing immutable byte or metadata drift is a fatal conflict. ETag is
only a compare-and-swap witness; size plus GET/SHA-256 remains byte authority.
Both manifest baseline gates also bind content type, content encoding, cache
control and SHA-256 metadata, so metadata-only races fail closed.

The productive executor is sealed around the fixed staging bucket and internal
S3 adapter. Its runtime mode dispatch uses an exact three-value whitelist and
an exhaustive fail-closed branch; an unknown JavaScript value cannot fall into
publication. Dependency injection exists only in an explicitly marked,
non-authoritative test harness. Local files are opened without following the
final link, sized before allocation, read to the exact witnessed length through
the same file handle, and rechecked by file identity and real directory chain.

There is deliberately no delete, cleanup, rollback or persisted publisher
state. If an operation stops after creating immutable objects but before the
manifest, rerun the dry-run first. Exact partial objects are safely reused;
conflicting bytes fail closed. Never repair a collision by overwriting or
deleting it. A failed or raced manifest remains unchanged, so recovery is a
fresh baseline-pinned invocation after the competing writer or transport issue
has been understood.

Remote credentials are read only by the ephemeral S3 client boundary from
`CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. They are
never CLI arguments or report fields. The publisher uses one client per
operation, bounded concurrency/timeouts/retries, a complete continuation-token
validated inventory, and a strict projected bucket ceiling below
10,000,000,000 bytes. Operational failures return a sanitized `NO-GO` envelope
with phase, reason code and accumulated telemetry, including partial immutable
writes; raw exceptions, CLI tokens and credential values are not serialized.

## Rejected alternatives

- Embedding every orb in Characters: excessive hot-path size and update
  coupling.
- Treating Stage rewards as the catalog: incomplete coverage and acquisition
  semantics outside this slice.
- Runtime joins by names or description text: localized, lossy and not an
  identity contract.
- Using third-party catalog data or assets as authority: inconsistent with the
  first-party source boundary.
