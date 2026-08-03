# Team Analysis Identity Audit

**Audited:** 2026-08-03
**Character dataset:** `2026-07-20T20:22:44.502Z`
**Character payload SHA-256:** `a92d451e771a170d3aeffc36aaf47d97dc4538f68f3d1aa2edef9eb196930d72`

## Observed source fields

The Dokkan.fyi character detail payload exposes four numeric identity fields:

- `id`: the concrete card or battle-form record;
- `canonical_id`: an explicit canonical character-variant relation;
- `character_id`: the game character identity, which can be broader than a
  display-name variant and is retained as `gameCharacterId`;
- `base_character_id`: the source awakening-line root.

The compact catalog retains all four as `id`, `canonicalId`, `characterId`, and
`baseCharacterId`. The current app-facing `Character` payload retains `id` for
the recruitable root and each `Transformation.id`, plus the structural
root-to-form relation. It currently drops the other three raw identity fields.

The audited catalog has 1,432 recruitable roots, 644 canonical IDs, 849 game
character IDs, and 1,416 awakening-family IDs. None of these catalog identity
fields is missing. The character payload has 191 additional forms: 92 passive
forms, 66 active-skill forms, 15 reversible exchanges, 14 standby forms, and 4
finish-skill forms.

## Normalized identity decision

- `characterId`: the root `Character.id`, representing the recruitable card;
- `formId`: root `Character.id` or the related `Transformation.id`;
- `stateKey`: `{characterId}:{formId}:{releaseState}`;
- `hardDuplicateGroupId`: `card:{characterId}` for the root and every related
  transformation, exchange, standby, finish, and release state;
- `variantGroupId`: `canonical:{canonicalId}` only when `canonical_id` is
  present in the matched catalog entry;
- `awakeningFamilyId`: `awakening:{baseCharacterId}` from the recruitable root's
  catalog entry;
- `releaseState`: `seza` when `sezaReleaseDate` exists, otherwise `eza` when
  `ezaReleaseDate` exists, otherwise `initial`.

`canonicalId`, `gameCharacterId`, and `baseCharacterId` are also retained in
each analysis state as source traceability. They do not replace the hard
duplicate identity.

The root relation is required for `hardDuplicateGroupId` because form records
such as standby target `4029481` expose their own `base_character_id`; using
that field directly would incorrectly split one recruitable card across hard
duplicate groups.

## Variant omission rule

No production catalog entry currently requires omission because every audited
root has `canonical_id`. The generator nevertheless omits `variantGroupId` when
the matched catalog entry or its canonical ID is absent. It never falls back to
name, title, portrait, passive text, or another display field. Golden fixtures
cover two equal display names with no canonical source relation and require
both variant groups to remain absent.

## Current state projection boundary

The audited character payload projects the latest released passive per form.
It yields 1,623 states: 969 initial, 620 EZA, and 34 SEZA, with 1,556 non-empty
passives. The raw source exposes an initial passive and one current extreme-Z
passive; for SEZA cards it does not expose the intermediate historical EZA
passive separately. This slice therefore emits the exact current release state
present in the compatible character payload and does not fabricate missing
historical states. When another compatible character payload explicitly
provides `ezaPassive`/`ezaPassiveDetails` or `sezaPassive`, the same generator
emits those additional release states with the unchanged hard-duplicate group.
