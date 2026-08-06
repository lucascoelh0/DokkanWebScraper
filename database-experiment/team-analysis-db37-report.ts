import { DatabaseTeamAnalysisDb37Coverage } from "./team-analysis-db37-contract";
const rows = (values: Record<string, number>) => Object.entries(values).map(([value, count]) => `| \`${value}\` | ${count} |`).join("\n");

export function renderDatabaseTeamAnalysisDb37Report(coverage: DatabaseTeamAnalysisDb37Coverage) {
    return `# Database Team Analysis experiment — DB37 passive lifecycle

DB37 closes the DB21 field-linkage gap for \`passive_skills.turn\` and \`is_once\`. Both columns are followed through the row constructor, passive status creation and runtime storage into their actual consumers.

- Rules/effects with supported field mechanics: **${coverage.fieldSupportedRuleCount}/${coverage.effectCount}**.
- Distinct passive IDs/states: **${coverage.passiveSkillCount}/${coverage.affectedStateCount}**.
- Once-only rules/effects/states: **${coverage.onceOnlyEnabledRuleCount}/${coverage.onceOnlyEnabledEffectCount}/${coverage.onceOnlyEnabledStateCount}**.
- Simulation status: **${coverage.simulationPartialRuleCount} partial**, **${coverage.simulationUnknownRuleCount} unknown**. No rule is declared lifecycle-complete because the \`clearExecCount\` trigger/epoch remains unknown.

## is_once

The SQLite row constructor normalizes zero to false and every nonzero integer to true. The native viability predicate is \`is_once == 0 || exec_count < 1\`. A successful execution sets the independent executed-this-turn flag and increments \`exec_count\`. \`clearExecCount\` is proved to write zero to every status, but its external/dynamic trigger was not established.

| Raw value | Rules |
|---|---:|
${rows(coverage.ruleCountsByRawIsOnce)}

## turn

The raw value initializes both current and maximum turn counters. A successful execution reloads current from maximum. On an eligible end-turn update, after the independent active, available and internal-turn gates, the status decrements current by one and deactivates when the result is nonpositive. Raw \`-1\` bypasses this decrement path, while the independent \`isEndTurn\` predicate still tests \`current < 1\`; DB37 therefore records it as a sentinel with partial product meaning rather than calling it \`forever\`. The projected snapshot contains only positive values.

| Raw value | Rules |
|---|---:|
${rows(coverage.ruleCountsByRawTurn)}

## Legacy comparison

DB20 had 120 aligned parser residuals expressed as appearance-turn upper bounds: 112 were numerically equal to raw \`turn\` and 8 differed. DB37 proves that the raw field is a status duration counter, not the appearance-turn causality counter. Because those mechanisms are independent, numeric equality is not semantic agreement and the eight differences are not counted as confirmed behavior conflicts without simulator parity. The legacy contract has no explicit \`is_once\`, duration-counter, exec-count epoch or executed-this-turn fields; this is a first-party representation gain.

Target, timing, operation, unit, calculation bucket and stacking remain independent. Recurrence is partial until the exec-count reset epoch and other status-removal paths are proved.
`;
}
