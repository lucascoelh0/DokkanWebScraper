# Database Characters K2 — taxonomy and presentation

Status: optional, additive, non-production. Contract version `1.0.0`.

## Question, boundary and gate

K2 asks which card taxonomy and presentation labels can be joined by stable
first-party IDs. The Global snapshot's text is labeled
`global_snapshot_default`; no language code or other locale is inferred.
Schedules and availability remain outside this contract. The gate requires
complete card/category/link joins, exact link-level rows, no text-key joins,
explicit original-rarity provenance and deterministic bytes.

## Contract

Rarity, Type and Class retain raw enums plus the confirmed mappings. Original
rarity follows only exact `CardAwakeningRoute::Zet` predecessors; no numeric ID
pattern participates. Categories use all 98 `card_categories.id` values and
links all 133 `link_skills.id` values. The focused SQLite join additionally
retains all 1,330 link-level rows and 2,064 raw efficacy rows. Their row values
are structural first-party facts; unproved effect semantics are not promoted.

Card titles, character names, unique-info names, category labels, link labels
and link-level descriptions are presentation fields with table/row/column
provenance. They never identify an entity or relation. Other locales remain
unknown rather than copied from the Global snapshot.

The deterministic payload is 12,566,626 bytes raw and 511,837 bytes gzip,
SHA-256
`af1c84eb0d030fbf389ea0f1f5590e5f643234e2d6348bcc64fe2ffab4718b37`.
Two generations were byte-identical; peak observed RSS was 833,986,560 bytes.
All required snapshot-default labels are present and every card has exactly one
structural Z-chain original-rarity root.

All 54,072 category and 34,018 link assignments retain raw target IDs. No
assignment is unresolved. Link-level/effect source row-ID sets are complete,
unique and free of orphans. Original-rarity evidence retains every traversed
Z-route row; cycles fail the gate. The SQLite fingerprint is rechecked after
focused reads and after both generations.
