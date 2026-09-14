# Home-feed R2 gateway

This Worker exposes the minimum R2 surface required by the home-feed publisher.
It binds only the `dokkanpanion-data` bucket and requires a `GATEWAY_TOKEN`
Worker secret of at least 32 UTF-8 bytes.

- `GET /object?key=...` returns a bounded allowed object and its `ETag`.
- `PUT /object?key=...` requires exactly one of `If-None-Match: *` or a single
  strong `If-Match` ETag. Hash-named objects accept create-only writes; manifest
  and run objects support create followed by ETag compare-and-swap.
- `GET /inventory?cursor=...` returns one page as
  `{ "bytes": number, "truncated": boolean, "cursor": string | null }`.
  It never returns object names.

The gateway chooses content type and cache policy from the validated key. It has
no delete route and does not log request headers, query strings, or exceptions.
It intentionally has no extra rate-limit binding: malformed and unauthorized
requests are rejected before any R2 operation, while volumetric controls remain
an account/route policy concern.

## Campaign capability

The optional `CAMPAIGN_GATEWAY_TOKEN` secret is separate from `GATEWAY_TOKEN`.
Without it, campaign routes return 503 without touching R2. Reusing the Home
secret is rejected. Neither token authenticates the other's routes.

- `/campaign-object` permits only `staging/v2/campaigns/manifest.json`,
  `index/<sha256>.json`, `details/<sha256>.json`, and `images/<sha256>.png`.
- Limits are respectively 4 KiB, 32 KiB, 512 KiB, and 512 KiB. Immutable files
  are create-only and hash-verified. Only the manifest accepts strong ETag CAS.
- `/campaign-inventory` is the deliberate aggregate-capacity exception: it counts
  the whole shared bucket, returning only bytes and an opaque pagination cursor,
  never object names or contents. The publisher needs this total to enforce the
  shared storage ceiling; a campaign-prefix subtotal would undercount usage.
- There is no production, Home, run-state, arbitrary key, delete or list-names
  capability for this credential. Full JSON schema/image decoding and publication
  ordering remain collector/publisher responsibilities, not gateway guarantees.

`../campaign-gateway-store.mjs` implements the publisher's read/write/inventory
interface using `CAMPAIGN_GATEWAY_URL` and `CAMPAIGN_GATEWAY_TOKEN`. It never falls
back to Home or broad S3 credentials. Import/construction performs no network I/O.
This does not provision the secret, deploy the Worker or enable a scheduled job.

### Activation gates

1. Review and authorize deploying the optional capability and provisioning a
   distinct secret. Keep its value outside source, logs and the APK.
2. Supply independently reviewed, hash-pinned campaign definitions from the current
   database; do not use a private HAR or emulator overlay as fresh public data.
3. Configure the opt-in runner step in the existing Home slot, preserving one
   attempt per slot, ownership checks and sanitized status receipts. Do not add
   another timer. Hosted settings must pass the read-only check before activation.
4. Run a fresh collection and read-only publication preflight. Report exact object
   bytes and projected shared-bucket usage before any approved R2 write.
5. Publish immutable images/details/index first, conditional manifest last; verify
   public hashes/sizes and then test the Android consumer against remote data.
6. Validate one scheduled observation before claiming automatic refresh is active.

Reference check: Cloudflare's Workers best practices and R2 Workers API,
retrieved 2026-09-13; installed types `5.20260911.1`. Existing bindings/config remain
unchanged. See the dated rollout record below for deployment and activation state.

### Runner inputs

`run-refresh.mjs --publish-staging` now optionally invokes campaigns after verified
Home publication. `--collect-only` and `--validate-auth` retain their old behavior.
Only the exact string `HOME_FEED_CAMPAIGNS_ENABLED=true` activates the optional step.
It needs `CAMPAIGN_GATEWAY_URL`, `CAMPAIGN_GATEWAY_TOKEN`, an absolute regular-file
`HOME_FEED_CAMPAIGNS_DEFINITIONS_PATH`, plus independently reviewed
`HOME_FEED_CAMPAIGNS_DEFINITIONS_SHA256` and `HOME_FEED_CAMPAIGNS_DATABASE_SHA256`.

The definitions file is read with a 2 MiB ceiling and full schema/pin validation
before constructing auth/storage. Presentation is enabled for this new path.
Missing/invalid campaign settings fail only the campaign step after Home success;
there is no retry in the same lease. The capability closes on success or failure.
Only publication counts/capacity totals and sanitized status leave the step.

The hosted workflow alternatively accepts
`HOME_FEED_CAMPAIGNS_DEFINITIONS_GZIP_BASE64`: canonical base64, at most 32 KiB
encoded, gzip decompressed to at most 2 MiB. It is mutually exclusive with the
local path and undergoes the same schema/database/checksum validation before
authentication. This small, reviewed static game-content snapshot is an environment
variable, not account data or a credential. Update it together with both reviewed
pins when exporting new definitions; never accept an unpinned `latest` input.

The workflow exposes these settings only as environment values, never interpolated
shell source. Its optional `check_campaigns` manual input performs GET-only gateway
checks using the hosted secret, skips game login and publication, and reports only
operation/status/capacity. It does not consume a Home publication slot.

2026-09-13 rollout: gateway code deployed (initial version
`425a2917-7318-41a4-9810-e54236c2af02`), distinct campaign secrets provisioned in
Cloudflare and GitHub `home-feed-staging`. Definitions are 116344 bytes / 17768
encoded bytes, SHA-256
`633c9be4fe1c097348381093cddd2da23fd3a662a8c8f8564e3fe85a40a23d3e`, database
`dcccb18baf72727e3f31db6b2f17a11eefb1b3f9aecaa75a04cfbabfae89e7b8`.
The immediate local gateway smoke check failed with sanitized diagnostics; the
subsequent hosted GET-only check passed in run `34784816102`, with inventory and
manifest HTTP 200, and shared-bucket usage of 1657039479 bytes. The early failure's
exact cause is not established; credentials were not rotated or exposed to retry.
Campaigns were then enabled in the existing six-hour Home workflow. One normal
publication run `34784938863` completed with `already_running`: the current slot
was already reserved, so it made no new game login or campaign publication.
Do not clear the reservation or force a retry. The next scheduled slot must prove
successful campaign publication and public image/detail/index hash verification.
This configuration does not yet prove a successful scheduled campaign publication.
No production objects or Home credentials were changed.

### Hosted recovery verified — 2026-09-14

Read-only history established that run `34782284641` failed during collection:
nonce/sign-in returned 200, then summons returned 400. The later `already_running`
result meant a consumed six-hour slot, not an active process. No reservation was
deleted or reclaimed. Hosted login configuration still dated 2026-09-12, before
the successful current-session capture from 2026-09-13.

After offline validation of that capture's nonce/login lineage and bearer
association, the primary updated only `HOME_GAME_AUTH_JSON` in the existing
`home-feed-staging` environment. The secret was encrypted with GitHub's public
key; no raw capture, old bearer, token or login configuration was logged or
committed. No job was active during the update. One manual dispatch used the
ordinary protected publishing path in a new slot, with no retry or lock bypass.

Run `34797853252`, main `8a97207319a54d345acedcbba3c231788b455d78`, passed tests
and published Home plus enriched campaigns. Campaign preflight reported
1,092,869 write bytes and projected shared storage 1,659,516,743 bytes.
Independent public verification passed schema 2, eight campaigns, 191 missions,
55 typed event links and eight decoded images (1,093,122 verification bytes).
Manifest SHA-256:
`90158387f145adcf54a29b754e33d8088e8ae1c7c74f4f5e6a5f1309f31ecf76`.
Observation: `2026-09-14T02:03:53.808Z`; validity:
`2026-09-14T08:03:53.808Z`. Old observation expiry was not extended.

This proves the hosted manual path, not a subsequent cron-triggered run. The
six-hour schedule and its safeguards remain unchanged. Production is untouched.
If the game rejects a future read, inspect sanitized phases and configuration
age before retrying; `already_running` alone must never be called a stuck lock.

### Independent public verification

Run `node home-feed/verify-public-campaigns.mjs --require-v2` after a new campaign
publication. It has no credential input and performs only fixed-origin GETs.
It checks bounded manifest/index/detail/image bytes and hashes, revision/context
consistency, campaign identity and board counts, typed event destinations, PNG
decoding/dimensions, freshness, and unchanged manifest at completion. Shared
artwork is fetched once, with eight images and a 4 MiB snapshot ceiling (plus
one bounded manifest reread). It is an integrity audit, not a replacement for the
Android parser or a device UX check. Output contains only sanitized phases,
counts, timestamps and a manifest digest; never raw payloads or exception text.

Without `--require-v2`, it can verify legacy staging data but reports schema 1
and zero artwork; that is not evidence of the enriched rollout. On 2026-09-13,
the existing schema-1 snapshot verified as 8 campaigns / 191 missions, expiring
2026-09-14T00:05:50.718Z. The monitor must require schema 2 for rollout acceptance.
