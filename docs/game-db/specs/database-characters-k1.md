# Database Characters K1 — state graph and awakenings

Status: optional, additive, non-production. Contract version `1.0.0`.

## Question, boundary and gate

K1 asks which card, playable-state and form transitions are structurally
proved by DB1. It uses no ID proximity, presentation text, server availability
or dynamic capture. The gate requires exact reconstruction of every state,
awakening route and form relation, unique transition IDs, explicit partial
release binding and two byte-identical generations.

## Model

The graph has 10,654 state nodes and 4,895 release-state progression edges.
Initial state identity uses `cards.id`;
optimal state identity adds the exact `optimal_awakening_growths.id`. The
release label is an attribute, never the identity.

Awakening routes are exact first-party string enums: 1,487 Z-Awakening, 1,244
Dokkan Awakening, 4,142 EZA steps and 34 SEZA steps. Z-Awakened presentation
duplicates receive a collapse hint while both card row IDs remain lossless.
Dokkan Awakening always preserves distinct card identity, including legitimate
UR/TUR/LR progressions. EZA/SEZA transitions stay on the same card and bind
the exact growth row.

The graph retains 359 transformations, 139 giant/rage relations and 60
reversible exchanges across passive (374), Active (140), Standby (28) and
Finish (16) channels. Passive relations bind exact source states when their
passive set matches. Other channel-to-release bindings remain partial; card,
skill and target-form IDs remain lossless. Combined exchange, transformation,
Standby and Finish chains are represented as independent composable edges.

The deterministic graph is 6,306,654 bytes raw and 329,730 bytes gzip,
SHA-256
`babe3061921a886271bceeb189bdc2f519e9dcf75104c9c759d8213300c6439e`.
Two generations were byte-identical. Peak observed RSS was 899,956,736 bytes,
below the 1 GiB ceiling.
