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
collecting the four compact values needed per eligible card.

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

## Selection and current result

A card is emitted only when all three fields have an unequivocal structural
production join, supported evidence, `agreement` or `representation_gain`, no
confirmed conflict, a common non-empty state binding and valid productive
enums. Any drift from the pinned inventory fails generation.

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
re-read after validation to detect mutation during the validation window.

GO is limited to offline K15 generation and compact artifact validation.
In-memory consumption, `Character[]` changes, Android, R2/publication,
production, authority promotion and FYI/DokkanInfo removal remain NO-GO.

The next gate is **K16**: an opt-in shadow consumer that reads K15 only, never
K11, and compares projected values without changing effective character
values.
