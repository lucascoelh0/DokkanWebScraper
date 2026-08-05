# Database Team Analysis experiment v6 (DB7)

Status: experimental, non-production. Contract version: `0.6.0`.

## Purpose

DB7 preserves DB6 and projects selector conditions for causalities 41 and 46 without using passive text. Fully evidenced type-46 selectors become supported structured predicates. Type-41 tokens and unresolved type-46 masks retain their raw identities, scope, count and provenance.

## Causality 41

`cau_val1` is scope (`0=team`, `1=enemy`, `2=rotation`), an integer `cau_val2` is an opaque name-match token and `cau_val3` is minimum count.

No token dictionary exists in this SQLite schema. `skill_causalities` has no foreign key or token-reference table. Candidate character/card ID domains contradict audited examples. DB7 therefore emits a partial `qualifying_unit_count` predicate with `localizedName=null`; it never joins the token to an unrelated numeric domain and never backfills it from current text. Missing, empty or non-integer tokens remain raw unknown conditions with `name_token_invalid` metadata.

## Causality 46

The same scope/count roles apply. Independently confirmed selector bits are:

- `4=INT`;
- `8=STR`;
- `16=PHY`;
- `32=Super Class`;
- `64=Extreme Class`.

Bits `1/2` are collectively AGL/TEQ but cannot be assigned individually. High bits `131072..2097152` are collectively the five Extreme Types but have no individual relational identity. Only the five confirmed masks become supported predicates; all other masks remain raw unknowns.

## Artifacts and boundary

DB7 writes the versioned `team-analysis-db7-*` artifact family under ignored `data/database-experiment/`. The source database remains read-only/immutable/query-only and fingerprinted before and after generation. No production scraper, output, Android code, R2 object or asset is changed.

DB7 enables structured evaluation for confirmed class/type counts. Full Team Analysis remains NO-GO while name-token evaluation, remaining masks, recurrence and calculation buckets are unresolved.
