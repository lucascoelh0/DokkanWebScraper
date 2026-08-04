# Combat Rules Gate A8 audit

**Date:** 2026-08-04

**Schema:** `1`

**Combat rules:** `1.0.0`

**Evidence policy:** `1`

**Compatible Team Analysis:** schema `1`, rules `1..1`, parser `>=1.7.1`,
capability `sa-stat-raise-lifecycle-v1`

## 1. Decision and boundary

Gate A8 creates a small source-neutral dataset for global combat mechanics. It
does not calculate ATK, DEF, damage, rotations, recommendations, activation
probability, or expected values. Character values remain in the character and
Team Analysis datasets; runtime scenario state remains a consumer input.

The contract keeps condition, activation timing, calculation bucket, duration,
stacking, global rules, character values, runtime state, and calculated results
as independent channels. Gate A8 references the existing
`sa-stat-raise-lifecycle-v1` Team Analysis rule and does not reinterpret Gate
A7.1 duration or stacking semantics.

Only `verified` rules are normative. `corroborated`, `candidate`, and
`unresolved` entries are explicitly non-normative. In this gate, the verified
rules are integration/ownership invariants already established by versioned
contracts. No numeric community constant is promoted to normative production
data.

## 2. Evidence audit

### First-party Global export

The frozen Global export is DB `1782367825`, asset `1782367204`, APK
`6.2.5-7bd58ad32a3f187fe638587d4277a850ec8c1d67e04d9aa21433a931211621c1`.
It contains cards, leader skills, passive skills, links, specials, active
skills, standby skills, and structural relations. It does not contain an
exported global formula table for Class/Type alignment, guard, Hidden Potential
rates, variance, minimum damage, integer rounding, or operation order.

The Gate A7 exact join from `card_specials` to `special_sets` proves attack
identity, variant, starting Ki, name, and description for 1,913 of 1,922 attack
records. It does not expose base Super multiplier progression or numeric
qualitative-effect mappings. Gate A7.1 likewise found no row-level special
duration/stacking table. These joins are retained as structural provenance,
not as numeric authority.

### Community guides and workbook

The Ultimate Guide supplies candidate ATK/DEF order, Hidden Potential rates,
Super Attack term mappings, stacking-penalty claims, variance, and damage
formula order. The damage-taken guide supplies a more explicit candidate model
for source-group ATK lowering, damage-reduction groups, alignment, guard, TDB,
variance, and minimum damage.

The workbook was inspected as an `.xlsx`, including formulas on `Basic`,
`Damage Reduction`, `ATK Lower`, `DEF Stack & Lower`, and `Guard`. It
reproduces, among other examples:

- `(220000 × 1.015 × 0.8 - 118502) × 0.5 = 30069`;
- `(120000 × 2.5 × 1.015 × (0.9 - 0.01 × 10) - 129176) × 0.5 = 57212`;
- additive general DR versus a separate normal-only DR multiplier;
- additive ATK lowering inside an origin group and multiplicative lowering
  between origin groups;
- floor operations after the shown DEF stages.

Those examples corroborate the documented structures. They are not independent
first-party proof of the game's complete formula, RNG distribution, minimum
damage path, or every integer boundary.

## 3. Evidence matrix

| Regra | Canal | Valor/ordem candidata | Fonte | Evidência | Status | Risco |
| --- | --- | --- | --- | --- | --- | --- |
| Separation of condition/timing/bucket/duration/stacking/runtime/result | compatibility | independent channels | Team Analysis contract + combat roadmap | versioned contract | verified | low |
| Canonical SA raise lifecycle ownership | compatibility | reference `sa-stat-raise-lifecycle-v1` | Gate A7.1 audit | versioned contract and audited corpus | verified | low |
| ATK pipeline | atk_pipeline | base → leader → SoT → item/memory → links → active buff → Ki → On Attack → SA raise → SA multiplier → final modifiers | Ultimate Guide + roadmap; Global fields | community order; first-party structure only | candidate | high |
| DEF pipeline | def_pipeline | base → leader → SoT → item/memory → links → active buff → On Attack → SA raise → final modifiers | Ultimate Guide + damage guide/workbook | community order and reproduced examples | candidate | high |
| DEF stage flooring | def_pipeline | floor after each demonstrated DEF stage | damage guide + workbook | reproducible workbook formulas, no runtime capture | candidate | high |
| Hidden Potential Critical | hidden_potential_critical | level × 2% | Ultimate Guide + roadmap | consistent community documentation | corroborated | medium |
| Hidden Potential Additional | hidden_potential_additional | level × 2% | Ultimate Guide + roadmap | consistent community documentation | corroborated | medium |
| Hidden Potential Dodge | hidden_potential_dodge | level × 1% | Ultimate Guide + roadmap | consistent community documentation | corroborated | medium |
| Hidden Potential/passive proc separation | compatibility | independent rolls/channels | Team Analysis contract + roadmap | versioned ownership boundary | verified through separation rule | low |
| Type Attack Boost | hidden_potential_type_attack_boost | no production value | community fragments only | incomplete applicability and formula | unresolved | high |
| Type Defense Boost | hidden_potential_type_defense_boost | alignment − 0.01 × level under natural advantage | damage guide + workbook | corroborated examples only | candidate | high |
| Base SA multiplier/progression | super_attack | dimensions Super/Ultra/Unit/EX and damage tier/level | Global exact joins + Ultimate Guide image/table | identity proven; numeric table not exported/auditable | unresolved | high |
| Qualitative SA raises | super_attack | partial dimensioned mapping 30/50/100 and 20 for persistent ATK+DEF `raise` | Global exact text joins + Ultimate Guide | text identity proven; values community-only and exceptions exist | candidate | high |
| Canonical SA raise stacking/duration | super_attack | per-Super lifecycle from Gate A7.1 | Gate A7.1 audit | audited versioned domain rule | verified by referenced rule | low |
| Permanent ATK-stack SA penalty | super_attack | subtract one raise from SA multiplier before first contribution | Ultimate Guide | community claim with named exceptions | candidate | high |
| Complete Class/Type table | type_class_alignment | must cover attacker/defender Class, Type, advantage and no-Class | damage guide/workbook examples | partial examples, no universal matrix proof | unresolved | high |
| Natural guard | guard | alignment plus separate 0.5 coefficient | damage guide/workbook | reproducible examples, no first-party formula | corroborated/candidate | high |
| Passive guard | guard | candidate alignment nullification plus separate 0.5 coefficient | damage guide | community-only and dimension-dependent | unresolved | high |
| Damage dealt order | damage_dealt | ATK × modifier × variance − enemy DEF, then enemy DR channels | Ultimate Guide + roadmap | community model | candidate | high |
| Damage received order | damage_received | candidate equation serialized in dataset | damage guide + workbook + roadmap | multiple reproduced examples | candidate | high |
| ATK lowering source groups | atk_lowering | add inside passive/item/SA group; multiply groups; SA-effect lowering adjusts SA multiplier | damage guide + workbook | reproduced examples | candidate | high |
| Damage reduction groups | damage_reduction | add general DR; multiply normal/Super-specific group; memory in item channel | damage guide + workbook | reproduced examples | candidate | high |
| Variance endpoints | variance | inclusive 1.00–1.03 | both guides + workbook | consistent community examples | corroborated | medium |
| Variance distribution | variance | unknown | no first-party/RNG evidence | endpoints do not prove distribution | unresolved | high |
| `1.015` | variance | arithmetic midpoint only | guides + workbook | midpoint is reproducible; expected-value claim is not | unresolved as mean | high |
| Minimum damage trigger/range | minimum_damage | candidate result `<150`, observed enemy-zero-Ki range `9..132` | damage guide | community report | candidate | high |
| Minimum damage algorithm | minimum_damage | not a clamp; Ki/RNG mapping unknown | damage guide + roadmap | insufficient reproducible mapping | unresolved | high |
| Exact integer operation order | rounding | no universal boundaries | workbook proves selected DEF floors only | incomplete | unresolved | high |
| Enemy phase facts | damage_received | separate future dataset | roadmap | inputs absent | unresolved | high |

## 4. Contract and validation

`CombatRulesDataset` contains contract/rules/evidence versions, generated time,
an exact Team Analysis compatibility range, non-unresolved rules, and a
separate unresolved list. Every rule has a stable ID, channel, local version,
status, normative flag, typed value, unit, provenance, evidence level,
structural references, compatibility notes, and risk. Order and rounding claims
are optional typed objects; absence never implies a default.

The validator rejects unknown contract enums, bad version compatibility,
missing/unknown provenance, normative rules without sufficient evidence,
invalid probability/range values, duplicate IDs, malformed or non-contiguous
pipeline order, contradictory before/after references, and contradictory
rounding claims. Candidate and unresolved rules cannot be normative.

## 5. Artifacts and exact-calculator blockers

The generated local bundle is:

- `combat-rules.json`;
- `combat-rules-manifest.json`;
- `combat-rules-coverage.json`.

The manifest covers the raw JSON byte size and SHA-256 plus schema, combat-rules
version, evidence policy, rule counts, Team Analysis schema/rules, minimum
parser/capabilities, and compatibility. No
per-character data is present and no `data/` artifact is versioned.

Final local artifact:

- 17 non-unresolved rules: 2 verified/normative, 5 corroborated, and 10
  candidate;
- 12 unresolved rules;
- `combat-rules.json`: 52,016 bytes, SHA-256
  `9eb211eb6a8c743da69730da750f486138e46ec0bdeca444cc505e23647e93c2`;
- manifest SHA-256
  `ddb02ba15b2760c85e5fa8d6df1c6d98ca6504d34d584af956644cae12d2b238`;
- coverage SHA-256
  `ff1be8b1258b9db6fed37bfd85a208e9c4a2ef6fabbb8d9db4bb89660c0bc5ff`.

Two sequential generations produced byte-identical dataset, manifest, and
coverage files. The focused Gate A8 suite passed 13 cases and the full suite
passed 488 cases. `tsc --noEmit`, standalone bundle validation, and manifest
size/SHA-256 checks also passed.

An exact calculator remains blocked by base/level Super multipliers, complete
qualitative mappings and exceptions, the complete Class/Type/guard/TAB/TDB
matrix, variance distribution, minimum-damage algorithm, typed enemy-phase
facts, attack-kind DR applicability, and the exact integer truncation order.
