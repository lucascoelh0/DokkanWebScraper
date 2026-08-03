# Team Analysis Gate A1.1 Audit

Audit date: 2026-08-03

## Inputs

- Character payload: `data/fyi-characters/latest/characters.json.gz` and its lossless passive text /
  `PassiveDetails` projection.
- Semantic evidence: Global first-party export under
  `game-db/data/game-db-acquisition/first-party/latest`.
- Export metadata: DB `1782367825`, assets `1782367204`, APK `6.2.5`, exported
  at `2026-06-28T17:43:15.341Z` from the decrypted game DB.

The character payload contains only display text for the qualitative chance
terms. The numeric evidence therefore comes from the first-party tables
`passive_skill_sets`, `passive_skill_set_relations`, and `passive_skills`.
Community references, including Reddit, were treated only as corroborating
context and are not used by the resolver or checked-in evidence registry.

## Baseline unknown syntax families

The Gate A1 output contained 4,699 unknown effects. The real-text audit grouped
the in-scope high-frequency families as follows (families overlap when a phrase
contains more than one requested semantic):

| Family | Unknown occurrences before A1.1 |
| --- | ---: |
| additional attack -> Super | 386 |
| additional Super Attack | 442 |
| additional attack | 402 |
| qualitative critical chance | 210 |
| qualitative evade chance | 261 |
| stun | 87 |
| Super Attack seal | 38 |
| `within the turn` | 116 |
| `for N turns` | 361 |
| `up to X%` | 588 |

## Final probability policy

Resolution is ordered and effect-channel-specific:

1. an explicit percentage in passive text;
2. first-party evidence bound to the exact `stateKey`, full passive-text SHA-256,
   source rule line, passive set, skill row, effect family, and value column;
3. the stable `medium=30`, `high=50`, and `great=70` lexicon;
4. unresolved, retaining the typed effect and qualitative term without a number.

The serialized sources are `explicit_text`, `first_party_game_db`,
`qualitative_lexicon`, and `unresolved`. Activation and
additional-attack-to-Super conversion have separate percentage, term, and
source fields.

| Stable term | Percent | Critical (`eff_value1`) | Evade (`eff_value1`) | Additional Super activation (`probability`) | Additional -> Super (`eff_value3`) |
| --- | ---: | --- | --- | --- | --- |
| medium | 30 | set 968 / skill 1000968 | set 874 / skill 2000874 | set 1974 / skill 4001974 | set 1024 / skill 2001024 |
| high | 50 | set 969 / skill 1000969 | set 1019 / skill 1019 | set 2117 / skill 2002117 | set 949 / skill 1000949 |
| great | 70 | set 1603 / skill 5001603 | set 1128 / skill 2001128 | set 2103 / skill 3002103 | set 1119 / skill 1001119 |

This also validates the contract distinction: an additional Super's activation
chance is stored in `probability`, while a normal additional attack's chance of
becoming Super is stored in `eff_value3`. Guaranteed additional Super evidence
uses 100 in both relevant fields; guaranteed normal additionals use 0 for the
conversion field.

### `rare chance` and reconciliation of first-party 7/15 records

The current character input contains 41 standalone `rare chance` occurrences
(plus six `very`/`super`/`ultra-rare` phrases that are different terms). There
is no defensible universal value: audited rows encode 7% or 15% for specific
effects, while some same-valued columns are effect magnitudes rather than
probabilities. The parser therefore has no `rare` lexicon entry.

The earlier audit over-associated every 7/15 field in a passive set with its
`rare chance` clause. The corrected audit joins
`passive_skill_set_relations.passive_skill_id` to `passive_skills.id` and then
checks the effect family (`efficacy_type`) and semantic field individually.

| Set / skill | `passive_skills` field | Effect family | Corresponding passive text | Finding |
| --- | --- | --- | --- | --- |
| 40 / 40 | `probability=7`, `eff_value1=15` | ATK down (`efficacy_type=1`, enemy target) | `Rare chance of all enemies' ATK 15%` | 7 is activation encoding; 15 is the ATK reduction magnitude |
| 954 / 954 | `eff_value1=15`, `eff_value2=15` | enemy ATK/DEF down (`3`) | `All enemies' ATK & DEF 15%` | both 15s are magnitudes, unrelated to the rare conversion clause |
| 954 / 2000954 | `eff_value3=7` | additional attack (`81`) | `rare chance of becoming a Super Attack` | 7 is the card-specific additional-to-Super encoding |
| 967 / 1000967 | `eff_value1=7` | critical (`90`) | `Rare chance of performing a critical hit` | 7 is the card-specific critical chance encoding |
| 1599 / 2001599 | `eff_value1=15` | evade (`91`) | `Rare chance of evading enemy's attack` | 15 is the card-specific evade chance encoding |
| 2564 / 3002564 | `probability=15`, `eff_value3=100` | additional Super (`81`) | `Rare chance of launching an additional Super Attack` | 15 is activation; 100 marks the launched additional as Super |
| 2654 / 2654 | `probability=15` | stun (`9`) | `Rare chance of stunning all enemies` | 15 is an activation encoding |
| 3421 / 8003421 | `eff_value1=15` | critical (`90`) | `Rare chance of performing a critical hit` | 15 is a card-specific critical chance encoding |
| 4196 / 4004196 | `probability=15`, `eff_value1=600` | ATK (`1`) | `Rare chance of ATK 600%` | 15 is activation; 600 is the ATK magnitude |

Therefore, some 7/15 values really are probabilities, while identical numbers
elsewhere are magnitudes. The checked-in evidence registry contains only ten
current state/rule/effect associations: Jaco's 7% all-enemy stun and nine 15%
critical, evade, or additional-to-Super effects. Every other `rare` probability
stays typed but unresolved. Numeric 7/15 text is explicit text and is never
reverse-mapped to `rare`.

### `a chance` audit

The current compressed character input has no passive occurrence of the exact
term `a chance`. The first-party `passive_skill_sets` table has eight passive
sets containing `has a chance of becoming a Super Attack`: 726, 818, 955,
1219, 1342, 1343, 1932, and 2017. Their linked efficacy-81 rows all have
`probability=100` for launching the additional attack and `eff_value3=10` for
its conversion to a Super Attack. Because the evidence is complete and
consistent for that syntax and semantic, `a chance` resolves to 10% only for
`additional_to_super`; it remains unresolved for every other effect family.

### Jaco and Chiaotzu audit

Fourteen current payload states are named Jaco or Chiaotzu. The historically
relevant first-party rows are:

| State/card | Passive set / skill | Payload text | First-party probability | Usage limit |
| --- | --- | --- | ---: | --- |
| Chiaotzu `1000140` | 141 / 141 | `Stuns all enemies` | 100 | `is_once=1` |
| Jaco `1002210` | 198 / 198 | `Rare chance of stunning all enemies` | 7 | `is_once=0` |
| Jaco `1004870` | 402 / 402 | `Stuns all enemies` | 100 | `is_once=1` |

In this first-party snapshot, the rare-text Jaco is not guaranteed: its stun is
7% and has no once-only flag. The guaranteed Chiaotzu and later Jaco are
separate structural cards/passive sets and are once-only. Thus no character-name
exception is needed. The normalized payload omits the first-party `once` marker;
usage limits remain outside Gate A1.1 and are documented rather than invented.

### Hidden Potential boundary

Hidden Potential is separate from Passive Skills. Critical and Additional use
skill level × 2%; Dodge/Evasion uses skill level × 1%. These formulas are saved
only as future domain knowledge and are not implemented or consulted here.

## Parser boundary

Gate A1.1 recognizes the audited combat effects, explicit attack counts,
validated activation/conversion chances, direct duration modifiers, and direct
percent caps. Runtime battle conditions and ambiguous or family-dependent
qualifiers remain lossless `unknown` fragments; recognized effects with an
unresolved probability remain typed and `partial`.

## Generated result

The final dataset generated with parser `1.1.2` contains 1,556 passive states
and 9,292 rules. The probability correction compares as follows:

| Measure | 1.1.0 | 1.1.1 (universal rare) | 1.1.2 (structural rare) |
| --- | ---: | ---: | ---: |
| supported / partial / unknown passives | 70 / 1,474 / 12 | 90 / 1,455 / 11 | 91 / 1,454 / 11 |
| supported / partial / unknown rules | 1,943 / 5,901 / 1,453 | 2,540 / 6,247 / 505 | 2,541 / 6,247 / 504 |
| supported / partial / unknown effect statuses | 4,809 / 2,156 / 2,332 | 7,044 / 1,411 / 837 | 7,045 / 1,423 / 824 |
| typed effects / unknown effects | 10,949 / 4,699 | 12,644 / 2,335 | 12,708 / 2,289 |
| unresolved typed probabilities | not represented | not represented | 63 |
| unknown source fragments | 10,663 | 7,893 | 7,892 |

The 2,410-effect reduction is 51.3%. Existing typed counts for ATK, DEF, Ki,
damage reduction, and evade were checked against 1.1.0 and did not regress.

| Audited family | Before | Remaining | Reduction |
| --- | ---: | ---: | ---: |
| additional attack -> Super | 386 | 0 | 100% |
| additional Super Attack | 442 | 2 | 99.5% |
| additional attack | 402 | 0 | 100% |
| qualitative critical chance | 210 | 2 | 99.0% |
| qualitative evade chance | 261 | 4 | 98.5% |
| stun | 87 | 6 | 93.1% |
| Super Attack seal | 38 | 6 | 84.2% |
| `within the turn` | 116 | 9 | 92.2% |
| `for N turns` | 361 | 42 | 88.4% |
| `up to X%` | 588 | 77 | 86.9% |

Family counts overlap for composite clauses. Remaining examples are outside the
implemented boundary or deliberately ambiguous: class-qualified enemy targets,
self stun/seal, scouter durations, Ki Sphere scaling, slot/HP/
attack conditions, and caps whose underlying increment is not yet typed.

The most frequent normalized residual unknown groups are: `(up to +N)` (91),
`per Ki Sphere obtained` (70), `when attacking` (67), `Super Class allies'`
(62), `Extreme Class allies'` (59), `attacked enemy's` (46), `all enemies'`
(45), `when attacking with N or more Ki` (45), Ki-Sphere-to-Rainbow changes
(44), and `at the end of turn` (38). These belong to Gate A2 conditions/targets
or later Ki-sphere, cap, enemy-debuff, and timing work.

The final resolution sources are 1,707 `explicit_text`, 986
`qualitative_lexicon`, 10 `first_party_game_db`, and 63 `unresolved` channels.
The ten first-party resolutions are one 7% stun (Jaco) and nine 15% critical,
evade, or additional-to-Super effects. Of the unresolved channels, 53 are
unqualified `Chance of...`, nine are `rare` stuns, and one is a `rare` seal.
The correction preserves all of them as typed effects without invented values.

Compared with the discarded universal-rare output, one rule becomes supported
(Jaco), 13 effect-only rules leave `unknown` status, and 46 standalone unknown
effects disappear because the known effect and unresolved probability now share
one typed node. No explicit numeric chance changes. The artifact is 752,364
bytes compressed and 15,567,184 bytes uncompressed; generation took 2.749 s on
the first audit run and 2.493 s on the byte-identical determinism replay.
