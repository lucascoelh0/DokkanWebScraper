# DokkanInfo scraper reference

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

## Release dates

Dates are saved as UTC ISO strings.

- `releaseDate` comes from `card.open_at`
- `ezaReleaseDate` comes from `eza_open_at` or `eza_open_date.open_at`
- `sezaReleaseDate` comes from `seza_open_at` or `seza_open_date.open_at`

## Mechanics mapping

Leader, passive, links, categories, stats, ki meter, art URL and portrait URL keep the existing fields where possible.

Super attacks:

- `superAttack`: `style: "Normal"`
- `ultraSuperAttack`: `style: "Hyper"` or Ki >= 18
- `exSuperAttack`: `style: "Extra"`
- `unitSuperAttacks`: `style: "Condition"` or `style: "Unit"`

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

## Known caveats

DokkanInfo sometimes serves a base card payload on an awakened card URL while putting the requested rarity in the list data. The scraper merges list fields into detail fields so rarity, stats, release dates and card ID stay correct for all rarities.

Some transformed states only work through the transformation endpoint when EZA query params are included. The scraper first tries the plain endpoint, then retries with `?eza=true&step={max_eza_step}` when available.
