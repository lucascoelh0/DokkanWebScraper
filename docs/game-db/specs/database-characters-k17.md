# Database Characters K17 - opt-in in-memory promotion overlay

Status: experimental offline in-memory overlay GO; authority, production and
delivery remain NO-GO. Contract version `1.0.0`.

## Boundary

K17 is explicitly opt-in, offline and memory-only. It accepts only the exact
pinned K15 release through `validateCharacterCompactArtifact` and the exact
productive `Character[]` snapshot pinned by the canonical
`CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN` constant. It does not import or
open `compact-source`, `shadow-source`, K11 or a K0-K14 sidecar.

The productive input remains the read-only
`D:/Dokkan/DokkanWebScraper/data/characters.json` with this exact identity:

| Property | Pin |
| --- | --- |
| SHA-256 | `421c8fec6f7ba22e270af19b2278da4fbba19b6299205a54cc3d1ed570319dbc` |
| bytes | 121,390,313 |
| top-level records | 4,090 |

Alternate K15 and productive roots are read-only inputs. The CLI accepts only
`--k15-root` and `--production-root`, requires exactly one
`--opt-in-k17`, and rejects output paths, positional values, duplicate roots
and unknown arguments. There is no writer or output-file API; bounded JSON is
printed to stdout.

## Overlay contract

All joins use structural `cardId` only. Productive state selection duplicates
the K16 rule and is covered by a direct parity golden:

1. exactly one top-level record wins over every nested record;
2. without a top-level record, identical nested states select the first JSON
   path;
3. duplicate top-level records and divergent nested states block the record.

The selected binding is fixed before the overlay. This matters for 17 pinned
IDs with repeated identical nested states: filling only the first selected path
must not trigger a second selection pass that would manufacture an ambiguity.

`type` is agreement-only and can never produce a change. A difference, missing
binding/value or ambiguous binding blocks readiness. `rarity` can produce a
candidate only when the productive comparable value is null and K15 supplies
the validated supported value. The null comparison deliberately matches K16:
an absent optional nested `rarity` property normalizes to null. A non-null
difference, missing structural binding or ambiguity blocks readiness, and a
non-null productive value is never overwritten.

Candidates are sorted by numeric structural ID, state ID and selected JSON
path. The complete list is canonically encoded as compact UTF-8 JSON array v1
and SHA-256 hashed; the list itself is not returned. The bounded report retains
at most five examples, prioritizing blockers over candidates.

Application is globally fail-closed. Any blocker anywhere in the evaluation
prevents every detected candidate from being applied to the clone. The report
preserves the detected candidate count, examples and complete-list hash as
evidence, sets `candidatesAppliedToClone` to zero, evaluates `postOverlay`
against the untouched clone and keeps readiness `NO-GO`. Candidates are
applied as one complete set only when `blockers.total` is zero.

## Mutation and integrity proof

K17 deep-clones productive `Character[]` in memory. With zero blockers it
applies every candidate to the selected clone paths and checks all 4,296 K15
records for `id`, `rarity` and `type` agreement. With any blocker it performs
no clone application and checks the unchanged clone. It then requires
byte-for-byte deep equality with the clone's pre-overlay shape, including
whether an optional `rarity` property was absent. The original K15 and
productive objects remain unchanged; no `Character` is returned, created or
removed.

K15 validation runs before and after the proof. The complete validated K15
object graph must remain deeply equal. Productive bytes are reread, checked
against the canonical pin and compared byte-for-byte; the reparsed productive
object must also remain deeply equal. Any drift throws instead of returning a
report.

The module exports no apply, merge, fallback, writer or changed-`Character[]`
surface. Its public runtime surface is only the opt-in runner and CLI parser,
both returning or printing the bounded report.

## Pinned result

Two final executions used K15 at
`D:/Dokkan/DokkanWebScraper-character-compact/data/database-characters/compact`
and production at `D:/Dokkan/DokkanWebScraper/data`. Their 4,985-byte stdout
reports were byte-identical:

| Evidence | Result |
| --- | ---: |
| K15 records / selected productive bindings | 4,296 / 4,296 |
| `type` agreements / changes | 4,296 / 0 |
| `rarity` agreements before overlay | 4,085 |
| `rarity` null-fill candidates | 211 |
| blockers | 0 |
| post-overlay all-field agreements | 4,296 |
| post-overlay blockers | 0 |

Canonical complete candidate-list SHA-256:
`da56af2745acd0a0791b9df659da7148d8784d88c658cbf4a6ab33cbadc65b71`.
Deterministic stdout report SHA-256:
`3b75e45ee9f117e49519cda81468d89e7bda6f5366c13e6ee7e7550bb95280fc`.

## Readiness

| Scope | Decision |
| --- | --- |
| explicitly opt-in offline in-memory overlay proof | **GO** |
| authority promotion | **NO-GO** |
| production use or productive catalog mutation | **NO-GO** |
| Android | **NO-GO** |
| R2 or publisher integration | **NO-GO** |
| FYI removal | **NO-GO** |
| DokkanInfo removal | **NO-GO** |

K17 proves only that the pinned null-fill candidates can make the selected
in-memory clone agree. It does not authorize an effective-value source,
delivery path, persisted overlay or authority change.
