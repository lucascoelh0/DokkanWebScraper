import{DatabaseTeamAnalysisDb40Coverage,DatabaseTeamAnalysisDb40Dataset}from"./team-analysis-db40-contract";const rows=(x:Record<string,number>)=>Object.entries(x).map(([k,v])=>`| \`${k}\` | ${v} |`).join("\n");
export function renderDatabaseTeamAnalysisDb40Report(d:DatabaseTeamAnalysisDb40Dataset,c:DatabaseTeamAnalysisDb40Coverage){const examples=d.resolutions.filter((r,i)=>i<8).map(r=>`- \`${r.stateKey}\` / causality \`${r.causalityId}\`: truncated battle-gauge/cap100 percentage \`${r.predicate.comparator} ${r.predicate.threshold}\`.`).join("\n");return`# Database Team Analysis experiment — DB40 battle-gauge thresholds

DB40 resolves causalities 3 and 4 through the native dispatch, status deck/category getters, current-character lookup, battle-gauge numerator and cap-100 denominator. It covers **${c.resolutionCount} occurrences**, **${c.uniqueCausalityCount} causality rows** and **${c.affectedStateCount} states**.

For raw status category zero, the runtime reads the current character at the status deck index, calls the battle-gauge getter with boolean argument false, divides that signed int32 value by signed int32 \`battleGaugeCap100\` in float32, multiplies by 100 and truncates toward zero. Type 3 tests \`>= cau_val1\`; type 4 tests strict \`< cau_val1\`. A nonzero raw status category yields metric zero without reading character gauge state. The category's product name and the zero-denominator result remain unknown.

| Causality | Occurrences |
|---|---:|
${rows(c.occurrenceCountsByType)}

All ${c.resolutionCount} legacy conditions were previously unknown, so this is a representation gain with no confirmed parser conflict. Condition-evaluation timing, recurrence, calculation bucket and gauge population/reset stay independent and unknown; full simulation is partial.

## Examples

${examples}
`}
