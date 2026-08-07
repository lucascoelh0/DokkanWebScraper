# Database/server source catalog

Status: S0 complete (`0.1.0`); static discovery only, optional and non-production.

## Authority boundary

SQLite remains authoritative for every already-proved static identity and relation. A server source may become authoritative only for a separately contracted dynamic field whose response is structurally keyed and whose current request/response behavior is evidenced. Community sources remain shadow or gap evidence. Names, titles, localized text and derived HTML keys are never join identity.

The model keeps four channels independent:

1. static identity — database table domain plus numeric ID;
2. schedule — server periods, availability, maintenance and server time;
3. presentation — localized title, description and imagery;
4. delivery — versions, manifests, object/container keys, bytes and hashes.

Missing values stay absent. `supported`, `partial` and `unknown` are preserved per dimension; a source does not inherit authority merely because another field in the same response is supported.

## S0 evidence checkpoint

- Baseline commit: `d28b3f2f006a6544ff7979c107ff220f899c2088`.
- Database snapshot: `global-6.4.0-v338-2026-08-05`.
- Global base APK: 98,799,013 bytes, SHA-256 `a51ba758e0555e0a756aa4f20278e6bec25ba6b0c7dcdcd0f4372e0fad159bc0`.
- Native ELF: 95,662,296 bytes, SHA-256 `7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a`.
- The APK, ELF, repository code, ignored caches and prior emulator observations were inspected without making a network request.
- Local `settings.json` was deliberately not opened because it may contain credentials or secrets.

## Hosts and roles

| Host | Evidence | Permitted role at S0 |
|---|---|---|
| `ishin-global.aktsk.com` | literal in official Global ELF and prior emulator connection observation | candidate official authority for dynamic fields; no request is yet authorized |
| `dokkan.fyi` | current repository clients | structured community shadow source |
| `cdn.dokkan.fyi` | current asset URL builders | community delivery mirror only |
| `dokkaninfo.com` | current repository scrapers | HTML/Vue parity and gap evidence only |
| `assets.dkbcompanion.com` | project delivery documentation | future project sidecar delivery only; never upstream evidence |

The official ELF also contains version and context header names: `X-AssetVersion`, `X-DatabaseVersion`, `X-ClientVersion`, `X-RequestVersion`, `X-Language` and `X-Platform`. `Authorization`, `X-APIToken`, `X-UserID`, `X-UserCountry` and `X-UserCurrency` are sensitive or pseudonymous and their values must never reach logs, receipts or committed fixtures.

## Official endpoint candidates

Static strings prove path existence in the client, not HTTP method, reachability, schema or permission to call it. All official paths therefore remain `discover_only` in S0.

| Family | Static path evidence | Candidate dimensions | S0 boundary |
|---|---|---|---|
| client assets | `client_assets/database`, `client_assets/new_version_exists` | database/assets versions and delivery | auth, method and response schema unknown |
| events | `events/ids`, `events/listbutton_images`, `events/eventkagi_events` | roots, current availability and presentation assets | server-time and payload semantics unknown |
| gasha | `gashas/{id}/featured_cards`, `gashas/{id}/rates` | banner identity and featured card IDs | method, currency/category semantics and current periods unknown |
| RMBattle | `rmbattles/{id}`, `rmbattles/available_user_cards` | missing root, current period and account/runtime restrictions | second path is likely account-dependent and cannot use a personal session |
| World Tournament | `budokais/{id}/rankings`, `budokais/{id}/rankings/borders` | active root, period and aggregate reward/rank boundaries | possible user-derived data requires minimization |
| missions | `missions/categories` | current mission/reward binding | reward identity and grant semantics unknown |

Action-shaped paths for draws, entries, reward acceptance, battle start/finish/dropout and mission mutation are grouped as `prohibited`. They remain prohibited even if a future observation shows an unusual GET transport.

## Community structured sources

The current Dokkan FYI summon client performs GET requests to `summons?active=true&category={id}&page={page}` and `summons/{id}` and parses the `application/json` page payload. It supplies numeric summon and featured-character IDs plus periods and banner paths. S1 may sample it conservatively for shadow evidence, but it is not official schedule authority.

DokkanInfo event pages expose some structured Vue attributes, yet transport and coverage remain HTML-centric. They stay reference-only when a structured endpoint exists. S2 later corrects the former E7 product label for the `sdbattle` family: those 25 records describe Pettan Battle, while SBR/ESBR structurally join challenge roots 710/720 to SQLite areas. Scraped event reward rows remain unjoinable until a structural first-party/server identity is proved.

## Threat model

The protected assets are credentials, account state, device identifiers, request signatures, private traffic, upstream availability, local ignored artifacts and the integrity of database-first facts. Principal risks are credential leakage, accidental mutation, collection from a personal account, authentication or attestation bypass, rate-limit harm, stale/replayed schedule, schema drift, cross-host redirects, oversized or decompression-bomb responses, path traversal through asset keys, silently trusting community presentation, and treating zero observed conflicts as completeness.

Trust boundaries are explicit: official static client evidence is not a live server contract; a live response is not database identity; community structured data is not official authority; an asset reference is not delivery proof; and project R2 is downstream delivery, never source evidence.

## Collection policy for S1–S4

- GET only. Size metadata must come from a GET response or a documented manifest; no other HTTP method is permitted.
- Default concurrency 1, maximum 2 independent reads; at least one second between requests per host.
- Honor `Retry-After`; exponential backoff with jitter for 429/5xx; at most three attempts and no retry for other 4xx responses.
- HTTPS allowlist by exact host; reject credential-bearing URLs, cross-host redirects and non-HTTP schemes.
- No login automation, personal sessions, cookies, device IDs, signing reproduction, pinning bypass, attestation bypass or intercepted account traffic.
- If an official family needs any sensitive header or authentication context, stop that family and continue with independent public sources.
- Record request time, response time, status, media type, byte count, SHA-256 and sanitized headers. Store raw samples only under ignored `data/database-server/` and never commit them.
- Default response cap 25 MB; download only a bounded sample. Project aggregate bytes before a batch and stop before 500 MB total investigative transfer.
- Reject unknown schema/contract versions. Preserve raw IDs and missing fields; never add compatibility defaults.
- TTL is assigned only after volatility is observed. `fetchedAt` records retrieval; deterministic `generatedAt` records derivation and is never substituted for it.

## S0 gate result

**GO** for committing disabled catalog infrastructure and for bounded public GET probes against Dokkan FYI in S1. **NO-GO** for official API calls, authenticated capture, schedule replacement, banner replacement, asset batches, R2, Android and production activation.

Exit condition for the official-api NO-GO: direct evidence of a credential-free, read-only request with bounded response schema and no attestation, signature, device or account dependency. Otherwise that family stays documented and stopped.

## S1 schedule, availability and banners

The final S1 collector uses only the two public FYI GET patterns promoted by S0. It reads and hashes the actual S0 catalog, checks the exact pinned contract/snapshot, and verifies both endpoint entries remain `GET` plus `eligible_get_probe` before collection. The collector enforces an exact HTTPS host allowlist, serial concurrency, a one-second minimum interval, manual redirects, omitted credentials, three attempts only for 429/5xx, a 5 MiB response ceiling and a 50 MiB aggregate gate ceiling. That 50 MiB cap is the maximum projected batch transfer; the observed successful transfer was 2,149,474 bytes. Raw HTML and sanitized receipts remain under ignored `data/database-server/s1/raw/`.

The first 2026-08-07 pre-review run attempted 27 GETs: 17 succeeded against `dokkan.fyi` and 10 DokkanInfo event-index requests returned 403. A 403 was treated as non-transient and produced no response body or schedule data. Contract review then identified that DokkanInfo was `reference_only`, not `eligible_get_probe`; those calls therefore violated the S0 gate despite being read-only. The final runner removes DokkanInfo entirely and permits only the 17 FYI GETs. No capture or sidecar is committed, and no browser impersonation, authentication, cookies or bypass was attempted.

The successful structured page payloads contain 13 source-reported active gasha IDs:

| FYI query-filter membership | Banners |
|---|---:|
| Recommended | 2 |
| Dragon Stone | 1 |
| Ticket | 8 |
| Friend Pts. | 2 |

All 26 period values carry explicit timezone evidence and all 13 complete periods calculate as active at their individual fetch times. This calculation is `partial`: it uses community periods plus the collector clock and does not claim official server state. The capture retains 129 featured-character reference positions with numeric entry/payload/canonical/base IDs when supplied. Those IDs are structurally useful shadow evidence, but the featured relation remains community-only until an official `gashas/{0}/featured_cards` response is proved.

Category membership is not promoted to currency semantics. Currency/ticket identity, step/rate semantics and official featured relations remain `unknown`; presentation remains locale-unverified. The Global SQLite inventory contains no gasha/summon root table, so S1 adds no static identity authority and overwrites nothing from E0–E9.

No schedule records were promoted. The DokkanInfo event indexes were inaccessible under the permitted policy, the official event paths remain method/auth/schema unknown, and database dates remain embedded hints rather than current availability. Maintenance likewise remains `unknown` because no credential-free structured current source was found.

S1 gate decisions:

- **GO** — disabled, optional community-shadow banner sidecar infrastructure;
- **GO** — repeatable bounded FYI refresh for shadow comparison only;
- **NO-GO** — authoritative event schedule or availability;
- **NO-GO** — maintenance authority;
- **NO-GO** — banner replacement, currency/rate authority or production activation.

## S2 server-only roots

S2 performs no network requests. It verifies the manifests and payload hashes for E1, E2 and E7, then fingerprints exactly 27 ignored DokkanInfo cache records (`challenge-710`, `challenge-720`, and `sdbattle-1` through `sdbattle-25`). The resulting `0.3.0` contract keeps product labels separate from identity and explicitly forbids title joins and automatic joins between overlapping numeric namespaces.

The most important result is a semantic correction to the prior frontier report. DokkanInfo `sdbattle` and SQLite `sd_*` describe Pettan/Sticker Battle, not Super Battle Road. SBR and ESBR are the DokkanInfo `challenge` roots 710 and 720. Both root IDs match first-party SQLite `area` IDs, and all 175 cached stage IDs match first-party `quest_level` IDs under those areas: 90 for area 710 and 85 for area 720. The titles only establish the human-facing product label; the joins use numeric root and stage IDs exclusively.

| Product family | Static/root result | Server-only boundary |
|---|---|---|
| SBR / ESBR | `supported`: areas 710/720 and 175 quest levels already exist in SQLite | current schedule and availability remain unknown |
| Ultimate Clash (`rmbattle`) | `partial`: 98 distinct mission-referenced IDs; first-party strings identify the family, but no root table/payload exists | roots, titles, schedule, runtime topology and reward-root relation remain unknown |
| World Tournament (`budokai`) | `supported`: 63 first-party static roots | current schedule, availability, server match topology and ranking reward identity remain unknown |
| Burst Mode (`genkai`) | `unknown` root: family semantics are partial, but score/gimmick candidate tables expose no proved root FK | root IDs, schedule and score-benefit relation remain unknown |
| Pettan Battle (`sd_*` / `sdbattle`) | `partial`: 48 SQLite `sd_map` roots and 25 community series roots occupy separate namespaces | series-to-map relation and current schedule remain unjoinable/unknown |

S2 records two supported joins (177 identities: two roots plus 175 stages), three unjoinable relations, zero title joins and zero network requests. Its reviewed runner fails closed on unknown upstream contracts, upstream validation failures, E7 cache-fingerprint drift and cache changes during collection. Its peak working set was 309,186,560 bytes.

S2 gate decisions:

- **GO** — commit the disabled root-resolution contract and semantic correction;
- **GO** — treat SBR/ESBR as already database-rooted by IDs 710/720;
- **NO-GO** — claim schedule/availability resolution for any family;
- **NO-GO** — synthesize Ultimate Clash or Burst Mode root records;
- **NO-GO** — join Pettan series IDs to `sd_map` IDs by numeric overlap.

## S3 reward identity

S3 makes no network requests. It verifies the E5 and E7 manifests, payloads and green validation receipts, then requires the 24,832,924-byte DokkanInfo reward artifact and the exact parser implementation to match the hashes already audited by E7. `fetchedAt` remains the community artifact's 2026-07-23 retrieval timestamp; deterministic `generatedAt` remains the S3 evidence checkpoint.

The former E7 boundary treated all 40,345 normalized community reward records as unjoinable because the source reward number was retained only inside the generated key. S3 pins the key-builder implementation and reverses that key shape. This is not a title/text join: it recovers a numeric reward-number candidate and compares numeric event/stage, reward-row and item identities.

Contract review found an important loss of provenance in the historical parser: when `payload.id` was absent, it substituted the DOM index without marking which origin produced the key. It also deduplicated by key without recording the raw pre-deduplication count. Consequently, the artifact proves exact accounting of 40,345 normalized records, not lossless accounting of upstream rows, and none of its reward numbers can be promoted to a supported row identity retroactively.

For traditional quest families, 14,193 records align on `(stage_id, reward_number, item_type, item_id)` and another 717 align on stage/reward number but differ on item identity. All 14,910 remain `partial_candidate`, not agreement or confirmed conflict, because the reward number may be `payload.id` or a synthetic index. The remaining 341 traditional records are `unjoinable`. SQLite retains authority throughout.

Z-Battle remains deliberately weaker. For 2,919 rows, `(event_id, remote payload.id)` locates an E5 first-reward stage/level anchor and the item type/ID is unique inside its reward set. These are only `partial_candidate`: the semantics of the remote `payload.id` as the reward level/checkpoint have not been contractually proved. Quantity agrees for 2,170 candidates and conflicts for 749, but neither result promotes the candidate join. The other 22,175 Z-Battle rows remain `unjoinable`.

Every normalized record receives exactly one classification:

| Classification | Rows | Meaning |
|---|---:|---|
| `agreement` | 0 | blocked until identity origin is explicit |
| `confirmed_conflict` | 0 | blocked until identity origin is explicit |
| `partial_candidate` | 17,829 | 14,910 traditional and 2,919 Z-Battle candidates |
| `unjoinable` | 22,516 | no safe row-level target |

The channel contract keeps preview, drop, first-clear, mission, ranking and server-grant semantics distinct. It inventories 362 preview rows as partial, 16,717 drop rows with partial aggregate semantics, 22,225 first-reward rows with partial claim-frequency semantics, 24,484 mission reward rows, 44,273 ranking reward rows, and zero observed server-grant rows. Server grant identity/semantics remain `unknown`; action-shaped accept endpoints remain prohibited. No remote quantity is promoted where first-party quantity is absent, and no chance or repeatability is inferred.

The legacy collision count and raw upstream row count remain `unknown`. A future refresh may produce supported joins only after its parser preserves `identityOrigin: payload_id | synthetic_index`, records raw and normalized counts, and fails on or explicitly accounts for key collisions. The reviewed S3 sidecar is 27,789,750 bytes, SHA-256 `bf2e4d061fd4b08ff8c6e5637e9fdcd79183fb3fc079a72124a825159c3cedd9`; peak working set was 740,245,504 bytes.

S3 gate decisions:

- **GO** — commit the disabled reward-identity contract and its explicitly partial candidate sets;
- **NO-GO** — promote any historical normalized reward record to agreement or confirmed conflict;
- **NO-GO** — promote Z-Battle candidate joins until remote reward-ID semantics are proved;
- **NO-GO** — infer quantity, chance, repeatability or server-grant state;
- **NO-GO** — replace the static E5 reward contract or activate production consumers.
