# Database Team Analysis experiment v5 (DB6)

Status: experimental, non-production. Contract version: `0.5.0`.

## Purpose

DB6 preserves DB5 and maps the proven event/count portion of first-party causality 44. It explicitly separates a supported battle-history predicate from unresolved recurrence, effect application and calculation-bucket semantics.

The source SQLite remains read-only/immutable/query-only and fingerprinted before and after generation. Outputs remain ignored under `data/database-experiment/`. No production scraper, manifest, latest directory, Android code, R2 object or asset is changed.

## Confirmed structure

Causality 44 is a self combat-history minimum-count condition:

- `cau_val1=1`: Super Attacks performed;
- `cau_val1=2`: attacks performed;
- `cau_val1=3`: attacks received;
- `cau_val1=4`: guard activations;
- `cau_val1=5`: attacks evaded;
- `cau_val2`: minimum event count.

Every snapshot row has `cau_val3=0`; no meaning is assigned to that field. A future nonzero value remains unknown.

## Conservative boundary

The same event/count shape appears in both one-time “after N” and recurring “every N” mechanics. Neither the causality tuple nor `execution_timing_type`, `calculation_option`, `is_once`, `turn` or efficacy independently proves recurrence. DB6 therefore:

- maps the accumulated battle-history predicate;
- never converts type 44 into scaling;
- keeps recurrence and calculation bucket explicitly unknown;
- retains raw timing, calculation, turn and `is_once` values plus table/row provenance;
- keeps affected rules partial even when the predicate itself is supported.

No passive text is parsed or regex-reinterpreted.

## Artifacts

- `team-analysis-db6-experiment.json.gz`;
- `team-analysis-db6-manifest.json`;
- `team-analysis-db6-coverage.json`;
- `team-analysis-db6-parity.json`;
- `team-analysis-db6-report.md`;
- `team-analysis-db6-golden-validation.json`.

## Gate boundary

DB6 can replace text parsing for the event identity and minimum count. It cannot yet replace production semantics for recurring activation, calculation buckets, unresolved name tokens or other partial causality families.
