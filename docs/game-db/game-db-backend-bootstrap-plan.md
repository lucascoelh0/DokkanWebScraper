# Game DB Backend Bootstrap Plan

## Goal

Build a first-party Dokkan data backend that reads Global game database tables directly, publishes a stable Dokkanpanion dataset, and treats `dokkan.fyi` scraping as validation and fallback instead of the primary source.

## Why start here

The current spike already proved the most important thing:

- we can read a `dokkan-backend`-style exported data folder
- we can map real cards into a source-aligned snapshot
- we can already recover standby, finish, active, and reversible exchange mechanics for golden cards

That means we do not need to start by reverse-engineering every network/API detail. We can first harden the importer against committed CSV/database exports, then replace the external acquisition piece with our own later.

## Recommended architecture

Treat the new backend as a small pipeline with clearly separated stages:

1. source acquisition
2. raw table ingestion
3. source-aligned snapshot build
4. app projection build
5. validation against alternate sources
6. publish to storage

In practical terms:

- `game-db-source.ts`: source acquisition boundary and CSV readers
- `game-db-experiment.ts`: current snapshot builder prototype
- future `game-db-dataset.ts`: build the real Dokkanpanion dataset from source snapshots
- future `game-db-validate.ts`: compare DB output against `dokkan.fyi` samples and hand-picked golden cards
- existing publish flow: keep R2 publishing shape once the character contract is ready

## Phase 1: Lock the source-friendly contract

First, keep the backend close to the game DB instead of prematurely flattening it.

Immediate fields we should trust as source-of-truth:

- card ids and character ids
- skill set ids
- relation ids
- categories and links
- growth steps
- awakening routes
- raw effect/condition descriptions
- form relations

Immediate rule:

- if a field is directly represented in the game DB, preserve it first
- only derive sugar for the app once the source field is stable

This is the main reason the new contract in `docs/game-db/specs/dokkan-source-contract.md` matters.

## Phase 2: Expand the golden-card suite

Before broadening to all cards, grow confidence with a deliberate card matrix.

Add golden cards that cover:

- plain TUR/LR without special mechanics
- EZA and SEZA
- active transformation
- passive transformation
- reversible exchange
- standby into finish
- standby into post-standby transformed state
- giant/rage
- units with multiple follow-up states

The point is not large volume yet. The point is mechanic coverage.

## Phase 3: Build the real Dokkanpanion projection

Once the source snapshot feels stable, create a second mapper whose only job is:

- derive the exact app-facing fields we still want
- remove scraper-era convenience hacks we no longer need
- keep legacy compatibility fields only where the app still consumes them

Recommended bias:

- change Dokkanpanion to fit the game database when possible
- do not preserve old field shapes just because the scraper once needed them

That should dramatically reduce mapper churn.

## Phase 4: Keep the scraper as a validator

The scraper still matters, just in a different role.

Use `dokkan.fyi` for:

- cross-checking names, presentation text, and mechanic presence
- spotting import regressions after game updates
- filling temporary gaps if a mechanic is not yet decoded from the DB
- sanity checks when the game DB structure shifts unexpectedly

This gives us a safer migration path than deleting the scraper immediately.

## Phase 5: Replace third-party acquisition

There are really two separate problems:

1. understanding and shaping the data
2. acquiring fresh data ourselves

The repos we reviewed help with problem 1 today.

For problem 2, the recommended order is:

1. keep using a mirrored `dokkan-backend`-style export as a development fixture
2. document exactly which files/tables our importer needs
3. later build our own acquisition step for Global assets/db export
4. only then remove operational reliance on outside repos

That keeps momentum high without coupling the production path to someone else's automation.

## Automation end-state

Yes, the intended end-state is that we update this ourselves and automate it.

The likely production flow is:

1. fetch or export fresh Global assets/database with our own acquisition step
2. unpack/export the required tables
3. build source snapshots
4. build the Dokkanpanion projection dataset
5. run validation against golden cards and optional `dokkan.fyi` comparisons
6. publish artifacts to R2
7. run this on a schedule and also on-demand

So the short answer is:

- yes, we should be able to own the updates ourselves
- no, we do not need to stay dependent on Nicholas' repo to do that
- but we should earn that autonomy in stages instead of trying to replace every moving part on day one

Current practical state:

- `game-db-dataset.ts` builds the primary dataset bundle
- `game-db-publish-r2.ts` prepares portraits and reuses the R2 publish flow
- `game-db-update-runner.ts` orchestrates build, validation, and optional publish
- `game-db-acquisition.ts` now separates acquisition modes, including a future-facing `first-party-export` contract

So we now have the beginning of the real update pipeline, even though acquisition is still based on an external exported source folder rather than our own downloader.

## Concrete next coding steps

The next highest-value implementation steps are:

1. add more golden cards and expected mechanic assertions
2. keep separating `game-db-experiment.ts` into importer vs reporter modules
3. keep hardening the Dokkanpanion projection mapper from the source snapshot
4. promote the `game-db-dataset` bundle into the real publish path once coverage is good enough
5. add validation reports that compare DB output with `dokkan.fyi` output per mechanic

## Practical decision

So the answer to "how should we begin?" is:

Begin by treating the game DB backend as the new primary pipeline, but keep the scraper alive as a validator while we harden mechanic coverage.

That gives us:

- source-of-truth data
- less dependency on third-party websites
- less mapper complexity
- a migration path that stays safe while we learn the remaining edge cases

