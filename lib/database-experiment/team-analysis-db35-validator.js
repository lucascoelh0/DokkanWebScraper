"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb35Dataset = void 0;
const team_analysis_db35_builder_1 = require("./team-analysis-db35-builder");
const id = (row) => row.id === null || row.id === undefined ? undefined : String(row.id);
const aggregateCurrentScopes = (current) => {
    const result = {};
    for (const state of current.states)
        for (const rule of state.passive?.rules ?? [])
            for (const effect of rule.effects ?? []) {
                const target = effect.target;
                const scope = target && typeof target === "object" && !Array.isArray(target) && typeof target.scope === "string"
                    ? String(target.scope)
                    : "absent";
                result[scope] = (result[scope] ?? 0) + 1;
            }
    return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right)));
};
function validateDatabaseTeamAnalysisDb35Dataset(dataset, source, tables, expectedSources) {
    const failures = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-team-analysis-passive-target-native-dispatch-experiment" || dataset.contractVersion !== "0.34.0" || dataset.inheritedSemanticPromotionCount !== 15 || dataset.semanticPromotionCount !== 9)
        failures.push("contract identity");
    if (dataset.generatedAt !== expectedSources.db33.generatedAt || dataset.sourceSnapshotVersion !== expectedSources.db33.sourceSnapshotVersion || dataset.sourceDatabaseSha256 !== source.sourceSha256 || dataset.sourceDatabaseSha256 !== expectedSources.db33.sourceDatabaseSha256)
        failures.push("source lineage");
    if (JSON.stringify(dataset.sourceDb11) !== JSON.stringify({ fileName: "team-analysis-db11-experiment.json.gz", sha256: expectedSources.db11Sha256, contractVersion: "0.10.0" }) || JSON.stringify(dataset.sourceDb33) !== JSON.stringify({ fileName: "team-analysis-db33-player-attack-setup-timing.json.gz", sha256: expectedSources.db33Sha256, contractVersion: "0.32.0" }))
        failures.push("artifact lineage");
    if (JSON.stringify(dataset.currentTeamAnalysis) !== JSON.stringify({ fileName: "team-analysis.json.gz", sha256: expectedSources.currentSha256 }) || JSON.stringify(dataset.nativeRuntime) !== JSON.stringify({ fileName: "libcocos2dcpp.so", sha256: expectedSources.nativeSha256, sizeBytes: expectedSources.nativeSizeBytes }) || JSON.stringify(dataset.nativeEvidence) !== JSON.stringify({ fileName: "native-passive-target-dispatch-semantics.json", sha256: expectedSources.evidenceSha256 }))
        failures.push("runtime lineage");
    const rows = new Map((tables.passive_skills ?? []).map(row => [id(row), row]));
    const expectedRules = new Map();
    for (const state of source.states)
        for (const rule of state.passive?.rules ?? [])
            expectedRules.set(`${state.stateKey}|${rule.ruleKey}`, { passiveSkillId: rule.source.passiveSkillId, rawTarget: rule.source.targetType, effectCount: rule.effects.length });
    const proofRoles = expectedSources.evidence.codeRegions.map(region => region.role);
    const seen = new Set();
    let losslessReconstructionCount = 0;
    for (const rule of dataset.ruleTargets) {
        const key = `${rule.stateKey}|${rule.ruleKey}`;
        const expected = expectedRules.get(key);
        const row = rows.get(rule.passiveSkillId);
        if (seen.has(key))
            failures.push(`duplicate ${key}`);
        seen.add(key);
        const target = expected ? (0, team_analysis_db35_builder_1.projectDb35Target)(expected.rawTarget) : undefined;
        if (!expected || !row || expected.passiveSkillId !== rule.passiveSkillId || JSON.stringify(expected.rawTarget) !== JSON.stringify(rule.rawTargetType) || expected.effectCount !== rule.effectCount || JSON.stringify(target) !== JSON.stringify(rule.target)) {
            failures.push(`projection ${key}`);
            continue;
        }
        if (JSON.stringify(row.target_type) !== JSON.stringify(rule.rawTargetType) || JSON.stringify(row.sub_target_type_set_id ?? null) !== JSON.stringify(rule.subTarget.rawSetId))
            failures.push(`lossless ${key}`);
        else
            losslessReconstructionCount++;
        const expectedSubTarget = { status: "unknown", rawSetId: row.sub_target_type_set_id ?? null, runtimeAssociation: "unknown", valueTypeSemantics: "unknown", booleanComposition: "unknown" };
        const expectedDimensions = { timing: "independent", operation: "independent", unit: "independent", calculationBucket: "unknown", duration: "unknown", recurrence: "unknown", expiry: "unknown", reset: "unknown" };
        const expectedDatabaseProvenance = { table: "passive_skills", rowId: rule.passiveSkillId, columns: ["target_type", "sub_target_type_set_id"] };
        if (rule.semanticStatus !== "partial" || JSON.stringify(rule.subTarget) !== JSON.stringify(expectedSubTarget) || JSON.stringify(rule.independentDimensions) !== JSON.stringify(expectedDimensions) || JSON.stringify(rule.provenance.database) !== JSON.stringify(expectedDatabaseProvenance))
            failures.push(`boundary ${key}`);
        const projectedTarget = rule.target;
        if (projectedTarget.status === "supported") {
            const handlerRole = expectedSources.evidence.dispatch.slots.find(slot => slot.raw === projectedTarget.value.raw)?.handlerRole;
            const expectedRuntime = { fileName: "libcocos2dcpp.so", sha256: expectedSources.nativeSha256, evidenceFile: "native-passive-target-dispatch-semantics.json", evidenceSha256: expectedSources.evidenceSha256, handlerRole, proofRoles };
            if (!handlerRole || JSON.stringify(rule.provenance.runtime) !== JSON.stringify(expectedRuntime))
                failures.push(`runtime provenance ${key}`);
        }
        else if (rule.provenance.runtime !== undefined)
            failures.push(`unknown runtime provenance ${key}`);
    }
    if (seen.size !== expectedRules.size || dataset.ruleTargets.length !== expectedRules.size)
        failures.push(`cardinality ${seen.size}/${expectedRules.size}`);
    if (JSON.stringify(dataset.legacyComparison.currentAggregateTargetScopes) !== JSON.stringify(aggregateCurrentScopes(expectedSources.current)) || dataset.legacyComparison.directlyComparableRuleCount !== 0 || dataset.legacyComparison.confirmedConflictCount !== 0 || dataset.legacyComparison.boundary !== "aggregate_only_no_first_party_to_legacy_rule_identity")
        failures.push("legacy boundary");
    return { schemaVersion: 1, valid: failures.length === 0, ruleCount: dataset.ruleTargets.length, losslessReconstructionCount, failures };
}
exports.validateDatabaseTeamAnalysisDb35Dataset = validateDatabaseTeamAnalysisDb35Dataset;
//# sourceMappingURL=team-analysis-db35-validator.js.map