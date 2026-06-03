# Dokkan Scraper Spec

## Purpose

This scraper now targets `dokkaninfo.com` as the source of truth for cards and equipment.

The main goal of this spec is to keep future prompts short:

- update this spec first when the data contract changes
- then update code
- then run smoke validation

## Sources

- Card catalog: `https://dokkaninfo.com/cards?sort=open_at`
- Card detail: `https://dokkaninfo.com/cards/{id}`
- EZA detail: `https://dokkaninfo.com/api/cards/{id}/eza?eza=true&step={step}`
- Transformation detail: `https://dokkaninfo.com/api/cards/{id}/transformation`
- Equipment index: `https://dokkaninfo.com/items/equipment`

## Parsing Rules

1. DokkanInfo list-like fields are not always arrays.
Some pages return arrays, others return objects keyed by numeric strings.
Every parser step must accept both formats.

2. Preserve structure before flattening.
If DokkanInfo provides names, styles, raw attack types, or multi-line passive text, keep those in structured fields.
Compatibility strings can still exist, but they should be derived from the structured data.

3. Prefer DokkanInfo IDs over legacy IDs.
`id` is the real DokkanInfo card ID string.
`legacyId` is compatibility-only.

4. Keep raw-looking gameplay text readable.
Multi-line passive or attack descriptions should stay multi-line in structured fields.
Do not aggressively collapse bullets into one sentence when the source already provides sections.

5. Normalize common typography artifacts at scrape time.
Convert smart quotes, common mojibake quote variants, long dashes and non-breaking spaces into stable ASCII-friendly text before serializing JSON.

## Character Contract

Stable top-level fields still used by the Android app:

- `id`, `legacyId`
- `name`, `title`
- `rarity`, `type`, `characterClass`
- `releaseDate`, `ezaReleaseDate`, `sezaReleaseDate`
- `summonable`, `isSummonable`
- `leaderSkill`, `ezaLeaderSkill`
- `leaderSkillBoost`
- `leaderSkillDetails`
- `ezaLeaderSkillDetails`
- `superAttack`, `ultraSuperAttack`, `exSuperAttack`
- `ezaSuperAttack`, `ezaUltraSuperAttack`, `ezaExSuperAttack`
- `passive`, `ezaPassive`
- `activeSkill`, `activeSkillCondition`
- `domain`, `standbySkill`, `finishingMove`
- `links`, `categories`
- stat fields
- awakening references
- equipment references

Field rules:

- `leaderSkillBoost` is the app-facing summary number for the card's best leader skill value, such as `170`, `200`, or `230`
- when EZA leader skill exists, summary should prefer the EZA leader skill text
- `leaderSkillDetails` / `ezaLeaderSkillDetails` are the structured contracts for future app-side leader matching
- each leader skill detail contains:
  - `rawText`
  - `displayBoost`
  - `clauses[]`
- each clause contains:
  - `rawText`
  - `stackGroup`: `primary`, `secondary`, or `additional`
  - `targetMode`: `base` or `also-belong`
  - optional `categories`, `types`, `classes`, `ki`
  - numeric `hp`, `atk`, `def`
  - `boostForm`: `percentage` or `flat`

- `portraitURL` must point to the locally composed portrait image:
  `images/portrait_{id}.png`
- `portraitSpec` must preserve the data needed to rebuild the DokkanInfo `card-icon` portrait locally:
  - `iconId`: thumb asset id used in `/character/thumb/card_{iconId}_thumb/...`
  - `frameColorId`: frame/background color id used in `cha_base_0{frameColorId}_0{rarityNumber}.png`
  - `rarity`: rarity enum used for the rarity badge
  - `elementCode`: raw DokkanInfo element code used in `cha_type_icon_{elementCode}.png`
- `elementCode` is a visual key, not a gameplay key.
  Do not rebuild the type badge from `type + characterClass`, because cards like SSR `1033830` visually use `01` while gameplay class is inferred as `Extreme`.
- `artURL` continues to use the full card art asset
- `characterClass` should come from `element` when DokkanInfo encodes Super or Extreme there
- if `element` does not encode class, such as many SSR cards with values like `00` through `04`, infer class from `awakening_element_type`

Structured fields added on top:

- `passiveDetails`
- `ezaPassiveDetails`
- `superAttackDetails`
- `ezaSuperAttackDetails`
- `ultraSuperAttackDetails`
- `ezaUltraSuperAttackDetails`
- `exSuperAttackDetails`
- `ezaExSuperAttackDetails`
- `extraInfo`

## Structured Fields

### `PassiveDetails`

- `name`: passive skill name from DokkanInfo
- `text`: multi-line passive text
- `lines`: passive text split by line for later parsing

### `SuperAttackDetails`

- `name`: attack name
- `effect`: attack effect text
- `type`: normalized attack type enum: `Armed`, `Unarmed`, `Ki Blast`, or `Other`
- `ki`: starting Ki threshold when available
- `style`: DokkanInfo style such as `Normal`, `Hyper`, `Extra`, `Condition`
- `condition`: causality or activation condition text when present
- `extras`: formatted extra effect labels from DokkanInfo

Attack type normalization rules:

- `Ki Blast` stays `Ki Blast`
- `Unarmed` stays `Unarmed`
- `Armed` and `Physical` map to `Armed`
- missing or unknown values map to `Other`
- `type` is the app-facing canonical property and must be enough on its own for display/filtering

### `CharacterExtraInfo`

- `kiMultiplierText`: compatibility string summary
- `kiMultiplierSteps`: structured multiplier steps

## Equipment Contract

Two equipment surfaces exist:

1. Card-level compatibility on each card payload:
- `cardEquipment`
- `characterEquipment`

2. Global equipment catalog:
- `getEquipmentData()`

Rules:

- use official DokkanInfo equipment IDs whenever available
- if a rendered equipment page has no official ID, generate a stable synthetic ID
- preserve `restrictions` and `sourcePages`

## Validation

Minimum validation for scraper changes:

1. `npm run build`
2. targeted smoke scrape with `DOKKAN_SCRAPER_LIMIT`
3. targeted card scrape with `DOKKAN_SCRAPER_CARD_IDS`
4. if equipment changed, smoke scrape with `DOKKAN_SCRAPER_EQUIPMENT_LIMIT`

## Output Formatting

- Character and equipment JSON outputs must be pretty-printed with indentation.
- `npm run format:data` must reformat existing JSON files in `data/` without running a new scrape.

## Current Known Gaps

- `scraper.spec.ts` now focuses on unit coverage for the DokkanInfo leader skill parser and display-boost summary rules.
- Passive classification, stat extraction, and effect tagging are not implemented yet.
- Some compatibility strings still coexist with the new structured fields until the Android app migrates.
