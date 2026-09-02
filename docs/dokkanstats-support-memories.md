# DokkanStats Support Memory enrichment

DokkanStats is an authorized, additive evidence source for Support Memory
acquisition. The collector does not replace identity, gameplay effects,
targeting, costs, enhancement requirements, or official game assets from the
Global game database. It writes a separate sidecar so first-party candidate
generation remains valid when this enrichment is absent.

Run:

```text
npm run run:dokkanstats-support-memories
```

Output:

```text
data/dokkanstats-support-memories/latest/support-memories.json
```

The catalog join is exact by numeric Support Memory ID. Every catalog row must
be covered exactly once by a root memory or one of its enhanced levels.
Each root detail page must match its catalog identity before acquisition data
is accepted. Unknown acquisition kinds, duplicate IDs, broken enhancement
chains, catalog/detail drift, and malformed source identities fail closed.

The current acquisition projection preserves two typed source kinds:

- `mission`, keyed by mission ID and carrying category, quantity, dates, image,
  and source URL when present;
- `stage-drop`, keyed by map ID and drop type and carrying the official-looking
  event/quest identifiers exposed by DokkanStats.

Relative image paths are resolved against DokkanStats' Global English asset
origin, not the website origin. DokkanStats responses use the shared 168-hour
mapped-response cache. Set
`DOKKANSTATS_SUPPORT_MEMORIES_REFRESH=1` to refresh it. Optional controls are
`DOKKANSTATS_SUPPORT_MEMORIES_DELAY_MS` and
`DOKKANSTATS_SUPPORT_MEMORIES_CACHE_TTL_HOURS`.

Promote the sidecar into a first-party candidate with:

```text
npm run run:support-memory-how-to-get -- \
  --support-memories <support-memory-details.json> \
  --stages <stage-details.json> \
  --dokkanstats <support-memories.json> \
  --output-dir <new-output-directory>
```

Promotion joins missions by memory/mission identity and stage drops by
memory/map/drop identity. DokkanStats supplies only event images, source type,
availability, and source links. First-party data supplies the acquisition
facts, quantities, English event titles, and official navigation relations.
Stage-drop sources remain exact per map/difficulty, but their presentation
group is keyed by area and quest. This keeps Normal, Hard, and Z-Hard in one
event/stage block while preserving an exact quest-level relation for each
difficulty and an area relation for browsing every stage in the event.
Promotion emits a Support Memory manifest and a separate audit, fails closed on
identity or stage-drop drift, and keeps the Android payload functional when
enrichment is absent.

The 2026-09-02 live validation found 76 roots and 191 total levels, matching
the first-party candidate exactly by root ID, English name, and maximum level.
It collected 328 acquisition sources for 75 memories: 285 missions and 43
stage drops. `10003 / Training Complete!` explicitly exposes no DokkanStats
sources and continues to use its first-party mission groups.
