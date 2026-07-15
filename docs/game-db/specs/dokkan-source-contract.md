# Dokkan Source Contract Direction

## Purpose

This document defines the preferred direction for a source-neutral Dokkan data contract.

The immediate reason for this document is that Dokkanpanion is no longer constrained to a `dokkan.fyi`-first worldview. We now have a realistic path to derive data directly from the Global game database, and the app is still pre-production, so we can optimize for a cleaner backend shape instead of preserving old scraper-era conveniences.

## Current stance

The app-facing contract should evolve in two layers:

1. a source layer that stays close to the game database
2. an app projection layer that derives UI-friendly fields only where they truly help

This reduces mapper complexity, preserves source fidelity, and makes it easier to validate against raw game data.

## Why this direction is better

If we map:

- game database -> site payload
- site payload -> scraper contract
- scraper contract -> app models

then every mechanic gets translated too many times.

If we instead map:

- game database -> source-neutral Dokkan contract
- optional app projections where needed

we remove an entire layer of accidental complexity.

## Contract priorities

The source layer should prefer:

- stable game ids
- set ids and relation ids when they matter
- raw effect descriptions from the game where available
- grouped mechanics as the game models them
- explicit source provenance

The app projection layer can still derive:

- convenience booleans
- flattened summary strings
- display-only labels
- legacy compatibility fields during migration

## What should stay close to the game DB

These fields are good candidates to remain source-aligned:

- `card id`
- `character id`
- `card_unique_info_id`
- `resource id`
- `leader_skill_set_id`
- `passive_skill_set_id`
- `active_skill_set_id`
- `standby_skill_set_id`
- `finish_skill_set_id`
- awakening route references
- optimal awakening growth steps
- raw release/open dates
- raw categories and link ids

This is especially important for standby, finish, exchange, and transformation logic, where site-oriented flattening tends to hide the real relationships.

## What can still be projected for the app

These fields can still exist, but should be derived from the source layer:

- `isFreeToPlay`
- `hasEza`
- `hasSeza`
- `leaderSkillBoost`
- flattened passive summaries
- flattened standby strings
- `finishingMove`
- presentation-specific transformation labels

## Near-term implementation rule

For the backend spike, prefer building a source-friendly snapshot first, even if it looks less polished than the current `dokkan.fyi` contract.

That means:

- keep ids
- keep grouped skill sets
- keep awakening growth steps
- keep raw descriptions
- keep relation structure

Then only derive app-facing sugar once we know which fields the app genuinely needs.

## Relationship to existing docs

The existing `dokkan.fyi` contract docs are still valuable because they identify:

- which mechanics matter
- which fields the app wants
- which data needs structured handling

But going forward, those docs should be treated as:

- mechanic requirements
- app rendering requirements

not as a requirement that the backend must stay shaped around `dokkan.fyi`.

## Practical next step

The first backend experiment should output a small set of golden cards in a source-friendly format and compare them against the current `dokkan.fyi` experiment output.

That is the fastest way to answer:

- how much of the current app contract can be satisfied directly from the game DB
- which fields truly need projection logic
- which scraper-era abstractions we can delete instead of preserving

