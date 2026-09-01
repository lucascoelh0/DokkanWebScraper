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
  --previous-dataset <support-memory-details.json> \
  --characters <characters.json-or-gzip> \
  --output-dir <candidate-directory>
```

It emits the consumer payload, a field-scoped provenance audit, and a manifest
with exact file sizes and SHA-256 values.

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
  replace matching legacy facts. Existing navigation, stage references, and
  images remain presentation-only enrichment when available.
- Enhancement requirements come from
  `support_memory_enhancement_require_items`; official quantities overwrite
  matching legacy asset presentation. Level descriptions come from each
  official memory variant.

## Authority boundary

First-party authority owns identity, copy, film, cost, unlock quantity, release
date, enhancement chain, effects, duration, category targets, applicable card
IDs, mission facts, and enhancement quantities. DokkanInfo still supplies
presentation assets and links until the game asset API is projected. Those
fields are explicitly reported as `legacy-presentation-only`; they are not used
to decide gameplay targets or effect semantics.

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
types, broken enhancement chains, invalid source identity, and an invalid
consumer Character artifact. The comparison report lists added/removed roots,
core changes, and semantic category-set changes against the previous payload.

Publishing remains a separate, explicitly authorized action. Before release,
the remaining first-party asset acquisition gap must be closed or consciously
accepted, the real candidate must pass Android parsing/rendering, and the
publisher's normal dry-run and storage checks still apply.
