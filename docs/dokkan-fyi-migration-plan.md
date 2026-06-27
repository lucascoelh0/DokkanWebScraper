# Dokkan.fyi migration plan

This document records the intended migration from the current `dokkaninfo.com`-based scraper to a `dokkan.fyi`-based pipeline.

The goal is not a one-to-one port of old scraping code. The goal is to end up with a cleaner, more maintainable data contract for Dokkanpanion while the app still has no active user base and can safely evolve.

The detailed target contract now lives in:

- `docs/specs/dokkan-fyi-character-contract.md`

The planned auxiliary datasets around that core contract now live in:

- `docs/specs/dokkan-fyi-auxiliary-datasets-plan.md`

## Why migrate

`dokkan.fyi` looks like the better long-term source for this project because:

- it exposes richer structured JSON directly in the page payload
- it includes mechanics that were painful to reconstruct from DokkanInfo
- it provides official-looking state transitions for standby, transformations and reversible exchange
- it is easier to validate against the rendered site because most of the page is already backed by JSON

## Migration stance

We are intentionally **not** optimizing for backward compatibility with every legacy quirk in the old dataset.

Current preferred direction:

- keep only the **latest relevant playable state** for each card line as the primary card dataset
  - initial if the card has no EZA/SEZA
  - EZA if the card has EZA
  - SEZA if the card has SEZA
- do not preserve intermediate Z-Awaken-only duplicates just to mirror old app behavior
- preserve real alternate states that matter to gameplay:
  - transformations
  - standby states
  - post-standby transformations
  - reversible exchange
  - active skills
  - domains
  - unit attacks
  - EX attacks

Because the app has not been relaunched yet, we can afford to improve the contract now instead of dragging legacy compromises forward.

## What the experiment already proved

The experimental scraper in:

- `fyi-scraper.ts`
- `fyi-experiment.ts`

already proved that `dokkan.fyi` can cover, at minimum:

- latest awakening state selection
- transformation paths
- standby paths
- reversible exchange
- active skills
- EX super attacks
- unit super attacks
- leader skill parsing using the existing structured parser

The main missing piece discovered during the first spike was `finish skills`.

That gap is now understood better:

- `finish skills` are not attached to the standby transformed card page
- they are exposed on the **base card payload** under `character.standby_skill.finish_skills`
- the standby target can be resolved from `character.standby_skill.effects[].transformation.character.id`
- some finish skills can themselves trigger another transformation, exposed through `finish_skill.effects[].transformation.character.id`

This means a single-source `dokkan.fyi` migration is viable.

## Target data model direction

The current app contract still contains some fields that flatten rich mechanics into plain strings.

For the migration, prefer moving toward structured objects first and only flattening to strings where the current app still needs it.

### Keep

Keep these concepts in the contract:

- base character record
- transformations
- leader skill details
- passive details split into sections
- portrait/art references
- release dates

### Improve

These areas should become more structured:

#### Obtainability / free-to-play state

The app should know whether a character line is:

- summonable
- freely obtainable
- a stage reward
- a World Tournament reward

Recommended direction:

- keep `summonable` / `isSummonable` for legacy compatibility if needed
- add a structured obtainability field as the source of truth
- expose a convenience boolean for `isFreeToPlay`

Suggested shape:

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

Notes:

- for the examples inspected so far, `dokkan.fyi` already exposes `is_freely_obtainable` on later awakened states too, not only on the first base rarity page
- exact acquisition sources still deserve their own dataset later
- this field will also help future training-partner logic on the app side

#### Reversible exchange

Reversible exchange should not live only as a generic transformation entry.

The app will likely want to render it as its own mechanic block, just like `dokkan.fyi` does.

Recommended direction:

- keep the exchange counterpart inside the transformation path
- also expose a dedicated `reversibleExchange` object on the current state

Suggested shape:

```ts
interface ReversibleExchangeDetails {
  targetCharacterId: string
  targetCharacterName?: string
  condition: string
}
```

Notes:

- this is especially important for tag units
- some tag units also have later transformations, so the app should support:
  - reversible exchange
  - transformation after exchange
  - both mechanics on the same card line

#### Standby

Current field:

- `standbySkill: string`

Preferred direction:

- `standbySkillName`
- `standbySkillDescription`
- `standbySkillCondition`
- `standbyTargetCharacterId`

The old string can still be derived for UI compatibility.

#### Finish skills

Current field:

- `finishingMove: string[]`

Preferred direction:

- `finishSkills: FinishSkill[]`

Suggested shape:

```ts
interface FinishSkill {
  id?: string
  name: string
  description: string
  condition: string
  targetTransformationId?: string
  effectKind?: "damage" | "buff" | "transform" | "mixed" | "unknown"
}
```

Notes:

- `targetTransformationId` is important for cases like Jiren where one finish skill transitions into another form
- the existing `finishingMove: string[]` can remain temporarily as a derived legacy field if the app still depends on it

#### Transformation metadata

Current direction is already close, but we should preserve source semantics:

- normal transformation
- standby transformation
- reversible exchange
- finish-triggered transformation

Suggested addition:

```ts
type TransformationSource =
  | "transformation-path"
  | "standby"
  | "reversible-exchange"
  | "finish-skill";
```

This will make app-side rendering and linking logic far less brittle.

## Proposed migration phases

### Phase 1: finish the experimental scraper

Goal:

- make the `dokkan.fyi` experiment mechanically complete enough to judge the source fairly

Tasks:

1. map `standby_skill.finish_skills`
2. attach each finish skill to the corresponding standby transformation
3. resolve finish-skill-triggered transformations when present
4. add focused tests for:
   - Gohan standby + multiple finish skills
   - Jiren standby + finish skill that transforms again
   - one simple standby finisher like Piccolo

Exit criteria:

- experiment output includes standby and finish data correctly for known sample cards

### Phase 2: define the new stable dataset contract

Goal:

- decide what the scraper should publish as the long-term app contract

Tasks:

1. document which legacy fields stay
2. add new structured fields for standby / finish / transformation source
3. decide which fields are derived convenience fields versus source-of-truth fields
4. update tests around the contract

Exit criteria:

- one documented contract that both scraper and app can target

### Phase 3: adapt the Android app to the new contract

Goal:

- stop forcing the scraper to mimic old UI shortcuts where better structured data exists

Tasks:

1. update deserialization models
2. update UI rendering for:
   - standby blocks
   - finish skills
   - transformation chains
3. keep old fallback rendering only where still useful during migration

Exit criteria:

- app renders the new source data without needing scraper-side hacks

### Phase 4: full-source validation

Goal:

- make sure `dokkan.fyi` is trustworthy for a complete publish flow

Tasks:

1. run a larger scrape
2. compare coverage with the current DokkanInfo dataset
3. spot-check:
   - new releases
   - EZA / SEZA latest-state selection
   - standby units
   - exchange units
   - transformation chains
   - links, categories, leader skills, passives
4. verify portrait/art URL consistency

Exit criteria:

- no blocker remains that would force a dual-source architecture

### Phase 5: replace the production path

Goal:

- make `dokkan.fyi` the default pipeline

Tasks:

1. swap the default scraper entrypoint
2. update publish flow to use the new dataset
3. keep the old DokkanInfo implementation only as a temporary fallback until confidence is high
4. remove the old path when it is clearly dead weight

Exit criteria:

- official published dataset comes from `dokkan.fyi`

## Validation strategy

Use layered validation instead of trusting one happy-path scrape:

### Unit tests

Focus on:

- latest awakening state selection
- attack slot selection
- standby target resolution
- finish-skill attachment
- finish-triggered transformation resolution

### Golden-card checks

Keep a curated list of cards that cover the mechanics we care about:

- normal transformations
- tags
- tag + transformation
- standby
- standby + post-standby transformation
- active skill
- reversible exchange
- EX attack
- unit attack
- EZA
- SEZA

### App smoke tests

After contract changes, verify at least:

- character detail page
- transformation rendering
- linking partners still behave correctly
- leader skill simulator still parses the expected summary fields

## Risks

### 1. Overfitting to the current experimental contract

Risk:

- we preserve legacy string fields too long and miss the chance to simplify the app

Response:

- treat the experiment as proof-of-source, not proof-of-final-contract

### 2. Hidden source gaps

Risk:

- some edge mechanics may exist visually on `dokkan.fyi` but be harder to recover from payloads than they first appear

Response:

- keep a mechanic coverage checklist
- do not switch production until the checklist is green

### 3. Transformation semantics becoming ambiguous in the app

Risk:

- if all alternate states are flattened into one generic list, the UI will lose meaning

Response:

- preserve transformation source/type metadata explicitly

## Recommended next step

The next best step is:

1. implement `standby_skill.finish_skills` in `fyi-scraper.ts`
2. attach them to the standby transformation target
3. add tests for Gohan and Jiren

That work will answer the biggest remaining source question before we touch the Android app contract.

## Future enrichment backlog

Once the core character migration is stable, the next wave of work should add richer cross-page data instead of forcing everything into the base character payload.

The important rule here is:

- keep the **character scraper** focused on character-native data
- add **adjacent datasets** for support memories, medals, events and other reusable resources
- join those datasets at publish time or app-consumption time where appropriate

### 1. Exclusive Skill Orbs

Status:

- already exposed directly on the `dokkan.fyi` character payload as `character.skill_orbs`

What is already available there:

- orb id
- name
- description
- grade
- reusable flag
- icon/image id
- stat/skill entries
- mission reward summary
- shop items

Why this is a strong near-term target:

- it is already character-scoped
- it already contains meaningful acquisition hints
- it does not require a second source just to become useful

Recommended contract direction:

```ts
interface CharacterExclusiveSkillOrb {
  id: string
  name: string
  description: string
  grade?: string
  reusable?: boolean
  iconImageId?: string
  skills: CharacterExclusiveSkillOrbSkill[]
  acquisition?: CharacterExclusiveSkillOrbAcquisition[]
}

interface CharacterExclusiveSkillOrbSkill {
  id?: string
  attribute?: string
  level?: number
  hiddenPotentialSkillId?: number | null
}

interface CharacterExclusiveSkillOrbAcquisition {
  sourceType: "mission-reward" | "shop-item" | "unknown"
  missionId?: string
  missionCategoryId?: string
  bannerImageUrl?: string
  quantity?: number
  note?: string
}
```

Follow-up later:

- scrape stages / missions so orb acquisition can link to exact events instead of only showing the mission-category shell

### 2. Training Partners

Status:

- visible on the character page UI
- not currently present in the JSON payload we inspected for the character page

Implication:

- this may end up being driven more by **our own app logic** than by scraping the rendered section directly
- likely inputs for that logic:
  - `isFreeToPlay`
  - character identity / shared name lineage
  - obtainable forms in the same awakening line
  - future event/acquisition datasets

Recommended contract direction:

```ts
interface TrainingPartnerGroup {
  rarity: string
  successRate?: number
  partners: TrainingPartner[]
}

interface TrainingPartner {
  characterId: string
  name?: string
  rarity?: string
  type?: string
  isFarmable?: boolean
  portraitURL?: string
}
```

Priority:

- medium
- useful for the app, but should wait until the core `dokkan.fyi` character path is fully stable and the obtainability model is settled

### 3. Applicable Support Memories

Status:

- character page UI shows applicable support memories
- support memories also have their own dedicated listing page at:
  - `https://dokkan.fyi/support-memories`

What the support memory listing already exposes:

- support memory id
- name
- description
- support film
- cost
- lasts entire battle flag
- release date
- enhancement chain
- support memory skills / effect payload

Recommended architecture:

- do **not** scrape applicable support memories only from character pages
- instead create a dedicated support memory dataset
- then determine applicability either:
  - from explicit support-memory target metadata if available
  - or from derived matching rules if the dataset is expressive enough

Recommended contract direction:

```ts
interface SupportMemory {
  id: string
  name: string
  description: string
  filmId?: string
  filmName?: string
  cost?: number
  lastsEntireBattle?: boolean
  releaseDate?: string
  enhancementChain?: SupportMemoryEnhancementStep[]
  effects?: SupportMemoryEffect[]
}

interface ApplicableSupportMemoryReference {
  supportMemoryId: string
  name: string
  description: string
  lastsEntireBattle?: boolean
}
```

Priority:

- high after the core character migration
- because it naturally wants its own dataset and benefits the team-building side of the app too

### 4. Awakening Path

Status:

- visible in the character UI
- not currently exposed in the top-level character payload we inspected
- likely depends on medal metadata and possibly separate item/stage pages

Recommended architecture:

- split this into:
  - character awakening path references
  - medal dataset
  - acquisition dataset for medals/events/stages

Recommended contract direction:

```ts
interface AwakeningPathStep {
  fromCharacterId: string
  toCharacterId: string
  awakeningKind: "z-awaken" | "dokkan-awaken" | "extreme-z-awaken" | "super-extreme-z-awaken" | "unknown"
  medals: AwakeningMedalRequirement[]
}

interface AwakeningMedalRequirement {
  medalId: string
  name?: string
  quantity: number
}
```

### 5. Medal dataset

Status:

- needed if we want awakening paths to be actually useful
- should eventually answer:
  - where to get a medal
  - which characters use it
  - possibly which event or stage drops it

Recommended contract direction:

```ts
interface AwakeningMedal {
  id: string
  name: string
  imageUrl?: string
  acquisitionSources?: AcquisitionSource[]
  usedByCharacterIds?: string[]
}
```

Priority:

- medium-high
- because it unlocks awakening path, item pages and event linking all at once

### 6. Event / acquisition dataset

Status:

- this becomes more important once we start showing where to obtain:
  - skill orbs
  - medals
  - support memory materials

Recommended scope:

- event pages
- stage pages
- mission reward metadata
- item reward metadata

This dataset should eventually power:

- orb acquisition details
- medal acquisition details
- support-memory upgrade material sourcing

## Contract implications to keep in mind now

Even before we implement the backlog above, the character contract should stay open for these joins.

That means:

- prefer stable ids over display-only strings
- use reference objects for cross-page resources
- keep room for acquisition metadata
- avoid baking UI-specific formatting into source-of-truth fields

Good examples:

- `finishSkills[].targetTransformationId`
- `standby.targetCharacterId`
- future `exclusiveSkillOrbs[].id`
- future `applicableSupportMemories[].supportMemoryId`
- future `awakeningPath[].medals[].medalId`

## Recommended order after the core migration

After the base `dokkan.fyi` character migration is solid, the recommended order is:

1. exclusive skill orbs
2. support memories dataset
3. stable app contract adoption
4. awakening path + medal dataset
5. event / acquisition enrichment
6. training partners

Why this order:

- orbs are already in the character payload and are the cheapest win
- support memories have a dedicated page and want their own clean dataset
- awakening path becomes much more useful once medals and acquisition sources exist
- training partners look valuable, but the source is still less clear than the others
