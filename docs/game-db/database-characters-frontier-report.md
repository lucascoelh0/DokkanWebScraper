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
| K1 state graph and awakenings | green | 10,654 state nodes; 12,360 progression/awakening/form edges; 329,730-byte gzip |
| K2 taxonomy and presentation | green | 98 categories, 133 links, 1,330 levels and 2,064 raw effect rows; 511,837-byte gzip |
| K3 structured skills | green | 10,654 state records backed by 107,070 normalized raw rows; all 1,350 C2 rules structurally joined with zero forbidden consumer fields |
| K4 stats and progression | green | 5,759 cards, 10,654 state caps, 12,881 awakening requirements, 15,030 potential nodes and 8,644 raw-only orb items |
| K5 acquisition and training relations | green | 988 static card-drop references, 292 selected cards with drop evidence, zero F2P/summon assertions and 116,724 explicitly derived training candidates |
| K6 static asset references | green | 21,207 static references; all action/view joins green; only 75 card resource IDs and no proved local files or delivery |
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

K1 artifact: 329,730 bytes gzip / 6,306,654 bytes raw, SHA-256
`babe3061921a886271bceeb189bdc2f519e9dcf75104c9c759d8213300c6439e`.
Two generations were byte-identical; peak observed RSS was 899,956,736 bytes.

K2 artifact: 511,837 bytes gzip / 12,566,626 bytes raw, SHA-256
`af1c84eb0d030fbf389ea0f1f5590e5f643234e2d6348bcc64fe2ffab4718b37`.
Two generations were byte-identical; peak observed RSS was 833,986,560 bytes.

K3 artifact: 2,707,309 bytes gzip / 81,356,220 bytes raw, SHA-256
`6a9c18ae74e5e5e052615d75abbfa900337ea9eebfe0262d0943213f6afd03e0`.
Two generations were byte-identical; peak observed RSS was 856,489,984 bytes.
Raw skill structure and supported mechanics are separate channels. The latter
is an exact, pinned C2 projection and contains no partial/unknown dimensions.

K4 artifact: 3,486,645 bytes gzip / 90,774,310 bytes raw, SHA-256
`9d40af1da053f008730992537d0a349e94ca36d88a6584d7e7086faa9ee82c0e`.
Two generations were byte-identical; peak observed RSS was 820,379,648 bytes.
Player-card, enemy-runtime, displayed and calculated-combat stat domains remain
strictly separate. Potential and equipment limitation semantics are raw-only.

K5 artifact: 581,649 bytes gzip / 21,296,298 bytes raw, SHA-256
`f7b3bb6a59d66868aa83dae3396bd9af76907af15b39c2d48dfef789fcd73623`.
Two generations were byte-identical; peak observed RSS was 525,762,560 bytes.
Dynamic acquisition remains server-owned; stage-drop evidence is not promoted
to F2P, summonability is unknown and training partner candidates are derived.

K6 artifact: 901,984 bytes gzip / 27,373,521 bytes raw, SHA-256
`743b9128ba3b708a4ead6b436c7f6aa71f6885f29f7336fb91972bf7e09089a1`.
Two generations were byte-identical; peak observed RSS was 549,810,176 bytes.
Only 75 card resource IDs are explicit. Portrait/card-art roles, local files,
rarity/type frames, Entrance/Domain grouping and delivery remain unknown.
