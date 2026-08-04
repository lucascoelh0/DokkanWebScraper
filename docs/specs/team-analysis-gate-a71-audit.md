# Team Analysis Gate A7.1 audit

Date: 2026-08-04

Parser: `1.7.1`

Schema: `1` (optional additive fields)

Domain rule: `sa-stat-raise-lifecycle-v1`

## 1. Scope and decision

Gate A7.1 recovers leading Dokkan.fyi effect markers before
`cleanMultilineText` removes `{...}` tokens. The normalized display text is
unchanged. Evidence is accepted only after identity, raw/normalized SHA-256,
source version/field, exact span, line range, anchor, marker token, and marker
order validation.

The lifecycle channels remain independent:

- `once` proves one activation/application, not one-turn duration, cap, or
  non-stacking;
- `forever` proves battle persistence, not one activation or repeatability;
- adjacent `once` + `forever` proves both facts without collapsing them;
- application trigger, stacking, cap, condition, `activationTiming`, and
  `calculationBucket` retain separate provenance.

`sa-stat-raise-lifecycle-v1` applies only to canonical Super Attack ATK/DEF
raises. A contribution is applied per performed Super; a one-turn contribution
can accumulate across Supers in that turn, N-turn applications keep their own
active windows, and a raise without a finite duration persists for the battle.
The rule does not infer a percentage, cap, formula, or semantics for lowering,
stun, seal, heal, sacrifice, support, damage-only, or ambiguous text.

## 2. Raw-cache marker audit

The current local cache contains 1,625 character pages. Counts differ from the
earlier preliminary audit because this is a different cache snapshot and this
audit separates every stored initial/EZA source from the one selected release.

| Scope | `once` | `forever` | adjacent combinations | affected records/states |
| --- | ---: | ---: | ---: | ---: |
| all stored initial passives | 353 | 504 | 61 | 401 records |
| all stored EZA passives | 204 | 408 | 16 | 312 records |
| all stored passive versions | 557 | 912 | 77 | 542 files |
| selected dataset states | 451 | 702 | 70 | 524 states |

Selected-state evidence has 1,083 anchored records and 1,153 marker spans:

| Release | states | evidence | `once` | `forever` | combinations |
| --- | ---: | ---: | ---: | ---: | ---: |
| initial | 255 | 559 | 286 | 329 | 56 |
| EZA | 248 | 489 | 156 | 346 | 13 |
| SEZA | 21 | 35 | 9 | 27 | 1 |

No selected raw Super, Ultra, Unit, or EX description contains either marker.
The real channel distribution is therefore passive 1,083 and zero for each SA
variant. Synthetic goldens cover all four variants and prove that the same
upstream extractor preserves their attack ID/variant boundary without leaking
to another attack.

## 3. First-party joins and ambiguity

The frozen first-party export is global DB `1782367825`, asset
`1782367204`, APK `6.2.5-7bd58ad32a3f187fe638587d4277a850ec8c1d67e04d9aa21433a931211621c1`.
The safe structural chain is card ID to `cards.passive_skill_set_id` (or the
exact optimal-awakening growth set for the release), then
`passive_skill_sets`, `passive_skill_set_relations`, and `passive_skills`.
Names were never join keys.

Of the 524 affected selected states:

- 521 joined an exact first-party card ID;
- 518 joined the exact release's passive skill set and relation rows;
- 471 also had byte-identical FYI/first-party itemized text;
- six remained unmatched: three EZA cards without an exported growth link and
  three newer initial cards absent from the frozen card snapshot.

These joins are corroborative only. Among the affected joined states, 311
sets mix `is_once` values and 439 mix `turn` values. There is no rendered-clause
ID that maps one bullet to one relation row. For example, set `4005` has a
rendered `once` clause among 18 rows but only row `17004005` has `is_once=1`;
the export does not prove ownership of that clause. Set `4304` renders two
`forever` clauses while accumulating rows use turns 1 through 5 rather than a
single `turn=99`. Consequently, zero first-party rows were promoted to an
effect-level activation limit, duration, or stacking decision. No safe
effect-level divergence was declared in production; ambiguous mixed rows stay
separate audit evidence. A synthetic divergent golden verifies that a FYI
marker and first-party claim are retained separately and that the exact
marker/span has priority without erasing the disagreement.

First-party `special_sets` prove the SA description identity only. This export
has no row-level special-effect duration/stacking table, so the SA lifecycle
uses documented domain-rule provenance, never first-party provenance.

## 4. Canonical Super Attack raise audit

The 1,922 attacks are distributed as 1,621 Super, 252 Ultra, 39 Unit, and 10
EX. There are 1,070 attacks with a canonical raise: 323 ATK-only, 175 DEF-only,
and 572 ATK & DEF. Their 1,685 typed raise effects cover all observed
magnitudes: 963 `raise`, 622 `greatly_raise`, and 100 `massively_raise`.

| Raise lifecycle | effect count | result |
| --- | ---: | --- |
| explicit current turn | 1,093 | cumulative in `current_turn` scope |
| explicit N turns | 188 | cumulative in `active_windows` scope |
| no finite duration | 400 | persistent/cumulative in `battle` scope |
| explicit battle persistence | 4 | persistent/cumulative in `battle` scope |

The audit found no source exception saying a canonical finite raise is
non-stacking, no source exception to per-Super reapplication, and no marker in
the real SA channel. Goldens cover two Supers in one turn, applications in
different N-turn windows, two persistent applications, explicit caps, and all
attack variants without simulating a battle result.

## 5. Before/after coverage

Gate A7 had 1,251 unknown durations and 2,208 stat effects with unknown
stacking. Gate A7.1 resolves all 1,685 canonical raise stacking modes and the
400 durationless canonical raises:

- duration unknown: 1,251 -> 851 (400 resolved);
- stacking unknown: 2,208 -> 523 (1,685 resolved);
- application trigger `per_super_attack`: 1,685;
- passive marker-resolved activation limits: 727 typed/unknown effect atoms;
- passive marker-resolved battle durations: 1,045 effect atoms;
- passive application triggers: 431 `entry`, 505 `per_combat_event`, and 710
  explicitly `unknown` rather than inferred;
- passive cumulative stacking derived from already explicit repeatable
  scaling/caps: 468 battle-scoped effect atoms.

Remaining SA unknowns are deliberately family-specific:

| Family | duration unknown | stacking unknown | application trigger absent |
| --- | ---: | ---: | ---: |
| enemy ATK lowering | 224 | 224 | 224 |
| enemy DEF lowering | 299 | 299 | 299 |
| stun | 231 | n/a | 232 |
| Super Attack seal | 97 | n/a | 97 |
| canonical ATK/DEF raise | 0 | 0 | 0 |

All unrelated Gate A1-A7 counts stayed stable: 1,625 states, 1,558 passive
states, 9,317 rules (`6,834/2,373/110` supported/partial/unknown), 1,922
attacks, 2,537 typed SA effects, and identical effect-family counts. A direct
comparison of all 1,625 passive state texts plus 1,922 SA/condition texts found
zero identity or normalized-text differences.

## 6. Artifact and deterministic validation

Final Team Analysis artifact:

- dataset version `2026-08-04T22:43:50.776Z:parser-1.7.1`;
- compressed size `1,706,243` bytes;
- uncompressed size `30,591,159` bytes;
- payload SHA-256
  `cbe5d1a719745c1bd4de7eed43cfe5ad8467d1a9a58dc0c507cd1d848c2d7951`;
- manifest file SHA-256
  `ace2286f455c9a578254b0f79f0cb50e60392acd7b66d805dac3178ba3e173d1`;
- coverage file SHA-256
  `b8a0e4585fd13ffb79e50f45f37d408284c7285d0e4bc9423291547e5d1283ef`.

Compared with Gate A7, the compressed payload grows by 370,724 bytes (27.76%)
and the uncompressed payload by 3,879,014 bytes (14.52%). The character source
artifact containing the optional raw structural documents is 1,211,389 bytes
compressed with SHA-256
`56681e7327c56bce7becbda72ee507b77d964f449fd1862012d4e751b801b499`.
No generated `data/` artifact is versioned.

Two sequential generations produced byte-identical gzip, manifest, and
coverage files. The lossless audit checked 524 raw structural documents, 1,083
anchors, and 1,153 marker spans with zero errors. Focused tests passed 320
cases; full `npm test` passed 475. `tsc --noEmit`, real character and Team
Analysis payload validation, exact normalized-text regression, deterministic
generation, and `git diff --check` were also required before commit.
