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

DokkanInfo event pages expose some structured Vue attributes, yet transport and coverage remain HTML-centric. They stay reference-only when a structured endpoint exists. The E7 boundary remains unchanged: SBR roots and scraped event reward rows are unjoinable until a structural first-party/server identity is proved.

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
