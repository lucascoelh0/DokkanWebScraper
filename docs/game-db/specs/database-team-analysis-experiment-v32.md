# Database Team Analysis experiment v32 — DB33

DB33 adds one versioned overlay over DB32 and promotes only
`passive_skills.exec_timing_type = 4` to the bounded native event
`player_attack_setup`.

The proof reuses the already pinned SQLite-to-runtime timing field chain and
equality filter from DB32. It then pins three calls inside
`PlayerAttackDamageAndActionBank::setup` that place literal `4` in timing
argument register `w3`. Their other raw arguments are preserved as
`(skill_category, skill_type) = (0,2), (0,11), (1,10)`. Each returned result is
consumed while the setup result is assembled. A controller path calls setup
before passing that result to `TrySpecialAttackAll`; additional callers cover
extra-attack and counter-attack setup.

DB33 also proves that the `(0,2)` call covers every projected passive status.
The complete native reference scan finds three callers of the public passive
creator, and each passes raw category `0`. Its `AbilityManager` vtable slot
forwards that category to the shared creator, which writes literal SkillType
`2` for every `AbilityStatusPassive`. The base constructor copies both values
to the runtime fields, the passive vtable resolves their getters, and the
execution filter compares them to the requested category/type. Thus the first
timing-4 call `(0,2)` reaches the DB11/DB32 passive row population; the other
two calls remain preserved as distinct raw variants rather than being used to
justify coverage.

The event name is intentionally narrower than `when_attacking` or
`before_attacking`. DB33 does not assert that an attack has executed, landed,
dealt damage, or entered a particular calculation bucket. Unit, target,
duration, recurrence, stacking, `is_once`, and `turn` stay unknown.

The overlay preserves DB31 calculation operations and DB32 timing-1 records
byte-for-byte at the record level. It rejects a DB32 artifact from another
database or runtime, validates exact native symbols/VMAs/sizes/code hashes and
call-site instruction bytes, rebuilds losslessly, and remains deterministic.
