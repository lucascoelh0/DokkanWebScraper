# Special modes capture M0–M6 — offline audit

M0–M6 audit two exact local HARs without issuing, preparing or replaying requests. The implementation is additive, optional, disabled by default and has no Android, R2, publisher, production or mutation capability. Raw HARs, headers, cookies, tokens, query values, account values, raw payloads, binary bodies and `data/` artifacts remain outside Git. Only sanitized structural observations and synthetic fixtures are tracked.

## Source lock and M0 inventory

| Capture | Bytes | Entries | SHA-256 |
| --- | ---: | ---: | --- |
| `burst-mode-2026-08-10` | 1,172,149 | 118 | `f38177e42e4e8aa89140033eae5e470e842391a575a869b0b5464c89b6947875` |
| `pettan-not-live-2026-08-10` | 1,282,236 | 165 | `2ceee1373ab93ec33ee32e322cf09b48d25ac5ed5c8f2ef5580b22a85bbd92de` |

The combined inventory contains 283 entries and labels 12 captured mutations as observations only. Across request and response sides, representations are 289 absent, 53 identity JSON, eight base64 binary, 216 cache-not-modified 304 and zero Zstandard. A 200 identity body, a 304 cache representation and binary delivery are non-equivalent observations; they are never promoted to conflicts.

The inventory retains capture ID, entry index, timestamp, normalized route, method, status, scope, MIME, size, representation and sensitive-header names. It never retains the corresponding sensitive values. Scope is explicit: global product, bounded capture-time/account observation, asset delivery or unknown.

## M1 — inactive Pettan evidence

Both observed `GET /sd/packs` bodies contain an empty `sd_packs` array. This proves only two capture-time empty indexes while Pettan was not live; it proves neither an empty global catalog nor unavailability at another time. Five captured tutorial/pack-opening mutations retain method, normalized route, response status and shape-only account boundaries. Their values and effects are omitted, and the code has no callable mutation path.

Three announcement reads and four binary assets are retained as sanitized structural observations. No Pettan battle route was observed, so battle identity, setup, state, rewards and gameplay all remain `unknown`. M1 contains zero observed pack IDs and zero battle routes; no synthetic battle is invented.

## M2 — Burst briefing evidence

One briefing body explicitly contains a `genkai_battle` object. Structural identity is therefore the body, not the HAR filename, presentation text or route quest alone. The allowlisted projection records route quest `1511002`, genkai root `48`, schedule `52`, 38 gimmick IDs, 13 distinct subcategory IDs and 40 condition IDs. It also records empty advantageous-card arrays, `is_cpu_only = false` and `ranking_enabled = true` as bounded raw product fields.

M2 emits 320 facts: 119 `supported` numeric identities/booleans and 201 `partial` raw fields whose labels, units, precedence, effect direction, scoring and runtime application are not proved. Deck, supporters, previous score, prior term, descriptions and presentation text are account/presentation surfaces and are omitted. The observed 200 start route shares quest `1511002` and occurs after the briefing, but request and response each expose only an opaque signature and zero visible structural IDs. Route and order are insufficient: both Burst association and configuration remain `unknown`, and the value is never retained.

One announcement and four binary assets are structural observations only. Zero Zstandard bodies occur in either input, so no decode is attempted.

## M3 — database-first joins

All joins use exact structural numeric IDs. The route quest joins E2 quest stage `1511002`, whose area is `1511` and whose level/map IDs are `15110022` and `15110023`. This supports quest topology only; it does not prove Burst gameplay or make the quest itself a Burst root.

E1/E2 contain 131 SD packs, 48 SD maps, 231 arenas and 1,169 stages. Because the inactive capture exposes no pack/map/arena/stage ID, none can be joined to Pettan. S2's 25 community series roots and SD map IDs occupy different namespaces and remain unjoinable.

The pinned 95,428,608-byte SQLite snapshot (`3654eb7db9e18dfe4c238abd02bcc06a688ffa6f30aa1ad93fd108dcfeb78265`) is opened URI read-only with `query_only`. All 13 captured `genkai_gimmick_sub_category_id` values join exact rows, spanning four raw category types and ten invalidation edges. This supports row identity, priority and invalidation topology only; labels, modifier effects and scoring remain unproved.

The 22 `genkai_gimmick_sub_categories`, 706 `score_benefits` and 19 `special_bonuses` rows are still 747 root candidates, but expose no foreign key to captured genkai root `48`. The score-benefit conditions expose structural keys but no binding to this briefing or aggregation formula. M3 therefore has two supported joins, zero partial joins, two unjoinable joins and two coverage gaps.

## M4 — lossless sanitized contracts

M4 reconstructs every allowlisted M1–M3 observation as 349 facts with 359 source spans: 135 supported, 206 partial and eight unknown. Eight omission records bind account values, secrets/headers, presentation text, raw payloads, binary bytes and opaque signatures to explicit exclusion reasons. Validation rebuilds the complete ordered fact set from M1–M3 and fails on loss, duplication, status drift or lineage drift.

`supported` means direct structural identity or verified bytes/lineage. `partial` preserves an observed field or join while its product semantics remain unproved. `unknown` marks a missing authority, missing active evidence or missing join. These statuses are evidence boundaries, not confidence scores.

## M5 — shadow parity

M5 pins validated E9, S7, H3, H12 and H13 artifacts plus current local caches. Their lineages close E0–E9, S0–S7 and H0–H13. The two DokkanInfo cache aggregates contain 898 event files and 25 `sdbattle` roots; the current stage catalog contains 7,600 entries.

The 17 exclusive parity rows use non-equivalent units, so their 2,634-unit aggregate is a profile rather than an entity total:

| Classification | Units |
| --- | ---: |
| agreement | 48 |
| representation gain | 1 |
| representation mismatch | 1 |
| coverage gap | 1,604 |
| unknown | 208 |
| unjoinable | 772 |
| confirmed conflict | 0 |

H3 agrees on genkai root `48` and schedule `52`; the 13 exact SQLite subcategory joins add structural agreements. The captured route quest and H3 sugoroku map are different structural dimensions, so their difference is a `representation_mismatch`, not a conflict. H13 independently retains 612 gasha representation mismatches, 15 gaps and zero confirmed conflicts. Current cache absence, separate namespaces, empty capture-time indexes and candidate-table non-joins are likewise never promoted to conflicts.

### Local score recomputation hypothesis

The user confirmed that selecting modifiers changed the displayed predicted score while no additional API call was observed. This is strong evidence for client-side recomputation from data already received. The briefing is the strongest structural candidate because it contains 38 modifier `point` values, priorities and condition shapes. SQLite closes the 13 subcategory taxonomy IDs but supplies no genkai-root foreign key or proved aggregation function. Three `/events` responses have no body persisted in the HAR, so `/events` contributes no payload evidence. Four captured help assets are binary presentation material, not machine-readable formula authority.

The hypothesis is therefore `partial/strong`; the formula remains `unknown`. No sum, multiplier, interaction, cap, precedence or rounding rule is declared.

## M6 — readiness

| Decision | Status | Boundary |
| --- | --- | --- |
| merge disabled infrastructure | **GO** | additive, offline-only, default-off and fail-closed |
| tracked synthetic fixtures | **GO** | minimal GET-only shapes with no captured scalar values |
| active Pettan catalog or battle | **NO-GO** | capture was inactive, indexes empty and battle unobserved |
| Burst gameplay or scoring | **NO-GO** | raw briefing fields do not prove effects or formulas |
| opaque start configuration | **NO-GO** | omitted signature provides no schema authority |
| replace E/S/H or current caches | **NO-GO** | bounded shadow evidence and explicit gaps |
| Android | **NO-GO** | out of scope and unchanged |
| R2 or publisher | **NO-GO** | out of scope; no dry-run or byte projection |
| production enablement | **NO-GO** | production unchanged and default remains off |
| request/replay/mutation automation | **NO-GO** | prohibited and unsupported |

### Campaign closure and optional future-window checklist

M0–M6 is complete with the current evidence. No additional Pettan capture and no start/finish capture is required. The interception crash at stage boundaries is accepted as a hard capture boundary and does not block readiness. Pettan schedule, battle, result and runtime rewards remain `partial/unknown`; the start route's Burst association and configuration remain `unknown`.

The following flows are optional dependencies for a future event window, not requirements for this campaign. Every such session must remain user-driven and passive, start from a new exact source lock, retain source spans, run under the memory cap, sanitize before projection, scan fail-closed and reproduce twice byte-for-byte.

1. During a future visibly active Pettan window, record a cold read-only landing-screen navigation and the natural `GET /sd/packs`; stop before pack opening or tutorial advance. A complete result needs a non-empty 200 index with numeric pack/map IDs.
2. Repeat the same read-only navigation warm. Record whether the natural representation is 200 or 304, without forging conditional requests. Treat representation changes as typed observations.
3. Browse Pettan's read-only pack, series/map, arena and stage screens while recording naturally triggered GETs. Retain only exact numeric parent/child IDs. Stop before battle start or any account mutation. Close the E1/E2 join or report the precise missing numeric link.
4. During a future Burst window, passively record the naturally issued `GET /resources/home`. Retain root, schedule, area/map and window representations only; omit account state.
5. Record cold and warm `GET /quests/:id/briefing` observations for the same root in at least two naturally selected map/difficulty contexts, then repeat in another schedule/window. Retain route quest and body structural IDs, query key names and source spans; omit query values, deck, supporters, score and text.
6. Pair natural cold 200 and warm 304 observations for referenced announcement assets. Retain status/MIME/size/hash metadata only; binary bytes remain local and unversioned.
7. If a future special-mode response is Zstandard, validate the frame but do not decode. Dictionary ID `315060143` alone is never proof. Decoding requires independently sourced exact dictionary bytes pinned by size, SHA-256 and ID, plus a reviewed bounded provider and a green decode receipt; every mismatch fails closed.

The machine-readable M6 artifact contains five fully ordered optional flows with preconditions, retained evidence, stop boundaries and completion criteria. It contains no start/finish flow.

## Determinism, memory and artifacts

The maximum sampled working set is 258,596,864 bytes at M3 while hashing the pinned SQLite before and after its read-only query, below 1 GiB. Isolated M0–M6 peaks are 63,160,320 / 55,091,200 / 58,236,928 / 258,596,864 / 55,050,240 / 125,128,704 / 72,220,672 bytes. Runners use a 576 MiB Node heap limit and execute sequentially.

| Gate | Primary artifact bytes | SHA-256 |
| --- | ---: | --- |
| M0 | 219,041 | `96a662cfd72d1136c1ec0cab4001e3e6e11d573c68a8a372770c9ecfba22b200` |
| M1 | 8,237 | `82eb92bbae7b65baea8718607e23ac4ed85c846d87847e84bb831da7fca4ecfb` |
| M2 | 160,323 | `98912187018fe54a38404e7c735ecb8e0fe76316c805a1000b755ab527639d29` |
| M3 | 7,024 | `d2af3b8bcfdab58c02e6508b61625905aabec4de9f9fb7ca92054199528027ac` |
| M4 | 207,809 | `32b5c76ea46b76b0abeff15a313f1e0c23c05b155620a01a6d911510e101fdd4` |
| M5 | 23,096 | `bf03ccfc89e43b21f3dca1792f0392ff6492a20b53de3c8edc54e821bb6b1dbb` |
| M6 | 15,255 | `bc4978334f5ad14f68b4af9e502a250cc2ede9bff74e572516c0a68b86fd0751` |

Two complete sequential M0–M6 reconstructions produced 22 byte-identical files. The final M6 scanner compares 139 captured sensitive values against every sanitized M0–M6 payload and the synthetic fixture. Exact captured-value matches and generic secret-pattern matches are both zero. Generated artifacts remain ignored under `data/`; tracked TypeScript and `lib/` are required to correspond exactly.
