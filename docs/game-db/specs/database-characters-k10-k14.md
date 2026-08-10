# Database Characters K10-K14 — field-scoped product shadow

Status: complete on `codex/database-character-shadow-projection`, optional,
offline-only and non-production. Contract version `1.0.0`.

## Boundary

The campaign projects validated K0/K1/K2 facts toward `Character[]` without
constructing placeholder characters and without modifying the production
dataset. Each record owns one field, explicit status, authority, comparison,
fallback, source state and row-level provenance. K7 supplies only structural
join/comparison-state evidence; no K7 value becomes a K10-K14 value.

Inputs came from exact controlled roots. K0, K1, K2 and K7 artifacts,
manifests, coverage and validation files matched the pinned K9 profile. The
production JSON matched K7's 121,390,313-byte content identity
`421c8fec6f7ba22e270af19b2278da4fbba19b6299205a54cc3d1ed570319dbc`;
the FYI gzip and manifest matched the 1,211,389-byte identity
`56681e7327c56bce7becbda72ee507b77d964f449fd1862012d4e751b801b499`.
No DB0-DB50 or K3-K9 gate was executed.

## K10 authority

The matrix contains 19 K0-K2 candidate dimensions and 70 fields that remain
100% external fallback. Candidate authority means shadow eligibility only; it
does not promote production authority.

| Candidate | Product field | Owner | Boundary |
| --- | --- | --- | --- |
| `id`, `characterId`, `stateId`, `releaseState`, `growthRowId` | only `id` exists in `Character` | K0 | structural identity; no text/name/proximity join |
| `rarity`, `originalRarity`, `type`, `characterClass` | `rarity`, `type`, `characterClass` | K2 | current/original rarity remain distinct; `unawakened` is not coerced |
| `name`, `title` | same | K2 | Global snapshot-default presentation; missing locale retains external text |
| `categoryIds`, `categories` | labels only in `categories` | K2 | IDs and labels measured separately |
| `linkIds`, `links`, `linkLevels` | labels only in `links` | K2 | IDs, labels, levels and first-party slot order remain separate |
| `awakeningGraph`, `releaseStateGraph`, `formGraph` | none; structural shadow only | K1 | no aliases, condition text, direction repair or UI grouping inference |

The 70 external fields cover release dates; caps and stats; summonability,
F2P and obtainability; leader/passive/Super/Ultra/EX/Unit skills; conditions
and transformation/standby/finish presentation; portraits, art and delivery;
equipment; ki/cost/progression presentation; and all Dokkan Frontier
enrichment. The machine-readable readiness artifact enumerates every field.

## K11 projection

- 5,759 database cards and 109,421 field projections;
- 4,296 production structural joins and 1,463 explicit unjoinables;
- 1,625 FYI joins and 4,134 FYI unjoinables;
- zero characters created and zero production catalog-size change;
- 4,090 production top-level characters remain byte-owned by the external
  dataset; joined nested forms are compared but never materialized as new
  characters;
- selected-state coverage: 4,688 initial, 622 EZA, 34 SEZA and 415 forms.

## K12 parity

Every field/source cell has one exclusive classification. Across the 89-field
matrix there are 512,551 production cells. The totals below then append the
four preserved K7 cap conflicts as a separate audit inventory.

| Classification | Count |
| --- | ---: |
| agreements | 23,380 |
| representation gains | 35,011 |
| representation mismatches | 17,251 |
| confirmed conflicts | 4 (K7 audit only) |
| unknown | 5,982 |
| unjoinable | 130,207 |
| external fallback | 300,720 |

Key product-field coverage:

| Field | Agreement | Gain | Representation mismatch | Unknown | Unjoinable | In-memory patchable |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `id` | 4,296 | 0 | 0 | 0 | 1,463 | 4,296 |
| `rarity` | 4,084 | 212 | 0 | 0 | 1,463 | 4,296 |
| `type` | 4,296 | 0 | 0 | 0 | 1,463 | 4,296 |
| `characterClass` | 2,930 | 0 | 1,366 | 0 | 1,463 | 2,930 |
| `name` | 1,613 | 0 | 2,683 | 0 | 1,463 | 1,613 |
| `title` | 0 | 212 | 4,084 | 0 | 1,463 | 0 |
| `categories` | 2,207 | 217 | 1,872 | 0 | 1,463 | 2,207 |
| `links` | 766 | 2 | 3,528 | 0 | 1,463 | 766 |
| `formGraph` | 2,612 | 0 | 0 | 1,684 | 1,463 | 0 |

`originalRarity`, category IDs, link IDs and link levels each add 4,296
structural representation gains but remain shadow-only. Awakening evidence is
supported for 5,757 cards with two explicit partials; form binding is supported
for 5,583 and partial for 176.

Ordering was not silently selected. Production categories have 2,207 exact
order agreements, 1,711 same-set/different-order cases, 161 different
representations and 1,680 unavailable comparisons. Production links have 766,
3,472, 56 and 1,465 respectively. FYI categories have 26 exact and 1,408
same-set/different-order cases; FYI links have 107 and 1,518.

The four K7 conflicts remain exactly:

| Card | Field | First-party EZA | FYI | Growth row |
| --- | --- | ---: | ---: | ---: |
| `1027621` | `maxLevel` | 140 | 120 | 4885 |
| `1027621` | `maxSALevel` | 15 | 10 | 4885 |
| `1028161` | `maxLevel` | 140 | 120 | 4844 |
| `1028161` | `maxSALevel` | 15 | 10 | 4844 |

No winner is selected. These cap fields remain external fallback because K4 is
outside this campaign.

## K13 safety

Focused tests and real-corpus validation prove:

- absent, old, corrupt or unknown-schema projection returns the exact original
  `Character[]` value;
- partial/unknown evidence, unjoinables, conflicts and missing presentation
  locale cannot become database patches;
- duplicate field identities and ambiguous state bindings fail validation;
- path traversal and non-exact input names fail closed;
- valid patches operate on an in-memory clone only;
- zero production writes, zero publisher/Android capability and deterministic
  ordering/provenance.

Real-corpus safety counts are all zero: partial/unknown patches, unjoinable
database candidates, selected conflict winners, ambiguous state bindings and
duplicate projection identities.

## K14 readiness

| Field | Decision | Patchable cards | Reason |
| --- | --- | ---: | --- |
| `id` | **GO** | 4,296 | supported structural agreement with proved fallback |
| `rarity` | **GO** | 4,296 | 4,084 agreements plus 212 representation gains; zero mismatch/conflict |
| `type` | **GO** | 4,296 | complete supported structural agreement |
| `characterClass` | **NO-GO** | 2,930 | 1,366 representation mismatches |
| `name` | **NO-GO** | 1,613 | 2,683 presentation mismatches |
| `title` | **NO-GO** | 0 | no agreements and 4,084 presentation mismatches |
| `categories` | **NO-GO** | 2,207 | ordering/representation mismatch remains |
| `links` | **NO-GO** | 766 | ordering/representation mismatch remains |
| shadow-only identity/taxonomy dimensions | **NO-GO** | 0 | no `Character` field exists |
| awakening/release/form graphs | **NO-GO** | 0 | separate structural shape and partial/unknown evidence remain |
| all 70 external-owned fields | **NO-GO** | 0 | K0-K2 are not the field owner |

GO is a readiness result, not authority promotion. Production is unchanged;
publisher, R2 and Android are disabled; FYI and DokkanInfo remain active.
The first plausible migration slice is `rarity` plus `type`, behind the same
optional in-memory/fallback contract and only after separate authorization.

## Artifacts and verification

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| K11 gzip projection | 14,174,570 | `a71b2202902bf7702ba3724c6431b16e907bcb858e6aa4a826c919a2f9257722` |
| K11 raw JSON | 458,865,360 | manifest-owned size (streamed, not retained) |
| K12 coverage | 79,642 | `07b3041e668c1207a53db269b3a0d28d2a239c057f5d555771db78806e47b068` |
| K13 validation | 365 | `f6db1919c3caac43c54508e3e4022ea70f6e318ddab86c6b2efc1ce9316f2319` |
| K14 readiness | 50,905 | `30f0446703fa8903eb3bb98badc411f1736367f70e81e6973ec10c2612da6463` |
| K10-K14 manifest | 964 | `ca8956bf7d2cb3fa74090ad3d4c1af6d8c374db2fb66f5cab546785c412d2b6d` |

Two complete load/build/validate/readiness/streaming-gzip generations were
byte-identical. Peak RSS was 626,032,640 bytes. Generated `data/` artifacts are
ignored and are not committed or published.
