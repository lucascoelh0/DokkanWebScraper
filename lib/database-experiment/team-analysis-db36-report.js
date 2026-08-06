"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDatabaseTeamAnalysisDb36Report = void 0;
const rows = (x) => Object.entries(x).map(([k, v]) => `| \`${k}\` | ${v} |`).join("\n");
function renderDatabaseTeamAnalysisDb36Report(c) {
    return `# Database Team Analysis experiment — DB36 sub-target semantics

DB36 closes the SQLite-to-runtime sub-target binding left unknown by DB35. It proves the set lookup, status transport, candidate predicate, AND composition, empty-set identity and all value types present in projected passive rules.

- Supported rules/effects: **${c.supportedRuleCount}/${c.effectCount}**.
- Nonempty/empty-identity rules: **${c.nonemptyRuleCount}/${c.emptyIdentityRuleCount}**.
- Passive IDs/states with filters: **${c.passiveSkillCount}/${c.affectedStateCount}**.
- Distinct nonzero sets: **${c.distinctNonzeroSetCount}**.

| Raw value type | Rules containing type |
|---|---:|
${rows(c.ruleCountsByValueType)}

## Semantics

Values 1/2 include/exclude a first-party card-category ID. Values 4/5 include/exclude a first-party card-unique-info set; its members are joined through \`card_unique_info_set_relations\` and matched against the candidate card's native unique-info getter. A set applies each filter to the prior result, so the composition is AND. An empty set returns the original candidates unchanged.

Value 3 constructs a distinct metamorphic runtime filter, but is absent from projected passive rules and remains partial because its internal battle-state predicate is not yet bounded. Out-of-domain values remain unknown. Sub-target semantics remain independent of top-level target, timing, operation, calculation bucket and lifecycle.
`;
}
exports.renderDatabaseTeamAnalysisDb36Report = renderDatabaseTeamAnalysisDb36Report;
//# sourceMappingURL=team-analysis-db36-report.js.map