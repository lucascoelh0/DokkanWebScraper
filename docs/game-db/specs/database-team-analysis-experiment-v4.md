# Database Team Analysis experiment v4 (DB5)

Status: experimental, non-production. Contract version: `0.4.0`.

## Purpose

DB5 refines DB4 threshold-series projections without changing or replacing DB4 rows. It models the counted subject separately from the observed `1..N` encoding, decodes only independently supported class/type-mask bits, and compares the resulting structured effect and contribution boundary with the current Team Analysis dataset.

The source SQLite remains read-only/immutable/query-only and is fingerprinted before and after generation. Outputs remain ignored under `data/database-experiment/`; no production manifest, scraper, Android code, R2 object or asset is changed.

## Counted-subject contract

Every DB4 threshold projection is retained and additionally normalized as `per_counted_subject` with:

- the exact observed thresholds and series length;
- the effect value contributed by each satisfied threshold;
- a derived observed maximum contribution when the value is numeric;
- a discriminated subject: Ki Sphere, joined category, opaque name-match token, or class/type bitfield;
- the complete DB4 source-rule and table/row provenance.

The end of a complete `1..N` sibling series is structural evidence only. It is not sufficient evidence that the engine defines a semantic cap at `N`. Consequently `semanticCap` is always explicit `unknown` in DB5. The comparator may match the observed contribution with the current structured `stackCap`, but that result is diagnostic cross-source parity and never mutates the first-party contract.

## Confirmed causality semantics

For causality 41, `cau_val1` is scope (`0=team`, `1=enemy`, `2=attacking rotation`), `cau_val3` is the minimum count, and `cau_val2` is a name-includes token. The token is not a joinable character/category ID. Its localized dictionary is unavailable in this snapshot, so DB5 preserves the token, assigns no display name and keeps the selector partial.

For causality 46, `cau_val1` and `cau_val3` have the same scope/count roles. Confirmed `cau_val2` bits are `4=INT`, `8=STR`, `16=PHY`, `32=Super Class`, and `64=Extreme Class`. Bits `1/2` are not independently isolated, and bits `131072..2097152` are five distinct Extreme-Type selectors whose per-type assignment is not proven. Known and unknown portions of a mask are preserved separately.

No passive text is regex-parsed or reinterpreted by DB5.

## Artifacts

- `team-analysis-db5-experiment.json.gz`;
- `team-analysis-db5-manifest.json`;
- `team-analysis-db5-coverage.json`;
- `team-analysis-db5-parity.json`;
- `team-analysis-db5-report.md`;
- `team-analysis-db5-golden-validation.json`.

## Gate boundary

DB5 can support fully decoded class/category/Ki-Sphere counted projections and expose where the current parser has an unknown condition despite an equivalent structured base effect. It cannot claim production equivalence for unresolved name tokens, partial class/type masks, causality 44, or calculation-bucket interactions. Those remain explicit inputs to DB6.
