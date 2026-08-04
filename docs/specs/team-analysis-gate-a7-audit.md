# Team Analysis Gate A7 audit

**Baseline commit:** `3bd878a`
**Character dataset:** `2026-08-03T22:41:40.735Z`
**Character payload SHA-256:**
`a5a2a6b5f4821ff6e9d7d56cc0d56776a98843413ebf3f920a71b63cf14e4938`
**Schema:** `1`
**Parser:** `1.7.0`

## 1. Scope and evidence policy

Gate A7 adds a sibling `superAttacks` channel to each exact character form and
release state. It types only ATK/DEF raises, enemy ATK/DEF lowering, stun, and
Super Attack seal. It does not parse base damage tier/multiplier, Active Skill
or passive effects, bosses, Android runtime state, or combat calculations.

The parser treats four facts independently:

1. original effect and condition text with line offsets;
2. effect condition and source target;
3. Super Attack effect-resolution timing;
4. future mathematical bucket for stat raises or enemy stat lowering.

An explicit percentage, turn count, target, stacking phrase, or cap is copied
as written. Qualitative magnitude and chance terms remain qualitative. Bare
raises never become permanent or stackable by convention, and a probability
mapping validated for passives is not reused for Super Attack specials.

## 2. Baseline corpus audit

The compatible character payload contains 1,922 attack records across normal,
Ultra, EX, and Unit variants. Gate A6 serialized none of them into Team
Analysis; all typed Gate A7 effect and provenance counters therefore had a
baseline of zero.

Gate A7 recognizes at least one in-scope effect in 1,490 attack descriptions.
The remaining 432 are intentionally unknown, primarily damage-only text or
out-of-scope effects. Because production descriptions retain damage/formula
text as a lossless residual, no complete production attack is labeled fully
supported: 1,490 are partial and 432 unknown. This attack-level status does not
erase the independently supported typed effects.

The condition channel is supported `always` for 1,873 empty conditions. All 49
non-empty EX/Unit conditions remain unknown with exact text and offsets; no
conversion condition is treated as satisfied.

## 3. First-party cross-check

The reproducible Global export is recorded in
`game-db/data/game-db-acquisition/first-party/latest/metadata.json`:

- DB version `1782367825`;
- asset version `1782367204`;
- APK `6.2.5-7bd58ad32a3f187fe638587d4277a850ec8c1d67e04d9aa21433a931211621c1`;
- export timestamp `2026-06-28T17:43:15.341Z`.

The audit joined Team Analysis `formId` to `card_specials.card_id`, then
`card_specials.special_set_id` to `special_sets.id`, and required normalized
description, name, and starting Ki to agree. It produced 1,913 exact joins out
of 1,922 attacks (99.53%). The nine unmatched attacks are newer than or absent
from the frozen Global snapshot; they remain sourced from the compatible
character payload and do not receive first-party row provenance.

Representative exact joins:

| Character/form | `card_specials.id` | `special_sets.id` | First-party evidence |
| --- | ---: | ---: | --- |
| `1006430` | `10952` | `4198` | `Greatly raises ATK & DEF for 1 turn` |
| `1007770` | `9251` | `3508` | `Raises DEF for 1 turn` and `lowers ATK` |
| `1021011` | `7608` | `2819` | separate medium seal and stun chances |
| `1031821` | `17436` | `7771` | explicit `44%` ATK/DEF raise for 1 turn |
| `1007471` Ultra | `1353` | `385` | allies' ATK `30%` for 1 turn |
| `1004391` | `1152` | `325` | all-enemy rare stun wording |

`card_specials` proves the card/form, special set, style, Ki threshold, and
release-level row. `special_sets` proves the official name and description. The
available export does not expose a row-level duration/stacking/probability
mechanic table for specials, so the join is corroboration of exact source text,
not authority to invent hidden percentages, permanent stacks, or caps.

The nine unmatched form states are `1015411`, `1032411`, `1032711` (root and
transformed attacks), `1034301`, and `1034381`; they are called out as snapshot
drift rather than treated as parser failures.

## 4. Contract and parser decisions

`ParsedSuperAttack.effectOrigin` and every `SuperAttackEffect.origin` are fixed
to `super_attack`. Validators reject passive or Active Skill origins in this
channel. Release selection keeps base and EZA fields on their own state; a
generic field is used for a non-initial state only when the character payload
contains that sole current release.

Raises and lowerings keep qualitative magnitude independently from an optional
explicit numeric percentage. Duration is `current_turn`, `turns`, `permanent`,
or `unknown`, each with provenance. Only explicit `in battle`, `permanently`,
or rest-of-battle wording proves `permanent`; bare raise wording stays unknown.

Stat effects always serialize stacking separately. Explicit stack/cap syntax
can produce `stackable` and `capPercent`; no production description contains
such proof, so all 2,208 production stat effects retain unknown stacking and
zero production caps. Synthetic goldens cover accumulation and cap validation.

Singular enemy wording binds to `current_target`; explicit plural wording or a
same-clause all-enemy damage target binds to `all_enemies`. A singular status
after a semicolon cannot inherit an earlier all-enemy target. `allies` remains a
source-neutral scope with unknown self inclusion instead of guessing team or
rotation semantics.

Qualitative chance terms are preserved with unresolved provenance and no
number. An explicit numeric chance would use `explicit_text`; the production
payload contains none for the in-scope stun/seal families. Validators require
unresolved qualitative probability to keep the effect partial.

ATK/DEF raises use future bucket `super_attack_raise`. Enemy ATK/DEF lowering
uses `super_attack_enemy_stat_lowering`. Stun and seal have no mathematical
stat bucket. The common activation timing proves only that these are resolved
as Super Attack effects; it does not claim before-damage, post-hit, rounding, or
formula order.

## 5. Final real-payload coverage

| Channel | Gate A6 | Gate A7 |
| --- | ---: | ---: |
| serialized Super Attacks | 0 | 1,922 |
| attacks with typed Gate A7 effects | 0 | 1,490 |
| typed Super Attack effects | 0 | 2,537 |
| explicit numeric stat effects | 0 | 161 |
| non-empty conditions preserved unknown | 0 | 49 |

Typed effect distribution:

| Effect | Count |
| --- | ---: |
| ATK raise | 917 |
| DEF raise | 768 |
| enemy ATK lowering | 224 |
| enemy DEF lowering | 299 |
| stun | 232 |
| Super Attack seal | 97 |

Target distribution is 1,598 self, 87 allies, 836 current target, and 16 all
enemies. Duration is 1,094 current-turn, 188 multi-turn, 4 explicit permanent,
and 1,251 unknown. Future calculation buckets contain 1,685 raises and 523
enemy stat-lowering effects.

There are 236 qualitative chance effects with unresolved probability: 7 `a
chance`, 48 rare, 71 medium, 82 high, 24 great, and 4 `may`. The parser emits no
numeric probability for them. It preserves 3,537 out-of-scope residual
fragments with offsets.

Passive coverage and passive rule counts are unchanged from Gate A6. The new
metrics are additive and do not relabel passive conditions or effects.

## 6. Conservative residuals and risks

- 432 attacks have no Gate A7 typed effect; damage/formula and other future
  channels remain unknown rather than being called supported.
- 1,251 typed effects lack proven duration, and all 2,208 stat effects lack
  proven production stacking semantics.
- Zero production caps and zero numeric stun/seal probabilities are emitted.
- The 87 allies-target effects do not prove team/rotation scope or self
  inclusion.
- All 49 non-empty attack conditions require a later condition gate.
- The nine missing first-party joins expose frozen-snapshot drift; names are
  never used to synthesize a row identity.
- Base Super Attack multipliers/progression, damage kind, crit/effective/heal/
  sacrifice/action-disable effects, and exact calculation/rounding rules remain
  outside Gate A7.

The material-contract review found four issues before final validation: target
leakage across clauses, truncated lowering spans, insufficient probability-
status validation, and lossless validation that trusted only the top-level raw
copy. All four were corrected and received focused regression coverage.

## 7. Validation and deterministic artifact

Final artifact:

- dataset version `2026-08-03T22:41:40.735Z:parser-1.7.0`;
- compressed size `1,335,519` bytes;
- uncompressed size `26,712,145` bytes;
- payload SHA-256
  `1fd47fb2ddb3b8ff791d184b530ea2fa0279f7703d6fb5dbde48625372868c4b`;
- generation times `1.544 s` and `1.560 s`;
- manifest SHA-256
  `404e93e7a51fdd65e9ab8c55896c884a7be7286ac9ed53d3441b58f2287529f6`;
- coverage SHA-256
  `41997bd5111b9a50f0416d21148e075035333be8f33d9d922bb5e13dfcf6ba30`.

The two generated gzip, manifest, and coverage files were byte-identical.
Focused Team Analysis tests passed 281 cases; full `npm test` passed 452 cases.
`tsc --noEmit`, real-payload validation,
lossless golden reconstruction, two deterministic generations, and
`git diff --check` were also required before commit.
