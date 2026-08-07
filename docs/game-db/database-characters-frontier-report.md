# Database Characters productization frontier

Status: optional, additive, disabled and non-production.

## Source identity

- snapshot: `global-6.4.0-v338-2026-08-05`;
- SQLite SHA-256: `3654eb7db9e18dfe4c238abd02bcc06a688ffa6f30aa1ad93fd108dcfeb78265`;
- validated DB1 artifact SHA-256:
  `0afae38e1a80e55bc5d8a137f945727149f44403bf1670e830d3ef6f3650e547`;
- DB1 is streamed card by card; DB0–DB50 are not replayed.

## Gate status

| Gate | Status | Result |
| --- | --- | --- |
| K0 inventory and identity | green | 1,044 characters, 5,759 cards, 10,654 states; unique structural IDs; two explicit awakening targets outside the selected corpus |
| K1 state graph and awakenings | pending | — |
| K2 taxonomy and presentation | pending | — |
| K3 structured skills | pending | — |
| K4 stats and progression | pending | — |
| K5 acquisition and training relations | pending | — |
| K6 static asset references | pending | — |
| K7 shadow parity | pending | — |
| K8 optional sidecars and refresh | pending | — |
| K9 readiness | pending | — |

## K0 boundary

Card identity, playable state and UI grouping are distinct. All joins use
first-party row IDs; names and localized text are presentation only. The two
selected-corpus dangling awakening targets are `1010611` and `1010621`.

K0 artifact: 1,526,194 bytes gzip / 32,196,636 bytes raw, SHA-256
`c084075d1b8d89814a5c6245097812e7102440670b547b87d8e555d65cf010d9`.
Two generations were byte-identical; peak observed RSS was 497,344,512 bytes.
Seven relation families are fully supported. Awakening selection gaps (two
assignments) and Standby-derived Finish provenance absent from DB1 (46
assignments) remain explicit partials; there are no unknown assignments.
