# DokkanInfo scraper reference

Primary short-form specs now live in:

- `docs/specs/dokkan-scraper-spec.md`
- `docs/specs/passive-analysis-roadmap.md`

Use those first for future prompt context. This file stays as a more narrative reference.

## Source

The scraper uses `https://dokkaninfo.com/cards?sort=open_at` as the catalog source.

The cards list page embeds the full list in the `<cards v-bind:cardsjson="...">` attribute. Each card detail page embeds most card data in `<card-info v-bind:datajson="...">`.

Some detail pages/API calls are blocked by Cloudflare when fetched through `axios`. The scraper tries `axios` first, then switches to `curl` with browser-like headers.

## Catalog scope

`getDokkanData()` now scrapes all released playable rarities:

- `N`
- `R`
- `SR`
- `SSR`
- `UR`
- `LR`

The default list filter keeps cards that:

- have rarity `0` through `5`
- have `id <= 3000000` so transformed-only states are not scraped as base cards
- have `hp_init > 300`
- have `open_at` not later than the current time

For targeted checks, set `DOKKAN_SCRAPER_CARD_IDS` to a comma-separated list of DokkanInfo card IDs.

```powershell
$env:DOKKAN_SCRAPER_CARD_IDS='1032311,1032551,1029441'
npx ts-node -e "const { getDokkanData } = require('./scraper'); getDokkanData().then(console.log)"
```

`DOKKAN_SCRAPER_LIMIT` still limits the selected list for quick smoke tests.

## IDs

`id` is now the real DokkanInfo card ID as a string, for example `1032311`.

`legacyId` stores the old shortened asset-derived ID, for example `1231`. This prevents duplicate IDs when multiple rarities share the same asset, such as SSR and Z-Awakened UR variants.

## Summon and awakenings

Summon availability:

- `summonable`: raw DokkanInfo label, for example `Summonable`
- `isSummonable`: boolean convenience field; `false` when DokkanInfo does not mark the card as summonable

Leader skill summary:

- `leaderSkillBoost`: numeric summary used by the Android app for list/filter display
- the scraper currently mirrors the app's legacy summary rules, preferring `ezaLeaderSkill` when present
- `leaderSkillDetails` / `ezaLeaderSkillDetails`: structured leader clauses for future app-side matching and simulator migration

Awakening references:

- `awakeningCards`: all related cards returned by `awakening_cards`
- `previousAwakenings`: related cards with lower rarity than the current card
- `nextAwakenings`: related cards with higher rarity than the current card

Each awakening reference includes `id`, `legacyId`, `name`, `rarity`, `characterClass`, `type`, `releaseDate`, `portraitURL`, `portraitSpec` and `artURL`.

## Equipment

`getDokkanData()` now adds an `equipment` array to each card when DokkanInfo exposes compatible Skill Orbs in the card payload.

The card payload currently exposes:

- `cardEquipment`: equipment tied to one specific card/title
- `characterEquipment`: equipment tied to character-name restrictions

These entries use DokkanInfo's official equipment IDs and include `id`, `officialId`, `name`, `description`, `grade`, stat bonuses, exchange-point info, icon URL and parsed restriction metadata. For card-specific equipment the restriction includes the target `cardIds`, plus parsed `cardTitles` and `cardNames` when the description uses the `[Title] Character Name` format.

`getEquipmentData()` scrapes the equipment catalog from:

- `/items/equipment/other`
- `/items/equipment/cards`
- `/items/equipment/categories`
- `/items/equipment/characters`
- `/items/equipment/types`

The scraper saves this as `data/{YYYYMMDD}DokkanEquipmentData.json` from `index.ts`.

Official equipment IDs are used whenever they are embedded by DokkanInfo, especially on card-specific equipment pages. Some aggregate equipment pages are server-rendered without an equipment ID in the HTML; those entries get a stable synthetic ID based on name, description, grade, icon and source page. The original source page and parsed restrictions are still preserved so the Android app can filter by card, category, character name, class or type.

For quick equipment smoke tests, set `DOKKAN_SCRAPER_EQUIPMENT_LIMIT` to limit the number of category/character/type/card equipment pages fetched:

```powershell
$env:DOKKAN_SCRAPER_EQUIPMENT_LIMIT='2'
npx ts-node -e "const { getEquipmentData } = require('./scraper'); getEquipmentData().then(data => console.log(data.length))"
```

## Release dates

Dates are saved as UTC ISO strings.

- `releaseDate` comes from `card.open_at`
- `ezaReleaseDate` comes from `eza_open_at` or `eza_open_date.open_at`
- `sezaReleaseDate` comes from `seza_open_at` or `seza_open_date.open_at`

## Mechanics mapping

Leader, passive, links, categories, stats, ki meter and art URL keep the existing fields where possible.

`portraitURL` now points to a locally composed file in `data/images`, for example `images/portrait_1033830.png`.

`portraitSpec` is the app-facing contract for rebuilding the same portrait locally without storing raw layer URLs in JSON:

- `iconId`: card thumb asset id
- `frameColorId`: frame/background color selector from DokkanInfo
- `rarity`: rarity enum for the rarity badge
- `elementCode`: raw visual type-badge key such as `01` or `21`

`elementCode` must stay raw because some SSR and lower-rarity cards do not visually encode their inferred gameplay class in the badge asset. For example, `1033830` is classified as `Extreme` for gameplay purposes, but its visual type icon still comes from `cha_type_icon_01.png`.

Structured combat fields now exist alongside the legacy compatibility strings:

- `passiveDetails` / `ezaPassiveDetails`: passive name, multi-line text and split lines
- `leaderSkillDetails` / `ezaLeaderSkillDetails`: raw text, display boost and structured clauses
- `superAttackDetails`, `ultraSuperAttackDetails`, `exSuperAttackDetails` and EZA variants: attack name, normalized attack type, Ki threshold, style and extras
- `extraInfo`: currently used for structured Ki multiplier data

Super attacks:

- `superAttack`: `style: "Normal"`
- `ultraSuperAttack`: `style: "Hyper"` or Ki >= 18
- `exSuperAttack`: `style: "Extra"`
- `unitSuperAttacks`: `style: "Condition"` or `style: "Unit"`
- attack `type`: `Armed`, `Unarmed`, `Ki Blast`, or `Other`

Active skills:

- `activeSkill`: active skill name plus `effect_description`
- `activeSkillCondition`: `condition_description`
- `ezaActiveSkill` and `ezaActiveSkillCondition`: from the EZA endpoint when provided

Other mechanics:

- `domain`: `dokkan_fields`
- `transformationCondition`: `transformation`
- `standbySkill`: `stand_by_skill`
- `finishingMove`: `finish_skills`
- `transformations`: fetched from `/api/cards/{id}/transformation`, with EZA query params when needed
- `dokkanFrontierPassives`: `originPassiveSkills`, including battle title and `originBattleId`
- `dokkanFrontierGroupPassive`: `passive_skill.sougou_only_itemized_description`
- `dokkanFrontierCharacterPassive`: `passive_skill.kobetu_only_itemized_description`

## Example coverage checked

- Active Skill: `1032311`, `1028321`
- EX Super Attack: `1032551`, `1032741`
- Reversible Exchange: `1033061`
- Domain: `1029441`
- Standby/Finish Skill: `1029471`, `1025731`
- Transformations: `1030341`
- Exchange: `1029701`
- EZA: `1022781`, `1025071`
- SEZA: `1013771`
- Summonable + awakening chain: `1032530`, `1032541`, `1032551`
- Dokkan Frontier passive: `1032771`

## Known caveats

DokkanInfo sometimes serves a base card payload on an awakened card URL while putting the requested rarity in the list data. The scraper merges list fields into detail fields so rarity, stats, release dates and card ID stay correct for all rarities.

Some transformed states only work through the transformation endpoint when EZA query params are included. The scraper first tries the plain endpoint, then retries with `?eza=true&step={max_eza_step}` when available.

Text cleanup now also normalizes common typography artifacts from the source, such as smart apostrophes, curly quotes, mojibake quote sequences like `â€™`, long dashes and non-breaking spaces, so downstream apps receive stable plain-text strings.

## JSON formatting

The scraper now writes pretty-printed JSON by default.

To reformat existing JSON files in `data/` without scraping again:

```powershell
npm run format:data
```

To format a specific file only:

```powershell
npx ts-node format-json.ts data/20260601DokkanCharacterData.json
```
