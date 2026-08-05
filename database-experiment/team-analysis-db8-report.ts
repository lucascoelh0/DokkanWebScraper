import { DatabaseTeamAnalysisDb8Coverage, DatabaseTeamAnalysisDb8Dataset } from "./team-analysis-db8-contract";

function table(rows: Array<{ type: unknown, count: number, states: number, reason: string }>): string {
    return ["| Type | Occurrences/rules | States | Blocking evidence |", "| ---: | ---: | ---: | --- |",
        ...rows.map(row => `| ${String(row.type)} | ${row.count} | ${row.states} | ${row.reason} |`)].join("\n");
}

export function renderDatabaseTeamAnalysisDb8Report(dataset: DatabaseTeamAnalysisDb8Dataset, coverage: DatabaseTeamAnalysisDb8Coverage): string {
    const causalityRows = dataset.causalityGaps.slice(0, 15).map(value => ({ type: value.causalityType, count: value.occurrenceCount, states: value.affectedStateCount, reason: value.requiredEvidence.join(", ") }));
    const efficacyRows = dataset.efficacyGaps.slice(0, 15).map(value => ({ type: value.efficacyType, count: value.ruleCount, states: value.affectedStateCount, reason: value.requiredEvidence.join(", ") }));
    const examples = dataset.causalityGaps.filter(value => [3, 34, 43, 51, 55].includes(Number(value.causalityType))).flatMap(value => value.samples.slice(0, 1).map(sample =>
        `- causality ${String(value.causalityType)}: \`${sample.stateKey}\`, rule \`${sample.ruleKey}\`, row \`${sample.sourceRowId}\`; raw domains ${JSON.stringify(value.rawValueDomains)}.`));
    return `# Database Team Analysis experiment — DB8 evidence gaps\n\n` +
        `DB8 is a diagnostic evidence gate over DB7. It performs **${dataset.semanticPromotionCount} semantic promotions**: unresolved numeric values remain unknown or partial.\n\n` +
        `## Outcome\n\n` +
        `- Causality gap types/occurrences: **${coverage.causalityGapTypeCount}/${coverage.causalityGapOccurrenceCount}**.\n` +
        `- Efficacy gap types/rules: **${coverage.efficacyGapTypeCount}/${coverage.efficacyGapRuleCount}**.\n` +
        `- Type-41 name-token occurrences: **${dataset.crossCuttingGaps.nameTokenDictionaryOccurrenceCount}**.\n` +
        `- Unknown type-46 masks: **${dataset.crossCuttingGaps.unknownClassTypeMaskOccurrenceCount}**.\n` +
        `- Combat-history gaps: **${coverage.combatHistoryGapCount}** occurrences across **${coverage.combatHistoryGapAffectedStateCount}** states; recurrence/calculation-bucket unknown: **${dataset.crossCuttingGaps.combatHistoryRecurrenceUnknownCount}/${dataset.crossCuttingGaps.calculationBucketUnknownCount}**.\n\n` +
        `## Highest-impact causality gaps\n\n${table(causalityRows)}\n\n` +
        `The SQLite snapshot has no named causality enum or join that proves these predicates. Raw tuple domains, IDs and row provenance are preserved in the artifact.\n\n` +
        `## Highest-impact efficacy gaps\n\n${table(efficacyRows)}\n\n` +
        `\`passive_skill_effects.script_name\` is absent for almost all affected skills and opaque (for example \`pse0069\`) when present. DB8 does not treat script asset IDs as semantic labels. Each combat-history gap separately preserves state/rule, causality row, raw passive fields and required evidence.\n\n` +
        `## Concrete unresolved joins\n\n${examples.join("\n")}\n\n` +
        `## Gate assessment\n\n` +
        `SQLite-only semantic discovery is exhausted for these families. Full Team Analysis remains **NO-GO**. The next evidence-bearing gate must ingest a first-party named enum/runtime export or a structurally keyed asset that identifies the numeric codes; current scraped text may be used only for parity, not to promote a database enum.\n`;
}
