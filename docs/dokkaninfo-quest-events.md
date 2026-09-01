# DokkanInfo quest-event scraper

The DokkanInfo quest-event scraper is an additive community-source enrichment
for event and enemy data that the first-party game database does not expose,
such as runtime HP, ATK, DEF, damage reduction, attacks per turn and Super
Attack details.

It currently supports these public indexes:

- DB Stories: `https://dokkaninfo.com/events/dbstories`
- Story: `https://dokkaninfo.com/events/story`

The first-party game database remains authoritative for event/stage identity,
topology and every field it actually provides. DokkanInfo enemy card references,
portraits and types describe the enemy as presented by that quest and must not
be replaced by a same-name catalog card or forced to join to one.

## Refreshing data

Run either family from the repository root:

```powershell
npm run run:dokkaninfo-db-stories
npm run run:dokkaninfo-stories
```

Every run discovers event IDs from the corresponding live index. A newly added
event is therefore collected automatically after the seven-day index cache
expires. Force immediate rediscovery and refetch with the family-specific
refresh flag:

```powershell
$env:DOKKANINFO_DB_STORIES_REFRESH = "1"
npm run run:dokkaninfo-db-stories

$env:DOKKANINFO_STORIES_REFRESH = "1"
npm run run:dokkaninfo-stories
```

Shared defaults can be overridden with
`DOKKANINFO_QUEST_EVENTS_CONCURRENCY`,
`DOKKANINFO_QUEST_EVENTS_DELAY_MS`, and
`DOKKANINFO_QUEST_EVENTS_CACHE_TTL_HOURS`. A family-specific variable with the
same suffix takes precedence, for example `DOKKANINFO_STORIES_CONCURRENCY`.

The default concurrency is `3`, the inter-request delay is `150 ms`, and the
cache TTL is `168` hours. Index, event and quest responses are materialized as
separate parsed cache records, so an interrupted run resumes without refetching
valid entries.

## Outputs

- `data/dokkaninfo-db-stories/latest/db-stories.json`
- `data/dokkaninfo-stories/latest/stories.json`

Generated `data/` artifacts and cache records are local and ignored by Git.
This scraper does not publish to R2 and does not alter production datasets.

Each quest records one of three enemy-data states:

- `available`: DokkanInfo exposed at least one enemy row.
- `not-provided`: the page loaded successfully but exposed no enemy rows.
- `fetch-failed`: the page could not be collected; the stage ID is also listed
  in the dataset-level `failedStageIds` collection.

Enemy identity, stats, Super Attack and skill blocks remain optional. Missing
content is never synthesized. Event, stage, reward and mission IDs stay stable
and can be compared or joined structurally with first-party data.

## Transport and Cloudflare

A bare HTTP request may receive `403`. The shared `fetchFromWeb` transport uses
ordinary browser navigation headers with an Axios request and a cURL fallback.
This currently returns the server-rendered HTML without requiring a browser,
login, user ID or game token. Cached runs reduce traffic and provide resilience
if the public site is temporarily unavailable. A future Cloudflare policy
change must fail closed; it must not silently turn a transport failure into
`not-provided` enemy data.
