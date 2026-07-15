# KX Wiki and UniDokkan Findings

## Purpose

This document records findings from a 2026-06-27 review of:

- `KaryonixX/kxdokkan-wiki`: <https://github.com/KaryonixX/kxdokkan-wiki>
- `getting-started-with-unidokkan.md`: <https://github.com/KaryonixX/kxdokkan-wiki/blob/main/getting-started-with-unidokkan.md>

The goal is to separate what is useful for:

- first-party Dokkan data acquisition research
- game database schema understanding
- patching/modding reference
- a future low-priority UniDokkan revival track

## Safety and repo shape

Before reading deeper, the repo was checked at a high level to avoid needlessly pulling in something sketchy.

Observed file mix:

- mostly `.md` docs and `.png` images
- a few editor metadata files under `.vs/`
- no meaningful codebase or runnable automation was found in the repo itself
- the only `.sqlite` file found was `.vs/slnx.sqlite`, which is editor metadata, not game data

Practical read:

- the repo is documentation-heavy, not an executable toolchain
- the main risk here is stale or community-approximate information, not malicious code

## Executive take

This repo is useful, but not as an operational backend source.

Best use:

1. use it as reference documentation for Dokkan DB structure and old modding workflows
2. use it to understand how UniDokkan and KX-Creator probably handled loose file loading, SQL patching, proxying, and asset injection
3. use it to collect clues for our eventual first-party acquisition flow
4. do not treat it as a production dependency or update source

It helps us understand the system. It does not give us a ready-to-run modern backend.

## What it tells us about the Dokkan database

The strongest part of the repo for our backend work is the database documentation:

- `information/database-breakdown.md`
- `information/database-function-tables.md`
- `information/database-changelog.md`

### `database-breakdown.md`

This is a giant table-by-table schema reference for Dokkan's SQLite database.

Why it is valuable:

- confirms table names across a large part of the game
- documents columns and many relationships
- gives a clearer mental map for less obvious tables outside the core card flow
- is especially useful for event, reward, support item, world, quest, Z-Battle, and utility tables

This is not source-of-truth, but it is a very good map when exploring unfamiliar tables.

### `database-function-tables.md`

This is one of the most useful docs in the repo for mechanic decoding.

It documents community interpretations for:

- causality types
- calc options
- efficacy types
- target types
- influence types
- exec timing
- type bitsets
- energy ball bitsets
- effect pack categories

Why this matters for Dokkanpanion:

- these tables help decode passive, active, special, standby, finish, transformation, and status mechanics
- this lines up directly with the hardest part of replacing `dokkan.fyi` parsing with game DB parsing
- even where values are marked unknown or WIP, the doc provides a working vocabulary for our importer and tests

This is exactly the kind of reference we want nearby when we harden mechanic coverage.

### `database-changelog.md`

This doc records schema changes between older Dokkan versions.

Why it helps:

- it shows the DB schema does shift over time
- it gives examples of columns added/removed in real updates
- it reinforces why our importer should preserve a stable first-party export contract instead of tightly binding app code to raw schema drift

This is more about maintenance posture than direct implementation.

## What it tells us about patching and UniDokkan

The UniDokkan material is useful mainly as architecture archaeology.

### Patch format

`guides/how-to-create-patches.md` describes UniDokkan patches as three parts:

1. SQL files for database changes
2. asset files for modified/new assets
3. hook files for code modification

The important backend-adjacent implication is that `database.db` changes were handled as SQL diffs, not by shipping a whole replacement DB in the normal patch flow.

That matches `guides/how-to-save-your-database-changes.md`, which recommends:

- keep original and modified DBs for the same version
- generate a `diff.sql`
- use `sqldiff.exe --primarykey`

This is useful for future internal tooling if we ever want:

- DB-level fixture patches
- migration diff generators
- QA tooling that compares two Dokkan DB versions

### Creator's Mode / loose loading

`guides/how-to-use-creators-mode.md` is a strong clue about how UniDokkan operated:

- the patcher intercepts file and database access at runtime
- it can loose-load assets from a user-selected folder
- it can loose-load a custom `database.db`
- it can log file requests and database requests

Why that matters:

- it explains the old "patch app launches the game with modified data" model
- it suggests the patcher sat between the game and local file/database access
- it gives a plausible design direction if UniDokkan is ever revived

For our current backend effort, this is mostly contextual, not directly actionable.

### Asset injection

`guides/how-to-inject-assets.md` describes a separate injection-host flow:

- custom assets live under an `assets/` folder
- the DB is expected at `assets/sqlite/current/database.db`
- the doc says that DB should be encrypted with key `2db857e837e0a81706e86ea66e2d1633`
- the host tool can generate `client_assets.json`
- if a DB is present, it can also generate `database.json`

Important nuance:

- this is useful evidence that older modding tools worked from Dokkan's asset manifest model
- it gives us a community-documented DB key clue for injected/encrypted DBs
- but it is not enough by itself to prove the live modern acquisition path

Treat the DB key and manifest notes as clues, not verified operational truth for our pipeline.

## What it tells us about acquisition

This repo does not give us a clean modern downloader.

But it does give several useful clues.

### KX-Creator workflow clue

`guides/how-to-use-creator-tools.md` says the KX-Creator tool:

- runs as a local proxy
- requires a trusted MITM certificate on device
- can load a patched KX-Creator app
- "automatically downloads the latest vanilla database encrypted" into the tool folder

That is one of the most interesting findings in this repo.

What it implies:

- older/private-server tooling likely intercepted enough traffic to learn or reproduce the DB download flow
- there was a stable-enough way to fetch a fresh vanilla DB without relying on a third-party website
- the local proxy/tooling path may have been part of that

This also fits with older community reports that Dokkan HTTPS traffic could be inspected via local proxy tools after installing a trusted MITM certificate on-device.

What it does not give us:

- source code for the downloader
- current endpoints
- current request signing logic
- a maintainable automation path on its own

### Strong synthesis with other repos

Combined with the other repos we already reviewed, the picture now looks like this:

- `tanukijs/dokkan-bot` suggests a live `/client_assets/database` path
- `kxdokkan-wiki` suggests proxy-based tooling could obtain/download the latest vanilla DB
- `bensnilloc/...Database-Decryptor` gives a small decrypt/export building block

That makes the long-term first-party path look more realistic:

1. discover or request the current DB asset from the live game service
2. download the encrypted DB
3. decrypt/export it
4. normalize to our first-party export contract
5. run our dataset build/publish pipeline

So this repo does help the acquisition story, just indirectly.

## What it tells us about a future UniDokkan revival

This is low priority, but we should still capture the shape of the work.

Based on the docs, a real UniDokkan-like revival would likely need multiple separate systems:

1. patched APK/IPA distribution per region
2. a launcher/patcher app
3. runtime file/database interception
4. loose-loading support for assets and DB overrides
5. SQL diff patch support
6. optional hook/module SDK for native code patches
7. proxy/certificate tooling for login or traffic interception flows
8. asset manifest generation for injected files

The wiki also mentions a UniDokkan SDK for modules:

- native modules loaded into Dokkan
- function hooking/redirection
- custom UI inside Dokkan

That is useful as a capability map, but not as implementation help, because the actual SDK/tooling is not present here.

Bottom line:

- reviving UniDokkan is not "make a patcher UI"
- it is a full reverse-engineering/product effort
- it should stay a separate roadmap from Dokkanpanion's data backend

## What is directly useful for Dokkanpanion now

High value right now:

- `information/database-breakdown.md`
- `information/database-function-tables.md`
- `information/database-changelog.md`
- `scripts/python-database-search.md`

Medium value right now:

- `guides/how-to-save-your-database-changes.md`
- `guides/how-to-create-patches.md`
- `guides/how-to-use-creators-mode.md`
- `guides/how-to-use-creator-tools.md`
- `guides/how-to-inject-assets.md`

Low value right now, but worth keeping noted:

- UniDokkan SDK/module references
- private-server/proxy guides
- Instant Win proxy material

## What is not a good idea to copy from this repo

Do not treat this repo as:

- a backend starter template
- a downloader implementation
- a cleanly verified source of modern request behavior
- a reliable automation recipe

It is documentation, not a production subsystem.

## Recommended follow-up actions

### For the backend/data project

1. keep this repo as a local reference mirror only
2. use the function-table docs while expanding golden-card coverage
3. use the schema docs when adding more first-party-export tables later
4. keep acquisition work focused on the `/client_assets/database` style path, not on reviving KX tooling

### For future research

1. compare the community-documented DB key and manifest assumptions against any encrypted DB we capture ourselves
2. inspect whether modern Dokkan still exposes a comparable asset-manifest/database flow
3. document any verified relationship between live DB downloads and `client_assets` metadata when we reach that stage

## Bottom line

`kxdokkan-wiki` is not a backend source, but it is a very useful reference repo.

Its highest value for us is:

- DB schema map
- mechanic/function decoding vocabulary
- clues about how older tooling acquired and injected the Dokkan DB
- a realistic picture of how large a UniDokkan revival project would actually be

That makes it worth preserving as research context, while our real implementation stays centered on our own first-party export/import pipeline.

