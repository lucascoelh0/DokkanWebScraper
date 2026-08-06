# Database Team Analysis experiment v35 (DB36)

Status: experimental, non-production. Contract version: `0.35.0`.

DB36 binds `passive_skills.sub_target_type_set_id` to `PassiveSkill +0xb8`, `SkillModel::getSubTargetTypesBySetId`, the native SQLite query over `sub_target_types`, `CreateAbilityStatusEfficacy +0x30`, `AbilityStatusEfficacy +0xe8`, its vtable getter and the singleton-candidate membership predicate.

The runtime copies the candidate vector and replaces it with each filter result, proving AND composition. Empty sets are identity. Current projected passive rules use only:

- `1`: include card category ID;
- `2`: exclude card category ID;
- `4`: include card unique-info set ID;
- `5`: exclude card unique-info set ID.

Unique-info sets are joined through `card_unique_info_set_relations(card_unique_info_set_id, card_unique_info_id)` and the runtime compares those members with `Card::getCardUniqueInfoId`. Value `3` constructs `SubTargetCardMetamorphicType` but remains partial and is absent from the projected passive corpus. Values outside `1..5` remain unknown.

The contract preserves SQLite row IDs, raw enum/value pairs, dictionary rows, runtime symbols/VMAs/hashes and every independent target/timing/operation/bucket/lifecycle boundary. It does not reinterpret localized text or parser output.

## Snapshot coverage and validation

- 14,301/14,301 rules reconstruct losslessly and are supported.
- 847 rules use nonempty sets: 844 passive IDs, 286 states and 194 distinct nonzero sets.
- 13,454 rules use a proved empty-set identity.
- Current rule counts by value type are `1=769`, `2=154`, `4=72`, `5=18`; value type `3` has no projected occurrence.
- The artifact is generated twice with identical JSON and gzip bytes; its SHA-256 is recorded in the DB36 manifest.
- The source database is opened read-only and its SHA-256 is verified unchanged after generation.
