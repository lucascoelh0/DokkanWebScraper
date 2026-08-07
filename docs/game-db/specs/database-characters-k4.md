# Database Characters K4 — stats and progression

Status: optional, additive, non-production. Contract version `1.0.0`.

## Question, boundary and gate

K4 asks which player-card stat and progression facts are structurally present
in the pinned Global SQLite snapshot. It does not implement damage, displayed
stat or enemy-runtime calculation. Player-card values are never reused as
enemy values. Leader and Super Attack mechanics remain owned by K3.

## Contract

All 5,759 cards retain raw HP/ATK/DEF initial and maximum values, rarity,
growth type, experience type, 10,654 state level/SA-level caps and exact
EZA/SEZA growth-row references. Every state declares stat overrides unknown:
the source contract does not expose a separate raw EZA/SEZA stat tuple.

Awakening projection covers 6,907 selected-corpus routes, 12,881 medal/item
requirements and all 2,291 referenced item IDs with quantities. Potential
projection covers 2,403 card/board assignments, 15,030 nodes and 30,200 graph
relations; 180 null predecessors are explicit roots. Equipment skill-orb data
retains 8,644 items, 13,850 skill rows and 303 limitation rows. Limitation and
potential-event semantics stay raw-only: no character-exclusive compatibility
claim is promoted without an audited enum contract.

The payload normalizes 101,972 complete SQLite rows across 19 focused tables.
There are no missing board/set/item joins, dangling node edges, dangling orb
items or duplicate identities. Two generations were byte-identical.

Artifact: 3,486,645 bytes gzip / 90,774,310 bytes raw, SHA-256
`9d40af1da053f008730992537d0a349e94ca36d88a6584d7e7086faa9ee82c0e`.
Peak observed RSS was 820,379,648 bytes. DB1 and SQLite are re-fingerprinted
after both streams and before the resource gate or any write.
