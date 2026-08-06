"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb34Dataset = void 0;
const team_analysis_db34_builder_1 = require("./team-analysis-db34-builder");
const id = (row) => row.id === null || row.id === undefined ? undefined : String(row.id);
function validateDatabaseTeamAnalysisDb34Dataset(dataset, db11, db31, db33, tables) {
    const failures = [];
    if (dataset.contract !== "dokkan-team-analysis-basic-stat-calculation-bucket-experiment" || dataset.contractVersion !== "0.33.0" || dataset.sourceDb11.contractVersion !== "0.10.0" || dataset.sourceDb31.contractVersion !== "0.30.0" || dataset.sourceDb33.contractVersion !== "0.32.0")
        failures.push("contract identity");
    if (dataset.generatedAt !== db33.generatedAt || dataset.sourceSnapshotVersion !== db33.sourceSnapshotVersion || dataset.sourceDatabaseSha256 !== db33.sourceDatabaseSha256 || dataset.currentTeamAnalysis.sha256 !== db33.currentTeamAnalysis.sha256 || dataset.nativeRuntime.sha256 !== db33.nativeRuntime.sha256 || dataset.nativeRuntime.sizeBytes !== db33.nativeRuntime.sizeBytes)
        failures.push("source lineage");
    const rows = new Map((tables.passive_skills ?? []).map(row => [id(row), row]));
    const sourceRules = new Map();
    for (const state of db11.states)
        for (const rule of state.passive?.rules ?? [])
            if ([1, 2, 3].includes(Number(rule.source.efficacyType)))
                sourceRules.set(`${state.stateKey}|${rule.ruleKey}`, { passiveSkillId: rule.source.passiveSkillId, efficacyType: rule.source.efficacyType, rawTiming: rule.source.executionTimingType });
    const operations = new Map(db31.ruleProjections.map(value => [`${value.stateKey}|${value.ruleKey}`, value]));
    const timings = new Map(db33.ruleTimings.map(value => [`${value.stateKey}|${value.ruleKey}`, value]));
    const seen = new Set();
    let losslessReconstructionCount = 0;
    for (const application of dataset.statApplications) {
        const key = `${application.stateKey}|${application.ruleKey}`, unique = `${key}|${application.stat}`, source = sourceRules.get(key), row = rows.get(application.passiveSkillId), operation = operations.get(key), timing = timings.get(key);
        if (seen.has(unique))
            failures.push(`duplicate ${unique}`);
        seen.add(unique);
        if (!source || !row || !operation || !timing || source.passiveSkillId !== application.passiveSkillId || Number(source.efficacyType) !== application.efficacyType || JSON.stringify(source.rawTiming) !== JSON.stringify(application.rawExecutionTimingType)) {
            failures.push(`source mismatch ${unique}`);
            continue;
        }
        const shape = (0, team_analysis_db34_builder_1.projectDb34BasicStatShape)(source.efficacyType).find(value => value.stat === application.stat), bucket = (0, team_analysis_db34_builder_1.projectDb34CalculationBucket)(source.rawTiming), unit = (0, team_analysis_db34_builder_1.db34OperandUnit)(operation.operation);
        if (!shape || shape.sourceColumn !== application.sourceColumn || JSON.stringify(bucket) !== JSON.stringify(application.calculationBucket) || unit.status !== "supported" || JSON.stringify(unit) !== JSON.stringify(application.operandUnit) || JSON.stringify(operation.operation) !== JSON.stringify(application.calculationOperation) || JSON.stringify(timing.executionTiming) !== JSON.stringify(application.executionTiming))
            failures.push(`projection mismatch ${unique}`);
        const raw = row[application.sourceColumn];
        if (JSON.stringify(raw ?? null) !== JSON.stringify(application.rawModifier) || application.runtimeModifierFloat32 !== Math.fround(Number(raw)))
            failures.push(`modifier mismatch ${unique}`);
        else
            losslessReconstructionCount++;
        if (application.semanticStatus !== "partial" || Object.values(application.independentDimensions).some(value => value !== "unknown") || application.provenance.database.rowId !== application.passiveSkillId || application.provenance.runtime.sha256 !== dataset.nativeRuntime.sha256 || application.provenance.runtime.evidenceSha256 !== dataset.nativeEvidence.sha256)
            failures.push(`boundary or provenance ${unique}`);
    }
    const expectedApplicationCount = [...sourceRules.values()].reduce((sum, value) => sum + (0, team_analysis_db34_builder_1.projectDb34BasicStatShape)(value.efficacyType).length, 0);
    if (seen.size !== expectedApplicationCount || dataset.statApplications.length !== expectedApplicationCount)
        failures.push(`cardinality ${seen.size}/${expectedApplicationCount}`);
    if (dataset.sourcePopulation.ruleCount !== db33.ruleTimings.length || dataset.sourcePopulation.effectCount !== db33.ruleTimings.reduce((sum, value) => sum + value.effectCount, 0))
        failures.push("source population");
    if (dataset.legacyComparison.confirmedConflictCount !== 0 || dataset.legacyComparison.boundary !== "db13_alignment_only_no_legacy_bucket_equivalence" || dataset.legacyComparison.candidateConflicts.some(value => value.status !== "candidate" || value.firstPartyBucket !== "latter_passive_stat" || value.legacyBucket !== "passive_start_of_turn"))
        failures.push("legacy comparison boundary");
    return { schemaVersion: 1, valid: failures.length === 0, applicationCount: dataset.statApplications.length, losslessReconstructionCount, failures };
}
exports.validateDatabaseTeamAnalysisDb34Dataset = validateDatabaseTeamAnalysisDb34Dataset;
//# sourceMappingURL=team-analysis-db34-validator.js.map