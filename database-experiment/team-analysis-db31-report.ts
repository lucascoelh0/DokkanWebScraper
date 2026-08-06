import{DatabaseTeamAnalysisDb31Coverage}from"./team-analysis-db31-contract";const rows=(x:Record<string,number>)=>Object.entries(x).map(([k,v])=>`| ${k} | ${v} |`).join("\n");
export function renderDatabaseTeamAnalysisDb31Report(c:DatabaseTeamAnalysisDb31Coverage):string{return`# Database Team Analysis experiment — DB31 SkillCalcOption

DB31 proves the native float operation selected by \`passive_skills.calc_option\`. It does not promote target, timing, calculation bucket, duration, recurrence, stacking or an effect-level unit.

- Rules/effects/passive IDs/states: **${c.ruleCount}/${c.effectCount}/${c.passiveSkillCount}/${c.affectedStateCount}**.
- Supported/unknown rules: **${c.supportedRuleCount}/${c.unknownRuleCount}**.
- Effects attached to supported operations: **${c.supportedEffectCount}**.
- Explicit legacy operation fields / confirmed conflicts: **${c.explicitLegacyOperationEffectCount}/${c.confirmedLegacyConflictCount}**.

| Value | Proven operation |
|---:|---|
| 0 | \`lhs + rhs\` |
| 1 | \`max(lhs - rhs, 0)\` |
| 2 | \`lhs + lhs × rhs / 100\` |
| 3 | \`max(lhs - lhs × rhs / 100, 0)\` |
| 4 | \`rhs\` (lhs ignored) |

| Operation | Rules |
|---|---:|
${rows(c.ruleCountsByOperation)}

| Raw option | Rules |
|---:|---:|
${rows(c.rawOptionCounts)}

The dispatcher indexes five ELF relocation slots. Positive values above 4 use a native add fallback, while negative values index before the table; both remain \`unknown\` at the contract boundary because they are outside the proved enum domain. The legacy parser exposes no explicit calculation-operation field, so DB31 confirms no direct semantic conflict; instead it identifies a representation gap. Units inferred by older projections are not used as authority.
`;}
