# Team Analysis Gate A5.1 audit

## 1. Scope and baseline

Gate A5.1 adds calculation-phase metadata to the Gate A5 payload without
implementing a calculator or changing any existing condition/effect parse
result. The baseline is commit `7eaf179`, parser `1.5.0`, character dataset
version `2026-08-03T22:41:40.735Z`, and character SHA-256
`a5a2a6b5f4821ff6e9d7d56cc0d56776a98843413ebf3f920a71b63cf14e4938`.

The three independent concepts are:

- condition: whether the contribution is eligible in the scenario;
- activation timing: when the contribution becomes active;
- calculation bucket: where an ATK/DEF passive percentage enters the formula.

An unresolved phase does not make a recognized condition or effect partial.
It remains an independent enrichment resolution.

## 2. Sources audited

### First-party Global export

The local reproducible export is documented by
`game-db/data/game-db-acquisition/first-party/latest/metadata.json`:

- region: Global;
- DB version: `1782367825`;
- asset version: `1782367204`;
- APK version:
  `6.2.5-7bd58ad32a3f187fe638587d4277a850ec8c1d67e04d9aa21433a931211621c1`;
- exported at: `2026-06-28T17:43:15.341Z`.

The exact audit join was:

1. `passive_skill_sets.id` to
   `passive_skill_set_relations.passive_skill_set_id`;
2. `passive_skill_set_relations.passive_skill_id` to `passive_skills.id`;
3. inspect `itemized_description`, `exec_timing_type`, `efficacy_type`,
   `calc_option`, `turn`, `causality_conditions`, and `eff_value1..3`.

`exec_timing_type` is an engine execution phase, while `calc_option` is the
operation applied to the value. In the audited rows, `calc_option=2` is used by
percentage ATK/DEF effects under timings 1, 3, 4, 7, 14 and 15. It therefore
cannot be interpreted as Start of Turn or On Attack.

Representative exact joins:

| Passive set | Text sections | Linked ATK/DEF rows |
| --- | --- | --- |
| 1149 | Basic; After receiving an attack | 1149 timing 1; 1001149 timing 7; both calc 2 |
| 2475 | Basic; After performing a Super Attack | 2475 timing 1; 1002475 timing 5; both calc 2 |
| 2493 | Basic; Ki threshold; After receiving | 2493 timing 1; 1002493 timing 4; 2002493 timing 7; all calc 2 |
| 2623 | Basic; Ki threshold; enemy count; final blow | timing 1, 4, 1 and 14 ATK/DEF rows; all calc 2 |

The old threshold ambiguity is first-party-visible. Passive set 42 has
`When attacking with 10 or more Ki` and a linked ATK row at timing 3; set 57
has `When attacking with 5 or more Ki` and a linked percentage ATK row at
timing 4. Similar threshold wording therefore does not justify a universal On
Attack bucket.

The current normalized character payload retains passive text and structural
sections, but does not retain a general per-effect first-party row identity.
The optional passive skill ID currently preserved for Gate A4.1 is scoped to
enemy-status evidence. Consequently this gate does not claim
`first_party_game_db` for a character effect unless an exact state/passive/
effect join can be serialized in a future evidence layer. First-party data is
used here to validate and constrain domain rules, not to guess missing joins.

### Community references

The historical [calculation guide](https://docs.google.com/document/d/1Kjk7QnNmfax80qXM8LL4b9woN_GxR0rqyAibR8BoDFY/edit?tab=t.0)
distinguishes Start of Turn and On Attack passive multipliers, separates Super
Attack effect raises, and explicitly notes old Ki-threshold exceptions. The
[Reddit thread](https://www.reddit.com/r/DBZDokkanBattle/comments/zza0ye/the_ultimate_guide_to_calculating_dokkan_full/)
is an index post whose target is the same guide. These sources support a
documented rule but never override contradictory first-party evidence.

## 3. Contract and resolution policy

Every typed effect receives `activationTiming`; every typed ATK/DEF effect also
receives `calculationBucket`. Each carries its own resolution source:
`explicit_text`, `first_party_game_db`, `documented_domain_rule`, or
`unresolved`.

Implemented high-confidence rules:

- explicit `at the start of ... turn` -> activation `start_of_turn`;
- `Basic effect(s)` -> Start of Turn activation and bucket by documented rule;
- `when performing a Super Attack` -> explicit activation and On Attack bucket
  by documented rule;
- `after performing a Super Attack` -> explicit `after_attacking` activation
  and On Attack bucket by documented rule;
- explicit before/when/after attack, receiving, evading and final-blow wording
  -> activation timing only;
- a proven `For every ... Ki Sphere obtained` scaling header -> Start of Turn
  activation and bucket by documented rule.

Conservative fallbacks:

- bare `when attacking` proves activation timing but not a universal bucket;
- Ki thresholds prove attack timing and runtime condition, not a bucket;
- after receiving/evading/attacking/final-blow triggers do not automatically
  become On Attack buckets;
- ally, enemy, HP, slot and temporal conditions do not imply activation timing;
- unknown effects carry no phase claim;
- Super Attack raises remain outside passive parsing.

Explicit inline timing has precedence over a structural Basic header. Bucket
and activation metadata never consume text, merge effects or change existing
parse statuses.

## 4. Real-payload coverage

The Gate A1-A5 semantic metrics are byte-for-byte equivalent as JSON values to
the baseline: 400/1,150/8 passive states and 5,844/3,273/200 rules remain
supported/partial/unknown. Conditions remain 6,837/276/2,204 and effects remain
7,765/976/576. This is expected because Gate A5.1 is enrichment, not a relaxed
parser.

Activation timing coverage across 13,000 typed effects:

| Moment | Count |
| --- | ---: |
| start of turn | 5,301 |
| before attacking | 57 |
| when attacking | 1,745 |
| when performing a Super Attack | 0 |
| after attacking | 359 |
| after receiving an attack | 358 |
| after evading | 129 |
| after final blow | 37 |
| unresolved | 5,014 |

Resolution provenance is 2,844 explicit text, 5,142 documented domain rule,
0 exact first-party joins, and 5,014 unresolved. Thus 7,986/13,000 (61.4%)
typed effects have resolved activation timing.

Bucket coverage across 7,568 typed ATK/DEF contributions:

| Bucket | Count |
| --- | ---: |
| `passive_start_of_turn` | 3,249 |
| `passive_on_attack` | 5 |
| `unresolved` | 4,314 |

The 3,254 resolved buckets (43.0%) use documented domain rules. No bucket is
labeled explicit-text or first-party without evidence that proves the
mathematical channel.

Largest unresolved bucket families are: attack-Ki thresholds (941), enemy
conditions (388), per-ally contributions (321), ally conditions (263), bare
`when attacking` (239), per-attack-performed contributions (224), HP
conditions (207), Ki Sphere thresholds (185), slots (177), per-attack-received
(128), `when receiving` (113), entry windows/durations (108), after receiving
(100), after evading (44), and per-attack-evaded (42).

Largest unresolved activation families are enemy conditions (723), ally
conditions (533), per-ally contributions (451), HP conditions (444), slots
(391), Ki Sphere thresholds (336), entry windows (324), and `when receiving`
(193). These are retained because condition evaluation time is not necessarily
effect activation time.

## 5. Compatibility, artifact and validation

`schemaVersion` remains 1 because all phase fields and coverage counters are
additive and existing serialized meanings are unchanged. `parserVersion`
advances from `1.5.0` to `1.5.1`. Consumers of old schema-1 cached payloads
must tolerate the optional enrichment; current generated payloads use explicit
`unresolved` values to prevent accidental inference.

Final artifact:

- compressed: `926,153` bytes;
- uncompressed: `19,875,438` bytes;
- SHA-256: `497882be67590ad9447c310e17c16ef537a4751cca65ad9083b726d5ffcc679c`;
- dataset version: `2026-08-03T22:41:40.735Z:parser-1.5.1`;
- final generation times: `2.7 s` and `2.7 s` on the audit machine.

Compared with Gate A5, the additive metadata increases gzip size by 73,781
bytes and raw JSON by 3,062,071 bytes. No network request occurs during normal
semantic generation.

Validation covers the golden phase families, independent contributions,
support-target regression, impossible enum/resolution combinations, lossless
reconstruction, TypeScript compilation, focused parser tests, full project
tests and two deterministic generations. The final gzip, manifest and coverage
outputs were byte-identical in both runs. Their file SHA-256 values are,
respectively, `497882be67590ad9447c310e17c16ef537a4751cca65ad9083b726d5ffcc679c`,
`7bafb37b8706351b828abce562c712ebb18ff4d7c9e3a7bc8995e82ee1d2b0b2`,
and `1ccec3c4766e27dea98a999b98c9f749f558827d48df730e258f61ad2196ac8f`.
