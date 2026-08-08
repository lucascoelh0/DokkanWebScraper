# H7 — Capture shadow parity and readiness

Status: complete; offline readiness checkpoint, disabled and non-production.

## Pinned comparison

H7 verifies 19 source artifacts before comparison: capture sidecars H0 and H3–H6, database/server S0–S7, and the relevant database-events E1, E2, E5, E6, E7 and E9 contracts. A tracked source lock independently pins the path, byte size and SHA-256 of every external payload, manifest and validation receipt. The ignored external tree cannot replace those three files coherently without failing the lock. Contract/version and the receipt's green state must also match. Updating an upstream checkpoint therefore requires an explicit reviewed lockfile change. No scraper, collector, network request, captured-request replay or production pipeline runs.

The new capture comparisons use structural IDs or an explicitly documented path normalization only. Text and names are never join identity. For E6 database paths, the only normalization is adding one leading slash to a safe relative path; asset delivery still requires an exact resulting pathname. Existing S6 and E7 metrics are preserved as context but are excluded from the new capture totals to avoid double counting.

## Capture comparison result

The summary below is a non-exclusive sum of comparison cells, not a count of unique entities. Comparisons use different units—IDs, period boundaries and paths—and a single path may legitimately agree once against E6 and once against a captured CDN request. Per-comparison rows are authoritative; the aggregate is only a compact workload/profile summary.

| Classification | Count |
|---|---:|
| agreement | 3,871 |
| representation gain | 1,485 |
| confirmed conflict | 0 |
| unknown | 13,122 |
| unjoinable | 118 |

Important agreements include 339 event-root identities, 1,666 event-to-quest identities, 231 Z-Battle identities, one Ultimate Clash root, 10 gasha identities, all 20 start/end boundaries for the 10 common gashas, 1,504 normalized E6/H6 asset paths and 100 exact JSON-reference/CDN paths.

The largest gains are 1,391 official capture-time schedule coordinates and 55 official asset paths absent from E6. The capture also adds one database descriptor and one observed Genkai root. Twenty-one mission-completion references and 16 category references are absent from the E5 linked slice; they remain partial representation gains, not mission or reward authority.

The unjoinable set contains 97 captured CDN paths without a captured JSON reference, five featured-card relation parents whose card/character ID-domain mapping is unproved, and 16 display-reward references without a proved reward target. Zero confirmed conflicts means only that no comparable joined value disagreed; it does not prove coverage, freshness or completeness.

## Independent decisions

| Decision | Result | Boundary |
|---|---|---|
| merge disabled infrastructure | **GO** | readiness only; no merge is performed |
| sanitized local fixtures | **GO** | ignored audit/test use with validation, provenance and secret scanning |
| replace schedules | **NO-GO** | bounded capture-time observations; refresh and total coverage unproved |
| replace banners | **NO-GO** | current/total official inventory and consumer migration unproved |
| mission/reward authority | **NO-GO** | no progress, completion, contents, quantity, eligibility or grant authority |
| asset delivery | **NO-GO** | no complete manifest, byte identity, sizes or immutable-cache proof |
| R2 publication | **NO-GO** | no authorization, publisher dry-run, byte projection or cache plan |
| Android shadow mode | **NO-GO** | Android unchanged; missing/stale/old-cache compatibility untested |
| remove FYI/DokkanInfo | **NO-GO** | captures are bounded audit evidence and do not replace unmatched coverage |
| future authenticated automation | **UNRESOLVED** | capture structure does not prove a CI-safe auth/refresh flow |

## Future authenticated collection architecture — design only

This campaign does not implement or execute authenticated access. A future proposal must preserve these boundaries:

1. Long-lived credentials exist only in GitHub Actions Secrets or Cloudflare Secrets. No token, credential, signing material or account identifier is compiled into Android, committed, copied into a fixture or stored in a build artifact.
2. Secret material never appears in command-line arguments, URLs, artifacts or logs. A minimal isolated credential broker supplies an ephemeral access token directly to the collector process through a protected runtime channel; logs expose only bounded counters and sanitized error classes.
3. Authentication and renewal remain unresolved until independently proved. The pipeline fails before collection if token acquisition, expiration, refresh, attestation, device binding, account independence or read-only authorization cannot be established. A static `x-apitoken` or `access_token` is not assumed suitable for CI.
4. The collector is read-only, allowlisted and separated from persistence. Raw responses remain memory-bounded and ephemeral; the sanitizer removes secrets and account/progress fields before any file can be written.
5. A separate validation stage enforces an exact schema version, endpoint/path allowlist, maximum payload and aggregate size, deterministic bytes, SHA-256, provenance, secret scan and user-derived-authority prohibition. Unknown schema or authority fails closed.
6. Collection and publication are separate workflows with separate authorization. A publisher consumes only validated sanitized artifacts, must run a dry-run first, reports projected bytes and object counts, verifies the R2 budget, uses stable keys only for content-stable bytes and never receives upstream credentials.
7. Local captures remain confidential audit inputs only. They are not a production secret source, token cache, refresh mechanism or prerequisite for Android.

## Verification

- TypeScript `--noEmit`: passing.
- Focused H7 test: passing; all pinned manifests are verified and an attempted production decision promotion is rejected.
- Real H7 source set: 19 pinned artifacts; validation and secret scan pass.
- Two real outputs: byte-identical.
- Compiled runner heap cap: 576 MiB.
- Peak measured compiled-runner working set: 871,739,392 bytes, below 1 GiB.

## Final gate

**GO** for committing and pushing this isolated, disabled audit campaign branch.

**NO-GO** for main merge execution, production dataset or manifest changes, official requests, request replay, authenticated automation, Android changes, R2 publication or removal of existing community sources.
