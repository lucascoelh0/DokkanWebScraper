# Database Characters K3 — structured skills and audited semantics

Status: optional, additive, non-production. Contract version `1.0.0`.

## Question, boundary and gate

K3 asks how every first-party skill attached to a playable card state can be
retained losslessly while exposing only already-audited mechanics to a future
consumer. It performs no new semantic reverse engineering and no combat
calculation. Raw SQLite rows remain an audit channel; the consumer channel is
an exact projection of pinned Integration C2 bytes.

## Contract

The payload covers all 10,654 DB1 states and retains Leader, Passive, Super,
Ultra, Unit and EX skill structure. Card-scoped Active, Standby and Finish rows
are retained separately. Repeated source rows are normalized losslessly by
`table + rowId`: 107,070 complete raw/provenance records back every structural
reference. Names and text do not identify a skill or state.

The supported channel binds all 1,350 C2 rules to K1-compatible state IDs. A
primary card uses its actual latest released state label. A nested form keeps
DB2's proven compatibility label `initial` while `sourceReleaseState` records
the actual latest first-party state (including EZA/SEZA). Every binding verifies
the exact passive-skill row ID. The channel recursively rejects raw, audit,
provenance, uncertainty and presentation fields; partial and unknown dimensions
remain only in the independently pinned C1 audit artifact.

Coverage is 10,654 Leader states, 10,434 Passive states, 12,429 Super attacks,
1,255 Ultra attacks, 186 Unit attacks and 20 EX attacks. There are 494 cards
with Active skills, 28 with Standby skills and 56 with Finish skills. All 575
C2 states and 1,296 passive-skill IDs join; 1,277 rules include supported
timing. There are no unknown attack variants, unjoined rules, forbidden
consumer fields or duplicate structural identities.

The deterministic payload is 81,356,220 bytes raw and 2,707,309 bytes gzip,
SHA-256
`6a9c18ae74e5e5e052615d75abbfa900337ea9eebfe0262d0943213f6afd03e0`.
Two generations were byte-identical; peak observed RSS was 856,489,984 bytes.
The SQLite, DB1, C1 and C2 hashes and sizes are checked before generation, and
the SQLite fingerprint is checked again after both generations.
