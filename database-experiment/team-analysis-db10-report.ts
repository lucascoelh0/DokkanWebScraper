import { DatabaseTeamAnalysisDb10Coverage, DatabaseTeamAnalysisDb10Dataset } from "./team-analysis-db10-contract";

export function renderDatabaseTeamAnalysisDb10Report(dataset: DatabaseTeamAnalysisDb10Dataset, coverage: DatabaseTeamAnalysisDb10Coverage): string {
    const rows = dataset.causalityResolutions.map(value => `| ${value.causalityType} | ${value.status} | ${value.operation} | ${value.comparator} | ${value.parameterReads.join(", ") || "none"} | ${value.ignoredParameters.join(", ")} | ${value.occurrenceCount} | ${value.unknowns.join(", ") || "—"} |`).join("\n");
    return `# Database Team Analysis experiment — DB10 native semantics\n\n` +
        `DB10 audits native handler implementations and joins their parameter reads back to structured \`skill_causalities\` columns. It does not parse localized descriptions or promote a handler name by itself.\n\n` +
        `## Result\n\n` +
        `- Fully promoted causality types: **${coverage.supportedTypeCount}**, covering **${coverage.promotedOccurrenceCount}** occurrences and **${coverage.promotedAffectedStateCount}** states.\n` +
        `- Partial native resolutions: **${coverage.partialTypeCount}**, covering **${coverage.partialResolutionOccurrenceCount}** occurrences that remain unresolved.\n` +
        `- Remaining unresolved: **${coverage.remainingUnresolvedTypeCount}/${coverage.sourceGapTypeCount}** types and **${coverage.remainingUnresolvedOccurrenceCount}/${coverage.sourceGapOccurrenceCount}** occurrences.\n` +
        `- Efficacy promotions: **0**.\n\n` +
        `| Type | Status | Operation | Comparator | Parameters read | Parameters ignored | Uses | Remaining unknowns |\n| ---: | --- | --- | --- | --- | --- | ---: | --- |\n${rows}\n\n` +
        `## Confirmed boundaries\n\n` +
        `- Type 43 does not dereference the SkillCausality payload and reads a dodge-success status flag.\n` +
        `- Type 51 compares appearance-turn count \`<= cau_val1\`; type 55 compares it \`> cau_val1\`. Both require the native appearance-initialized gate.\n` +
        `- Type 3 reads only \`cau_val1\` and compares \`trunc(runtime_gauge_value / unnamed_virtual_denominator * 100) >= cau_val1\`. The metric identity, denominator identity and unit remain unknown, so it is not promoted.\n\n` +
        `## Provenance\n\n` +
        `The payload chains DB8 \`${dataset.sourceDb8.sha256}\`, DB9 \`${dataset.sourceDb9.sha256}\`, native runtime \`${dataset.nativeRuntime.sha256}\` and semantic layout \`${dataset.nativeSemanticsLayout.sha256}\`. Every handler includes its VMA, byte size and code SHA-256.\n`;
}
