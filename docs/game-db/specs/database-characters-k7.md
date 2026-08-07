# Database Characters K7 — structural shadow parity

Status: optional, additive, shadow-only and non-production. Contract version
`1.1.0`.

## Question, boundary and gate

K7 asks where the database-first sidecars agree with, add representation to,
conflict with or cannot be joined to the pinned production/FYI/Team snapshots.
All joins use card IDs or C3 state/rule identities. Names, labels and skill text
are never join keys. Production data is read and content-hashed but not changed.
No DokkanInfo character cache was present, so that source is explicitly absent
rather than reconstructed from URLs.

## Comparison semantics

Production's pinned legacy DokkanInfo-shaped contract exposes initial card caps
and raw card maximum stats, so it is compared with the explicit `initial`
state. FYI exposes its latest released state, so K7 selects the highest
first-party progression step whose `availableAt` precedes FYI's pinned
`generatedAt`. Every record retains the selected `stateKey`, release state,
availability, progression step and growth-row provenance.

Only proven common domains can produce `confirmed_conflict`. An unawakened DB
class versus Super/Extreme, FYI EZA maximum stats versus raw card maxima and
external transformation sets versus directional/channel-specific K1 relations
are classified `unknown`. First-party release graphs, relation channels,
original rarity and EX attacks remain representation gains. The four confirmed
conflicts are FYI `maxLevel` and `maxSALevel` for cards `1027621` and `1028161`:
both selected EZA step 7 released on 2026-07-29, before the FYI snapshot on
2026-08-04, while FYI still carried 120/10 rather than 140/15.

Across 5,759 cards, production joins 4,296 and leaves 1,463 structurally
unjoinable; FYI joins 1,625 and leaves 4,134 unjoinable. Field classification
totals are 56,484 agreements, 14,002 representation gains, four confirmed
snapshot conflicts and 55,042 unknowns. C3 contributes 1,108 agreements, 154
representation gains, zero conflicts, 29 unjoinables and 59 unknowns.

The twelve historical audits are an exact, unique inventory. Their results are
derived from the K7 records or pinned K1/K2/K3/K6/C3 metrics. K1, K2, K3 and K6
artifact and coverage hashes are verified both before and after generation, so
an omitted, renamed or stale audit cannot pass validation.

Two generations were byte-identical. Artifact: 121,529 bytes gzip / 6,578,877
bytes raw, SHA-256
`ff2528f1057c2cd8d7edec0b57a0c7dcc64f955b282f31d124b7d0dad80cd7d5`.
Peak observed RSS was 717,873,152 bytes.
