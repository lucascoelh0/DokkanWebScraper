"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDatabaseTeamAnalysisDb44Report = void 0;
const rows = (values) => Object.entries(values).map(([value, count]) => `| \`${value}\` | ${count} |`).join("\n");
function renderDatabaseTeamAnalysisDb44Report(dataset, coverage) {
    const examples = dataset.ruleProjections.slice(0, 8).map(value => `- \`${value.stateKey}\`, passive \`${value.passiveSkillId}\`: type ${value.efficacyType}, ${value.statModifier.stat} ${value.statModifier.runtimeModifierFloat32}, operation \`${value.calculationOperation.value}\`, bucket \`${value.calculationBucket.value}\`.`).join("\n");
    return `# Database Team Analysis experiment — DB44 single-stat proportional ATK/DEF

DB44 maps efficacy types \`59\` and \`60\` through their native dispatch handlers. Both handlers write literal \`1\` to the proportional flag at \`CallChangeParam + 0x1c\`; type 59 tail-dispatches to the pure ATK handler and type 60 to the pure DEF handler. Both pure handlers read the same \`eff_value1\` double at offset \`0x28\`, narrow it to float32, and tail-dispatch to the corresponding stat generator. They do not read \`eff_value2\` or \`eff_value3\`.

- Rules / stat applications / states / passive IDs: **${coverage.ruleCount}/${coverage.statApplicationCount}/${coverage.affectedStateCount}/${coverage.passiveSkillCount}**.
- ATK / DEF applications: **${coverage.ruleCountsByStat.attack}/${coverage.ruleCountsByStat.defense}**.
- Supported modifiers, buckets and targets: **${coverage.supportedModifierRuleCount}/${coverage.supportedBucketRuleCount}/${coverage.supportedTargetRuleCount}**.
- Empty AND sub-target identities: **${coverage.emptySubTargetIdentityRuleCount}**.
- Legacy representation gains / confirmed conflicts: **${coverage.legacyRepresentationGainRuleCount}/0**.

## Shared count consumer

The flag, constructor defaults and consumer arithmetic are inherited by content hash from DB39. The emitted efficacy info retains raw ball type \`11\` and bitpattern \`0\`; the consumer uses a signed int32 value from \`InGameCharaData.getObtainedBallTypeNumbers()[11]\`, with zero for an absent map entry, multiplies it by the widened float32 modifier, and applies DB31's operation afterwards.

The semantic name, population and reset window of raw ball type \`11\` remain **unknown**. DB44 therefore does not call it “all Ki spheres”. Operation, target, timing, bucket, duration, recurrence and stacking remain separate dimensions. DB34 provides only the already proved former/latter stat bucket for raw timings 1/4; DB37 provides duration/once-only fields without completing the reset/expiry epoch.

| Efficacy type | Rules |
| ---: | ---: |
${rows(coverage.ruleCountsByEfficacyType)}

| Raw \`calc_option\` | Rules |
| --- | ---: |
${rows(coverage.ruleCountsByCalculationOption)}

| Stat and bucket | Applications |
| --- | ---: |
${rows(coverage.statApplicationsByStatAndBucket)}

## Representative rows

${examples}

## Legacy comparison

All 33 corresponding legacy rules are \`unknown\`. This is a first-party representation gain, not semantic agreement and not proof of a parser conflict. Full combat simulation stays partial until raw ball type 11 population/reset, recurrence/expiry, cross-status stacking and final cross-bucket formula order are proved.
`;
}
exports.renderDatabaseTeamAnalysisDb44Report = renderDatabaseTeamAnalysisDb44Report;
//# sourceMappingURL=team-analysis-db44-report.js.map