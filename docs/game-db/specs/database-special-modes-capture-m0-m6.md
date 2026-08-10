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

M2 emits 320 facts: 119 `supported` numeric identities/booleans and 201 `partial` raw fields whose labels, units, precedence, effect direction, scoring and runtime application are not proved. Deck, supporters, previous score, prior term, descriptions and presentation text are account/presentation surfaces and are omitted. The common start request and response expose only an opaque signature; the value is never retained, and start configuration remains `unknown`.

One announcement and four binary assets are structural observations only. Zero Zstandard bodies occur in either input, so no decode is attempted.

## M3 — database-first joins

All joins use exact structural numeric IDs. The route quest joins E2 quest stage `1511002`, whose area is `1511` and whose level/map IDs are `15110022` and `15110023`. This supports quest topology only; it does not prove Burst gameplay or make the quest itself a Burst root.

E1/E2 contain 131 SD packs, 48 SD maps, 231 arenas and 1,169 stages. Because the inactive capture exposes no pack/map/arena/stage ID, none can be joined to Pettan. S2's 25 community series roots and SD map IDs occupy different namespaces and remain unjoinable.

The 22 `genkai_gimmick_sub_categories`, 706 `score_benefits` and 19 `special_bonuses` rows are 747 Burst candidates, but expose no foreign key to captured genkai root `48`; they remain unjoinable rather than being joined by names or proximity. M3 has one supported join, one partial join, two unjoinable joins and two coverage gaps.

## M4 — lossless sanitized contracts

M4 reconstructs every allowlisted M1–M3 observation as 349 facts with 359 source spans: 134 supported, 207 partial and eight unknown. Eight omission records bind account values, secrets/headers, presentation text, raw payloads, binary bytes and opaque signatures to explicit exclusion reasons. Validation rebuilds the complete ordered fact set from M1–M3 and fails on loss, duplication, status drift or lineage drift.

`supported` means direct structural identity or verified bytes/lineage. `partial` preserves an observed field or join while its product semantics remain unproved. `unknown` marks a missing authority, missing active evidence or missing join. These statuses are evidence boundaries, not confidence scores.

## M5 — shadow parity

M5 pins validated E9, S7, H3, H12 and H13 artifacts plus current local caches. Their lineages close E0–E9, S0–S7 and H0–H13. The two DokkanInfo cache aggregates contain 898 event files and 25 `sdbattle` roots; the current stage catalog contains 7,600 entries.

The 16 exclusive parity rows use non-equivalent units, so their 2,621-unit aggregate is a profile rather than an entity total:

| Classification | Units |
| --- | ---: |
| agreement | 35 |
| representation gain | 1 |
| representation mismatch | 1 |
| coverage gap | 1,604 |
| unknown | 208 |
| unjoinable | 772 |
| confirmed conflict | 0 |

H3 agrees on genkai root `48` and schedule `52`. The captured route quest and H3 sugoroku map are different structural dimensions, so their difference is a `representation_mismatch`, not a conflict. H13 independently retains 612 gasha representation mismatches, 15 gaps and zero confirmed conflicts. Current cache absence, separate namespaces, empty capture-time indexes and candidate-table non-joins are likewise never promoted to conflicts.

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

### Exact future capture checklist

Every future session is user-driven and passively recorded. It must start from a new exact source lock, retain source spans, run under the memory cap, sanitize before projection, scan fail-closed and reproduce twice byte-for-byte. It must stop before any mutation control unless a separate passive-observation campaign was explicitly authorized; even then it may observe a user's independent action but never cause, script or replay it.

1. During a visibly active Pettan window, record a cold read-only landing-screen navigation and the natural `GET /sd/packs`; stop before pack opening or tutorial advance. A complete result needs a non-empty 200 index with numeric pack/map IDs.
2. Repeat the same read-only navigation warm. Record whether the natural representation is 200 or 304, without forging conditional requests. Treat representation changes as typed observations.
3. Browse Pettan's read-only pack, series/map, arena and stage screens while recording naturally triggered GETs. Retain only exact numeric parent/child IDs. Stop before battle start or any account mutation. Close the E1/E2 join or report the precise missing numeric link.
4. Pettan battle routes may be observed only if a user independently plays in a separately authorized passive session. Retain operation order, product IDs and shape-only account boundaries; make no causal, effect or reward claims.
5. While Burst is visibly active, passively record the naturally issued `GET /resources/home`. Retain root, schedule, area/map and window representations only; omit account state.
6. Record cold and warm `GET /quests/:id/briefing` observations for the same root in at least two naturally selected map/difficulty contexts, then repeat in another schedule/window. Retain route quest and body structural IDs, query key names and source spans; omit query values, deck, supporters, score and text.
7. Pair natural cold 200 and warm 304 observations for referenced announcement assets. Retain status/MIME/size/hash metadata only; binary bytes remain local and unversioned.
8. Proving common-start configuration requires a separate authorization for local schema-only instrumentation before signing or after verification during a legitimate manual play. Retain only names, types, presence/cardinality and product-ID domains. Never retain, reconstruct, send or replay the signed body. Until that exists, the dimension is `unknown`.
9. If a future special-mode response is Zstandard, validate the frame but do not decode. Dictionary ID `315060143` alone is never proof. Decoding requires independently sourced exact dictionary bytes pinned by size, SHA-256 and ID, plus a reviewed bounded provider and a green decode receipt; every mismatch fails closed.

The machine-readable M6 artifact contains seven fully ordered flows with preconditions, retained evidence, stop boundaries and completion criteria.

## Determinism, memory and artifacts

The maximum sampled working set is 125,968,384 bytes at M5, below 1 GiB. Isolated M0–M6 peaks are 63,008,768 / 56,795,136 / 57,962,496 / 89,112,576 / 55,341,056 / 125,968,384 / 71,675,904 bytes. Runners use a 576 MiB Node heap limit and execute sequentially.

| Gate | Primary artifact bytes | SHA-256 |
| --- | ---: | --- |
| M0 | 219,041 | `96a662cfd72d1136c1ec0cab4001e3e6e11d573c68a8a372770c9ecfba22b200` |
| M1 | 8,237 | `82eb92bbae7b65baea8718607e23ac4ed85c846d87847e84bb831da7fca4ecfb` |
| M2 | 160,056 | `75fa17e91f214fdcc70732773e2ffabcf286d36152168640db0c8b27895be091` |
| M3 | 5,454 | `8b4406063398ee1a0ba13f6f71e032dfea3d323784548d29e9a412e6447c0ac9` |
| M4 | 207,645 | `794c921e01e9bba7773bd88b097cef65a5f60355be467f3bba89bf439f119d6a` |
| M5 | 22,620 | `e7bf2638d2c33d68768acc7c91788f63390dc74e75272314cb2238b9de2ba72f` |
| M6 | 15,132 | `c99e3b25636a240867e1ddfe1225b6fd042ca7e8f6d91eb4c228addd7c15c209` |

Two complete sequential M0–M6 reconstructions produced 22 byte-identical files. The final M6 scanner compares 139 captured sensitive values against every sanitized M0–M6 payload and the synthetic fixture. Exact captured-value matches and generic secret-pattern matches are both zero. Generated artifacts remain ignored under `data/`; tracked TypeScript and `lib/` are required to correspond exactly.
