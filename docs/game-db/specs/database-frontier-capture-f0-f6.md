# Dokkan Frontier capture F0–F6 — offline protocol audit

F0–F6 audit one exact local HAR without issuing, replaying or preparing any request. The infrastructure is additive, disabled by default and incapable of battle replay. Raw HAR bytes, compressed bodies, decoded account payloads, proprietary dictionaries and real scalar fixtures remain outside Git.

## Source lock

- Capture: `frontier-2026-08-10` / `frontier.har`.
- Size: 2,181,883 bytes.
- SHA-256: `2bd584040f46025fa5f9cd7275846bf68dd27bb9c52a65ef3429d872a74f61cb`.
- Entries: 155, from `2026-08-10T13:58:14.085Z` through `2026-08-10T14:12:41.701Z`.
- Structural inventory: 27 product reads, 24 already-observed mutations, 101 CDN reads, two authentication entries and one account-state read. Mutation means captured evidence only; no mutation is callable from this code.

The inventory retains entry index, timestamp, method, normalized path, status, MIME, decoded body size and names of sensitive headers. It never retains header, cookie, query or authentication values.

## F1 — Zstandard and dictionary identity

Twenty response bodies, totaling 16,438 compressed bytes, have MIME `application/x-zstd`, HAR `content.encoding = base64` and the standard frame magic `28 b5 2f fd`. Their valid frame descriptors all select a four-byte dictionary ID field. Every frame declares dictionary ID `315060143`; this is proved from the frame format rather than inferred from filename or location.

The exact allowlisted APK, ELF, current SQLite, local SQLite backup and SQLCipher wheel were scanned for the Zstandard dictionary magic and ID. The APK's 779 entries and the wheel's eight entries were also scanned after ZIP decompression. No dictionary header was found. In particular, the 98,799,013-byte APK expanded to 177,869,909 scanned entry bytes and produced zero candidates. Discovery candidates are diagnostic only and can never establish identity; proof requires a separately and explicitly pinned dictionary with verified ID, size and SHA-256. The decoder therefore remains `compressed_unknown`; it does not try raw-content guesses, name-based candidates or brute force.

The dependency-free decoder boundary validates frame magic, reserved bits, dictionary ID, dictionary size and SHA-256 before it can invoke a decompression provider. Invalid magic, ID/hash drift, provider failure, output-limit overflow and frame-content-size mismatch all fail closed. No Zstandard dependency was added because no real dictionary identity was proved.

## F2 — sanitized schemas

F2 emits types, presence, empty/null states and provenance only. Account subtrees such as `user_origin_series`, `user_origin_episode`, `user_origin_battle`, `special_guests` and `last_deck_cards` stop at their boundary; their scalar values are never projected.

The capture produces 26 target observations and nine route schemas: `series`, `episode`, `briefing`, `start`, `take_energy_ball`, `next_turn`, `use_group_change`, `execute_trigger_skill` and `finish`. All 20 battle responses stay `compressed_unknown`. The tracked fixture is synthetic and contains no captured values.

## F3 — Frontier catalog

The capture establishes two series and three episode IDs. Two episodes were detailed, yielding 11 pages, 65 nodes and 47 battle nodes with zero dangling capture-internal relationships. It adds the missing structural chain `episode → page → origin_spot → origin_battle`, including page order, spot order, predecessor, raw spot type, coordinates, display enemy-card reference and unlock-mission reference.

Twelve distinct unlock-mission IDs, two briefings and 15 temporal CDN asset observations are retained as bounded evidence. Briefing limitations preserve numeric card/category IDs and raw type strings, but no description text. A briefing request carries no stage ID, so temporal adjacency is not promoted to a briefing-to-stage join. Availability and unlock/progress fields remain separate capture-time/account observations with source-entry provenance; unlocked on this account never means universally available.

## F4 — observational battle protocol

The observed sequence contains one `start`, 11 `take_energy_ball`, five `next_turn`, one `use_group_change`, one `execute_trigger_skill` and one `finish`. Request schemas and structural product references are retained; battle-room and actor values become first-observation equality aliases. Selected-team and special-guest values, presence and counts are excluded from projection; the contract lists those fields only as always-omitted account surfaces.

The state machine records order only. It makes no claim about causality, RNG, damage, server validation, client authority or replayability. The product projection of episode `99001` is equal before and after `finish`; account values were deliberately not compared, so this is not proof of the finish effect.

## F5 — E0–E9 parity

F5 validates eight directly relevant E1–E7/E9 payloads, manifests and green receipts. E0 and E8 remain transitive through those contracts. The database-first comparison universe is two series, three episodes, 13 pages, 52 battles, 121 Origin-linked missions, 12 Origin asset paths and 49 Origin numeric asset references.

The 232 exclusive fact rows use non-equivalent domain units, so their aggregate is a profile rather than an entity count:

| Classification | Facts |
| --- | ---: |
| agreement | 69 |
| representation gain | 80 |
| temporal/account observation | 11 |
| representation mismatch | 43 |
| confirmed conflict | 0 |
| coverage gap | 9 |
| unknown | 8 |
| unjoinable | 12 |

Agreements comprise both series, all three episodes, 11 pages, 47 battle-to-spot joins, four display-enemy references and two heat-up set IDs. Coverage gaps are the two pages and five battles in the episode not detailed, the missing captured JSON-to-E6 asset relation and the undecoded finish reward surface.

All 65 node-topology facts and 12 unlock-mission references are representation gains. Forty-three display `enemy_card_id` values do not occur in the corresponding E3 encounter arrays; they are `representation_mismatch`, not confirmed conflict, because display identity and encounter membership are different representations. Twelve unique captured news CDN paths have no exact E6 path match and remain unjoinable; prefix and filename joins are forbidden.

Zero confirmed conflicts does not establish completeness, freshness or runtime semantics.

## F6 — readiness

| Decision | Status | Boundary |
| --- | --- | --- |
| merge disabled infrastructure | **GO** | offline-only, additive, default-off and fail-closed |
| tracked synthetic fixtures | **GO** | minimal and contains no captured scalar values |
| decode real offline battle bodies | **NO-GO** | no explicitly pinned dictionary, approved provider or green real-body decode receipt |
| replace E0–E9 data | **NO-GO** | bounded capture and explicit coverage gaps |
| Android shadow | **NO-GO** | Android unchanged and compatibility untested |
| publish R2 | **NO-GO** | no publisher dry-run, byte projection or key/cache plan |
| automated refresh | **NO-GO** | no approved non-personal credential lifecycle |
| consume battle protocol | **NO-GO** | response state and gameplay semantics unknown |
| replay or automate battle | **NO-GO** | prohibited and unsupported |

## Determinism, memory and artifacts

Two complete sequential F0–F6 reconstructions produced 16 byte-identical files. The final secret scan compared 81 sensitive captured values against all sanitized payloads and the synthetic fixture: zero exact matches and zero generic secret-pattern matches.

Peak working set stayed below the 1 GiB gate. F1 was the maximum at 488,800,256 bytes while scanning the process tree; F5 peaked at 375,648,256 bytes. F0/F2/F3/F4/F6 were 52,944,896 / 58,818,560 / 58,093,568 / 59,625,472 / 59,125,760 bytes.

Primary ignored artifacts:

| Gate | Bytes | SHA-256 |
| --- | ---: | --- |
| F0 inventory | 100,431 | `52f8743fc15e0220500ecf7bca48750bb0142277999f8a1c2134276b60964483` |
| F1 Zstd audit | 17,911 | `25bda55ee4934add3c6cf2fa3be44a1b1a61a52c70d039e0ee8b2fe360075817` |
| F2 sanitized shapes | 100,566 | `9959301fe78eec23a254c8ec0e088ab856b729087b2732cd15f60a45a1fbd992` |
| F3 catalog | 58,635 | `cf16367a2f263f427eee59bf373c3127fc2e85b4beb43b3ab4bdb5ebc00a749c` |
| F4 observational protocol | 28,067 | `0cd54213425f2c7cd1953b7c7f842dbaf82c1e5f966214f4575b8ba696f7f6ee` |
| F5 parity | 76,173 | `b3ffe309736732d86df09fc6aee6d3de0d53c8ed8e39dedab51137a0b13c1188` |
| F6 readiness | 6,158 | `6280ec896beda1150df84a1933f6f76ece28e278ba47a310922cfac6d28c8f63` |

The focused Frontier suite has 14 tests. The final relevant suite adds seven H0 path/source-safety tests and passes 21/21. TypeScript `--noEmit`, the final F6 run and `git diff --check` also pass; the staged secret scan is required again at the final commit checkpoint.
