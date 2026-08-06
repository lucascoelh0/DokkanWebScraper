import { DatabaseTeamAnalysisDb30Coverage } from "./team-analysis-db30-contract";
function rows(v: Record<string, number>): string { return Object.entries(v).map(([k, n]) => `| ${k} | ${n} |`).join("\n"); }
export function renderDatabaseTeamAnalysisDb30Report(c: DatabaseTeamAnalysisDb30Coverage): string { return `# Database Team Analysis experiment — DB30 native efficacy removal

DB30 promotes the exact native behavior of efficacy type \`110\`: it removes matching efficacy-info entries and inactivates both the matching target status, when present, and the source status executing the operation.

- Resolved rules/states/source passive IDs: **${c.resolutionCount}/${c.affectedStateCount}/${c.uniquePassiveSkillCount}**.
- Candidate passive-ID joins / unknown target family: **${c.candidatePassiveTargetJoinCount}/${c.unknownTargetJoinCount}**.
- Partial records: **${c.partialResolutionCount}**.

The three SQLite values are consumed as raw selectors: \`eff_value1 → SkillType\`, \`eff_value2 → skill ID\`, and \`eff_value3 → removal category\`. Removal requires exact equality of category, selected deck index, skill type and skill ID. Skill type 2 has a reproducible ID candidate in \`passive_skills\`, kept \`partial\` because the numeric SkillType name is not independently proven; skill type 15 remains unnamed and unjoined. The lookup category is raw 1 only for skill types 10/13/18 and raw 0 otherwise. If the source status target type is raw 16, the target-status lookup uses the alternate runtime deck index at \`CallChangeParam + 72\`; the enum name remains unknown.

| Raw skill type | Rules |
|---:|---:|
${rows(c.skillTypeCounts)}

| Raw removal category | Rules |
|---:|---:|
${rows(c.removalCategoryCounts)}

| Raw execution timing | Rules |
|---:|---:|
${rows(c.executionTimingTypeCounts)}

## Boundary

Skill type 15's dictionary, category names, target type 16's name, the status-zero enum name, activation timing, calculation bucket, probability order and recurrence remain unknown. Direct zero writes and the handler/control-flow identity support the operation label \`inactivated\`, but the raw status value is preserved. DB30 can model expiry/removal dependencies; a turn simulator must not schedule them until timing semantics are proven.
`; }
