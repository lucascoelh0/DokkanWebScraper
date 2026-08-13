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

## State projection boundary

The 2026-08-03 audited analysis artifact yielded 1,623 states: 969 initial,
620 EZA, and 34 SEZA, with 1,556 non-empty passives. Those counts describe
that historical artifact, not the current Characters release or the pending
replacement Team Analysis artifact.

The Dokkan.FYI character mapper now
preserves the raw initial combat fields as BASE and projects the one current
extreme-Z state into the compatible EZA or SEZA fields. For SEZA cards the raw
source still does not expose the intermediate historical EZA passive
separately. The analysis generator therefore emits every explicit compatible
release state and does not fabricate that missing intermediate passive. All
states retain the unchanged hard-duplicate group.

The compatible character-field projection is:

- `leaderSkill`, `passive`, and base super-attack fields are INITIAL/BASE;
- `ezaLeaderSkill` and EZA super-attack fields come only from an explicit
  extreme-Z payload (and remain the applicable leader/super-attack facts for a
  SEZA card, because SEZA changes the passive only);
- `ezaPassive` is emitted only when the latest explicit state is EZA;
- `sezaPassive` and `sezaPassiveDetails` are emitted only when the latest
  explicit state is SEZA;
- the generator consumes SEZA passive details and keeps their conditions and
  structural provenance on the SEZA state;
- EZA Super Attack and Ultra Super Attack fields remain attached to a SEZA
  state because SEZA changes only the passive in the available source;
- the mapper does not project BASE facts into awakened character fields when
  the release-state label is unknown or the extreme-Z payload is missing.

## Current delivery lineage

The public Characters release is `2026-08-13T03:49:01.219Z`, with payload
SHA-256
`de6268219039f0bbafda7b01b473e957e0cd5442682caab361a32470a2a2e899`,
1,436 characters and 1,627 structural states. Its K15 overlay changed only 189
missing rarities within the same collection baseline. The full delta from the
previous public release additionally contains the BASE/EZA/SEZA projection
changes, 720 modified states, two added states, two removed states and 111
changed portrait references.

The public Team Analysis manifest still points to the 2026-08-04 Characters
lineage and reports 1,625 states. It is therefore incompatible with the
current Characters payload under Android's exact source-version and
source-SHA checks. Regeneration must use the exact public Characters gzip and
must let the generator derive its own state count; the Characters structural
state count is not a forced Team Analysis count.
