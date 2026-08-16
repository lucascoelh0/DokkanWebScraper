# Database Characters K61 - supported leader public candidate shadow

Status: public read-only delivery and shadow lookup GO for the exact candidate
manifest published by K60. Persisted consumer, dataset authority, production,
Android and UI remain NO-GO. Contract version `1.0.0`.

## Boundary

K61 consumes the public release without credentials, writers or output
artifacts. It requires explicit `--opt-in-k61` and `--remote-read-only`, every
source root, the pinned native/SQLite inputs and a canonical UTC observation
time. Production exposes no injectable validator, transport, URL, key or
report.

The mutable public object is deliberately pinned to the exact 11,561-byte K58
candidate manifest with SHA-256
`370dc7026c4523d509a403a2fbfa91009d1bb9452f7ab277f9c6aaebb8a1441e`.
K61 requires its `candidateOnly: true`, `remotePreflight: NOT_EXECUTED` and
`mutationExecuted: false` fields. They describe the offline K58 artifact and
are preserved as a product boundary rather than reinterpreted as publication
or authority claims.

## Read-only sequence

Exactly six public HTTPS GETs run in this order:

1. mutable manifest before the shadow;
2. content-addressed payload;
3. content-addressed coverage;
4. content-addressed validation;
5. content-addressed K56 source manifest;
6. mutable manifest after the shadow.

The origin and namespace are fixed. Redirects and encoded responses are
blocked; `Accept-Encoding: identity`, per-response, aggregate and timeout
limits apply. Every response must match exact bytes, SHA-256, size,
`Content-Type` and `Cache-Control`. The final mutable-manifest reread must be
byte-identical to the first.

Before the first GET and after all lookups, K61 independently invokes the public
K58 source-bound validator. Candidate, plan, receipt and marker must remain
byte-identical across both validations. The public four-member bundle is
reconstructed as a K56 artifact, including bounded gunzip and canonical JSON,
and must match the exact K56 member, full-artifact and lineage pins.

## Shadow lookup

The reconstructed public K56 artifact is passed to the existing K57 private
consumer boundary. It builds indexes by reference identity, state ID, card ID
and effect row ID, preserves source order and multiplicity, and returns only
deep-frozen clones. K61 audits up to five pinned samples from every lookup
dimension and releases the public artifact/consumer before the second K58
validation.

The public dataset remains supported-only:

- 12,265 references;
- 7,248 states;
- 3,434 cards;
- 3,836 effect rows;
- 17 conditional effects and 45 references excluded as
  `runtime_deck_index_unresolved`;
- the user-confirmed domain rule remains coverage-only, is not first-party
  runtime-deck-index evidence and does not authorize the projection.

## Invocation

```text
npm run audit:database-characters-leader-supported-public-shadow -- \
  --sidecar-root <exact-k0-k7-root> \
  --production-root <exact-k7-production-root> \
  --fyi-root <exact-k7-fyi-root> \
  --k43-root <exact-k43-artifact-root> \
  --k46-root <exact-k46-artifact-root> \
  --k48-root <exact-k48-artifact-root> \
  --k56-root <exact-k56-artifact-root> \
  --k58-root <exact-k58-artifact-root> \
  --native-runtime <exact-libcocos2dcpp.so> \
  --database <exact-first-party-global-sqlite> \
  --checked-at <canonical-UTC-timestamp>
```

## Real result

The real K61 audit checked at `2026-08-16T16:00:10.344Z` completed with exit 0
and empty stderr. Six public responses totaled 238,870 bytes. Both K58
validations returned source-bound GO; the complete K58 bundle and the public
manifest remained stable. Every public member and metadata tuple matched.

All four lookup dimensions passed five samples each and returned deep-frozen
clones. The 4,364-byte stdout report has SHA-256
`4b2a5ed42ab5cf4d73cb40d5a40818a19e3eeab6daef01ab5755cf700bd71838`.
Remote mutation, authenticated requests, Character[] reads and apply operations
were all zero.

Per-process peaks were 1,016,770,560 and 1,022,099,456 bytes for the two K58/K55
validations and 1,003,216,896 bytes for the K61 parent. Maximum individual
process RSS was 1,022,099,456 bytes, below the exclusive 1 GiB limit. Combined
process-tree RSS remains unmeasured and NO-GO.

Focused K57+K61 checks passed 16/16. The compiled `database-characters` suite
passed 328 tests with 9 platform-dependent tests pending.

## Readiness

| Scope | Decision |
| --- | --- |
| exact public six-GET sequence | **GO** |
| public bytes and metadata | **GO** |
| K58 source binding before/after | **GO** |
| public K56 reconstruction | **GO** |
| four private lookup dimensions | **GO** |
| candidate-only boundary | **GO** |
| per-process RSS below 1 GiB | **GO** |
| combined process-tree RSS below 1 GiB | **NO-GO** |
| persisted consumer or output artifact | **NO-GO** |
| authenticated network or R2 mutation | **NO-GO** |
| conditional 17 / combined Leader+Friend / final combat value | **NO-GO** |
| authority, production, Android or UI | **NO-GO** |
