# Database Characters K15 — compact supported-only projection

Status: offline generation and artifact validation ready; every consumer and
publication path remains disabled. Contract version `1.0.0`.

## Boundary and budget

K15 projects only the K14-approved `id`, `rarity` and `type` evidence from the
pinned K11 audit artifact. K11 is read only by the offline generator after its
manifest, compressed SHA-256 and raw SHA-256 have been validated. K11 is not a
K15 delivery file and no runtime, opt-in consumer, publisher or Android path
can open it.

The documented hard budgets are 4 MiB for raw JSON and 1 MiB for gzip. The
generator fails closed rather than relaxing either budget. It streams the K11
field array and discards each large field projection immediately after
extracting only its database value, common `stateId`, comparison class and
single exclusion classification. Full provenance, joins, external/FYI values
and the rest of `CharacterFieldProjection` are not retained in the accumulator.

## Contract

The deterministic payload uses contract
`dokkan-database-character-compact-shadow` `1.0.0`. Each record contains only:

- `cardId`, the structural join key to `Character.id`;
- `stateId`, the minimum unequivocal K11 state binding;
- productive enum values `rarity` and `type`.

`releaseState` is not repeated because validated `stateId` already proves the
binding. Records contain no external fallback, presentation text, categories,
links, skills, stats, assets, forms, paths, per-field provenance, status,
mismatch, conflict, unknown or unjoinable data. There is no apply, merge or
fallback API and no `Character[]` mutation.

Compact lineage is stored once in the header and manifest: pinned profile and
snapshot identities, database/DB1, K0/K1/K2, K11/K12/K13/K14 and the exact
productive `Character[]` identity. Policy
`database-character-compact-supported-only` `1.0.0` records K14 `1.0.1`
approval and explicitly marks records as supported-only.

The payload file name embeds its gzip SHA-256. The fixed manifest separately
binds the payload, raw bytes, coverage, validation and readiness files by exact
name, size and SHA-256.

Standalone validation additionally requires the one authorized K15 release
pin. It binds the exact 3,115-byte manifest
`490573185c487306958c272b1c7b3658f0c38643a64b0d5e146b51f35cb73793`,
the payload and raw identities below, 4,296 records, and the exact hashes and
sizes of coverage (766 bytes), validation (612 bytes) and readiness (771
bytes). Internal consistency is not authorization: recalculating every
manifest and auxiliary hash after changing `cardId`, `stateId`, `rarity` or
`type` is rejected. This pin is contained in K15 code; standalone validation
and K16 never open K11.

## Selection and current result

A card is emitted only when all three fields have an unequivocal structural
production join, supported evidence, `agreement` or `representation_gain`, no
confirmed conflict, a common non-empty state binding and valid productive
enums. Any drift from the pinned inventory fails generation.

Emitted `rarity` is the K11 database value derived from K2 `cards.rarity` for
the selected `cardId`/`stateId`. `originalRarity` remains a separate dimension
and is never read into or emitted by K15.

| Measure | Result |
| --- | ---: |
| database cards | 5,759 |
| compact records | 4,296 |
| unjoinables excluded | 1,463 |
| `id` agreements | 4,296 |
| `rarity` agreements | 4,085 |
| `rarity` representation gains | 211 |
| `type` agreements | 4,296 |
| characters created/removed | 0 / 0 |

The generated payload is 29,902 gzip bytes and 558,190 raw bytes. Its gzip
SHA-256 is
`803346fc61a7e659ccb8aeea62c273fcdf24ef3d66d3d03564a6fad29627c81f`;
the raw SHA-256 is
`5866b075e1cfc2d45eacb6e2055dd975b885accc05379423aac3d7d45b1f793a`.
Two complete projections were byte-identical and peak RSS was 248,946,688
bytes. Generated `data/` remains ignored and is not committed.

## Validation and readiness

Validation rejects duplicate or unordered IDs, unknown enums, extra fields,
missing/ambiguous bindings, non-supported selection evidence, lineage/version
drift, old/future schemas, traversal/absolute paths, links/junction roots,
mutated payloads, hash/size drift and either budget violation. The artifact is
closed by re-opening and re-reading the manifest, payload, coverage, validation
and readiness files. Every final file must retain its original filesystem
identity and bytes and must again satisfy the exact pinned manifest hashes and
sizes; mutation of any one during the validation window fails closed.

The productive CLI writes only to the repository-owned literal
`data/database-characters/compact`, derived internally from the running module.
It does not accept `--output-dir`; absolute, traversal, alternate and mixed
separator overrides therefore have no CLI surface. Any symlink, junction or
reparse redirection at the repository root or output parents is rejected.

Files are created exclusively and sequentially in an unpredictable staging
directory under the controlled output. The generator holds directory handles,
writes through exclusive file handles, checks file and directory identity
before and after each operation, and promotes one verified file at a time. The
fixed order is payload, coverage, validation, readiness, run report and finally
the manifest. The manifest is therefore the last visible commit marker: a
failure after any earlier promotion cannot expose a new manifest, and no run
report write occurs after it. Cleanup uses only individually revalidated
regular files and never recursively removes an unproved staging path. Existing
pinned files must be byte-identical; an existing run report is retained instead
of overwritten.

Node does not expose Windows `openat`/`renameat` operations relative to a held
directory handle. Consequently this protocol minimizes and detects namespace
swaps but cannot claim an impossible race-free guarantee against a hostile
same-user process between syscalls. Identity loss fails closed; if safe cleanup
cannot be proved, staging may be left for manual inspection rather than risk
following a replaced path.

GO is limited to offline K15 generation and compact artifact validation.
In-memory consumption, `Character[]` changes, Android, R2/publication,
production, authority promotion and FYI/DokkanInfo removal remain NO-GO.

The next gate is **K16**: an opt-in shadow consumer that reads K15 only, never
K11, and compares projected values without changing effective character
values.
