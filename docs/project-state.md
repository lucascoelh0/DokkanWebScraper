# Dokkanpanion Project State

**Last updated**: 2026-07-27

This is a short operational snapshot for future implementation sessions. It is
not an architectural history. Durable decisions live in [`adr/`](adr/).

## Repository Boundaries

- `D:\Dokkan\DokkanWebScraper`: TypeScript data pipeline, validation, assets,
  manifests, and R2 publishers.
- `D:\Dokkan\Dokkanpanion`: Android app, domain models, local caches, Room, and
  Compose UI.
- Shared project workflow and constraints live in [`AGENTS.md`](../AGENTS.md).
- Project-scoped subagents are disabled. One model handles each task end to end;
  escalation is recommended only when concrete risk or failure warrants it.

## Current Architecture

- App-facing contracts are source-neutral.
- `dokkan.fyi` currently provides the canonical structured character and most
  auxiliary gameplay data.
- DokkanInfo provides optional media, item, animation, and event enrichment
  where it has stronger coverage.
- The Global game-database pipeline remains a future candidate for primary
  first-party data after it reaches contract and golden-fixture parity.
- Character data and auxiliary datasets publish independently to Cloudflare R2
  behind `https://assets.dkbcompanion.com`.
- Android validates manifests and preserves usable cached data when refreshes
  fail.

## Latest Completed Slice

Stage details are implemented end to end:

- scraper discovery includes event stages, quest stages, support-memory stage
  references, and support-memory navigation targets;
- the production dataset contains 1,477 stages;
- all 388 unique stage IDs referenced by support memories are present;
- the published dataset version is `2026-07-26T02:55:13.975Z`;
- payload size is 2,295,970 bytes;
- payload SHA-256 is
  `2dca7e72abd8a87c48741d9efd4eb1ec394b3403e53db3c5365e63e3459543df`;
- 425 mirrored assets use 7,123,702 bytes;
- the Android model accepts fractional link-skill rates such as `0.2`;
- an existing-install smoke test updated an older cache and opened
  `Android #18's Fees` -> `Hercule's Secret?!` without a crash;
- the app cache matched the public manifest size, version, and SHA-256.

Relevant local commits:

- scraper: `7a06152` (`Include navigation target stage details`);
- Android: `930b3ee` (`Handle fractional stage rates`).

These commits were local and not pushed at the time of this snapshot.

## Release Preparation

- Support Memories remains available in debug builds for continued development.
- Release builds hide its drawer entry and character-detail section.
- Release startup skips the Support Memory dataset refresh, avoiding unnecessary
  network and storage use while the feature remains experimental.
- The feature is controlled by the generated
  `BuildConfig.SUPPORT_MEMORIES_ENABLED` value.

## Next Gate

1. Run a fresh-install smoke test. Clearing the debug package data is
   destructive to that emulator's app state, so confirm before doing it.
2. Mark the `dokkan.fyi` character cutover complete after the fresh-install
   flow downloads and renders the production data successfully.
3. Start the summons app slice: active-banner list, banner category filters,
   detail view, and featured-character links.

## Operating Constraints

- Use focused discovery and read this snapshot before rebuilding broad context.
- Keep verbose command output in ignored `.agent-logs/`; inspect only the exit
  code and concise failure context.
- Prefer one focused validation during implementation and one broader final
  validation only when the change warrants it.
- Keep managed R2 data comfortably below the user's 10 GB free allowance.
- Always run publisher dry-runs and inspect projected bytes before uploading.
- Publish payloads before their mutable manifests.
- Do not run multiple Gradle builds concurrently.
- Do not run scraper generation and tests concurrently when both write
  generated `lib/` or `data/` files.
- Do not commit generated `data/` artifacts.
- Keep only the matching generated `lib/` output for changed TypeScript files.
- Preserve unrelated user changes in both repositories.

## Maintenance Rule

Update this file after a major publish, cutover, or user-visible feature
milestone. Do not add routine command history or low-level implementation
details. Create or supersede an ADR when a durable decision changes.
