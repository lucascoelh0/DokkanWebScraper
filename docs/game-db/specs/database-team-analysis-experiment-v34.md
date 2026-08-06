# Database Team Analysis experiment v34 (DB35)

Status: experimental, non-production. Contract version: `0.34.0`.

DB35 binds `passive_skills.target_type` to `PassiveSkill +0x40`, `CreateAbilityStatusEfficacy +0x24`, `AbilityStatusEfficacy +0xe0`, its vtable getter and the 17-slot native target dispatch. The contract supports every value present in projected passive rules:

- `1`: ability owner;
- `2`: player party, deck indices 0–6;
- `3`: runtime-selected enemy, with the owner-target fallback when the stored target is negative;
- `4`: every current enemy in native vector order;
- `12/13`: player party filtered by raw awakening-class predicates `{1,3}` / `{2,3}`;
- `14/15`: current enemies filtered by the same respective predicates;
- `16`: player party excluding the ability owner's deck index for projected category-0 passives.

The Super/Extreme labels reuse the already confirmed first-party awakening-class mapping, while preserving the raw predicate sets including dual-class value `3`. Handler names alone are not evidence: validation pins the SQLite literal, object field chain, target getter relocation, dispatch instructions/table relocations, every handler body, class-predicate implementations and selection helpers.

`selfInclusion` describes structural membership in the handler's candidate set before sub-target filtering. It does not claim that the owner or any other candidate reaches the efficacy callback.

All supported handlers invoke `containsSubTargetType` before their callback. DB35 proves that control-flow position but does not yet bind SQLite `sub_target_type_set_id` through the runtime object into that predicate. The SQLite ID stays raw with `runtimeAssociation: unknown`; value types, boolean composition and empty-set behavior also remain for DB36. Target, timing, operation, unit, calculation bucket and lifecycle remain independent dimensions.

Slots absent from projected passive rules are not promoted. Slot `6` is explicitly null; out-of-range values remain unknown. Payload validation is lossless and unknown-safe, goldens cover all nine present values plus null/out-of-domain/invalid values, and two generations must be byte-identical without modifying SQLite or ELF sources.
