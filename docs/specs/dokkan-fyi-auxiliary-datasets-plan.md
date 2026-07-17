# Dokkan.fyi Auxiliary Datasets Plan

## Purpose

This document defines the planned auxiliary datasets that should sit beside the core `dokkan.fyi` character contract.

The goal is to avoid overloading `characters.json` with every cross-cutting concern on the site while still letting Dokkanpanion grow into richer features over time.

The core principle is:

- character data should describe the card itself
- auxiliary datasets should describe shared systems around the card

Examples of those shared systems:

- support memories
- summon banners
- event stages
- mission catalogs
- Dokkan Frontier content
- acquisition sources
- categories as reverse-lookup metadata

## Implementation status

Already implemented in this scraper:

- `support-memories.json`
- `support-memory-details.json`
- `support-memory-dokkaninfo-enrichment.json`
- `awakening-medal-dokkaninfo-enrichment.json`
- `item-catalog.json`
- `exclusive-skill-orb-details.json`
- `summons-index.json`
- `summons-details.json`
- `quest-story-stages.json`
- `event-stages.json`
- `stage-catalog.json`
- `z-battles.json`
- `panel-missions.json`
- `event-missions.json`
- `mission-catalog.json`
- `dokkan-frontier-series.json`
- `dokkan-frontier-chapters.json`
- `awakening-paths.json`
- `awakening-medals.json`
- `acquisition.json`
- `acquisition-source-index.json`
- `acquisition-navigation.json`
- `dokkaninfo-event-rewards.json`
- `category-context.json`
- `team-context.json`
- `category-roster.json`
- `categories.json`
- `wallpapers.json`

Current `acquisition.json` scope:

- event mission rewards
- Dokkan Frontier chapter and node mission rewards
- Z-Battle level and checkpoint rewards
- awakening medal source normalization for:
  - stage drops
  - Z-Battles
  - Baba Shop sales
  - World Tournament rewards
- DokkanInfo event/stage rewards for cards, awakening items, potential items,
  training items, equipment skill orbs, support items, treasures, support
  memories, and other event reward types

Current `acquisition-source-index.json` scope:

- normalized `source -> rewards[]`
- derived `groupKey/groupKind` so the app can group atomic sources into bigger surfaces
- current grouping coverage for:
  - event mission categories
  - Frontier chapters and nodes
  - Z-Battles
  - awakening stage quests/areas
  - Baba Shop sales
  - World Tournament rewards

Current `acquisition-navigation.json` scope:

- normalized `sourceKey -> app navigation target`
- mission-linked acquisition resolves into `mission-catalog` keys
- stage-linked acquisition resolves into `stage-catalog` keys
- current target coverage for:
  - event missions
  - Frontier chapter missions
  - Frontier node missions
  - Z-Battle levels and checkpoints
  - awakening stage quest/area routes
  - Baba Shop sales
  - World Tournament rewards
  - DokkanInfo event and stage reward pages

Current `dokkaninfo-event-rewards.json` scope:

- cached DokkanInfo event index and detail-page scraping
- 897 configured event pages across bonus, challenge, DB Stories, growth,
  limited, quest, story, Z-Battle, Dokkan Frontier, and Super Dragon Ball
  Heroes surfaces
- 40,345 reward rows and 4,851 distinct item identities in the 2026-07-15
  full refresh
- stage-aware source links when the event page exposes a concrete stage
- event-level sources for pages such as Z-Battles whose reward rows are not
  attached to a stage anchor
- stable `dokkaninfo-event-reward:{eventType}:{eventId}:...` source keys
- cache, bounded concurrency, timeout/retry controls, progress logging, and
  `failedEventIds` for partial-run recovery

This layer intentionally remains separate from the character contract. It is
joined through normalized acquisition item keys, so the same event reward can
serve awakening medals, equipment skill orbs, training items, support memories,
and future item catalogs without copying event data into each feature.

Current `category-context.json` scope:

- normalized `category -> leaderIds/supportIds/supportMemoryIds`
- normalized `supportMemory -> categoryIds/applicableCharacterIds`
- normalized `character -> categoryIds/leaderOfCategoryIds/supportOfCategoryIds/applicableSupportMemoryIds`

Current `support-memory-details.json` scope:

- app-facing joined support memory catalog
- support memory coverage includes:
  - core support-memory identity/effect fields
  - film metadata
  - category ids/names
  - applicable character ids
- unlock resolution via `unlockMethod`
- direct unlock acquisition refs via `SupportMemory:{id}`
- film acquisition refs via `SupportFilm:{filmId}`
- grouped acquisition rollups per source surface
- navigation targets for each acquisition source when available
- DokkanInfo enrichment joined directly onto each memory under `dokkanInfo`
  - large art / complete art / film icon
  - enhancement item refs
  - local animation mirrors and availability status

Current `support-memory-dokkaninfo-enrichment.json` scope:

- DokkanInfo-only enrichment layer for support memories
- intended to stay separate from the canonical dokkan.fyi support-memory contract
- current coverage includes:
  - large card art
  - sepia "complete" art and required quantity
  - required film icon / color code / quantity
  - enhancement item icons / ids / quantities
  - stable `SupportMemoryEnhancementItem:{id}` keys for the separate
    support-memory material namespace
  - local animation mirroring when the individual page exposes an LWF support-memory animation
- current animation strategy:
  - `status: mirrored` when the `.lwf` and all referenced textures were mirrored locally
  - `status: partial` when the `.lwf` exists but one or more referenced textures are missing upstream
  - `status: unavailable` when the animation payload itself is not available from DokkanInfo

Current `awakening-medal-dokkaninfo-enrichment.json` scope:

- DokkanInfo-only enrichment layer for awakening medals
- intended to stay separate from the canonical dokkan.fyi awakening-medal and acquisition layers
- current coverage includes:
  - DokkanInfo medal identity / description / rarity bucket / zeni / trade-point metadata
  - `eventJumpable` flags from the DokkanInfo list payload
  - local mirroring of DokkanInfo awakening-medal thumbs
  - download the `.lwf` payload
  - inspect it for external texture atlas references
  - mirror the required texture atlas files locally beside the `.lwf`
- intended app use:
  - richer support-memory presentation without bloating `support-memories.json`
  - future support-memory detail screens with locally packaged animation playback

Current `exclusive-skill-orb-details.json` scope:

- app-facing exclusive skill orb catalog
- orb coverage includes:
  - core orb identity/effect fields already exposed on the character contract
  - owner character refs for the fully-awakened cards that surface the orb
  - grouped acquisition rollups per source surface
  - optional DokkanInfo equipment metadata joined by official orb ID
  - local mirrored orb icon/background assets under `presentationAssets`
- acquisition resolution prefers `EquipmentSkillItem:{id}` from `acquisition.json`
- current fallback coverage keeps character-page shop / mission hints when the normalized acquisition layer does not yet include the orb
- current fallback is especially useful for Baba-shop orb rotations that only expose treasure/pricing metadata on the character page
- DokkanInfo equipment metadata is enrichment only; it does not change an `unknown` acquisition into a confirmed source
- character-page responses are cached with a short configurable TTL so full refreshes can resume after transient source failures
- individual unavailable character pages are recorded in `failedCharacterIds` instead of aborting the entire orb catalog

Current `item-catalog.json` scope:

- 994 DokkanInfo items across act items, keys, potential items, special items,
  stickers, support items, training fields, training items, and treasure items
- stable `itemType:id` keys aligned with the reward/acquisition layer where the
  same item type is exposed
- normalized names, descriptions, training EXP values, and source paths
- local icon mirrors for all 994 entries and local background mirrors when the
  source page exposes a layered icon
- cached category pages, bounded page/asset concurrency, and
  `failedCategorySlugs` for partial-run recovery
- equipment and awakening medals intentionally remain specialized datasets,
  since their contracts already include restrictions, awakening metadata,
  rarity, exchange values, and other fields that do not belong in this generic
  catalog

As of 2026-07-15, the event-mission catalog was refreshed across all 463 index categories and joined again into the orb dataset. The subsequent DokkanInfo event-reward layer added normalized event/stage sources to the shared acquisition catalog. The current orb refresh reports 876 orbs with normalized acquisition items, 404 with character-page shop fallbacks, and 457 still without an explicit source. The remaining gap is now isolated to acquisition surfaces not yet modeled, rather than stale mission data or inference from F2P status.

Event-mission scraping now has:

- cached index/category payloads under `data/event-missions/cache/`
- bounded concurrency, timeout and retry controls
- progress logging and `failedCategoryIds` when a category remains unavailable

Current `team-context.json` scope:

- app-facing join layer for categories, character roles and support memories
- category coverage includes:
  - leaders
  - support units
  - support memories
- character coverage includes:
  - category refs
  - leader-of-category refs
  - support-of-category refs
  - applicable support memory refs
- support memory coverage includes:
  - category refs
  - applicable character ids
  - core film/cost/unlock metadata

Current `category-roster.json` scope:

- app-facing category-detail dataset
- category coverage includes:
  - leaders
  - support units
  - support memories
  - full member roster
- member coverage includes:
  - title
  - rarity / type / class
  - portrait refs
  - latest release state inference (`initial` / `eza` / `seza`)
  - role flags for leader/support membership
  - reversible exchange and free-to-play flags

Current `categories.json` scope:

- reverse-lookup category dataset sourced from dokkan.fyi category pages
- category coverage includes:
  - leaders
  - support units
  - support memories

Current `mission-catalog.json` scope:

- normalized `panel`, `event` and `frontier` mission entries under one shared contract
- shared mission reward shape
- stable reward `itemKey` values aligned with `acquisition.json` item keys when a reward can be joined
- shared mission character reference shape
- group hierarchy coverage for:
  - panel campaigns
  - panel boards
  - event mission categories
  - Frontier chapters
  - Frontier nodes

Current `stage-catalog.json` scope:

- normalized `quest-story`, `event`, and `z-battle` stage surfaces under one shared contract
- group hierarchy coverage for:
  - quest-story chapters
  - quest-story areas
  - event areas
  - Z-Battles
- entry coverage for:
  - quest-stage difficulty rows
  - event-stage difficulty rows
  - Z-Battle levels
  - Z-Battle reward checkpoints

Still planned:

- additional mission surfaces beyond panel/event/frontier
- later acquisition expansion for Frontier, shops and richer event joins
- remaining DokkanInfo item work is now limited to richer detail joins for
  equipment and awakening medals, which stay on their specialized pipelines
- likely best use of those DokkanInfo item pages:
  - shared item art / naming normalization
  - local asset mirrors for app rendering
  - future acquisition and event/shop joins once those pages are scraped
- additional DokkanInfo event and banner surfaces to evaluate next:
  - `https://dokkaninfo.com/banners`
  - `https://dokkaninfo.com/events/burstmode`
  - `https://dokkaninfo.com/events/bonus`
  - `https://dokkaninfo.com/events/challenge`
  - `https://dokkaninfo.com/events/dbstories`
  - `https://dokkaninfo.com/events/zbattle`
  - `https://dokkaninfo.com/events/growth`
  - `https://dokkaninfo.com/events/limited`
  - `https://dokkaninfo.com/events/sdbattle`
  - `https://dokkaninfo.com/events/quest`
  - `https://dokkaninfo.com/events/story`
  - `https://dokkaninfo.com/events/dokkanfrontier`
  - `https://dokkaninfo.com/events/rmbattle`
  - `https://dokkaninfo.com/events/worldtournament`
- likely best use of those DokkanInfo event/banner pages:
  - fill gaps where DokkanInfo exposes richer art or presentation metadata than dokkan.fyi
  - add event-specific flavor/media that is useful for the app but not ideal for the core normalized stage contract
  - compare DokkanInfo banner coverage against current dokkan.fyi summon coverage before deciding whether banners should stay fyi-only or become a merged enrichment layer

## Confirmed Dokkan.fyi surfaces

The following pages were inspected and confirmed to expose structured Inertia page payloads:

### Support memories

Source:

- `https://dokkan.fyi/support-memories`

Confirmed payload:

- component: `SupportMemory/Index`
- props:
  - `supportMemories`
  - `categories`

Observed support memory fields include:

- `id`
- `name`
- `description`
- `support_film_id`
- `support_film`
- `cost`
- `lasts_entire_battle`
- `unlock_quantity`
- `released_at`
- `root_enhancement_levels`
- `support_memory_skills`

Recommendation:

- treat this as a first-class standalone dataset

### Summon banners

Sources:

- `https://dokkan.fyi/summons?active=true&category=1`
- detail example: `https://dokkan.fyi/summons/12338`

Confirmed payloads:

- index component: `Summon/Index`
- detail component: `Summon/SummonShow`

Observed index data:

- paginated `summons.data`
- each row includes at least:
  - `id`
  - `name`
  - `description`
  - `category`
  - `starts_at`
  - `ends_at`
  - `banner`

Observed detail data:

- `summon`
  - `featured_characters`
  - `steps`

Recommendation:

- keep both an index dataset and detail dataset
- banner detail is where featured units and step logic belong

### Quest / Dokkan Story stages

Source:

- `https://dokkan.fyi/stages/quest-dokkan-story`

Confirmed payload:

- component: `Stage/QuestDokkanStoryIndex`
- props:
  - `chapters`

Observed fields:

- chapter-level structure with nested `areas`

Recommendation:

- low-complexity stage index
- useful as one branch of a future unified stage catalog

### Event stages

Source:

- `https://dokkan.fyi/stages/events`

Confirmed payload:

- component: `Stage/StageIndex`
- props:
  - paginated `areas.data`
  - `tabs`

Observed fields:

- `id`
- `name`
- `type`
- `chapter`
- `images`
- `quests`

Recommendation:

- treat this as the main event-stage index
- later enrich with detail pages if needed

### Z-Battles

Source:

- example: `https://dokkan.fyi/z-battles/205`

Confirmed payload:

- component: `ZBattle/ZBattleShow`
- props:
  - `stage`
  - `levels`
  - `missionCategories`
  - optional `superStage`, `superLevels`, `superTeam`

Observed stage fields:

- `id`
- `name`
- `nickname`
- `type`
- `has_super`
- `images`
- `enemies`
- `check_points`
- `first_reward_level_ranges`
- `beneficial_items`
- `eza_characters`

Observed level fields:

- `level`
- `enemy_card`
- `hp`
- `atk`
- `def`
- `skills`
- `first_rewards`

Recommendation:

- Z-Battles deserve their own dataset branch, not just a generic stage row
- they are especially valuable for medal and EZA acquisition linking later
- do not trust `stage.has_super` alone; some pages expose `superStage` even when `has_super` is `false`
- beneficial-character recommendations are better derived app-side from `beneficial_items` plus the character database

### Dokkan Frontier

Sources:

- `https://dokkan.fyi/dokkan-frontier`
- series example: `https://dokkan.fyi/dokkan-frontier/2`
- chapter example: `https://dokkan.fyi/dokkan-frontier/2/chapters/2001`

Confirmed payloads:

- index component: `DokkanFrontier/Index`
- series component: `DokkanFrontier/Show`
- chapter component: `DokkanFrontier/ChapterShow`

Observed fields:

- series list:
  - `id`
  - `name`
  - `banner_image_path`
  - `priority`
  - `chapters`
- chapter:
  - `pages`
- chapter-level extras:
  - `group_exchange`
  - `chapter_missions`

Observed mission fields:

- `id`
- `type`
- `name`
- `description`
- `rewards`
- `characters`
- `priority`
- `starts_at`
- `ends_at`
- `category_id`

Recommendation:

- Frontier is rich enough to justify its own dataset family
- do not cram it into the generic stage model too early

### Panel missions

Source:

- `https://dokkan.fyi/missions/panel`

Confirmed payload:

- component: `Mission/Panel`
- props:
  - `campaigns`

Observed fields:

- `id`
- `name`
- `ends_at`
- `is_indefinite`
- `img`
- `category_ids`
- `categories`

Recommendation:

- panel missions can be a compact standalone dataset
- event mission data should later be normalized into a broader mission model if we scrape more mission surfaces

### Wallpapers

Source:

- `https://dokkan.fyi/wallpapers`

Confirmed payload:

- component: `Wallpaper/Index`
- props:
  - paginated `wallpapers.data`

Observed fields:

- `id`
- `name`
- `description`
- `schedules`

Recommendation:

- compact optional content dataset
- useful for collection or cosmetics surfaces, but still below gameplay catalogs in priority

### Categories

Source:

- `https://dokkan.fyi/categories`

Confirmed payload:

- component: `Category/Index`
- props:
  - paginated `categories.data`

Observed fields:

- `id`
- `name`
- `characters`
- `support_memories`

Recommendation:

- keep character-page categories as the canonical per-character membership list
- scrape the categories surface as a reverse-lookup dataset for:
  - leaders by category
  - support units by category
  - support memories by category
  - future category metadata normalization

## Proposed dataset boundaries

### 1. Core characters dataset

Already in progress:

- `characters.json`

Should remain focused on:

- character identity
- current playable state
- transformations
- standby
- finish skills
- reversible exchange
- leader skills
- passive details
- exclusive skill orbs as lightweight structured references

Should not become the only source of truth for:

- full support memory catalog
- banners
- event catalogs
- medal sourcing
- mission catalogs

### 2. Support memories dataset

Suggested artifact:

- `support-memories.json`

Suggested scope:

- support memory identity and effect data
- support film data
- enhancement chain
- release date

Possible future joins:

- category references
- character references only if needed for UI shortcuts

Why this should come first:

- structurally clean
- standalone
- immediately useful in the app
- low risk of destabilizing character scraping

### 3. Summons dataset

Suggested artifacts:

- `summons-index.json`
- `summons-details.json`

Suggested scope:

- active and historical banner index
- category and availability window
- featured characters
- step-up details

Possible future joins:

- summonable history for a character
- “currently featured” UI

### 4. Stages dataset family

Suggested artifacts:

- `quest-story-stages.json`
- `event-stages.json`
- `z-battles.json`

Suggested scope:

- stage identity
- stage grouping / chapter / area structure
- rewards
- bosses and enemy references
- level-by-level data where relevant

Why split instead of forcing one file immediately:

- Quest/Dokkan Story is structurally simpler
- event stages are paginated area catalogs
- Z-Battles have deeper per-level combat/reward structure

### 5. Missions dataset family

Suggested artifacts:

- `panel-missions.json`
- future: `missions.json`

Suggested scope:

- campaign metadata
- mission requirements
- rewards
- validity windows

Possible future joins:

- skill orb acquisition
- event unlock chains
- Frontier mission display

### 6. Dokkan Frontier dataset family

Suggested artifacts:

- `dokkan-frontier-series.json`
- `dokkan-frontier-chapters.json`

Suggested scope:

- series metadata
- chapter graph/pages/nodes
- enemies
- chapter rewards
- Frontier missions
- exchange/group data

Why keep separate:

- Frontier is closer to a self-contained mode than a generic stage
- it deserves its own modeling pass

### 7. Categories dataset

Suggested artifact:

- `categories.json`

Suggested scope:

- category metadata
- reverse links to characters
- reverse links to support memories

Current recommendation:

- keep using character-page categories as the canonical per-character list for now
- treat `categories.json` as the right source for category landing-page data

### 8. Wallpapers dataset

Suggested artifact:

- `wallpapers.json`

Suggested scope:

- optional media catalog only

Current recommendation:

- lowest priority

## Acquisition strategy

Long-term, acquisition should become its own normalized layer instead of staying scattered across:

- character obtainability
- skill orb mission reward data
- shop item data
- stage rewards
- panel missions

Suggested direction:

- keep direct lightweight acquisition hints near the source dataset
- add a later normalized acquisition dataset only when enough surfaces are covered

That eventual normalized layer could point to:

- missions
- stages
- Z-Battles
- shop exchanges
- Frontier rewards

## Recommended implementation order

### Phase A: low-risk standalone wins

1. `support-memories.json` [done]
2. `summons-index.json` [done]
3. `summons-details.json` [done]

Why:

- high user value
- relatively isolated
- no need to redesign the character contract again

### Phase B: structured gameplay catalog

4. `quest-story-stages.json` [done]
5. `event-stages.json` [done]
6. `stage-catalog.json` [done]
7. `z-battles.json` [done]

Why:

- unlocks later acquisition and medal work
- creates the foundation for “where do I get this?” features

### Phase C: mission and mode-specific layers

8. `panel-missions.json` [done]
9. `event-missions.json` [done]
10. `mission-catalog.json` [done]
11. `dokkan-frontier-series.json` [done]
12. `dokkan-frontier-chapters.json` [done]

Why:

- richer, but also more domain-specific
- easier once stage/reward patterns are already familiar

### Phase D: reverse-lookup and polish datasets

13. `awakening-paths.json` [done]
14. `awakening-medals.json` [done]
15. `acquisition.json` [done]
16. `acquisition-source-index.json` [done]
17. `acquisition-navigation.json` [done]
18. `category-context.json` [done]
19. `team-context.json` [done]
20. `category-roster.json` [done]
21. `categories.json` [done]
22. `wallpapers.json` [done]
23. `dokkaninfo-event-rewards.json` [done]
24. `item-catalog.json` [done]

Why:

- useful, but not the best first use of time

## App-facing guidance

Near-term app usage that seems most compelling:

- support memories linked from category and character views
- featured banners / current summons
- event and Z-Battle browsing
- later, acquisition links from skill orbs and awakening materials

Now that `exclusive-skill-orb-details.json` exists, the app can also consume skill-orb acquisition/group metadata without bloating the core character contract.

This suggests the first auxiliary dataset the app would actually benefit from is:

1. support memories
2. summons
3. stage catalogs

## Open questions to revisit later

1. Whether auxiliary datasets should publish as one combined bundle or separate files.
2. Whether categories should become source-of-truth for reverse links or remain convenience-only.
3. Whether acquisition should be modeled as a dedicated graph or embedded references plus app-side joins.
4. Whether wallpapers belong in the app at all or stay website-only.
