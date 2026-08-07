import { DatabaseTeamAnalysisDb50Coverage } from "./team-analysis-db50-contract";

export function renderDatabaseTeamAnalysisDb50Report(coverage: DatabaseTeamAnalysisDb50Coverage): string {
    return `# DB50 — Counter selection and resistance consumer

DB50 extends the DB24 efficacy-120 payload through native counter selection and the bounded enemy-source intermediate-damage consumer. It does not claim the external activation event or the damage dealt by the counter itself.

## Proven semantics

- The type-120 registration handler reads a runtime field at \`CallChangeParam + 4\`: zero registers the behavior and nonzero skips it. The product meaning of that field remains unknown.
- Normal counter selection filters efficacy records by literal type 120 and the requested deck index, then chooses the greatest \`resistDamageRate\`. Strict greater-than replacement means the first efficacy-info record wins ties.
- The general selector tries a type-128 dodge-counter candidate before the type-120 normal candidate. The caller boolean and the SQLite binding for type 128 remain unknown.
- Enemy-source intermediate damage uses \`pre - truncTowardZero(pre × resistDamageRate / 100)\`. The consumer is after efficacy-13 mitigation and before DEF and guard. A separate flag is set when the selected rate exceeds 99.
- The remaining DB24 fields, \`increaseDamagePercent\` and \`battleScriptNo\`, remain structured payloads but their downstream consumers are not promoted by this gate.

## Coverage

| Metric | Count |
|---|---:|
| Rules | ${coverage.ruleCount} |
| States | ${coverage.affectedStateCount} |
| Supported payload fields | ${coverage.supportedPayloadFieldCount} |
| Supported target / timing | ${coverage.supportedTargetCount} / ${coverage.supportedTimingCount} |
| Supported selection / damage consumer | ${coverage.supportedSelectionCount} / ${coverage.supportedDamageCount} |
| Partial full simulations | ${coverage.partialSimulationCount} |

Resistance-rate distribution: ${Object.entries(coverage.resistRateCounts).map(([value, count]) => `\`${value}\`: ${count}`).join(", ")}. Probability remains raw and independent: ${Object.entries(coverage.probabilityCounts).map(([value, count]) => `\`${value}\`: ${count}`).join(", ")}.

## Candidate selection and remaining boundaries

The first bounded candidate was \`AbilityManager::clearExecCount\`, relevant to 1,049 once-only rules. A streamed scan of named symbol intervals found no direct calls or relocation/vtable reference, so its trigger and reset epoch require dynamic observation and were not promoted. High-volume unknown efficacy types 103 and 119 also retain null runtime dispatch slots in the pinned DB9 evidence.

DB50 selected efficacy 120 because its 50 rules / 38 states expose a reproducible SQLite → runtime behavior → selector → damage-operand chain. External counter activation, caller-boolean semantics, type-128 binding, probability application, lifecycle/reset/expiry, battle-script behavior, counter outgoing-damage calculation and final HP application remain partial or unknown.
`;
}
