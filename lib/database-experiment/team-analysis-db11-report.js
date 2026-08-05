"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDatabaseTeamAnalysisDb11Report = void 0;
function percent(value, total) { return total === 0 ? "0.0%" : `${(value * 100 / total).toFixed(1)}%`; }
function compact(values) {
    const visible = values.slice(0, 8);
    const remaining = values.length - visible.length;
    return `${visible.join("; ") || "none"}${remaining > 0 ? `; … +${remaining}` : ""}`;
}
function renderDatabaseTeamAnalysisDb11Report(coverage, parity, parserVersion, db10Coverage) {
    const typeRows = [43, 51, 55].map(type => { const comparison = parity.occurrenceCountsByType[String(type)]; return `| ${type} | ${coverage.runtimePredicateCountsByType[String(type)]} | ${coverage.affectedStateCountsByType[String(type)]} | ${comparison.currentStateSignatures} | ${comparison.matchedStateSignatures} |`; }).join("\n");
    const examples = parity.examples.slice(0, 12).map(value => `- \`${value.stateKey}\`: DB-only [${compact(value.databaseOnly)}]; current-only [${compact(value.currentOnly)}].`).join("\n");
    return `# Database Team Analysis experiment — DB11 runtime predicate integration\n\nCompared with current parser \`${parserVersion}\`. DB11 applies only the three DB10-supported causality semantics to the full DB7 state dataset.\n\n` +
        `## Outcome\n\n- Runtime predicates: **${coverage.runtimePredicateCount}** over **${coverage.uniqueRuntimeCausalityCount}** unique causalities.\n` +
        `- Promoted structural signatures DB/current/matched: **${parity.promotedStructuralSignatures.database}/${parity.promotedStructuralSignatures.current}/${parity.promotedStructuralSignatures.matched}** (${percent(parity.promotedStructuralSignatures.matched, parity.promotedStructuralSignatures.database)} of DB signatures).\n` +
        `- Supported-condition delta: **+${coverage.supportedConditionDelta}**; supported-rule delta: **+${coverage.supportedRuleDelta}**.\n` +
        `- Type 3 remains partial for **${coverage.partialType3OccurrenceCount}** occurrences.\n\n` +
        `| Causality | Projected occurrences | DB states | Current state signatures | Matched state signatures |\n| ---: | ---: | ---: | ---: | ---: |\n${typeRows}\n\n` +
        `## Projection rules\n\n- 43 → \`attacks_evaded/self/current_event\`.\n- 51 → \`turn_from_entry <= cau_val1\`.\n- 55 → \`turn_from_entry >= cau_val1 + 1\`, the exact integer normalization of the native \`> cau_val1\`. The raw threshold and native comparator remain in provenance.\n\n` +
        `No localized passive text is parsed. Invalid thresholds stay unknown (43/51/55: ${[43, 51, 55].map(type => coverage.unprojectedSupportedTypeOccurrencesByType[String(type)]).join("/")}), DB10 code hashes remain attached to every projection, and untouched DB7 condition branches remain structurally preserved. Parity signatures include normalized all/any ancestry and NOT polarity.\n\n` +
        `## Important parity conflicts\n\n${examples || "None."}\n\n` +
        `## Gate assessment\n\nDB11 proves that selected first-party predicates can be integrated into the state contract with measurable parity. It remains NO-GO for production replacement because ${db10Coverage.remainingUnresolvedTypeCount} causality gap types (${db10Coverage.remainingUnresolvedOccurrenceCount} occurrences), efficacy semantics, recurrence and calculation buckets remain unresolved.\n`;
}
exports.renderDatabaseTeamAnalysisDb11Report = renderDatabaseTeamAnalysisDb11Report;
//# sourceMappingURL=team-analysis-db11-report.js.map