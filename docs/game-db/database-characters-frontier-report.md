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
| K7 shadow parity | green | structural-ID-only shadow join; 56,484 agreements, 14,002 representation gains, four state-proven conflicts and explicit unknown/unjoinable domains |
| K8 optional sidecars and refresh | green | eight content-addressed optional sidecars; six supported-only consumer scopes; exact SQLite/DB1/ELF/C1–C3 profile and fail-before-write receipt |
| K9 readiness | green | infrastructure-only readiness: two narrow GOs, twelve prerequisite-backed NO-GOs and zero authority promotion |
| K10 field authority | green | explicit 19-dimension K0-K2 candidate matrix plus 74 mandatory external-fallback fields covering every `Character` field |
| K11 product shadow projection | green | audit-only; 109,421 field projections over 5,759 cards; 4,296 production joins and 1,463 preserved unjoinables; no delivery or production mutation |
| K12 field parity | green | exclusive per-field classifications, label/ID/order audits and four preserved K7 cap conflicts |
| K13 fallback safety | green | fail-closed audit boundary with no exported K11 application path; zero unsafe, ambiguous, duplicate or conflict-winning patches |
| K14 field readiness | green | `id`, `rarity` and `type` evidence readiness GO only; K11 is audit-only and every delivery/consumer/publisher/authority action remains disabled |
| K15 compact supported-only projection | green | offline generation and standalone validation GO; 4,296 pinned `cardId`/`stateId`/`rarity`/`type` records; no consumer, publication or authority promotion |
| K16 opt-in compact consumer | green | offline K15-only compare-shadow over the pinned productive `Character[]`; bounded field reports and zero effective-value or catalog changes |

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

K7 artifact: 121,529 bytes gzip / 6,578,877 bytes raw, SHA-256
`ff2528f1057c2cd8d7edec0b57a0c7dcc64f955b282f31d124b7d0dad80cd7d5`.
Two generations were byte-identical; peak observed RSS was 717,873,152 bytes.
Production joins 4,296 cards and FYI joins 1,625 by structural ID. Four FYI
cap conflicts retain their exact EZA state and growth-row provenance. Domains
without a proved shared contract—including portrait role, unawakened class,
EZA maximum stats and transformation direction—remain unknown. All twelve
historical audits are derived from K7 or hash-pinned K1/K2/K3/K6/C3 evidence.

K8 receipt: 3,158 bytes gzip / 10,950 bytes raw, SHA-256
`f91c894a7ebbd6a48380f73c68282e2f4f12c337367ff3b1de5cf07f01c19798`.
Two generations were byte-identical; peak observed RSS was 103,231,488 bytes.
The registry projects 10,166,877 compressed bytes across eight independent
sidecars. Six declare supported-only consumer scopes; K6 and K7 remain
audit-only. Absence preserves production. The focused finalizer verifies the
exact SQLite, DB1, ELF, C1–C3 and K0–K7 identities before any K8 write and does
not execute DB0–DB50 or regenerate prior gates.

## K9 readiness

K9 artifact: 3,668 bytes gzip / 10,195 bytes raw, SHA-256
`db0f86e858b091521ab72ae72b89d2531abb0fcd1bf684877bcb991197d5ff85`.
Two generations were byte-identical; peak observed RSS was 42,659,840 bytes.

Only disabled-infrastructure merge and exact-profile optional generation are
GO. Production replacement for identity/state, taxonomy, skills, forms or
assets; removal of FYI/DokkanInfo; R2; Android shadow consumption; Team Builder
consumption; and combat calculation are separate NO-GOs with explicit
prerequisites. No authority was promoted. The complete decision matrix,
remaining server/FYI/DokkanInfo dependencies, four confirmed FYI cap conflicts,
field-authority strategy and per-sidecar sizes are in
`specs/database-characters-k9.md`.

## K10-K15 product shadow

The field-scoped `1.0.0` shadow contains 109,421 projections and keeps all
5,759 K0 cards, including the 1,463 cards without a production structural
join. It does not construct `Character` placeholders. Production/FYI values,
database values, effective shadow fallback, evidence status, authority,
comparison, state selection and row/sidecar/hash provenance remain explicit.

K11 gzip is 15,906,227 bytes / 511,791,355 bytes raw, SHA-256
`baa78b0cb06ec404eb6df3b008a27e746b82e0f6601dd6622e8d6cb6ab46b074`.
Two complete generations were byte-identical and peak RSS was 715,735,040
bytes. The detailed coverage, conflict inventory, ordering audit and GO/NO-GO
matrix are in `specs/database-characters-k10-k14.md`.

Only `id`, `rarity` and `type` satisfy the K14 per-field readiness criteria;
these are evidence decisions, not delivery or authority promotion. K11 remains
audit-only and cannot be read by Android, runtime consumers or publishers.

K15 now provides the pinned, compact supported-only projection authorized by
K14. Its 4,296 deterministic records contain exactly `cardId`, `stateId`,
`rarity` and `type`; the 1,463 production-unjoinable cards remain excluded.
The payload is 29,902 bytes gzip / 558,190 bytes raw, with gzip SHA-256
`803346fc61a7e659ccb8aeea62c273fcdf24ef3d66d3d03564a6fad29627c81f`.
Offline generation and standalone pin validation are GO. K15 never creates,
removes or mutates productive `Character` records, and standalone validation
does not open K11. Details are in `specs/database-characters-k15.md`.

K16 now implements the explicitly opt-in, offline K15-only compare-shadow
consumer. It validates the pinned K15 release before and after use, validates
the exact 121,390,313-byte productive `Character[]` pin with 4,090 top-level
records, compares all 4,296 compact records by structural ID, and reports
bounded `id`/`rarity`/`type` agreement, difference, missing and ambiguous
counts. Top-level records outrank nested transformations; equal nested repeats
use the first exact path and divergent duplicates fail closed. The consumer has
no writer, apply, merge or changed-`Character[]` API and does not load K11 or
K0-K14 sidecars. The pinned real-data comparison reports 4,296 `id` agreements,
4,296 `type` agreements and 4,085 `rarity` agreements plus 211 differences
where the productive nested value is null, with zero missing or ambiguous
bindings. Details are in `specs/database-characters-k16.md`.

GO is limited to explicit offline compare-shadow. Publication, authority
promotion, production use, effective-value changes, R2, publishers and Android
remain NO-GO; FYI/DokkanInfo remain active.
