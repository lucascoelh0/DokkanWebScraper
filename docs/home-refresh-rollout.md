# Home automatic refresh: next rollout

## Local readiness, 2026-09-14

The hosted workflow was missing HOME_FEED_NEWS_ENABLED even though the local
runner already supports it. The optional flag now passes through from GitHub
variables, without hardcoded activation. Missing/false remains disabled. This
also matters for full summon availability: the collector obtains that evidence
from associated announcements when News is enabled.

No remote deployment, variable/secret update, dispatch, game login or publication
was performed in this pass. Local code is not proof of hosted activation.

## User-reported timing references

Timezone: America/Sao_Paulo, currently UTC-03:00. These are operational hints,
not API-derived source timestamps or universal reset semantics:

- Missions/events: 21:00 Brasília (00:00 UTC next day).
- This account's login reset: 22:00 Brasília (01:00 UTC next day).
- Releases generally: 03:00–04:00 Brasília (06:00–07:00 UTC); approximate.

Current workflow cadence remains 00:23/06:23/12:23/18:23 UTC, equivalent to
21:23/03:23/09:23/15:23 Brasília. It may collect before a 04:00 release and before
the 22:00 login reset. Do not claim refresh immediately after every reset.
The six-hour attempt reservation, durable slot and single-flight safeguards
remain unchanged. A schedule redesign must consider freshness, API load and
those safeguards together, not add ad-hoc retries or bypass reservations.

No login-bonus implementation or automated reset capture is enabled. Nonempty
first-party login evidence and reward schedule semantics remain prerequisites.

## Deployment gate

1. Review the Home-only diff and its tests; exclude the paused battle-capture
   research and unrelated changes from any deployment commit.
2. Obtain explicit commit/push authorization for that reviewed slice. The
   workflow only runs from main, so confirm default-branch delivery separately.
3. Inspect remote flags and recent sanitized run status read-only. Configure
   HOME_FEED_NEWS_ENABLED only as part of the approved rollout; do not dump
   environment values or rotate account credentials speculatively.
4. Before approved R2 publication, use the existing bounded fresh collection,
   capacity preflight and immutable-first/manifest-last publisher. Report bytes.
5. Verify public content/hashes and one scheduled execution. A manual success
   alone does not close automatic-refresh acceptance.

Regression coverage: hosted-home-workflow.test.mjs checks optional flag wiring,
main-only gate, single-flight cadence and credential separation. Existing runner
tests verify exact opt-in semantics and collect-only behavior without publication.

Validation completed: 13 focused tests and all 263 Home tests passed; workflow
diff whitespace check passed. No Android build or live credentials required.

## Authorized rollout checkpoint

User approved commit, push and staging activation. Final Home suite: 264/264.
The package-publication workflow now explicitly ignores both Home planning/rollout
documents, preventing an unrelated NPM release for this scoped deployment.
Read-only hosted inspection confirmed Home/publication/events enabled, News flag
absent, and no active Home run. Local base and origin/main matched 8a97207.
The approved rollout enables News in the existing protected six-hour workflow;
no extra manual publication or reset-time login capture is necessary. Every
scheduled publication still uses the existing capacity preflight and limits.
Record verified delivery separately after push/configuration; scheduled enriched
output remains unverified until a subsequent run actually publishes it.

## News presentation refresh delivered — 2026-09-14

Explicit user authorization covered commit and staging publication, followed by
separate authorization to push the producer branch and update main. Checkpoint
30e7ad6 preserves API announcement tab identity; 2aadba5 excludes its contract
document from unrelated NPM publication (3 focused workflow tests passed).
Both commits were remotely verified on main and codex/home-feed-deploy.

Fresh API collection used the standard six-hour durable slot. Published Home
payload dac14a82cb3faff7dc0ed07dbb41926cc2eb9edf99c4648e9140eedb6614a697,
generated 2026-09-14T21:49:15.447Z, contains 21 summons (9 with rewards),
20 events and 6 recent news items with explicit tabId. Campaigns observed at
21:50:22.686Z include 8 campaigns, 191 missions and 534 reward entries;
index SHA-256 bdf009a0ddd640141f1f160fba212aa0c7908523a7873d9c198a7ad5fb95c696.
Independent public readback checked Home, campaign index and all detail sizes
and hashes. Installed LDPlayer Home cache matches the published payload.

Reported dry-runs before writes: reservation <=4 KiB, Home 34,302 bytes,
campaigns <=129,097 bytes/18 objects. Projected bucket ~1.665 GB. No production
write, fixture publication, lease bypass, secret change or decoder work.
Login-bonus schedule is still unsupported without nonempty source evidence;
event257's exact catalog artwork remains 404. New scheduled execution is still
unverified; this successful manual refresh is not evidence of cron completion.
