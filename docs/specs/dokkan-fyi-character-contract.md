# Dokkan.fyi Character Contract

## Purpose

This document defines the preferred long-term character dataset contract for Dokkanpanion when the scraper source is `dokkan.fyi`.

It exists to keep future work aligned:

- evolve the contract here first
- then update the scraper
- then adapt the Android app
- only keep compatibility fields where they still buy us something

This is intentionally a cleaner target than the old DokkanInfo contract. The app has not been relaunched yet, so we can optimize for maintainability instead of legacy inertia.

## Source stance

Primary source:

- character listing and detail pages from `https://dokkan.fyi`

Current migration stance:

- keep only the latest relevant playable state for each card line as the primary character record
  - initial if the line has no EZA or SEZA
  - EZA if the line has EZA
  - SEZA if the line has SEZA
- do not preserve intermediate Z-Awaken-only duplicates for the same card line
- do preserve gameplay-relevant alternate states:
  - transformations
  - standby states
  - post-standby transformations
  - reversible exchange states
  - active skill transformations
  - domain states
  - EX attacks
  - unit super attacks

## Contract design rules

1. Prefer structured fields over flattened strings.
   If `dokkan.fyi` exposes a mechanic as structured JSON, keep that structure in the dataset.

2. Legacy strings are compatibility outputs, not the source of truth.
   Fields like `standbySkill` and `finishingMove` may continue to exist temporarily, but they should be derived from structured fields.

3. Keep mechanical provenance.
   Transformation-like states should preserve what created them: transformation path, standby, reversible exchange, finish skill, active skill, or passive-triggered state.

4. Preserve app-friendly convenience.
   Structured data is the source of truth, but the dataset can still include convenience booleans and summaries such as `isFreeToPlay` or `leaderSkillBoost`.

5. Normalize text once.
   Skill names, descriptions, and conditions should be normalized during scraping so the app does not need site-specific cleanup logic.

## Primary character record

The base `Character` record represents the latest relevant playable state for a card line.

Stable core fields expected to remain:

- `id`, `legacyId`
- `name`, `title`
- `rarity`, `type`, `characterClass`
- `releaseDate`, `ezaReleaseDate`, `sezaReleaseDate`
- `portraitURL`, `portraitFilename`, `portraitSpec`
- `artURL`, `artFilename`
- `leaderSkill`, `leaderSkillBoost`, `leaderSkillDetails`
- `superAttack`, `ultraSuperAttack`, `exSuperAttack`
- `superAttackDetails`, `ultraSuperAttackDetails`, `exSuperAttackDetails`
- `unitSuperAttacks`
- `passive`, `passiveDetails`
- `activeSkill`, `activeSkillCondition`
- `domain`
- `links`, `categories`, `kiMeter`
- stats and max-level information
- `transformations`

## Source-of-truth structured mechanics

### Obtainability

Preferred source of truth:

```ts
type CharacterObtainability =
  | "summonable"
  | "freely-obtainable"
  | "stage-reward"
  | "world-tournament-reward"
  | "unknown";

interface CharacterObtainabilityDetails {
  type: CharacterObtainability
  isFreeToPlay: boolean
  hasDirectAcquisitionDetails?: boolean
}
```

Rules:

- `obtainability` is the source of truth
- `isFreeToPlay` is a convenience boolean derived from `obtainability`
- legacy `summonable` / `isSummonable` may stay temporarily for app compatibility
- exact drop/acquisition locations belong to a future acquisition dataset, not the minimal character contract

### Standby

Preferred source of truth:

```ts
interface StandbySkillDetails {
  id?: string
  name: string
  description: string
  condition: string
  targetCharacterId?: string
  finishSkills: FinishSkill[]
  legacyText?: string
}
```

Rules:

- `standby` is the source of truth
- `standbySkill` may remain as a derived legacy string
- `targetCharacterId` points to the standby character state when one exists
- finish skills that belong to a standby mechanic must live under `standby.finishSkills` first, even if they are also mirrored elsewhere for convenience

### Finish skills

Preferred source of truth:

```ts
type FinishSkillEffectKind =
  | "damage"
  | "buff"
  | "transform"
  | "mixed"
  | "unknown";

interface FinishSkill {
  id?: string
  name: string
  description: string
  condition: string
  targetTransformationId?: string
  effectKind?: FinishSkillEffectKind
  legacyText?: string
}
```

Rules:

- `finishSkills` may exist on a character or transformation as a convenience view
- when the finish skill belongs to standby mode, the canonical attachment point is `standby.finishSkills`
- `finishingMove: string[]` is legacy-only and should be derived
- `targetTransformationId` is required when a finish skill transitions into another state

### Reversible exchange

Preferred source of truth:

```ts
interface ReversibleExchangeDetails {
  targetCharacterId: string
  targetCharacterName?: string
  condition: string
  legacyText?: string
}
```

Rules:

- reversible exchange should not be represented only as a generic transformation row
- `reversibleExchange` gives the app a dedicated mechanic block to render
- the corresponding exchanged state should still appear in `transformations`

### Transformation metadata

Preferred source of truth:

```ts
type TransformationSource =
  | "transformation-path"
  | "active-skill"
  | "standby"
  | "reversible-exchange"
  | "finish-skill"
  | "passive-skill"
  | "unknown";
```

Rules:

- every transformation entry should preserve how it is reached
- `transformationSourceLabel` may preserve the original site wording when useful for debugging
- app UI should branch on `transformationSource`, not on fragile text matching

## Transformation contract

Transformations are full gameplay states, not light references.

Important fields on `Transformation`:

- `id`, `baseCharacterId`
- display identity fields like `name`, `type`, `characterClass`
- `superAttack*`, `ultraSuperAttack*`, `exSuperAttack*`
- `passive`, `passiveDetails`
- `activeSkill`, `activeSkillCondition`
- `domain`
- `portrait*`, `art*`
- `standby`, `finishSkills`, `reversibleExchange`
- `transformationCondition`
- `transformationSource`, `transformationSourceLabel`
- `obtainability`, `isFreeToPlay`

Rules:

- standby states are transformations
- post-standby states are transformations
- reversible exchange counterparts are transformations
- active-skill or finish-skill follow-up states are transformations
- transformations should carry their own mechanic blocks if the target state exposes them

## Legacy compatibility fields

These can remain during migration, but they should be treated as derived outputs:

- `standbySkill`
- `finishingMove`
- `summonable`
- `isSummonable`

Preferred migration direction:

1. scraper emits both structured and legacy fields
2. Android app is migrated to structured fields
3. legacy fields are deprecated and eventually removed

## Exclusive skill orbs

Preferred source of truth:

```ts
interface CharacterExclusiveSkillOrb {
  id: string
  name: string
  description: string
  grade?: string
  reusable?: boolean
  iconImageId?: string
  iconURL?: string
  backgroundURL?: string
  skills: CharacterExclusiveSkillOrbSkill[]
  acquisition?: CharacterExclusiveSkillOrbAcquisition[]
}
```

Rules:

- exclusive skill orbs belong directly on the character contract
- keep orb effect details structured in `skills`
- keep acquisition structured enough to support later event/shop linking
- event metadata should be enriched later from a dedicated event dataset instead of forcing all context into the character scrape

## Fields intentionally deferred

These are valid follow-up expansions, but should not block the core migration:

### Training partners

Likely outcome:

- partly derived from our own logic
- optionally enriched from scraped free-to-play/acquisition data

This should stay out of the minimal character contract until the rules are clear.

### Applicable support memories

Recommended direction:

- separate support memory dataset as source of truth
- character contract can later store memory IDs or lightweight references

### Awakening path

Recommended direction:

- separate awakening-path and medal dataset
- character contract can reference path nodes and medal IDs once those datasets exist

### Event acquisition details

Recommended direction:

- separate event dataset that can be joined with:
  - skill orb acquisition
  - medal acquisition
  - free-to-play character acquisition

## Validation expectations

Minimum validation when changing this contract or its scraper mapping:

1. `npm run test`
2. targeted `npm run run:fyi-experiment`
3. inspect `data/fyi-experiment/latest/coverage-report.json`
4. manually verify at least one card for each mechanic touched:
   - standby
   - finish skill
   - reversible exchange
   - transformation after standby or finish
   - exclusive skill orb acquisition

## Migration note for the Android app

The app should gradually move toward these structured fields first:

1. `standby`
2. `finishSkills`
3. `reversibleExchange`
4. `transformations[].transformationSource`
5. `obtainability`
6. `exclusiveSkillOrbs`

Once those are consumed directly by the app, the old flattened compatibility fields can start disappearing without drama.
