# First-party Support Memory candidate

## Scope

This contract replaces Support Memory gameplay authority from Dokkan.fyi with
rows exported from the Global game database. It is a local candidate lane: it
does not publish, promote, or mutate R2. The Android wire shape remains
`support-memory-details.json`, so old caches and consumers continue to decode
the same fields.

The candidate command is:

```text
npm run run:game-db-support-memory-candidate -- \
  --source-data-dir <first-party-export/data> \
  --source-snapshot-version <numeric-version> \
  --source-database-sha256 <sha256> \
  --characters <characters.json-or-gzip> \
  --source-assets-dir <official-cpk-bundle> \
  --asset-source-identity <source-identity.json> \
  --asset-output-dir <data/support-memories/assets/game/version> \
  [--previous-dataset <support-memory-details.json>] \
  --output-dir <candidate-directory>
```

It emits the consumer payload, field-scoped database and asset provenance
audits, and a manifest with exact file sizes and SHA-256 values. The optional
previous dataset is comparison-only. No field from it may enter the candidate.

The official bundle is acquired from a rooted emulator before candidate
generation:

```text
npm run run:game-db-support-memory-assets-acquire -- \
  --device-serial <adb-serial> \
  --source-data-dir <first-party-export/data> \
  --snapshot-version <numeric-db-version> \
  --asset-version <numeric-asset-version> \
  --output-dir <new-source-bundle-directory> \
  --cpk-extractor <pinned-CriFsV2Lib-extractor.dll-or-exe> \
  --cpk-reader-commit <40-character-commit>
```

The command obtains Android package identity, derives the exact numeric
animation archive set from root `script_name` values, pulls each official CPK
through rooted ADB without shell redirection, extracts it, and writes the source
identity. Both acquisition and candidate output directories must be new.

## First-party joins

- Root identities are `support_memories` rows that are not referenced as an
  `enhanced_support_memory_id`.
- Level order and maximum level come from
  `support_memory_enhancement_levels`. Chains must be contiguous from level 2,
  and every edge must resolve to existing memory rows.
- Effects preserve the structural values from `support_memory_skills`:
  efficacy, values, target, calculation, turn, and probability.
- Film identity and copy come from `support_films`.
- Category and character applicability come from each skill's
  `sub_target_type_set_id`, joined to `sub_target_types`.
  Value types 1/2 include/exclude `card_categories`; value types 4/5
  include/exclude `card_unique_info_set_relations`. Filters inside a set are
  applied in game order as an AND chain, while different skill effects are
  unioned. Unknown value types fail the candidate.
- Applicability is intersected with the exact Character artifact supplied to
  the command. This prevents unused awakenings or stale DB card rows from
  leaking into the Android contract.
- Mission acquisition facts are joined through `mission_rewards`, `missions`,
  and `mission_categories`. Official title, description, quantity, and dates
  are the complete acquisition projection. A missing official join remains
  absent and is counted as unresolved; it is never filled from the comparison
  dataset.
- Enhancement requirements come from
  `support_memory_enhancement_require_items`; quantities and item identities
  are first-party. Level descriptions come from each official memory variant.
- Presentation bytes come from the installed Global game's official CPKs:
  `item/support_memory.cpk`, `item/support_memory_enhancement.cpk`, and one
  `ingame/battle/effect/support_memory_<script-id>.cpk` per root. Archives and
  every extracted/output file are inventoried by size and SHA-256. Animation
  joins use `support_memories.script_name`, including the non-identity
  `20011 -> sm20010` case.

## Authority boundary

First-party authority owns identity, copy, film, cost, unlock quantity, release
date, enhancement chain, effects, duration, category targets, applicable card
IDs, mission facts, enhancement quantities, images, film icons, enhancement
icons, and animation assets. The wire property remains named `dokkanInfo` only
to preserve Android 2.0.11 compatibility. Entries mark the replacement content
with `presentationSource: "game-assets"`; `detailUrl`, `remoteUrl`, legacy
navigation, stage references, and community URLs are empty or absent.

Each projected entry carries `categoryTargetSource` and
`applicableCharacterSource` as `game-db-structural`. Current Android trusts the
structural category fields only with that marker. Old cached/community entries
have no marker and retain the narrow text-derived compatibility fallback; old
Android builds ignore the additive fields.

`lastsEntireBattle` is true for the game's unbounded `turn = -1` encoding and
for the official 3000/4000-turn novelty memories, matching the existing product
contract. All other duration values remain lossless in each effect.

## Fail-closed gates

Generation rejects duplicate row identities, malformed numeric/JSON fields,
missing films/categories/target sets, orphan skills, unknown structural target
types, broken enhancement chains, invalid source identity, incomplete CPK or
extracted inventories, missing presentation assets, unsafe paths, and an
invalid consumer Character artifact. Database validation runs before the
versioned asset directory is created. The comparison report lists
added/removed roots, core changes, and semantic category-set changes against
the previous payload.

Publishing remains a separate, explicitly authorized action. Before release,
the real candidate must pass Android parsing/rendering and the publisher's
normal dry-run, remote preflight, storage projection, upload, and read-back
checks.
