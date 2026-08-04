# Team Analysis Gate A5 Audit

**Baseline commit:** `ad60cfc`
**Character dataset:** `2026-08-03T22:41:40.735Z`
**Character payload SHA-256:**
`a5a2a6b5f4821ff6e9d7d56cc0d56776a98843413ebf3f920a71b63cf14e4938`
**Schema:** `1`
**Parser:** `1.5.0`

## 1. Real-data audit before parsing

The audit traversed the baseline `team-analysis.json.gz` condition AST,
effects, and source fragments. Counts below are rule occurrences, not unique
passive strings: a section header intentionally appears once for every effect
rule governed by that header.

The broad Ki/Ki-Sphere filter found 1,441 unknown condition occurrences and
550 unknown effect occurrences. The most frequent exact syntaxes were:

| Family | Baseline examples | Occurrences |
| --- | --- | ---: |
| final attack Ki lower bound | `When attacking with 12 or more Ki` | 507 |
| final attack Ki lower bound | `When attacking with 18 or more Ki` | 93 |
| final attack Ki exact | `When attacking with 24 Ki` | 47 |
| per-sphere header, any | `For every Ki Sphere obtained` | 127 |
| per-sphere header, Rainbow | `For every Rainbow Ki Sphere obtained` | 68 |
| collected-sphere threshold | `3 or more Ki Spheres obtained` | 55 |
| collected-sphere threshold | `5 or more Ki Spheres obtained` | 33 |
| collected-sphere threshold | `7 or more Ki Spheres obtained` | 23 |
| collected-sphere threshold | `6 or more Ki Spheres obtained` | 18 |
| Rainbow presence/count | `1 or more Rainbow Ki Spheres obtained` | 17 |
| inline scaling, any | `per Ki Sphere obtained` | 70 |
| inline scaling, Rainbow | `per Rainbow Ki Sphere obtained` | 33 |
| inline scaling, colored Type | `per Type Ki Sphere obtained` | 19 |
| random Type conversion | `...a certain Type to Rainbow Ki Spheres` | 44 |

Less frequent but semantically distinct groups included AGL/TEQ/INT/STR/PHY
counts and scaling, `With a ... Ki Sphere obtained`, `Type Ki Sphere`
(non-Rainbow), multi-color selectors, exact `Changes Ki Spheres: X to Y`,
`All to X`, caps, inline attack-Ki suffixes, and malformed/wrapped clauses.
No real passive used an unambiguous board-count condition; board context in
this slice is therefore emitted only for conversion effects. Closed Ki ranges
are covered synthetically because the contract requires the shape even though
the audited payload has no exact range wording.

## 2. Contract decisions

- `ki_amount` means final Ki of the current attack only. It requires
  `kiContext: "final_attack_ki"`, self scope, an explicit comparator, and an
  attack evaluation moment.
- `ki_spheres_obtained` is an explicit count from the current collection.
- `ki_sphere_type_obtained` is presence (`gte 1`) in the current collection.
- `KiSphereType` is separate from character `TeamAnalysisType` and supports the
  five colors, `rainbow`, `non_rainbow`, and `any`.
- Source wording `Type Ki Sphere` maps to `non_rainbow`; `any` is used only
  when the text does not restrict color.
- Ranges are an `all` AST of scalar bounds. No `N + 1` rewrite is performed.
- `PassiveEffectScaling` stores the matching sphere selector and
  `spheresPerIncrement`; the typed effect's `value` remains the increment and
  `stackCap` remains a separate cap on that effect.
- `KiSphereChange` separates source selection (`listed_types`, `all`, or
  `random_type`), concrete destination, exclusions, and `board_state` context.
- A conversion effect uses the self effect channel even when a compound source
  line also contains an enemy-targeted effect.

All additions are optional enrichment or previously reserved predicate/effect
kinds. Existing serialized meanings are unchanged, so `schemaVersion` remains
`1`; `parserVersion` advances from `1.4.1` to `1.5.0`.

## 3. Recognized families

- final attack Ki: exact, `or more`/`at least`, `or less`/`at most`, and closed
  intervals;
- current collection: explicit counts and presence for any, five colors,
  Rainbow, non-Rainbow/`Type`, and explicit color alternatives;
- boolean composition with existing Category/Name/Class/Type/slot/HP/turn/enemy
  predicates, retaining AND/OR grouping;
- header and inline per-sphere scaling for existing typed effects, including
  Ki, HP, ATK, DEF, critical, evade, damage reduction, guard, and additional
  attacks when the underlying atom is already recognized;
- numeric caps attached to the scaled effect;
- direct listed/all conversions and random-Type conversions with explicit
  destination and optional concrete Type exclusions;
- wrapped source lines through the existing lossless source map.

## 4. Conservative fallbacks

The parser deliberately leaves these unresolved:

- bare `When Ki is ...` or `with ... Ki` without proof that the value is final
  attack Ki;
- Ki involved in attacks received, Ki Blast attacks, attack history, collection
  order, or `For every Ki when attacking`;
- sweet-treat/item spheres and Dragon Ball sphere exclusions;
- `non-AGL`/`non-TEQ` selectors whose inclusion of Rainbow is not proven by the
  current contract;
- count offsets such as `count starts from the 4th Ki Sphere`;
- choice rules such as “whichever sphere is collected more”;
- chance-qualified conversions until that activation family has validated
  probability evidence;
- conversions to “another Type”, “any 1 type”, multiple alternative
  destinations, temporary/next-turn conversion windows, and conditional
  conversions whose condition cannot be cleanly separated;
- board/path simulation, averages, and any assumption of 24 Ki.

After Gate A5, the broad residual filter contains 151 unknown Ki-related
condition occurrences and 77 unknown Ki-related effect occurrences, down from
1,991 to 228 occurrences (-1,763; -88.5%). The largest residual groups are Ki
Blast/received-attack mechanics, collection position, ambiguous bare Ki phase,
count offsets, item spheres, and probabilistic/temporal conversions.

## 5. Coverage delta

| Metric | Gate A4.1 | Gate A5 | Delta |
| --- | ---: | ---: | ---: |
| supported passive states | 235 | 400 | +165 |
| partial passive states | 1,312 | 1,150 | -162 |
| unknown passive states | 11 | 8 | -3 |
| supported rules | 4,269 | 5,844 | +1,575 |
| partial rules | 4,792 | 3,273 | -1,519 |
| unknown rules | 256 | 200 | -56 |
| supported conditions | 5,493 | 6,837 | +1,344 |
| partial conditions | 183 | 276 | +93 |
| unknown conditions | 3,641 | 2,204 | -1,437 |
| supported effects | 7,225 | 7,765 | +540 |
| partial effects | 1,266 | 976 | -290 |
| unknown effects | 826 | 576 | -250 |
| unknown effect atoms | 2,116 | 1,571 | -545 |
| unknown source fragments | 6,174 | 4,424 | -1,750 |
| runtime-containing rules | 0 | 1,213 | +1,213 |

Typed Gate A5 output contains 867 `ki_amount`, 345
`ki_spheres_obtained`, and 35 `ki_sphere_type_obtained` predicate occurrences;
525 typed scaled-effect contributions; and 257 conversions (110 listed source,
7 all-source, 140 random-Type). Scenario-evaluable rules decrease from 1,573
to 1,544 because 29 rules previously evaluable from scenario inputs alone are
now correctly known to require Ki runtime context as well. This is a semantic
correction, not a regression to false/unknown coercion.

## 6. Artifact and determinism

Final artifact:

- compressed: `852,372` bytes;
- uncompressed: `16,813,367` bytes;
- SHA-256: `29b7ce5dbaf522fa404c8b828b2d2b6343f91a3e95fa7deed58bc653df76f36e`;
- parser dataset version:
  `2026-08-03T22:41:40.735Z:parser-1.5.0`;
- measured final generations: `3.0 s` and `2.9 s` on the audit machine.

Two final generations produced byte-identical gzip, manifest, and coverage
(`fc /b`, all exit `0`) because `generatedAt` is inherited from the exact
character manifest. Normal semantic parsing performs no network requests.

## 7. Remaining risk and next gate

The largest global residual families are attack-performed/received/evaded
history, bare `when attacking`, Super Attack history, entrance/active/revive
state, start/end-of-turn effect qualifiers, counters/nullification, and guard
activation. The recommended next gate is attack-history and attack-phase
semantics: define current-action versus accumulated battle counters before
parsing `For every attack performed/received`, `after receiving`, Super Attack
history, and final-blow clauses. Board simulation and Android evaluation should
remain separate follow-up work.
