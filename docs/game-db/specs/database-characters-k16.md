# Database Characters K16 - opt-in compact compare consumer

Status: offline compare-shadow GO; authority, production and delivery remain
NO-GO. Contract version `1.0.0`.

## Boundary

K16 is an explicitly opt-in, offline and compare-only consumer. It accepts only
the exact pinned K15 release through `validateCharacterCompactArtifact` and the
exact productive `Character[]` snapshot. It does not import or open
`compact-source`, `shadow-source`, the K11 payload, or any K0-K14 sidecar. K11
payload readers are absent from the consumer dependency graph; the mandated
K15 validator retains only its existing release-lineage metadata dependency.

The default productive input is the read-only
`D:/Dokkan/DokkanWebScraper/data/characters.json`. Its required identity is:

| Property | Pin |
| --- | --- |
| SHA-256 | `421c8fec6f7ba22e270af19b2278da4fbba19b6299205a54cc3d1ed570319dbc` |
| bytes | 121,390,313 |
| top-level records | 4,090 |

An explicit alternate root is accepted only as a read-only root containing the
literal `characters.json`; existing contained-path validation rejects path
substitution and escape. K15 defaults to the repository-owned ignored
`data/database-characters/compact` directory and may likewise be selected by
an explicit read-only root.

## Comparison contract

All 4,296 K15 records are compared in memory by structural `cardId`. Productive
state selection is deterministic:

1. exactly one top-level record for an ID outranks every nested record;
2. when no top-level record exists, equal repeated nested transformation states
   select the first exact JSON path;
3. duplicate top-level records or divergent nested records are ambiguous and
   fail closed, so no candidate value is selected.

For `id`, `rarity` and `type`, the report records agreements, differences,
missing values and ambiguous bindings. At most five non-agreement examples are
retained per field, in K15 record order. Examples contain only structural IDs,
state IDs, compared values and bounded productive JSON paths. The report has no
personal data and no unbounded record inventory.

Provenance binds both sources: K15 contract/version, dataset version, manifest
and payload identity, and the productive `Character[]` file identity and
top-level count. The K15 validator runs before and after comparison. Productive
bytes are reread and compared byte-for-byte, while serialized K15 and productive
objects are checked for deep equality before and after. Any change fails the
operation instead of returning a report.

## Pinned dataset result

The focused real-data execution used the local pinned K15 release and the
productive `Character[]` pin above:

| Field | Agreements | Differences | Missing | Ambiguous |
| --- | ---: | ---: | ---: | ---: |
| `id` | 4,296 | 0 | 0 | 0 |
| `rarity` | 4,085 | 211 | 0 | 0 |
| `type` | 4,296 | 0 | 0 | 0 |

All 211 rarity differences are productive nested states whose `rarity` is
null; K15 supplies the K2-supported value. They are compare-shadow evidence,
not authorization to fill or mutate the productive value. The productive
index selected 4,301 unique states and found zero ambiguous productive IDs;
K16 compared only the 4,296 IDs present in K15.

## Safety and CLI

`runCharacterCompactConsumer` requires `optIn: true`. The CLI requires exactly
one `--opt-in-k16`; the package script supplies that flag deliberately. Optional
`--k15-root` and `--production-root` select read-only roots. No output-path flag
or writer exists: the CLI prints deterministic JSON to stdout only.

The module offers no apply, merge, fallback or catalog-writing API. It does not
return a changed `Character[]`, create or remove records, or alter effective
values. Shell redirection by an operator is outside the consumer and should be
limited to ignored `data/` when a local record is needed.

## Readiness

| Scope | Decision |
| --- | --- |
| explicitly opt-in offline compare-shadow | **GO** |
| authority promotion | **NO-GO** |
| production use or effective-value changes | **NO-GO** |
| Android | **NO-GO** |
| R2 or publisher integration | **NO-GO** |
| FYI removal | **NO-GO** |
| DokkanInfo removal | **NO-GO** |

K16 produces evidence only. Any delivery or authority proposal requires a new
gate and must not reinterpret compare-shadow output as permission to mutate the
productive catalog.
