# Database Team Analysis experiment contract v0.1.0

## Status and boundary

This is the DB2 experimental contract. It is source-neutral at the comparison
boundary but intentionally first-party-specific inside the SQLite adapter and
projector. It does not replace or mutate the production Team Analysis payload,
parser, manifest, or latest directory.

The generated files live only under the ignored
`data/database-experiment/` directory:

- `team-analysis-db-experiment.json.gz`;
- `team-analysis-db-manifest.json`;
- `team-analysis-db-coverage.json`;
- `team-analysis-db-parity.json`;
- `team-analysis-db-report.md`;
- `team-analysis-db-golden-validation.json`.

## State projection

DB2 starts with the DB1 terminal first-party catalog projection and adds only
the four explicit audited `collection_cards` omissions. Forms are traversed
from first-party form relations. For each primary/form pair the projector uses
the latest released initial/EZA/SEZA skill state at the snapshot cutoff.

The production Team Analysis contract labels every nested form as `initial`.
DB2 uses that label only in the compatibility `stateKey`; the actual database
state remains separately serialized as `sourceReleaseState` and the original
DB1 key as `sourceStateKey`.

## Passive joins and provenance

Every passive rule follows this chain without parsing display text:

`cards/optimal_awakening_growths -> passive_skill_sets ->
passive_skill_set_relations -> passive_skills`.

Optional joins retain `passive_skill_effects`, `sub_target_types`, and every
referenced `skill_causalities` row. Raw timing, game type, efficacy, target,
sub-target set, calculation option, duration, once flag, probability,
causality JSON, effect values, and localized text remain intact with table,
row, and column provenance.

## Confirmed effect enums

The projector maps only field meanings supported by exact first-party row
joins and the existing checked-in Team Analysis audits.

| Efficacy | Experimental mapping | Structured values |
| ---: | --- | --- |
| 1 | ATK / enemy ATK down by target | `eff_value1` |
| 2 | DEF / enemy DEF down by target | `eff_value1` |
| 3 | ATK+DEF / enemy ATK+DEF down by target | `eff_value1`, `eff_value2` |
| 4 | HP recovery | `eff_value1` |
| 5 | Ki | `eff_value1` |
| 9 | stun | `probability` |
| 13 | damage reduction | `100 - eff_value1` remaining-factor encoding |
| 16 | type-filtered ATK | type `eff_value1`, value `eff_value2` |
| 18 | type-filtered ATK+DEF | type `eff_value1`, values `eff_value2..3` |
| 20 | type-filtered Ki | type `eff_value1`, Ki `eff_value2` |
| 48 | Super Attack seal | `probability` |
| 51 | Ki Sphere change | source `eff_value1`, destination `eff_value2` |
| 76 | effective against all Types | boolean |
| 78 | guard | boolean |
| 81 | additional attack attempts | primary `probability`, optional second `eff_value2`, Super conversion `eff_value3` |
| 90 | critical chance | `eff_value1` |
| 91 | evade chance | `eff_value1` |
| 101 | scouter | boolean |

For efficacy 51 only, sphere values are confirmed as 0 AGL, 1 TEQ, 2 INT,
3 STR, 4 PHY, and 5 Rainbow. Stat calculation options are not promoted to a
global enum: the projector only uses the effect-specific unit evidence needed
for a mapped value and still retains the raw option.

## Confirmed target enums

| Target | Mapping |
| ---: | --- |
| 1 | self |
| 2 | allies; self inclusion unknown |
| 3 | current/attacked enemy |
| 4 | all enemies |
| 12 | Super Class allies; self inclusion unknown |
| 13 | Extreme Class allies; self inclusion unknown |
| 14 | Super Class enemies |
| 15 | Extreme Class enemies |
| 16 | allies excluding self |

Sub-target rows are preserved but not translated into category, name, or
compound runtime predicates in DB2.

## Conservative unknown policy

All other efficacy enums remain `unknown` with their raw numeric fields.
Execution timings, calculation-option enums, and causality-type meanings are
not assumed. Non-empty compiled causalities retain their exact JSON tree and
joined leaves as `structured-uninterpreted`; DB2 emits zero runtime condition
AST nodes.

No implementation regex interprets passive descriptions. Localized text is
carried for presentation and audits only.

## Parity interpretation

Parity compares the presence of mapped effect families per compatible state,
not parser rule counts. A first-party efficacy row can encode two stat effects
or two additional-attack attempts, while the current text parser can split or
merge clauses differently. Raw form IDs are never rewritten in the artifact;
the user-confirmed Nappa `4005130 -> 4005131` alias is applied only by the
comparison layer.

## Gate to DB3

DB3 should map causality and timing enums incrementally from exact golden joins,
then project a source-neutral condition/effect DTO. It must retain unknown
leaves and compare condition semantics before any production cutover.
