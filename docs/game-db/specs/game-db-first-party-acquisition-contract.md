# Game DB First-Party Acquisition Contract

## Purpose

This document defines the filesystem contract for a future first-party Dokkan Global export.

The goal is to let the rest of the pipeline stay stable while we replace mirror/external exports with our own acquisition step later.

In other words:

- acquisition can change
- the downstream importer should not need to change every time

## Current stance

The update runner now supports:

- `existing-export`
- `mirror-repo`
- `first-party-export`

`first-party-export` is the long-term target mode for Dokkanpanion-owned acquisition.

## Directory contract

The root directory passed to `first-party-export` should contain:

- `metadata.json`
- either:
  - `data/*.csv`
  - or direct `*.csv` files at the root

At minimum, it must be resolvable by the existing game DB source reader, which currently requires `cards.csv` and the other tables used by the importer.

Recommended layout:

```text
first-party-export/
  metadata.json
  data/
    cards.csv
    leader_skill_sets.csv
    leader_skills.csv
    passive_skill_sets.csv
    passive_skill_set_relations.csv
    passive_skills.csv
    card_specials.csv
    special_sets.csv
    link_skills.csv
    card_categories.csv
    card_card_categories.csv
    card_awakening_routes.csv
    optimal_awakening_growths.csv
    active_skill_sets.csv
    active_skills.csv
    card_active_skills.csv
    standby_skill_sets.csv
    standby_skills.csv
    card_standby_skill_set_relations.csv
    finish_skill_sets.csv
    finish_skills.csv
    card_finish_skill_set_relations.csv
    standby_skill_set_finish_skill_set_relations.csv
```

## Metadata contract

`metadata.json` must exist and should look like this:

```json
{
  "source": "first-party-export",
  "region": "global",
  "exportedAt": "2026-06-27T21:00:00.000Z",
  "dbVersion": "1782367825",
  "assetVersion": "1782367204",
  "apkVersion": "6.2.5",
  "notes": "Exported by local first-party acquisition pipeline"
}
```

Required fields:

- `source`

Recommended fields:

- `region`
- `exportedAt`
- `dbVersion`
- `assetVersion`
- `apkVersion`
- `notes`

## Upstream acquisition is a separate contract

AQ0–AQ6 defines a narrower upstream artifact acquisition contract in
[`game-db-manual-sqlite-acquisition-aq0-aq6.md`](game-db-manual-sqlite-acquisition-aq0-aq6.md).
It can validate and retain an official Global EN database artifact, but it does
not decrypt it, write this CSV export, invoke the update runner or promote any
production data.

Producing this first-party export remains a later, explicit transformation:

1. acquire and validate the Global EN artifact under AQ0–AQ6;
2. decrypt locally if the artifact is `encrypted_or_packaged`;
3. run the read-only SQLite/C4 compatibility evaluation;
4. write the normalized CSV tables;
5. write this contract's `metadata.json`;
6. place the export in a stable folder the runner can consume.

The rest of the pipeline should then stay unchanged:

1. read export
2. build source snapshot
3. build Dokkanpanion dataset
4. validate
5. publish

## Transitional helper

Until the real first-party downloader/exporter exists, the repo now includes a helper command that promotes a known-good external export into this contract:

```powershell
npm run run:game-db-promote-first-party-export
```

That helper:

1. resolves the current source export
2. copies the required CSV tables
3. writes `metadata.json`

This is not the final acquisition solution, but it lets the rest of the pipeline start consuming the `first-party-export` layout immediately.

There is also now a direct SQLite export helper:

```powershell
npm run run:game-db-build-first-party-export -- --sqlite-path "C:\path\to\database.db"
```

That helper is the first actual step toward a true first-party acquisition flow because it no longer requires a pre-exported `data/*.csv` folder.

## Why this matters

This contract gives us a clean handoff between:

- acquisition engineering
- importer/data-model engineering
- publish/ops automation

That separation is what lets us keep shipping progress now while the true downloader/export path is still under construction.

