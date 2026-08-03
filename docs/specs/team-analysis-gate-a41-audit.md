# Team Analysis Gate A4.1 Audit

**Date:** 2026-08-03
**Baseline:** `068d55d Implement Team Analysis Gate A4`
**Parser:** `1.4.1`
**Character dataset:** `2026-08-03T22:41:40.735Z`
**Character SHA-256:** `a5a2a6b5f4821ff6e9d7d56cc0d56776a98843413ebf3f920a71b63cf14e4938`

## Source audit and loss point

The status labels already exist in the first source inspected. The raw
dokkan.fyi Inertia payload contains tokens inside
`props.character.passive_skill.description` or
`props.character.extreme_z_awakening.passive_skill.description`, for example:

```text
When the target enemy is in the following status:
{passiveImg:atk_down} or {passiveImg:def_down}
```

The runtime `passive_skill` object also exposes `effects`, but those rows do not
encode the display condition binding and are not used to infer required enemy
statuses. The TypeScript `FyiSkill` interface previously modeled only
`id/name/description/condition`; it now also models `effects` so the raw shape
is no longer silently understated.

The labels were lost in `fyi-scraper.ts` at `cleanMultilineText`, whose
`/\{[^}]+\}/g` replacement intentionally strips display markers before
`passiveDetailsFromSkill` creates `text`, `lines`, and `sections`. Gate A4.1
extracts structural evidence before that replacement and leaves all existing
display text unchanged.

The HTML/SSR audit found the same payload in the `script[data-page="app"]`
block. The current dokkan.fyi `DokkanText` client asset parses
`{passiveImg:<token>}`, renders
`passive_skill_dialog_<token>.png`, and uses the token as image `alt`. HTML was
therefore a confirmation of the payload contract, not a fallback source.

The Global first-party database was audited as an independent structural
cross-check:

- DB version: `1782367825`;
- assets version: `1782367204`;
- APK version: `6.2.5-7bd58ad32a3f187fe638587d4277a850ec8c1d67e04d9aa21433a931211621c1`;
- card join: `cards.passive_skill_set_id -> passive_skill_sets.id`;
- effect-condition join:
  `passive_skill_sets.id -> passive_skill_set_relations.passive_skill_set_id
  -> passive_skills.id -> passive_skills.causality_conditions
  -> skill_causalities.id`.

One-marker records prove four separate first-party condition values under
`skill_causalities.causality_type = 38`:

| Marker | Normalized status | Passive set | Causality ID | `cau_val1` |
| --- | --- | ---: | ---: | ---: |
| `atk_down` | `atk_down` | 1293 | 105 | 16 |
| `def_down` | `def_down` | 1530 | 206 | 32 |
| `stun` | `stunned` | 1212 | 91 | 256 |
| `astute` | `super_attack_sealed` | 1210 | 92 | 1024 |

The generated enrichment still uses the raw dokkan.fyi payload directly. The
first-party joins are audit evidence only; DokkanInfo was not needed. No status
is derived from an effect, character name, CSS, or visual position.

## Evidence contract

`PassiveDetails.conditionEvidence` is optional and additive. Every record
contains the full state identity and release, passive-skill ID when present,
SHA-256 of the normalized passive, one line or inclusive line range, normalized
and structural anchors, ordered marker records, explicit AND/OR when proven,
resolution, payload field, source version, and marker syntax.

All 89 evidence records in this run came from dokkan.fyi payload version
`9b8400b8f2f713f705f9ee5b2c56470d`: 51 from the awakened passive field and 38
from the initial passive field. The normal parser performs no requests.

Before use, the Team Analysis parser revalidates state key, character/form,
release, passive hash, every anchor line, marker order, normalized status,
connector, resolution, payload field, and provenance. A mismatch rejects the
whole record and preserves the original unknown condition. `rawText` is never
patched with synthetic labels.

## Reconciliation of the affected-state count

The Gate A4 note reported 63 states from a lexical scan of already normalized
text. That denominator is not reproducible after tracing the structural source:
line wrapping, mixed HP/status headings, and more than one status heading in a
state made the earlier heuristic undercount.

The reproducible current audit finds 73 states and 89 structural headings:

- 68 states: every heading structurally resolved;
- 2 states: a mix of resolved icon headings and unresolved HP-only headings;
- 3 states: only source headings with no icon labels;
- 79 headings supported and 10 unresolved;
- no partially decoded icon heading: every icon token in the source belonged
  to the controlled four-status mapping.

Across the evidence itself, the normalized status distribution is:

- `atk_down`: 43;
- `def_down`: 38;
- `stunned`: 40;
- `super_attack_sealed`: 30.

The unresolved records are source limitations, not parser guesses. They use
wording such as `following status: HP is ...` without a status icon. In mixed
states the independently evidenced status heading is still consumed; the
HP-only heading remains partial/unknown under the existing Gate A4 rules.

## Coverage impact

The before column uses the same regenerated character payload and parser with
`conditionEvidence` removed, so it isolates Gate A4.1 rather than catalog drift.

| Metric | Before evidence | Gate A4.1 | Delta |
| --- | ---: | ---: | ---: |
| Passive supported / partial / unknown | 229 / 1,318 / 11 | 235 / 1,312 / 11 | +6 / -6 / 0 |
| Rule supported / partial / unknown | 4,173 / 4,887 / 257 | 4,269 / 4,792 / 256 | +96 / -95 / -1 |
| Condition supported / partial / unknown | 5,390 / 187 / 3,740 | 5,493 / 183 / 3,641 | +103 / -4 / -99 |
| Unknown fragments | 6,273 | 6,174 | -99 |
| `enemy_status` predicates | 0 | 216 | +216 |
| Rules containing scenario predicates | 1,560 | 1,663 | +103 |
| Fully scenario-evaluable rules | 1,470 | 1,573 | +103 |

Typed predicates outnumber source markers because one condition header can
govern several separate effect rules. Five remaining partial rules retain typed
status predicates beside an unrelated unknown qualifier. Eleven rules have no
typed status because their structural source has no status icon or because the
status wording occurs inside an effect continuation rather than a condition
header. No unknown fragment was discarded merely to improve coverage.

## Artifact and determinism

The final `team-analysis.json.gz` has:

- uncompressed size: 16,507,631 bytes;
- compressed size: 824,319 bytes;
- SHA-256: `8d023758a633c50f10b443d202885706e06de90c76b165a385741ec5ba551248`;
- complete generation times: 3,362 ms and 3,323 ms.

The two final runs produced byte-identical gzip, manifest, and coverage files.
The character artifact used for compatibility is 971,159 bytes compressed and
11,166,898 bytes uncompressed, with the SHA-256 recorded above.

`schemaVersion` remains 1 because evidence and coverage fields are optional and
additive. `parserVersion` advances from 1.4.0 to 1.4.1 because affected ASTs now
contain real `enemy_status` predicates.

## Remaining risks

- A future source-token rename must fail closed until the central mapping and
  first-party cross-check are updated.
- Source headings with no structural icon remain unresolved; effects must not
  be used to guess them.
- Embedded status wording inside effect continuations needs a separate parser
  slice that first separates the inline condition from its effect without
  changing source spans.
- Older character payloads do not contain the optional evidence. They continue
  to parse conservatively as before.
