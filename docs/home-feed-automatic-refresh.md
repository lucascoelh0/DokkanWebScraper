# Automatic Home refresh — implementation plan, 2026-09-12

Status: Actions collection validated on main; restricted Cloudflare gateway
deployed. Publication is still gated pending end-to-end verification.
Existing staging feed is unchanged at this checkpoint.

Activation authorized on 2026-09-12, conditional on security. GitHub environment
`home-feed-staging` permits only branch main. It holds HOME_GAME_AUTH_JSON and
HOME_GATEWAY_TOKEN; no bucket-wide R2 keys or Cloudflare administrative credentials
were transferred. A dedicated Worker enforces the staging key allowlist remotely,
conditional writes, content hashes and size limits, with no delete endpoint.
NPM push trigger ignores changes
limited to this isolated feed, its workflow/documentation and the NPM workflow
itself; other package changes still trigger the existing package pipeline.

Primary review aligned the collector with the current Android producer: 100-char
names, at most 100 unique featured IDs, single-segment PNG filenames. Combined
collector/coordinator tests passed on 2026-09-12. Added bounded authentication,
full PNG decode, slot reservation, conditional S3 publisher, and an isolated
dependency lock. All 46 focused tests passed on 2026-09-12. A complete live
authenticated collect-only run succeeded in 21,031 ms, producing 17 objects and
3,458,435 bytes, valid until 2026-09-13T18:35:18.592Z. Nothing was published.
Two earlier manual diagnostic attempts stopped during collection; offline
credential-shape validation passed with zero requests. CDN Content-Type is now
advisory: PNG signature, bounded dimensions and full decode remain mandatory.
Diagnostics contain only route/stage, HTTP status, image MIME/encoding and elapsed
time, never signed URLs or credentials. There is no automatic authentication retry.
Hosted collect-only run 34714925203 also passed, taking 2,183 ms for collection
and preparation (excluding job setup). Its 17 objects total 3,458,435 bytes.
Run 34714744909 was skipped while the repository enable variable remained false;
it made no game requests. Publication must pass before claiming operational status.

Read-only R2 preflight also passed: zero conflicts, bucket 1,650,519,981 bytes,
8,112 additional bytes and 8,303 proposed write bytes (existing image bytes reused).
No lease was acquired and no remote writes were made. Existing local R2 environment
credentials were used only for this read-only check, not transferred to GitHub.
Evidence: `.agent-logs/home-refresh-mime-20260912-c/summary.json`,
`.agent-logs/home-refresh-r2-preflight.log`, `.agent-logs/home-feed-final-tests.log`.

## Scope

Refresh public summon observations every six hours, with a 24-hour maximum
freshness window. Keep account eligibility distinct from global availability.
Only staging/v2/home may be published. Production remains excluded.

1. Tested bounded collector: gashas, exact featured-card endpoints, validated
   first-party image references. Project public fields only; signed URLs and
   tokens remain in memory. Fail the whole candidate on incomplete collection.
2. Server-only authentication adapter with secret storage and bounded transport.
   Reuse observed nonce/sign-in protocol; no old Bearer replay, purchase, summon,
   CAPTCHA bypass or automatic authentication retry. Stop on version rejection.
3. Candidate preparation compatible with the Android Home schema, including an
   empty active list. Select featured placement from verified category, not fixed
   Goku/Frieza IDs. Do not treat promotional artwork as a full-banner deadline.
4. Durable single-flight scheduler and six-hour reservation before authentication.
   Every publish/state write must be fenced against expired lease ownership.
5. Read-only remote dry-run, immutable collision verification, image decoding,
   byte/space caps, conditional manifest-last promotion and public verification.
6. Sanitized failure status, last-success time and explicit expired-feed behavior.
   Preserve last verified manifest on failures before promotion; never extend old
   observation validity just because a scheduled attempt ran.
7. Synthetic failure tests, one authorized real dry-run, staging verification,
   then enable recurrence. Commit/push remain separate user actions.

## Hosting decision

GitHub-hosted Actions runner, with environment-scoped secrets and R2 public
delivery. Account UI checked: Free plan, 115/2000 Actions minutes used, 0.3/0.5 GB
storage used, $0 billable and $0 Actions budget with Stop usage enabled. Leave
that budget untouched. No promise of exact-time execution or future free capacity.
Workflow has been isolated onto main without unrelated feature-branch commits.
Docker or an always-on personal PC is not required.

A single free Cloudflare Worker is not assumed adequate: current documented
free CPU allowance is 10 ms and 50 external subrequests per invocation; full
PNG validation and up to 40 banner/image/featured pairs need a deliberate runtime
budget. No paid service is activated implicitly.

Sources checked 2026-09-12:
- https://developers.cloudflare.com/workers/platform/limits/
- https://docs.github.com/en/billing/concepts/product-billing/github-actions

## Foundation interfaces

`home-feed/collect-summons.mjs` owns public projection behind injected transport.
`home-feed/refresh-cycle.mjs` owns sequence and safeguards behind injected lease,
preparer, dry-run and publisher. These are not deployment adapters. Importing them
cannot log in, publish, schedule work or read credentials.

The reservation is a conditional create under staging/v2/home/runs/<slot>.json.
It contains only random owner ID, timestamps, status and public hashes/byte counts,
not account data. The public bucket makes these operational counters public too.
It is never reclaimed within the six-hour slot, even after failure. Each run has
a 15-minute deadline and Actions has a 15-minute job timeout. Runs within the last
20 minutes of a slot are skipped. A conditional manifest PUT independently rejects
changes made after planning. No deletion or automatic cleanup is performed.
Hard safeguards: 16 MiB maximum proposed writes per cycle, projected bucket usage
strictly below 8 GB, no production prefix, no conflicts, no expired candidate.
Release failures may propagate to the host; authentication/API error text must
never be logged. No raw HAR should be uploaded to a runner or stored as an artifact.

## Activation gate

1. Local collect-only validation completed (21 seconds, excluding Actions setup).
   Measure a complete hosted run before estimating monthly runner consumption.
2. Restricted gateway deployed at
   https://dokkanpanion-home-feed-r2-gateway.lcsilva2099.workers.dev.
   It has a fixed R2 binding. Actions cannot manage the Worker or address other
   bucket objects. Inventory exposes byte totals and opaque cursors only.
3. Secondary login configuration and gateway key installed in GitHub environment
   `home-feed-staging`, under explicit user authorization. Full HAR stays local.
4. Isolated main deployment authorized; NPM paths-ignore prevents a feed-only
   deployment from publishing the package.
5. Set HOME_FEED_ENABLED only after environment configuration and a manual
   collect-only run; set HOME_FEED_ENABLE_PUBLICATION after remote dry-run review.
6. Verify successful manifest-last publication and next recurring execution.

The workflow defaults manual runs to collect-only, uses pinned action commits,
read-only repository permission, no persisted Git checkout credential, no artifact
uploads, and no dependency install scripts. Only the final step receives secrets.
The Actions $0 spending cap is not modified. A failed run remains visible in Actions;
notification delivery depends on the user's existing GitHub notification settings.

## Operations and security boundary

- Pause: set repository variable `HOME_FEED_ENABLED` to `false`. Leave the last
  published feed intact; Android's existing validity checks still apply.
- Publication-only gate: environment variable `HOME_FEED_ENABLE_PUBLICATION`.
  A false value rejects publish mode, rather than silently writing locally.
- Rotate the gateway key: generate a fresh 32-byte random value; update Worker
  secret `GATEWAY_TOKEN` and environment secret `HOME_GATEWAY_TOKEN` together.
  Pause scheduling during rotation. Never copy an R2 key into either field.
- Update game login configuration only in environment secret `HOME_GAME_AUTH_JSON`.
  Version/authentication rejections stop that attempt; no automatic login loop.
- Worker deployments use local Cloudflare authorization, not GitHub credentials.
  The Worker has bucket access internally; its reviewed handler is the remote
  enforcement boundary, not a Cloudflare bucket-prefix permission. GitHub cannot
  deploy or reconfigure it. Anyone able to modify main remains trusted with the
  two environment secrets, so protect the GitHub account and enable 2FA.
- Remote checks include 401 without authentication, 400 for a production key,
  405 for DELETE, and read-only candidate collision/size verification.
- Local checks: 50 publisher/client tests plus 12 gateway tests and strict gateway
  typecheck. The hosted job runs both test groups before receiving secrets.
- There is no automatic retention deletion. Inventory checks fail closed before
  the 8 GB safety ceiling. The gateway is not a general-purpose upload service.

Hosted publish attempt 34715192413 stopped in the state phase before game login
or feed publication. Cloudflare's compressed response weakened the read ETag
(`W/"..."`) while the write receipt had a strong ETag. The client now requests
identity encoding, preserving the CAS token. The failed scheduled-slot reservation
is retained; no automatic login retry or deletion was introduced. A one-off
validation can publish the existing verified candidate using a separate numeric
validation receipt, without new game requests or reclaiming the scheduled slot.
