# Database Characters K44 - local state product shadow consumer

Status: source-bound local shadow lookup GO. Persisted consumption,
`Character[]`, apply/overlay, authority, production, writer, publisher,
network, R2, Android and source removal remain NO-GO. Contract version
`1.0.0`.

## Boundary

K44 proves that the supported-only K43 state product can be queried without
changing product behavior. It is explicitly opt-in, local and stdout-only. It
accepts only a K43 artifact that passes the complete source-bound validator
against the exact K0/K1/K2/K7, productive and FYI roots.

The consumer creates private indexes for states by `stateId` and `cardId`, and
for release, awakening and form transitions by `transitionId` and every
participating structural `cardId`. Callers receive new deep-frozen clones;
they cannot reach or mutate the indexes. A card lookup means participation in
a structural transition, not ownership, effective state or product authority.

Direct report/consumer factories are deliberately non-authoritative: given a
raw artifact set they return `consumerShadow: NOT_EXECUTED` and do not claim
source validation or stability. Only the runner's private finalization can
promote the in-memory report to GO after the complete before/after protocol.

## Invocation and integrity

The runner requires Node garbage collection support and has no root defaults:

```text
npm run audit:database-characters-state-product-shadow -- \
  --opt-in-k44 \
  --sidecar-root <exact-k0-k7-root> \
  --production-root <exact-k7-production-root> \
  --fyi-root <exact-k7-fyi-root> \
  --k43-root <exact-k43-artifact-root>
```

K44 validates K43 source-bound before indexing, pins all four projection
counts and K7 coverage-only counts, and fingerprints the four K43 members. It
then releases the first artifact graph, runs the complete source-bound
validation again, and requires the same artifact fingerprint before the
consumer can be returned. The report is timestamp-free, contains only bounded
structural-ID samples and is limited to less than 64 KiB. RSS is fail-closed at
an exclusive 1 GiB limit.

## Real result

| Index | Records | Distinct card IDs |
| --- | ---: | ---: |
| states | 10,651 | 5,759 |
| release + awakening + form transitions | 12,171 | 4,497 |

The transition total is 4,892 release, 6,905 awakening and 374 form records.
K7's 4,296 productive agreements and 1,463 unjoinables remain coverage only.
Real lookups for `card-state:1000010:initial` and `awakening-route:1` returned
the expected frozen structural clones.

Two independent canonical reports were byte-identical at 3,774 bytes with
SHA-256
`bd8a8e1479ebf174331a17c87687a8a0221d5304f80969c26a3e488ed8fb69a8`.
Measured peak RSS was 1,052,553,216 and 1,051,172,864 bytes; the post-review
run measured 1,047,080,960 bytes. All remain below 1 GiB.

## Readiness

| Scope | Decision |
| --- | --- |
| source-bound local shadow lookup | **GO** |
| persisted consumer or `Character[]` | **NO-GO** |
| apply/overlay, authority or production | **NO-GO** |
| writer, publisher, network or R2 | **NO-GO** |
| Android | **NO-GO** |
| FYI/DokkanInfo removal | **NO-GO** |
