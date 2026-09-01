# DokkanInfo quest-event scraper

The DokkanInfo quest-event scraper is an additive community-source enrichment
for event and enemy data that the first-party game database does not expose,
such as runtime HP, ATK, DEF, damage reduction, attacks per turn and Super
Attack details.

It currently supports these public indexes:

- DB Stories: `https://dokkaninfo.com/events/dbstories`
- Story: `https://dokkaninfo.com/events/story`
- Growth: `https://dokkaninfo.com/events/growth`
- Limited: `https://dokkaninfo.com/events/limited`
- Challenge: `https://dokkaninfo.com/events/challenge`
- Bonus: `https://dokkaninfo.com/events/bonus`
- Quest: `https://dokkaninfo.com/events/quest`
- Extreme Z-Battle: `https://dokkaninfo.com/events/zbattle` (specialized two-page contract)

The first-party game database remains authoritative for event/stage identity,
topology and every field it actually provides. DokkanInfo enemy card references,
portraits and types describe the enemy as presented by that quest and must not
be replaced by a same-name catalog card or forced to join to one.

## Refreshing data

Run any family from the repository root:

```powershell
npm run run:dokkaninfo-db-stories
npm run run:dokkaninfo-stories
npm run run:dokkaninfo-growth
npm run run:dokkaninfo-limited
npm run run:dokkaninfo-challenge
npm run run:dokkaninfo-bonus
npm run run:dokkaninfo-quest
npm run run:dokkaninfo-z-battles
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

$env:DOKKANINFO_GROWTH_REFRESH = "1"
npm run run:dokkaninfo-growth

$env:DOKKANINFO_LIMITED_REFRESH = "1"
npm run run:dokkaninfo-limited

$env:DOKKANINFO_CHALLENGE_REFRESH = "1"
npm run run:dokkaninfo-challenge

$env:DOKKANINFO_BONUS_REFRESH = "1"
npm run run:dokkaninfo-bonus

$env:DOKKANINFO_QUEST_REFRESH = "1"
npm run run:dokkaninfo-quest

$env:DOKKANINFO_Z_BATTLES_REFRESH = "1"
npm run run:dokkaninfo-z-battles
```

For a bounded Z-Battle investigation, use `DOKKANINFO_Z_BATTLES_IDS` with a
comma-separated ID list or `DOKKANINFO_Z_BATTLES_LIMIT` for the newest N index
entries. The Z-Battle default concurrency is `2` because every `/stats` page
can contain 999 rendered levels.

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
- `data/dokkaninfo-growth/latest/growth.json`
- `data/dokkaninfo-limited/latest/limited.json`
- `data/dokkaninfo-challenge/latest/challenge.json`
- `data/dokkaninfo-bonus/latest/bonus.json`
- `data/dokkaninfo-quest/latest/quest.json`
- `data/dokkaninfo-z-battles/latest/z-battles.json`

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

## Z-Battle specialized surface

Z-Battle is intentionally not projected as ordinary quest stages. Its index
discovers the normal event roots; each event page contributes category
weaknesses, battle conditions, level/range rules, enemy card changes, skill
icons, damage reduction and five reward columns. Its separate `/stats` page is
reduced to compact level, enemy-card, HP, ATK and DEF records rather than
retaining the repeated full card payload rendered for every level.

DokkanInfo does not list first-party `ZBattleStage::Super` identities as
independent index entries. Their routes resolve to the related normal event
presentation, so this sidecar does not invent or duplicate those structural
IDs. The first-party event topology remains authoritative for that relation.
`failedEventIds` and `failedStatsIds` distinguish failures in the two pages.

## Transport and Cloudflare

A bare HTTP request may receive `403`. The shared `fetchFromWeb` transport uses
ordinary browser navigation headers with an Axios request and a cURL fallback.
This currently returns the server-rendered HTML without requiring a browser,
login, user ID or game token. Cached runs reduce traffic and provide resilience
if the public site is temporarily unavailable. A future Cloudflare policy
change must fail closed; it must not silently turn a transport failure into
`not-provided` enemy data.
