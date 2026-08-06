"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDatabaseTeamAnalysisDb32Report = void 0;
function renderDatabaseTeamAnalysisDb32Report(c) {
    const rows = Object.entries(c.rawTimingCounts).map(([k, v]) => `| ${k} | ${v} |`).join("\n");
    return `# Database Team Analysis experiment — DB32 execution timing

DB32 proves that \`passive_skills.exec_timing_type = 1\` selects passive execution during the native turn-start sequence. The proof follows the SQLite field through runtime object construction and the equality filter, then observes literal value 1 at two turn-start call sites.

- Supported/unknown rules: **${c.supportedRuleCount}/${c.unknownRuleCount}** of **${c.ruleCount}**.
- Supported effects: **${c.supportedEffectCount}** of **${c.effectCount}**.
- Supported passive IDs/states: **${c.supportedPassiveSkillCount}/${c.supportedStateCount}**.
- Legacy explicit start-of-turn effects: **${c.explicitLegacyStartOfTurnEffectCount}** (aggregate only; no rule identity comparison).

| Raw timing | Rules |
|---:|---:|
${rows}

The supported sequence occurs after character appearance and reversible-result fixation, before support-memory and potential-skill execution. This is execution timing, not a calculation bucket: ATK/DEF phase, unit, target, duration, recurrence, stacking, \`turn\`, and \`is_once\` interactions remain unknown. Values other than 1 are preserved raw and unknown. No parser text or legacy timing label is used as evidence.
`;
}
exports.renderDatabaseTeamAnalysisDb32Report = renderDatabaseTeamAnalysisDb32Report;
//# sourceMappingURL=team-analysis-db32-report.js.map