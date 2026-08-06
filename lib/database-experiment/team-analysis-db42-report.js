"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDatabaseTeamAnalysisDb42Report = void 0;
const rows = (x) => Object.entries(x).map(([k, v]) => `| \`${k}\` | ${v} |`).join("\n");
function renderDatabaseTeamAnalysisDb42Report(d, c) {
    const examples = d.resolutions.slice(0, 8).map(r => { const s = r.predicate.selector; return `- \`${r.stateKey}\` / causality \`${r.causalityId}\`: all seven resolved party slots must match ${s.kind === "card_category_id" ? `category ID \`${s.categoryId}\`` : `class mask \`${s.rawMask}\` (${s.class})`}.`; }).join("\n");
    return `# Database Team Analysis experiment — DB42 all-team-member conditions

DB42 resolves causality 67 through its native dispatch. It covers **${c.resolutionCount} occurrences**, **${c.uniqueCausalityCount} causality rows**, **${c.affectedPassiveSkillCount} passive skill IDs** and **${c.affectedStateCount} states**.

The handler reads \`cau_val1\` as a submode and \`cau_val2\` as its selector; \`cau_val3\` is not read. Current mode 0 calls the category helper, while mode 2 calls the element/class-bit-pattern helper. Both invoke \`findSpecificGroup\` with raw party mode 0 and threshold 7, traverse the seven native slot offsets \`0x00..0x60\` at stride \`0x10\`, reject unresolved \`MasterCard\` entries or callback-zero entries and require exactly seven accepted partners. Thus missing/unresolved slots do not make the predicate vacuously true.

For mode 0, the callback uses \`Card::getCardCategories\` and exact structured category-ID membership. For mode 2, native mask \`32\` accepts raw awakening values \`{1,3}\` and mask \`64\` accepts \`{2,3}\`. Their Super/Extreme labels reuse DB35's independently pinned raw class predicates; the bit-pattern helper's symbol name alone is not treated as evidence.

| Raw submode | Occurrences |
|---|---:|
${rows(c.rawConditionModeCounts)}

| Class | Occurrences |
|---|---:|
${rows(c.classCounts)}

All ${c.resolutionCount} corresponding legacy conditions were unknown, so DB42 is a representation gain with no confirmed parser conflict. Raw mode 1 is dispatched to a separate helper but is absent from the projected corpus and its full predicate remains unpromoted. Other masks, evaluation timing, duration, recurrence, reset/expiry and calculation bucket remain independent and unknown.

## Examples

${examples}
`;
}
exports.renderDatabaseTeamAnalysisDb42Report = renderDatabaseTeamAnalysisDb42Report;
//# sourceMappingURL=team-analysis-db42-report.js.map