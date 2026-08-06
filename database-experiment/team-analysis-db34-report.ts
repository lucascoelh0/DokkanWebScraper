import { DatabaseTeamAnalysisDb34Coverage, DatabaseTeamAnalysisDb34Dataset } from "./team-analysis-db34-contract";

const rows = (values: Record<string, number>) => Object.entries(values).map(([key, value]) => `| \`${key}\` | ${value} |`).join("\n");
export function renderDatabaseTeamAnalysisDb34Report(dataset: DatabaseTeamAnalysisDb34Dataset, coverage: DatabaseTeamAnalysisDb34Coverage) {
    const candidates = dataset.legacyComparison.candidateConflicts.map(value => `- \`${value.stateKey}\`: DB rule \`${value.databaseRuleKey}\`, current rule \`${value.currentRuleKey}\`, passive \`${value.passiveSkillId}\`, raw timing \`${value.rawExecutionTimingType}\`.`).join("\n") || "- None.";
    return `# Database Team Analysis experiment — DB34 basic ATK/DEF calculation buckets

DB34 follows passive efficacy types 1–3 from SQLite modifiers through their native handlers, ATK/DEF information records, timing-filtered consumers and the stat-difference accumulator. It promotes a bounded combat-calculation bucket, not a generic meaning for every execution timing.

- Basic stat rules/applications: **${coverage.basicStatRuleCount}/${coverage.statApplicationCount}**.
- Passive IDs/states affected: **${coverage.affectedPassiveSkillCount}/${coverage.affectedStateCount}**.
- Supported bucket rules/applications: **${coverage.supportedBucketRuleCount}/${coverage.supportedBucketApplicationCount}**.
- Unknown bucket rules/applications: **${coverage.unknownBucketRuleCount}/${coverage.unknownBucketApplicationCount}**.
- Legacy exact-effect alignments: **${coverage.alignedBasicStatRuleCount}**; confirmed/candidate conflicts: **0/${coverage.candidateLegacyConflictCount}**.

## Native buckets

| Bucket | Rules |
|---|---:|
${rows(coverage.ruleCountsByBucket)}

\`former_passive_stat\` consumes raw timings 1, 3, 11, 15 and 18. \`latter_passive_stat\` consumes 4, 5, 6, 7, 9 and 14. These are native accumulator identities. They do not rename unknown execution events and do not imply start-of-turn or on-attack labels. Timing 12 remains unknown for this stat family.

## Stat applications

| Bucket/stat | Applications |
|---|---:|
${rows(coverage.applicationCountsByStatAndBucket)}

Efficacy 1 reads \`eff_value1\` into ATK; efficacy 2 reads \`eff_value1\` into DEF; efficacy 3 reads \`eff_value1\` into ATK and \`eff_value2\` into DEF. Calculation options remain the independent DB31 operation dimension. The consumer proves their operand unit here: raw options 0/1/4 use stat points, while 2/3 use percentage points of the current stat.

| Operation | Applications |
|---|---:|
${rows(coverage.applicationCountsByOperation)}

| Operand unit | Applications |
|---|---:|
${rows(coverage.applicationCountsByOperandUnit)}

## Precision and stacking boundary

The basic handler converts each SQLite numeric modifier to \`float32\`, then widens it to \`double\`. The stat accumulator sums truncated flat changes, combines percent changes into a double multiplier, floors a negative percent multiplier at zero, and uses the last assignment encountered in native efficacy-list order. The final bounded result is the selected assignment or the truncated multiplied base plus flat delta, expressed as a difference from the base. This consumer-specific precision supersedes any temptation to apply DB31's standalone float dispatcher rounding to the final ATK/DEF accumulation.

Cross-bucket formula order, target selection, duration, recurrence, expiry and reset remain unknown. The contract therefore keeps every application \`partial\`. Every current application has a supported bucket; future basic-stat timing values outside the proved groups remain lossless with bucket \`unknown\` instead of aborting the dataset.

## Legacy comparison

The parser has no native former/latter vocabulary. DB13 provides diagnostic unique effect-set alignments, not identity proof, so DB34 reports no confirmed conflict. Four latter-bucket rows align to legacy \`passive_start_of_turn\` and are retained as candidates:

${candidates}
`;
}
