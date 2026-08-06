"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDatabaseTeamAnalysisDb38Report = void 0;
const rows = (x) => Object.entries(x).map(([k, v]) => `| \`${k}\` | ${v} |`).join("\n");
function renderDatabaseTeamAnalysisDb38Report(d, c) {
    const examples = d.ruleIncrements.filter(r => r.legacyComparison.status === "confirmed_conflict").slice(0, 8).map(r => `- \`${r.stateKey}\` / passive \`${r.passiveSkillId}\`: legacy \`ki\`, native \`modifier_battle_gauge\`.`).join("\n");
    return `# Database Team Analysis experiment — DB38 incremental status

DB38 follows efficacy type 98 from structured SQLite values into the native incremental handler, its signed cap fold, replacement of the previous efficacy-info record and six concrete output fields.

- Rules/effects/states/passive IDs: **${c.ruleCount}/${c.effectCount}/${c.affectedStateCount}/${c.passiveSkillCount}**.
- Supported field and accumulation mechanics: **${c.supportedFieldRuleCount}**.
- Full simulation status: **${c.simulationPartialRuleCount} partial**, **${c.simulationUnknownRuleCount} unknown**.
- Confirmed legacy conflicts: **${c.confirmedLegacyConflictCount} rules across ${c.conflictStateCount} states**.

| eff_value3 | Rules |
|---|---:|
${rows(c.ruleCountsByOutputSelector)}

Values 0–5 select modifier attack, modifier defense, critical probability, dodge probability, resist-damage rate and modifier battle gauge. The handler truncates \`eff_value1\` and \`eff_value2\` toward zero into signed int32 increment/cap values. It starts the aggregate at zero, conditionally appends the current increment when a local gate returns bit 0 clear, then traverses stored 40-byte entries from vector begin to end. Each native \`add w\` wraps modulo \`2^32\` before the sign-directed cap. It removes the matching previous efficacy-info entry and emits one aggregate field. Selector 4 converts a positive aggregate to \`max(100 - aggregate, 0)\` before storing the resist-damage rate; its negative branch stores the negated aggregate.

The local history helper and its structural branch condition are proved and losslessly pinned, but the event semantics behind that gate and the reset/expiry window remain unknown. Timing, target, lifecycle and calculation operation remain independent; non-ATK/DEF calculation buckets and the battle-gauge product unit/formula are partial.

## Confirmed parser conflict

The legacy DB3/DB11 projector labels selector 5 as \`ki\`. Native code instead calls the battle-gauge generator, which writes the field read by \`getModifierBattleGaugeValue\`. This is a direct field conflict, not a naming preference.

${examples}
`;
}
exports.renderDatabaseTeamAnalysisDb38Report = renderDatabaseTeamAnalysisDb38Report;
//# sourceMappingURL=team-analysis-db38-report.js.map