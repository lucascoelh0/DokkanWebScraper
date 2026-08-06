import { DatabaseTeamAnalysisDb39Coverage, DatabaseTeamAnalysisDb39Dataset } from "./team-analysis-db39-contract";
const rows = (values: Record<string, number>) => Object.entries(values).map(([key, value]) => `| \`${key}\` | ${value} |`).join("\n");
export function renderDatabaseTeamAnalysisDb39Report(dataset: DatabaseTeamAnalysisDb39Dataset, coverage: DatabaseTeamAnalysisDb39Coverage) {
    const examples = dataset.ruleProjections.slice(0, 8).map(rule => `- \`${rule.stateKey}\` / passive \`${rule.passiveSkillId}\`: ATK \`${rule.attack.runtimeModifierFloat32}\`, DEF \`${rule.defense.runtimeModifierFloat32}\`, timing \`${rule.rawExecutionTimingType}\`, calc \`${rule.rawCalculationOption}\`.`).join("\n");
    return `# Database Team Analysis experiment — DB39 proportional ATK/DEF by obtained-ball count

DB39 maps efficacy type 61 from SQLite through the native handler and the ATK/DEF accumulator. It adds a first-party representation for **${coverage.ruleCount} rules / ${coverage.sourceEffectCount} source effects / ${coverage.affectedStateCount} states / ${coverage.passiveSkillCount} passive IDs**, producing **${coverage.statApplicationCount} stat applications**.

The handler narrows \`eff_value1\` and \`eff_value2\` to float32, marks the emitted efficacy info as energy-ball proportional and leaves its constructor defaults at raw ball type \`11\` and raw bitpattern \`0\`. The consumer obtains the signed int32 count from \`InGameCharaData.getObtainedBallTypeNumbers()[11]\` (absent key = zero), widens the modifier to double, multiplies by the count, and only then applies DB31's calculation operation. Timings 1 and 4 feed DB34's former/latter passive-stat buckets.

The semantic name of raw ball type \`11\` is **unknown**. This gate therefore does not label it as “all Ki spheres” and does not infer its population/reset window. Target, timing, bucket, operation, lifecycle and recurrence remain independent dimensions. Full simulation stays partial.

- Supported modifier and bucket rules: **${coverage.supportedModifierRuleCount}/${coverage.supportedBucketRuleCount}**.
- Partial count semantics and simulation: **${coverage.countSemanticPartialRuleCount}/${coverage.simulationPartialRuleCount}**.
- Legacy representation gains: **${coverage.legacyRepresentationGainRuleCount}**; confirmed conflicts: **0**. The legacy parser emits only \`unknown\` for this family, so this is a representation gain rather than proof of a parser conflict.

| Timing | Rules |
|---|---:|
${rows(coverage.ruleCountsByTiming)}

| Operation | Rules |
|---|---:|
${rows(coverage.ruleCountsByCalculationOption)}

## Representative rows

${examples}
`;
}
