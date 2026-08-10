# Database Characters K10-K14 — field-scoped product shadow

Status: complete, optional, offline-only and non-production. K10-K13 remain at
contract version `1.0.0`; the K14 readiness contract is `1.0.1`.

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

The matrix contains 19 K0-K2 candidate dimensions and 74 fields that remain
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

The 74 external fields cover release dates; caps and stats; summonability,
F2P and obtainability; leader/passive/Super/Ultra/EX/Unit skills; conditions
and transformation/standby/finish presentation; portraits, art and delivery;
awakening presentation/direction; equipment; ki/cost/progression presentation;
and all Dokkan Frontier enrichment. The machine-readable readiness artifact
enumerates every `Character` field.

## K11 projection

K11 is **audit-only**. Its 511,791,355 uncompressed bytes are not a delivery
artifact and must never be read by Android, a normal runtime, an opt-in
consumer or a publisher.

- 5,759 database cards and 109,421 field projections;
- 4,296 production structural joins and 1,463 explicit unjoinables;
- 1,625 FYI joins and 4,134 FYI unjoinables;
- zero characters created and zero production catalog-size change;
- 4,090 production top-level characters remain byte-owned by the external
  dataset; joined nested forms are compared but never materialized as new
  characters;
- top-level product records outrank nested presentation records, equal repeated
  nested forms use their first exact JSON path, and divergent nested duplicate
  IDs fail closed;
- every joined production/FYI comparison carries the selected JSON path, source
  hash, source state and field path in its provenance;
- selected projection-state coverage: 5,344 initial, zero EZA/SEZA and 415
  forms; the separate FYI comparison-state view is 4,688 initial, 622 EZA, 34
  SEZA and 415 forms. Neither view silently replaces the other.

## K12 parity

Every field/source cell has one exclusive classification. Across the 93-field
matrix there are 535,587 production cells. The totals below then append the
four preserved K7 cap conflicts as a separate audit inventory.

| Classification | Count |
| --- | ---: |
| agreements | 23,382 |
| representation gains | 35,008 |
| representation mismatches | 17,252 |
| confirmed conflicts | 4 (K7 audit only) |
| unknown | 5,982 |
| unjoinable | 136,059 |
| external fallback | 317,904 |

Key product-field coverage:

| Field | Agreement | Gain | Representation mismatch | Unknown | Unjoinable | In-memory patchable |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `id` | 4,296 | 0 | 0 | 0 | 1,463 | 4,296 |
| `rarity` | 4,085 | 211 | 0 | 0 | 1,463 | 4,296 |
| `type` | 4,296 | 0 | 0 | 0 | 1,463 | 4,296 |
| `characterClass` | 2,930 | 0 | 1,366 | 0 | 1,463 | 2,930 |
| `name` | 1,613 | 0 | 2,683 | 0 | 1,463 | 1,613 |
| `title` | 0 | 211 | 4,085 | 0 | 1,463 | 0 |
| `categories` | 2,208 | 216 | 1,872 | 0 | 1,463 | 2,208 |
| `links` | 766 | 2 | 3,528 | 0 | 1,463 | 766 |
| `formGraph` | 2,612 | 0 | 0 | 1,684 | 1,463 | 0 |

`originalRarity`, category IDs, link IDs and link levels each add 4,296
structural representation gains but remain shadow-only. Awakening evidence is
supported for 5,757 cards with two explicit partials; form binding is supported
for 5,583 and partial for 176.

Ordering was not silently selected. Production categories have 2,208 exact
order agreements, 1,711 same-set/different-order cases, 161 different
representations and 1,679 unavailable comparisons. Production links have 766,
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

- the legacy optional entrypoint returns the exact original `Character[]` and
  rejects every present K11 object as `audit_only` without inspecting it;
- the canonical authority matrix is code-owned; a payload cannot relabel an
  external field as a database candidate;
- offline identity audit verifies the exact pinned manifest, raw projection
  hash and coverage hash but cannot activate patches;
- partial/unknown evidence, unjoinables, conflicts and missing presentation
  locale cannot become database patches;
- duplicate field identities and ambiguous state bindings fail validation;
- path traversal and non-exact input names fail closed;
- no K11 application path is exported;
- zero production writes, zero publisher/Android capability and deterministic
  ordering/provenance.

Real-corpus safety counts are all zero: partial/unknown patches, unjoinable
database candidates, selected conflict winners, ambiguous state bindings and
duplicate projection identities.

## K14 readiness

| Field | Decision | Patchable cards | Reason |
| --- | --- | ---: | --- |
| `id` | **GO** | 4,296 | supported structural agreement with proved fallback |
| `rarity` | **GO** | 4,296 | 4,085 agreements plus 211 representation gains; zero mismatch/conflict |
| `type` | **GO** | 4,296 | complete supported structural agreement |
| `characterClass` | **NO-GO** | 2,930 | 1,366 representation mismatches |
| `name` | **NO-GO** | 1,613 | 2,683 presentation mismatches |
| `title` | **NO-GO** | 0 | no agreements and 4,085 presentation mismatches |
| `categories` | **NO-GO** | 2,208 | ordering/representation mismatch remains |
| `links` | **NO-GO** | 766 | ordering/representation mismatch remains |
| shadow-only identity/taxonomy dimensions | **NO-GO** | 0 | no `Character` field exists |
| awakening/release/form graphs | **NO-GO** | 0 | separate structural shape and partial/unknown evidence remain |
| all 74 external-owned fields | **NO-GO** | 0 | K0-K2 are not the field owner |

GO is a readiness result, not authority promotion. Production is unchanged;
publisher, R2 and Android are disabled; FYI and DokkanInfo remain active.
K14 authorizes no data consumer and no delivery of K11.

The only next GO is `generate_compact_supported_projection`: project and
validate K15 as a new compact, supported-only, content-addressed sidecar. K15
does not exist in this campaign. Its payload must contain only the minimum
binding/`id`, `rarity` and `type` data plus compact hash/version provenance; it
must have its own manifest and explicit lineage to K11 and K0-K2. A future
consumer may read only K15, never K11. Generating and validating K15,
publishing K15 and consuming K15 are three separate gates. Publication,
consumption, authority promotion, R2, Android and production remain NO-GO.

## Artifacts and verification

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| K11 gzip projection | 15,906,227 | `baa78b0cb06ec404eb6df3b008a27e746b82e0f6601dd6622e8d6cb6ab46b074` |
| K11 raw JSON | 511,791,355 | `6797869b430bec1cb56315c66839d0db24726603718bb0315763a9d626a7523c` |
| K12 coverage | 108,935 | `5018f4e4a9a01e0d9c2ac568e9555f91878cad79c47f07f0cc540e28380febd7` |
| K13 validation | 365 | `f6db1919c3caac43c54508e3e4022ea70f6e318ddab86c6b2efc1ce9316f2319` |
| K14 readiness | 54,486 | `4773a9f3ae7019b4b5d9b133329aebe15db92ca2b9db242dc226890156344b2f` |
| K10-K14 manifest | 1,057 | `c86d7860ff56a97df3b10894ad69554ff01f64cb5455171fcb55e3548251d86f` |

The original K10-K13/K11 offline run completed two byte-identical
load/build/validate/streaming-gzip generations and peaked at 715,735,040 bytes.
K14 `1.0.1` was then generated twice, byte-identically, from the unchanged
pinned K12/K13 artifacts and the code-owned authority matrix without
regenerating K11. Generated `data/` artifacts are ignored and are not committed
or published.
