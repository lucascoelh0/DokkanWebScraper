import { DatabaseTeamAnalysisDb29Coverage, DatabaseTeamAnalysisDb29Dataset } from "./team-analysis-db29-contract";
function rows(values: Record<string, number>): string { return Object.entries(values).map(([value, count]) => `| ${value} | ${count} |`).join("\n"); }
export function renderDatabaseTeamAnalysisDb29Report(dataset: DatabaseTeamAnalysisDb29Dataset, coverage: DatabaseTeamAnalysisDb29Coverage): string {
    const examples = dataset.resolutions.slice(0, 5).map(value => `- \`${value.stateKey}\`, rule \`${value.ruleKey}\`: target_type \`${value.effect.target.structuredTargetType.raw}\`, timing \`${value.activation.executionTimingType}\`, probability \`${value.activation.probability}\`.`).join("\n");
    return `# Database Team Analysis experiment — DB29 native attack break

DB29 promotes the minimum native semantics of passive efficacy type \`111\`. Each activated entry is an attack-break marker scoped to a runtime enemy index. For one enemy, the consumer counts matching markers and selects the first N eligible actions from that enemy's current action order.

- Resolved rules/states/passive IDs: **${coverage.resolutionCount}/${coverage.affectedStateCount}/${coverage.uniquePassiveSkillCount}**.
- Supported effects / partial records: **${coverage.supportedEffectCount}/${coverage.partialResolutionCount}**.
- Rules whose three generic efficacy values are all zero: **${coverage.zeroRawValueRuleCount}**.
- Inherited/new semantic promotions: **3/1**.

## Proven behavior

The efficacy-111 handler copies the runtime enemy index into \`AbilityEfficacyInfo::deck_index\` and registers a no-value marker. \`AbilityManager::getAttackBreakingActions\` counts markers with matching enemy index, traverses current actions in their existing order and returns at most one eligible action per marker. Eligibility is preserved as raw predicates: a nonzero 32-bit field at action offset 8 and bit 0 clear at byte offset 44. The selection path does not read \`eff_value1..3\`; those raw columns remain lossless in the artifact.

## Raw SQLite distributions

| execution_timing_type | Rules |
|---:|---:|
${rows(coverage.executionTimingTypeCounts)}

| target_type | Rules |
|---:|---:|
${rows(coverage.targetTypeCounts)}

| calc_option | Rules |
|---:|---:|
${rows(coverage.calculationOptionCounts)}

| is_once | Rules |
|---:|---:|
${rows(coverage.isOnceCounts)}

| probability | Rules |
|---:|---:|
${rows(coverage.probabilityCounts)}

## Examples

${examples}

## Boundary

The human names of raw condition masks \`0x01000000\` and \`0x02000000\`, structured target types 3/4, execution timing types 4/5, calculation options 0/2, probability application order, action eligibility field names, exact duration/recurrence, the removed-marker predicate and efficacy-112 invalidation interaction remain unknown. The observed removal path is recorded only by raw mask. All records therefore remain \`partial\`; DB29 is sufficient for Team Analysis to represent attack-break capacity, but not yet for a turn engine to schedule or expire it deterministically.
`;
}
