"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDatabaseTeamAnalysisDb28Report = void 0;
function renderDatabaseTeamAnalysisDb28Report(coverage) {
    return `# Database Team Analysis experiment — DB28 revival activation counters

DB28 promotes the native counter predicates behind causality types 47 and 54.

- Resolutions/states: **${coverage.resolutionCount}/${coverage.affectedStateCount}**.
- Type 47/54 occurrences: **${coverage.occurrenceCountsByType["47"]}/${coverage.occurrenceCountsByType["54"]}**.
- Type 47/54 unique causalities: **${coverage.uniqueCausalityCountsByType["47"]}/${coverage.uniqueCausalityCountsByType["54"]}**.
- Supported predicates: **${coverage.supportedPredicateCount}**.
- Partial resolutions: **${coverage.partialResolutionCount}**.
- Nonzero type-54 polarity rows in this snapshot: **${coverage.nonzeroPolarityCount}**.
- Semantic promotions: **2**.

The first-party runtime increments \`InGameCharaData +0x268\` after the available-revival efficacy path opens and completes its revival-skill view callback. Revival availability reads the same field, and \`resetActivateRevivalSkillCount\` zeros it. This establishes the field as a resettable revival-skill activation count without relying on a handler name alone.

Type 47 tests whether the ability owner's \`getPureCharaDataCurrent(status.deckIndex)\` activation count is greater than zero and ignores all three causality values. Type 54 scans deck indices 0 through 6 across both \`getPureCharaDataCurrent\` and \`getBackCharaDataCurrent\`; \`cau_val1 == 0\` requires at least one positive count, while nonzero requires none. The current snapshot uses only zero polarity.

The reset trigger/history window, activation timing, recurrence, calculation bucket and overflow behavior remain unknown, so each complete structural predicate is carried inside a partial activation record.
`;
}
exports.renderDatabaseTeamAnalysisDb28Report = renderDatabaseTeamAnalysisDb28Report;
//# sourceMappingURL=team-analysis-db28-report.js.map