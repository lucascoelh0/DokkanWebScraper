import { DatabaseTeamAnalysisDb33Coverage } from "./team-analysis-db33-contract";

export function renderDatabaseTeamAnalysisDb33Report(coverage: DatabaseTeamAnalysisDb33Coverage) {
    const rows = Object.entries(coverage.rawTimingCounts).map(([raw, count]) => `| ${raw} | ${count} |`).join("\n");
    return `# Database Team Analysis experiment — DB33 player attack setup timing

DB33 proves the bounded meaning of \`passive_skills.exec_timing_type = 4\`. Three native calls load literal 4 into the timing argument of \`AbilityManager::callAbilityStatusExec\` inside \`PlayerAttackDamageAndActionBank::setup\`; the returned values are consumed while the setup result is assembled. A concrete controller caller invokes that setup before passing its result to \`TrySpecialAttackAll\`.

The promotion is exhaustive for the projected passive rules: all three native callers of the public passive creator pass raw category 0; its vtable slot forwards that category to the shared creator; the shared creator writes raw SkillType 2 for every \`AbilityStatusPassive\`; and the base constructor plus passive vtable getters carry category 0 / type 2 to the exact equality filter. The first timing-4 setup call requests that same pair \`(0,2)\`. Transformation, metamorphic and initial setup creation paths are all pinned by code hashes and call-site bytes.

- Newly supported rules/effects: **${coverage.newlySupportedRuleCount}/${coverage.newlySupportedEffectCount}**.
- Newly supported passive IDs/states: **${coverage.newlySupportedPassiveSkillCount}/${coverage.newlySupportedStateCount}**.
- Supported rules after DB33: **${coverage.supportedRuleCount}/${coverage.ruleCount}**.
- Unknown rules after DB33: **${coverage.unknownRuleCount}**.
- Inherited/new semantic promotions: **9/1**.

The promoted event is deliberately named \`player_attack_setup\`. It does not assert equivalence to legacy \`when_attacking\` or \`before_attacking\`, and it does not prove that the attack has executed, landed, dealt damage, or selected a calculation bucket. Target, unit, duration, recurrence, stacking, \`is_once\`, and \`turn\` remain independent unknowns.

## Native call variants

The three calls preserve their other raw selectors instead of naming them: \`(skill_category, skill_type) = (0,2), (0,11), (1,10)\`. Controller call sites cover regular attack order, extra attacks, a wrapper path, and two counter-attack paths; that establishes setup context without claiming a shared combat-event causality.

## Raw timing distribution

| Raw timing | Rules |
|---:|---:|
${rows}

## Legacy comparison boundary

The current parser contains **${coverage.explicitLegacyWhenAttackingEffectCount}** aggregate \`when_attacking\` effects. There is no direct first-party rule identity and no native proof that this text label is equivalent to timing 4, so DB33 records neither agreement nor conflict.
`;
}
