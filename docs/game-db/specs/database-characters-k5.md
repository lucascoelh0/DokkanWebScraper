# Database Characters K5 — acquisition and training references

Status: optional, additive, non-production. Contract version `1.0.0`.

## Question, boundary and gate

K5 asks which acquisition/training relationships are static structural facts in
the snapshot. It excludes schedules, availability and server-owned event
semantics. A stage drop is evidence of an obtainable source, not proof that a
card is F2P. No summon table exists in this snapshot, so summonability remains
unknown. Names and text never classify F2P.

## Contract

The sidecar retains 2,664 selected-card collection rows and 272 opaque event
IDs. Existing E5 item-catalog evidence binds the first-party string enum
`Card`; 988 boss-drop/quest-preview references then join structurally through
quest and card IDs. All quest joins succeed. Of those target IDs, 176 are
outside DB1's released selected corpus and remain explicit unjoinable
references rather than being dropped or invented.

There are 292 selected cards with first-party stage-drop evidence. F2P and
summonable assertions are both zero. Training partners are a distinct derived
channel: 116,724 directed candidates share exact `card_unique_info_id`, and
every candidate is labeled `derived_same_card_unique_info_id`. The raw training
tables remain available without promoting their conditions/probabilities.
Sixty reversible-exchange partner references use DB1/K1 relations. Awakening
sources remain route IDs and skill-orb compatibility remains raw-only in K4.

The payload normalizes 21,524 rows from ten focused tables. It has no missing
quest joins, duplicate drop IDs, duplicate source rows or unmarked derived
candidates. Two generations were byte-identical.

Artifact: 581,649 bytes gzip / 21,296,298 bytes raw, SHA-256
`f7b3bb6a59d66868aa83dae3396bd9af76907af15b39c2d48dfef789fcd73623`.
Peak observed RSS was 525,762,560 bytes. DB1 and SQLite are re-fingerprinted
after generation and the resource gate runs before any write.
