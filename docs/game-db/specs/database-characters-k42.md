# Database Characters K42 - supported-only state/form product scope audit

Status: offline scope audit and next supported-only projection gate GO. Product
projection, `Character[]`, apply/overlay, authority, production, writer,
publisher, network, R2, Android and source removal remain NO-GO. Contract
version `1.0.0`.

## Boundary

K42 answers which already-pinned K0/K1 structural identity, release-state,
awakening and form facts can enter a future product projection without
promoting `partial` or `unknown`. It is an explicitly opt-in, local,
stdout-only audit. It writes no artifact, selects no effective Character value,
returns no `Character[]` and has no network, publisher, R2 or Android path.

The evaluator uses only structural IDs and evidence statuses. The existing
source loader necessarily parses and compacts the pinned productive and FYI
payload shapes, including their presentation fields. The K42 evaluator and
structural fingerprint access only structural ID maps, sizes and hashes;
names, labels, descriptions and other presentation text are not used for scope
decisions or emitted in the report.

## Exact sources and CLI

The runner has no defaults and accepts exactly:

```text
npm run audit:database-characters-state-product-scope -- \
  --opt-in-k42 \
  --sidecar-root <exact-k0-k7-root> \
  --production-root <exact-k7-production-root> \
  --fyi-root <exact-k7-fyi-root>
```

It loads inputs through `loadCharacterShadowInputs`, which pins K0/K1/K2/K7,
the productive `Character[]` and FYI release bytes. After evaluation it loads
all inputs again and requires unchanged byte identities plus a structural
fingerprint over the relevant state, transition, card and external-ID shapes.
Every K1 state must match the same K0 state ID, card ID, release state and
evidence boundary.

The first real attempt correctly rejected the repository's newer
`data/fyi-characters/latest` because it did not match K7. The successful run
used the preserved exact FYI snapshot: SHA-256
`56681e7327c56bce7becbda72ee507b77d964f449fd1862012d4e751b801b499`,
1,211,389 bytes, generated at `2026-08-04T22:43:50.776Z`. No `latest` alias was
accepted as a substitute.

## Supported-only policy

- states are included only when K0 evidence is `supported` and K1 release state
  is `initial`, `eza` or `seza`;
- release transitions require `evidenceStatus: supported` and a known EZA/SEZA
  release state;
- awakening transitions require `targetStatus: supported` and a known kind;
- form transitions require `stateBindingStatus: supported` and a known kind;
- K7 productive identity agreement/unjoinable is coverage only and cannot
  create, remove or authorize a product record;
- all excluded samples are sorted structural IDs, capped at five per scope;
- the deterministic timestamp-free stdout report is limited to less than
  64 KiB.

## Real result

| Scope | Included | Excluded |
| --- | ---: | ---: |
| states | 10,651 | 3 unknown |
| release transitions | 4,892 | 3 unknown |
| awakening transitions | 6,905 | 2 partial |
| form transitions | 374 | 184 partial |

The included states are 5,759 initial, 4,855 EZA and 37 SEZA. Included
awakenings are 1,487 Z-Awaken, 1,242 Dokkan Awaken, 4,142 EZA and 34 SEZA; the
two out-of-corpus Dokkan Awakening targets remain excluded. Included forms are
199 transformations, 115 giant/rage relations and 60 reversible exchanges.
All 374 supported form bindings are passive-channel; 140 Active, 28 Standby and
16 Finish bindings remain partial and excluded.

K7 productive coverage remains 4,296 agreements and 1,463 unjoinables. The
structural source fingerprint is
`6cd56dcaa7bc988ef0d80735c3bcb0ec3345746a84ece507bd19ffb80894cfeb`.
Two complete real executions produced byte-identical 5,660-byte reports with
SHA-256
`e56a39cdc4b420a8eb58f6a075021e75b7b45eb5d3b4c9e9b658d6f3bc6d929e`.

Focused TypeScript validation and all five focused tests passed. The next gate
may build a supported-only product projection over exactly these included
identities. It must retain the exclusions and may not use K7 coverage as
authority.
The final full `database-characters` suite passed 188 tests with eight Windows
symlink fixtures pending. Contract review's only P2, an overstatement about
what the legacy loader parses, was corrected without changing the K42 decision
boundary; re-review found no remaining P0-P2.

## Readiness

| Scope | Decision |
| --- | --- |
| K42 offline scope audit | **GO** |
| next supported-only projection | **GO** |
| product projection | **NOT EXECUTED** |
| `Character[]` or apply/overlay | **NO-GO** |
| authority or production | **NO-GO** |
| writer, publisher, network or R2 | **NO-GO** |
| Android | **NO-GO** |
| FYI/DokkanInfo removal | **NO-GO** |
