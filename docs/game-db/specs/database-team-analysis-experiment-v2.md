# Database Team Analysis experiment v2 (DB3)

Status: experimental, non-production. Contract version: `0.2.0`.

## Purpose

DB3 projects audited first-party passive-skill causalities, target sub-types, timing and scaling fields into a source-neutral Team Analysis shape. It is built on the DB2 relation projector and does not change the FYI/DokkanInfo scrapers, production datasets, Android consumer, manifests, `latest` directories, or R2 objects.

All artifacts stay in the ignored `data/database-experiment/` directory. The SQLite source is opened with read-only URI mode, immutable mode and `query_only`; generation fails if its size, SHA-256 or mtime changes.

## Contract

Each state retains character/form/release identity and localized passive text. Each passive rule contains:

- first-party set, relation, skill and causality IDs;
- explicit table/row provenance for the passive set, relation, skill, causalities and every sub-target row;
- raw efficacy, target, timing and calculation values;
- a source-neutral condition expression;
- typed effects, target filters, scaling and Ki Sphere conversion;
- per-field evidence and explicit `unknown` status.

Sub-target value type `1` is an included category and value type `2` is an excluded category. Other value types remain raw in `unknownSubTargets`.

## Confirmed DB3 mappings

Passive efficacies:

- `67`: random/selected Ki Sphere type conversion; source and destination are bitmasks;
- `68`: per-Ki-Sphere scaling, with selector `1=ATK`, `2=HP recovery`, `3=ATK+DEF`, `4=critical chance`, `5=evade chance`, `6=damage reduction`;
- `96`: Ki gained per selected Ki Sphere;
- `98`: capped accumulation; `eff_value1` is the increment, `eff_value2` the cap and `eff_value3` selects `0=ATK`, `1=DEF`, `2=critical chance`, `3=evade chance`, `4=damage reduction`, `5=Ki`.

Ki Sphere mask bits are `1=AGL`, `2=TEQ`, `4=INT`, `8=STR`, `16=PHY`, `32=Rainbow`; `31` means non-Rainbow and `63` means any sphere. Masks containing other bits remain unknown.

Audited causality types:

- `1`: HP at least; `2`: HP at most;
- `5`: battle turn at least, stored zero-based;
- `15`: enemy count at least; `16`: enemy count at most, stored as exclusive upper bound;
- `19`: slot, stored zero-based;
- `24`: after an incoming attack lands; `25`: final blow delivered; `30`: guard activated;
- `38`: enemy status bitmask (`16=ATK down`, `32=DEF down`, `256=stunned`, `1024=Super Attack sealed`);
- `42`: minimum selected Ki Sphere count.

## Conservative unknowns

- Causalities `33`, `34`, `44` and `46` are retained raw because the general meanings of their value tuples are not proved.
- Compiled symbols `&`, `|` and `!` are retained raw. Their boolean semantics are not asserted without a first-party enum or durable checked-in evidence.
- Efficacy `110` and its special-set joins remain unknown.
- Execution timing `5` is normalized to per-attack scaling only for the audited no-causality shape. Conditioned/Super variants remain unknown instead of depending on a snapshot-specific causality row ID.
- High Ki Sphere mask bits and sub-target types other than `1`/`2` remain unknown.
- DB rows that discretize a scalable mechanic into multiple threshold rules are not silently collapsed into one rule; aggregation requires an explicit later contract.

## Artifacts

- `team-analysis-db3-experiment.json.gz`: deterministic source-neutral dataset;
- `team-analysis-db3-manifest.json`: content hash, byte sizes and source/current hashes;
- `team-analysis-db3-coverage.json`: rule/effect/condition, causality, efficacy and sub-target coverage;
- `team-analysis-db3-parity.json`: state-level kind presence and strict normalized predicate/effect signatures;
- `team-analysis-db3-report.md`: readable parity and important conflicts;
- `team-analysis-db3-golden-validation.json`: exact joined fixture results.

The strict signature comparison intentionally ignores representation defaults such as self-inclusion on a self target and a default 100% first-party probability. It still compares kind, scope, value, unit, target filters, caps, scaling and sphere conversion. It is diagnostic, not a claim that row counts should equal text-parser clause counts.
