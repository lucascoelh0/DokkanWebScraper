# Database Character Experiment Contract v1

**Status:** Gate DB1 experimental
**Contract identifier:** `dokkan-character-database-experiment`
**Contract version:** `1.1.0`

## Boundary

This contract is an isolated, source-aligned snapshot used to decide whether the
Global first-party SQLite database can replace HTML as the primary character
source. It is not the production character contract and is not consumed by
Android. Artifacts live only in ignored `data/database-experiment/`.

The adapter opens the supplied SQLite file with URI `mode=ro`, `immutable=1`,
and `PRAGMA query_only=ON`. Generation fails if the database SHA-256, byte size,
or modification time changes between the pre-read and post-read fingerprints.

## Shape

The gzip payload contains a deterministic JSON object with:

- contract/schema/source versions and source SHA-256;
- released collectable card rows plus form cards reached through confirmed
  first-party skill relations;
- separate `cards`, `characters`, and `card_unique_infos` identities;
- raw IDs, localized text, numeric fields, and row provenance;
- awakening routes and route-derived hard-duplicate groups;
- first-party collection membership and a terminal-card catalog projection;
- one initial skill state and every optimal-awakening growth step, including
  EZA/SEZA identity, availability date, and snapshot availability;
- structured leader, passive, Super/Ultra/Unit/EX, Active, Standby, and Finish
  rows and their relation/causality joins;
- explicitly unknown enums and unjoined release-state semantics.

Every sourced row records its table, row ID, and consumed columns. Numeric
values are never discarded when their labels are unknown.

## Confirmed mappings

- rarity `0..5` → N, R, SR, SSR, UR, LR, validated across exact IDs in the
  current dataset;
- element ones digit `0..4` → AGL, TEQ, INT, STR, PHY, validated across exact
  IDs;
- element band `0x` → unawakened/no class, `1x` → Super, and `2x` → Extreme.
  First-party Z-Awakening routes preserve the type digit while moving cards
  from `0x` into `1x` or `2x`; a pre-Z card is not assigned a site-derived
  hero/villain alignment as its in-game class;
- `card_specials.style` strings `Normal`, `Hyper`, `Condition`, and `Extra` →
  Super, Ultra, Unit, and EX attack variants;
- `card_awakening_routes.optimal_awakening_type` `1` → EZA and `2` → SEZA.
  The mapping is corroborated by preserved first-party help and mission rows;
  the exact route supplies the state date. The ordinal step alone is never
  used to infer EZA or SEZA;
- efficacy `103` → transformation in passive, active, standby, and finish;
- efficacy `79` → giant/rage only in passive and active;
- efficacy `131` → reversible exchange only in passive.

Mappings are channel-scoped. An efficacy observed in one channel is not
generalized to another without evidence.

## Explicit unknowns

Growth rows without a direct matching Optimal route may inherit evidence only
from a structured reverse form relation. If neither join exists, the state
remains `releaseState: "unknown"`. Future rows are retained with
`availableAtSnapshot: false` and are excluded from current-dataset parity.

The primary catalog projection starts only from `collection_cards`. A listed
card is primary when no other listed card is reachable downstream through
first-party awakening routes. The full diagnostic corpus is retained, but
non-terminal collection rows and unlisted internal/awakening rows are not
silently treated as primaries. No names or numeric ID suffixes participate in
the rule. A current-site audit proves that `collection_cards` is not exhaustive,
so this projection is a high-confidence signal rather than the final inclusion
authority; omissions remain explicit compatibility cases.

Unrecognized numeric enums remain `{ raw, value: "unknown", evidence:
"unknown" }`. The experiment does not parse localized descriptions to recover
semantics already represented by structured rows.

## Artifacts

- `characters-db-experiment.json.gz`
- `manifest.json`
- `source-manifest.json`
- `coverage.json`
- `golden-validation.json`
- `parity-summary.json`
- `parity-report.md`
- `site-audit.json`

The manifest hashes the compressed bytes. The source manifest lists the exact
tables and columns consumed. Two in-memory generations and two gzip operations
must be byte-identical before anything is written.

## Cutover rule

DB1 is GO to DB2 when all current IDs remain available in the broad database
corpus and no projected-primary release state is unknown. Production cutover
still requires DB2 Team Analysis validation and an explicit policy for
current-only catalog exceptions. A GO does not authorize Android changes,
production output changes, publication, commit, or push.

DB2 is specified separately in
`docs/game-db/specs/database-team-analysis-experiment-v1.md`; it projects the
latest released DB1 skill state without changing this lossless DB1 payload.
