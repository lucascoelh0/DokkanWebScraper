"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDatabaseTeamAnalysisDb41Report = void 0;
const rows = (x) => Object.entries(x).map(([k, v]) => `| \`${k}\` | ${v} |`).join("\n");
function renderDatabaseTeamAnalysisDb41Report(d, c) {
    const examples = d.resolutions.slice(0, 8).map(r => `- \`${r.stateKey}\` / causality \`${r.causalityId}\`: at least \`${r.predicate.threshold}\` eligible puzzle enemy with structured category ID \`${r.predicate.selector.categoryId}\`.`).join("\n");
    return `# Database Team Analysis experiment — DB41 enemy category-count thresholds

DB41 resolves causality 34 through its native dispatch and the mode-1 branch of \`AbilityCausalityFunc::findSpecificGroup\`. It covers **${c.resolutionCount} occurrences**, **${c.uniqueCausalityCount} causality rows**, **${c.affectedPassiveSkillCount} passive skill IDs** and **${c.affectedStateCount} states**.

The handler reads \`cau_val1\` as the group mode, creates a one-element selector vector from \`cau_val2\`, and reads \`cau_val3\` as the character-count threshold. Raw mode 1 enumerates current \`PuzzleEnemyData\` entries, ignores null entries, requires a signed int32 field at offset \`0x14c\` to be at least 1, resolves each enemy's first-party \`MasterCard\`, and accepts it when the structured card-category callback returns a nonzero exact-ID match count. Collection stops once partner count reaches the threshold; the final result compares partner \`size()\` unsigned \`>=\` the sign-extended int32 threshold.

| Category ID | Occurrences |
|---|---:|
${rows(c.categoryIdCounts)}

All ${c.resolutionCount} corresponding legacy conditions were unknown, so this is a representation gain with no confirmed parser conflict. The old DB4 scope hypothesis did not support raw mode 1 and is superseded by the native enemy traversal. Modes 0 and 2, the product name of the enemy eligibility field, evaluation timing, duration, recurrence, reset/expiry and calculation bucket remain independent and unknown.

## Examples

${examples}
`;
}
exports.renderDatabaseTeamAnalysisDb41Report = renderDatabaseTeamAnalysisDb41Report;
//# sourceMappingURL=team-analysis-db41-report.js.map