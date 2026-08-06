"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb39Dataset = void 0;
const team_analysis_db39_builder_1 = require("./team-analysis-db39-builder");
const id = (value) => value == null ? undefined : String(value);
function validateDatabaseTeamAnalysisDb39Dataset(dataset, db11, db31, db37, tables, expected) {
    const failures = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-team-analysis-energy-ball-proportional-stat-native-semantics-experiment" || dataset.contractVersion !== "0.38.0" || dataset.inheritedSemanticPromotionCount !== 39 || dataset.semanticPromotionCount !== 6)
        failures.push("contract identity");
    if (dataset.generatedAt !== db37.generatedAt || dataset.sourceSnapshotVersion !== db37.sourceSnapshotVersion || dataset.sourceDatabaseSha256 !== db37.sourceDatabaseSha256)
        failures.push("snapshot lineage");
    if (JSON.stringify(dataset.sourceDb11) !== JSON.stringify({ fileName: "team-analysis-db11-experiment.json.gz", sha256: expected.db11Sha256, contractVersion: "0.10.0" }) || JSON.stringify(dataset.sourceDb31) !== JSON.stringify({ fileName: "team-analysis-db31-skill-calc-option.json.gz", sha256: expected.db31Sha256, contractVersion: "0.30.0" }) || dataset.sourceDb34.sha256 !== expected.db34Sha256 || dataset.sourceDb37.sha256 !== expected.db37Sha256)
        failures.push("artifact lineage");
    if (JSON.stringify(dataset.nativeRuntime) !== JSON.stringify({ fileName: "libcocos2dcpp.so", sha256: expected.nativeSha256, sizeBytes: expected.nativeSizeBytes }) || JSON.stringify(dataset.nativeEvidence) !== JSON.stringify({ fileName: "native-energy-ball-proportional-stat-semantics.json", sha256: expected.evidenceSha256 }))
        failures.push("runtime lineage");
    const rows = new Map((tables.passive_skills ?? []).map(row => [id(row.id), row])), source = new Map(db37.ruleLifecycles.map(rule => [`${rule.stateKey}|${rule.ruleKey}`, rule])), operations = new Map(db31.ruleProjections.map(rule => [`${rule.stateKey}|${rule.ruleKey}`, rule]));
    const legacy = new Map();
    for (const state of db11.states)
        for (const rule of state.passive?.rules ?? [])
            legacy.set(`${state.stateKey}|${rule.ruleKey}`, rule.effects[0]?.kind ?? null);
    const proofRoles = expected.evidence.codeRegions.map(region => region.role), seen = new Set();
    let losslessReconstructionCount = 0;
    for (const rule of dataset.ruleProjections) {
        const key = `${rule.stateKey}|${rule.ruleKey}`, lifecycle = source.get(key), operation = operations.get(key), row = rows.get(rule.passiveSkillId), currentKind = legacy.get(key) ?? null;
        if (seen.has(key))
            failures.push(`duplicate ${key}`);
        seen.add(key);
        if (!lifecycle || !operation || !row || Number(row.efficacy_type) !== 61 || lifecycle.passiveSkillId !== rule.passiveSkillId || operation.passiveSkillId !== rule.passiveSkillId || lifecycle.effectCount !== rule.sourceEffectCount) {
            failures.push(`source ${key}`);
            continue;
        }
        losslessReconstructionCount++;
        if (JSON.stringify(rule.attack) !== JSON.stringify((0, team_analysis_db39_builder_1.projectDb39Modifier)("attack", row.eff_value1)) || JSON.stringify(rule.defense) !== JSON.stringify((0, team_analysis_db39_builder_1.projectDb39Modifier)("defense", row.eff_value2)) || JSON.stringify(rule.calculationBucket) !== JSON.stringify((0, team_analysis_db39_builder_1.projectDb39Bucket)(row.exec_timing_type)) || JSON.stringify(rule.calculationOperation) !== JSON.stringify(operation.operation) || JSON.stringify(rule.operandUnit) !== JSON.stringify((0, team_analysis_db39_builder_1.db39OperandUnit)(operation.operation)))
            failures.push(`projection ${key}`);
        if (rule.rawExecutionTimingType !== row.exec_timing_type || rule.rawCalculationOption !== row.calc_option || rule.rawTargetType !== row.target_type || rule.countInput.rawBallType !== 11 || rule.countInput.rawBitpattern !== 0 || rule.countInput.semanticName !== "unknown" || rule.countInput.absentMapEntryValue !== 0)
            failures.push(`raw/count ${key}`);
        const expectedStatus = rule.attack.status === "supported" && rule.defense.status === "supported" && rule.calculationBucket.status === "supported" && rule.calculationOperation.status === "supported" ? "partial" : "unknown";
        if (rule.simulationStatus !== expectedStatus || rule.legacyComparison.currentKind !== currentKind || rule.legacyComparison.status !== (currentKind === "unknown" ? "representation_gain_legacy_unknown" : "not_comparable") || rule.legacyComparison.confirmedConflict !== false)
            failures.push(`boundary/legacy ${key}`);
        const expectedLegacy = currentKind !== null ? { db11RuleKey: rule.ruleKey, db11Sha256: expected.db11Sha256 } : undefined;
        if (JSON.stringify(rule.provenance.database) !== JSON.stringify({ table: "passive_skills", rowId: rule.passiveSkillId, columns: ["efficacy_type", "eff_value1", "eff_value2", "eff_value3", "calc_option", "exec_timing_type", "target_type"] }) || JSON.stringify(rule.provenance.runtime) !== JSON.stringify({ fileName: "libcocos2dcpp.so", sha256: expected.nativeSha256, evidenceFile: "native-energy-ball-proportional-stat-semantics.json", evidenceSha256: expected.evidenceSha256, proofRoles }) || JSON.stringify(rule.provenance.inherited) !== JSON.stringify({ db31RuleKey: rule.ruleKey, db31Sha256: expected.db31Sha256, db34Sha256: expected.db34Sha256, db37RuleKey: rule.ruleKey, db37Sha256: expected.db37Sha256 }) || JSON.stringify(rule.provenance.legacy) !== JSON.stringify(expectedLegacy))
            failures.push(`provenance ${key}`);
    }
    const expectedCount = db37.ruleLifecycles.filter(rule => Number(rows.get(rule.passiveSkillId)?.efficacy_type) === 61).length;
    if (seen.size !== expectedCount || dataset.ruleProjections.length !== expectedCount)
        failures.push(`cardinality ${seen.size}/${expectedCount}`);
    return { schemaVersion: 1, valid: failures.length === 0, ruleCount: dataset.ruleProjections.length, losslessReconstructionCount, failures };
}
exports.validateDatabaseTeamAnalysisDb39Dataset = validateDatabaseTeamAnalysisDb39Dataset;
//# sourceMappingURL=team-analysis-db39-validator.js.map