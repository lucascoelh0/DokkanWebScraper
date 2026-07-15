# UDFiles Findings

## Purpose

This document records findings from a 2026-06-27 review of:

- `HarryTurney/UDFiles`: <https://github.com/HarryTurney/UDFiles>

The goal is to decide whether it helps with:

- first-party Dokkan data acquisition
- Dokkanpanion dataset design
- auxiliary datasets such as events, announcements, banners, and gasha metadata
- future test fixtures and validation

## Safety and repo shape

The repo was checked before reading deeper.

Observed file mix:

- `.png`: 764 files
- `.json`: 62 files
- `.txt`: 11 files
- no code files
- no executable tooling

Practical read:

- this is a data dump/reference repo, not a codebase
- there was no sign of malicious automation
- the main risk is stale or hand-curated data, not executable behavior

## Executive take

`UDFiles` is useful as a processed reference dataset, not as a primary source.

Best use:

1. use it as a fixture/reference source for auxiliary datasets
2. use it to understand output shapes for announcements, events, gashas, home banners, and some battle/event payloads
3. use it for UI/testing examples when we later enrich Dokkanpanion beyond cards
4. do not depend on it for updates or first-party acquisition

It helps with data shape and presentation. It does not solve the "how do we independently refresh from the game?" problem.

## Repo structure

Top-level folders:

- `Global/`
- `Japan/`
- `Event JSONs/`
- `Event Info/`

The most useful material for Dokkanpanion is under `Global/json/`.

Observed JSON groups:

- `announcements`
- `dragonball_sets`
- `events`
- `gashas`
- `gifts`
- `joint_campaigns`
- `recommends`
- `resources`
- `rmbattles`
- `secret_treasure_boxes`

Quick summary of notable files:

- `Global/json/announcements/announcements.json`
- `Global/json/events/events.json`
- `Global/json/resources/home/info.json`
- `Global/json/gashas/banners.json`
- `Global/json/gashas/rates/rates.json`
- `Global/json/rmbattles/allbattles.json`

## What it contains

### Announcements

`Global/json/announcements/announcements.json` is a curated announcement dataset with fields like:

- `id`
- `title`
- `summary`
- `banner`
- `bodies[]`
- optional `login_bonuses[]`

Why it matters:

- it gives us a ready example of how a compact app-facing announcement contract could look
- it shows how image URLs and rich text can be bundled together
- it includes some derived/normalized structure beyond the raw in-game DB tables

Limits:

- strings show encoding mess in places
- image URLs point to GitHub raw assets
- this appears curated and snapshot-like, not a live pipeline

### Home banners and battlefield cards

`Global/json/resources/home/info.json` contains:

- `banners[]`
- `rmbattles[]`

This is useful for:

- home page event/banner surfaces
- campaign rotation ideas
- future Dokkanpanion dashboard/promotional widgets

### Events and Z-Battles

`Global/json/events/events.json` contains two big top-level groups:

- `z_battle_stages`
- `events`

It includes examples for:

- event IDs
- quest IDs
- names
- banner/event/minibanner image URLs
- stage limitations
- category restrictions
- special challenge conditions

This is probably the highest-value file in the repo for future auxiliary datasets.

Why:

- it is close to the kind of event index Dokkanpanion may eventually want
- it is much more app-friendly than dumping raw DB joins directly into the frontend

### Gasha metadata

`Global/json/gashas/banners.json` and `Global/json/gashas/rates/rates.json` contain:

- gasha names
- banner copy
- step-up state
- course descriptions
- rate group references
- SSR guaranteed step metadata

This is useful if Dokkanpanion ever wants:

- banner history
- current/past summon metadata
- rate-step visualization

### Event JSONs

`Event JSONs/` contains per-event JSON snapshots with names like:

- `response_1588281538389.json`

These files are especially interesting because they preserve a richer runtime payload shape.

Sample observations:

- top-level `sign`
- `sign.sugoroku`
- event/battle map data
- enemy HP/ATK/DEF
- AI descriptions
- drop info
- round/stage metadata

This is not a clean backend format, but it is valuable as protocol archaeology and event-payload reference.

### Event Info text files

`Event Info/` contains human-readable event breakdowns like:

- enemy names
- types
- HP/ATK/DEF
- skills
- SA chance
- SA per turn

These look like manually derived summaries from the richer event payloads.

They are not ideal as machine sources, but they are nice as sanity-check material.

## What it is useful for in Dokkanpanion

### High-value uses

1. auxiliary dataset contract design
2. UI fixture data for announcements/events/gasha history
3. comparison examples when we later build event and Z-Battle exports from our own data
4. reference for how community-facing processed JSON can look

### Medium-value uses

1. validation against future event export work
2. banner/image URL naming conventions
3. approximating which subsets are worth publishing separately in Dokkanpanion

### Low-value uses

1. first-party acquisition research
2. current/modern update automation
3. card core data pipeline

## What it does not solve

This repo does not solve:

- how to fetch the modern Dokkan DB
- how to decrypt `database.db`
- how to discover live asset/database versions
- how to keep a backend automatically updated
- how to parse the full card/mechanic model from source-of-truth DB tables

So it should not change our main architecture decision.

## Risks and limitations

### Snapshot age

The data looks like a historical snapshot around older Dokkan periods, not an actively maintained current mirror.

### Curated format

The JSON shape is already transformed for a community use case.

That is good for reference, but it means:

- we do not know the exact transformation logic from the game source
- we should not confuse this with source-of-truth raw exports

### GitHub asset coupling

Many URLs point back to raw GitHub-hosted images.

That makes the dataset handy for browsing, but not robust as a backend dependency.

### Encoding noise

Some strings show mojibake/encoding issues, which means we should expect cleanup if we ever reuse any textual data.

## How it fits the roadmap

The best role for `UDFiles` is downstream of our first-party backend, not upstream of it.

In other words:

- first-party DB export remains the primary source path
- `UDFiles` can help us decide what auxiliary bundles are worth publishing after that

Good future applications:

1. `events.json`-style auxiliary bundle for event index pages
2. `announcements.json`-style bundle for campaign/news history
3. `gashas/*.json`-style bundle for summon metadata
4. `rmbattles` and Z-Battle support bundles

## Recommended follow-up actions

1. keep this repo only as a reference mirror
2. do not add it as a runtime dependency
3. when we start auxiliary dataset work, use it to design app-friendly payloads
4. consider lifting a few representative files into test fixtures later, after rewriting the contracts ourselves

## Bottom line

`UDFiles` is useful, just not for the core ingestion problem.

It is best viewed as:

- a processed snapshot of community-facing auxiliary data
- a useful contract/reference source for events, announcements, gashas, and banners
- a future fixture source for validation and UI work

It is not a replacement for the first-party Dokkan DB pipeline we are building.

