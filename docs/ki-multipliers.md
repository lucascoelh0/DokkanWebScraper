# Ki multiplier reference anchors

## Scope — 2026-09-09

Optional card-level reference information for the Android Stats disclosure.
This is not an ATK calculator, SA coefficient, orb-percentage passive, or an
interpolated curve. No production promotion is part of this change.

## First-party evidence

Audited Global snapshot `1788329250`, SQLite SHA-256
`7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495`.
The frozen export `first-party-complete-source/1788329250-awakening-routes-v1`
has `cards.csv` SHA-256
`cd296c63bfa4732030ec8e4394379920bdb39ca9aa7df3537c3ee7c3657cb21a`.
All 17,380 exact-card Ki tuples in that CSV were compared against the pinned
SQLite and match. Do not substitute the mutable `dokkan-global-current.db`:
its bytes and row count differ from this snapshot.

Reproduction query:

```sql
SELECT id, eball_mod_min, eball_mod_num100, eball_mod_mid,
       eball_mod_mid_num, eball_mod_max, eball_mod_max_num
FROM cards ORDER BY id;
```

| Source field | Reference anchor |
| --- | --- |
| `eball_mod_min` | Percentage at 0 Ki |
| `eball_mod_num100` | Ki count at 100%, not the location of the minimum |
| `eball_mod_mid`, `eball_mod_mid_num` | Optional intermediate percentage and Ki |
| `eball_mod_max`, `eball_mod_max_num` | Final percentage and Ki |

Percentages are percentage points: 140 means 140%, not 1.4% or an added 140%.
The anchor interpretation is corroborated by the existing reference UI/data
examples and [the original team builder's field-labelled table](https://old.dokkanbattlebuilder.com/).
The database supplies values; interpolation, clamping and combat rounding are
not asserted by this feature. The prior combat-calculation roadmap still owns
those open rules.

| Exact card | Anchors (Ki → percent) |
| --- | --- |
| Frieza `1009381` | 0 → 50, 4 → 100, 12 → 140, 24 → 200 |
| God Goku `1018251` | 0 → 40, 3 → 100, 12 → 145, 24 → 200 |
| Goku `1032611` | 0 → 40, 4 → 100, 12 → 135 |
| Omega `1031501` | 0 → 40, 3 → 100, 12 → 160, 24 → 200 |
| SS Goku `1007470` | 0 → 50, 4 → 100, 12 → 140, 24 → 200 |

No other table in the pinned SQLite has `eball_mod*` columns. EZA/SEZA reuse
the exact card's reference anchors; they do not borrow a different awakening
row. In-battle transformations have their own card IDs and their own values.
Rarity is not used to manufacture a 12/24-Ki point.

## Source exceptions

17,333 rows have supported anchors. 45 have the degenerate tuple
`(1,1,0,0,1,1)`; two presentation rows `9011720/9011721` have contradictory
12-Ki values `(40,3,150,12,200,12)`. These two audited shapes remain absent,
not corrected or interpolated. Unexpected partial/malformed tuples fail the
producer explicitly. Of the existing primary payload's 1,637 card/form
occurrences, 1,629 are supported and eight are degenerate training entries.

## Additive contract

```json
{"kiMultipliers":{"schemaVersion":1,"points":[
  {"ki":0,"percent":50},{"ki":4,"percent":100},
  {"ki":12,"percent":140},{"ki":24,"percent":200}
]}}
```

The optional field follows the exact card through snapshot, projection, primary
materialization, graph-only detail enrichment and transformation materialization.
Three or four unique ascending Ki points, Ki 0–24, integral percentages 0–1000,
first Ki 0 and second percentage 100. Legacy `kiMeter`/`kiMultiplier` strings
remain untouched and are not fallback authority. Old payloads can omit the field.

New primary or enrichment bytes require newly generated compatible manifests
and optional indexes. Do not edit source hashes in an old SA/HIPO artifact to
make it appear compatible. Local/native fixture verification does not constitute
remote publication or promotion. Production activation remains a release task.

## Local staging activation — 2026-09-09

Authorized by Lucas and activated for LDPlayer at localhost port 8771, without
R2 publication. The current local roots are:

- Primary: `game-db/data/ki-multipliers/candidate-local-20260909`.
- Enrichment: `game-db/data/character-detail-enrichment/candidate-ki-staging-current-20260909`.
- SA: `game-db/data/sa-training/candidate-ki-staging-current-20260909`.
- HIPO: `game-db/data/hidden-potential/candidate-ki-staging-current-20260909`.
- Team: `game-db/data/ki-multipliers/team-ki-staging-current-20260909`.

The dependent candidates were regenerated against the actual served Stage
catalog `candidate-staging-enrichment-20260908-owned`, SHA
`a0949a7e70233a2a725adfad75804aeb691c17bdd8a79f65b2be91543ae197f8`.
Old candidates remain intact. HIPO explicitly permits the audited additive Ki
primary SHA while retaining exact roster counts, input hashes and all source
checks; its 13 runner tests pass. No old artifact hashes were rewritten.

Local server root: `.agent-logs/ki-staging-current`; startup helper:
`.agent-logs/ki-staging-server.py`; generation helper: `.agent-logs/ki-activate-local.ts`.
Primary/Team manifests receive only the normal delivery `staging/v2/` fileName
projection. Source-bound payloads are unchanged. Android's real import and
graph-only navigation now render Ki; see its feature report for the import
correction, checks and HIPO first-load limitation.
