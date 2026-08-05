import { DatabaseTeamAnalysisDb12Coverage, DatabaseTeamAnalysisDb12Dataset, Db12AttributionReason } from "./team-analysis-db12-contract";

const reasons: Db12AttributionReason[] = ["logical_context_mismatch", "polarity_mismatch", "exact_turn_encoding_candidate", "threshold_mismatch", "comparator_mismatch", "absent_in_current", "absent_in_database"];
function compactSignature(value: string): string { const parsed = JSON.parse(value) as Record<string, unknown>; return Object.entries(parsed).map(([key, item]) => `${key}=${item}`).join(", "); }
function list(values: string[]): string { return values.length === 0 ? "None." : values.map(value => `- \`${value}\``).join("\n"); }

export function renderDatabaseTeamAnalysisDb12Report(dataset: DatabaseTeamAnalysisDb12Dataset, coverage: DatabaseTeamAnalysisDb12Coverage): string {
    const rows = reasons.map(reason => `| ${reason} | ${coverage.databaseOnlyCountsByReason[reason]} | ${coverage.currentOnlyCountsByReason[reason]} |`).join("\n");
    const candidates = dataset.exactTurnEncodingCandidates.slice(0, 12).map(value => `- \`${value.stateKey}\`, turn ${value.value}, DB context \`${JSON.parse(value.databaseLowerSignature).logicalContext}\`; rule \`${value.databaseRuleKey}\`.`).join("\n");
    const examples = reasons.flatMap(reason => {
        const database = dataset.databaseOnlyAttributions.find(value => value.reason === reason); const current = dataset.currentOnlyAttributions.find(value => value.reason === reason);
        return [database, current].flatMap(value => value ? [`- **${reason}/${value.side}** \`${value.stateKey}\`: ${compactSignature(value.atom.structuralSignature)}; ${value.sourceRuleKeys.length} source rule(s)${value.candidateSignatureCount ? `; ${value.candidateSignatureCount} candidate(s)` : ""}.`] : []);
    }).join("\n");
    return `# Database Team Analysis experiment — DB12 divergence attribution\n\n` +
        `DB12 reconciles every structural signature counted by DB11 and attributes the residual gaps without promoting new semantics or parsing localized text.\n\n` +
        `## Outcome\n\n- Matched states: **${coverage.matchedStateCount}**.\n- Exact structural matches: **${coverage.exactStructuralMatchCount}**.\n- DB-only/current-only signatures: **${coverage.databaseOnlySignatureCount}/${coverage.currentOnlySignatureCount}**.\n` +
        `- Exact-turn encoding candidates: **${coverage.exactTurnEncodingCandidateCount}** pairs in **${coverage.exactTurnEncodingCandidateStateCount}** state(s), covering **${coverage.databaseOnlyCountsByReason.exact_turn_encoding_candidate}** DB atoms and **${coverage.candidateCurrentExactTurnAtomCount}/${coverage.diagnosticCurrentExactTurnAtomCount}** diagnostic current \`eq\` atoms.\n- State presence gaps DB/current: **${coverage.databaseOnlyStateCount}/${coverage.currentOnlyStateCount}**.\n- Semantic promotions: **0**.\n\n` +
        `| Attribution | DB-only | Current-only |\n| --- | ---: | ---: |\n${rows}\n\n` +
        `## Exact-turn encoding\n\nA candidate requires a first-party \`gte N AND lte N\` pair proven inside one conjunction and a current \`eq N\` atom in the same state. The mathematics of the turn predicate is exact, but DB12 does not claim rule/effect alignment across sources; every candidate therefore remains \`candidate_not_rule_aligned\`.\n\n${candidates || "None."}\n\n` +
        `## Database-only states\n\n${list(dataset.databaseOnlyStateKeys)}\n\n## Current-only states\n\n${list(dataset.currentOnlyStateKeys)}\n\n` +
        `## Representative attributions\n\n${examples || "None."}\n\n` +
        `## Gate assessment\n\nDB12 explains a measurable portion of DB11 divergence as boolean representation rather than numeric disagreement, but most residual signatures remain absent on the opposite side. The next gate should align conditions to effects/rules before any exact-turn canonicalization is admitted into a compatibility projector. Production replacement remains NO-GO.\n`;
}
