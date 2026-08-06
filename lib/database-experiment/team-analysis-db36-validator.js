"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb36Dataset = void 0;
const team_analysis_db36_builder_1 = require("./team-analysis-db36-builder");
const id = (value) => value === null || value === undefined ? undefined : String(value);
const integer = (value) => typeof value === "number" && Number.isSafeInteger(value)
    ? value
    : typeof value === "string" && value.trim() !== "" && Number.isSafeInteger(Number(value)) ? Number(value) : undefined;
function validateDatabaseTeamAnalysisDb36Dataset(dataset, db35, tables, expected) {
    const failures = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-team-analysis-passive-sub-target-native-semantics-experiment" || dataset.contractVersion !== "0.35.0" || dataset.inheritedSemanticPromotionCount !== 24 || dataset.semanticPromotionCount !== 5)
        failures.push("contract identity");
    if (dataset.generatedAt !== db35.generatedAt || dataset.sourceSnapshotVersion !== db35.sourceSnapshotVersion || dataset.sourceDatabaseSha256 !== db35.sourceDatabaseSha256)
        failures.push("source lineage");
    if (JSON.stringify(dataset.sourceDb35) !== JSON.stringify({ fileName: "team-analysis-db35-target-dispatch.json.gz", sha256: expected.db35Sha256, contractVersion: "0.34.0" }))
        failures.push("artifact lineage");
    if (JSON.stringify(dataset.nativeRuntime) !== JSON.stringify({ fileName: "libcocos2dcpp.so", sha256: expected.nativeSha256, sizeBytes: expected.nativeSizeBytes }) || JSON.stringify(dataset.nativeEvidence) !== JSON.stringify({ fileName: "native-sub-target-type-semantics.json", sha256: expected.evidenceSha256 }))
        failures.push("runtime lineage");
    const passiveRows = new Map((tables.passive_skills ?? []).map(row => [id(row.id), row]));
    const categories = new Map((tables.card_categories ?? []).map(row => [id(row.id), row]));
    const filtersBySet = new Map();
    const membersBySet = new Map();
    for (const row of tables.sub_target_types ?? []) {
        const setId = id(row.sub_target_type_set_id);
        filtersBySet.set(setId, [...(filtersBySet.get(setId) ?? []), row]);
    }
    for (const rows of filtersBySet.values())
        rows.sort((left, right) => (integer(left.id) ?? 0) - (integer(right.id) ?? 0));
    for (const row of tables.card_unique_info_set_relations ?? []) {
        const setId = id(row.card_unique_info_set_id);
        membersBySet.set(setId, [...(membersBySet.get(setId) ?? []), { rowId: id(row.id), memberId: id(row.card_unique_info_id) }]);
    }
    for (const rows of membersBySet.values())
        rows.sort((left, right) => left.memberId.localeCompare(right.memberId, "en", { numeric: true }) || left.rowId.localeCompare(right.rowId, "en", { numeric: true }));
    const db35Rules = new Map(db35.ruleTargets.map(rule => [`${rule.stateKey}|${rule.ruleKey}`, rule]));
    const proofRoles = expected.evidence.codeRegions.map(region => region.role);
    const expectedDimensions = { targetCandidateScope: "inherited_db35", timing: "independent", operation: "independent", unit: "independent", calculationBucket: "unknown", duration: "unknown", recurrence: "unknown", expiry: "unknown", reset: "unknown" };
    const seen = new Set();
    let losslessReconstructionCount = 0;
    for (const rule of dataset.ruleSubTargets) {
        const key = `${rule.stateKey}|${rule.ruleKey}`;
        const sourceRule = db35Rules.get(key);
        const passiveRow = passiveRows.get(rule.passiveSkillId);
        if (seen.has(key))
            failures.push(`duplicate ${key}`);
        seen.add(key);
        if (!sourceRule || !passiveRow || sourceRule.passiveSkillId !== rule.passiveSkillId || sourceRule.effectCount !== rule.effectCount || JSON.stringify(sourceRule.subTarget.rawSetId) !== JSON.stringify(rule.rawSetId) || JSON.stringify(passiveRow.sub_target_type_set_id ?? null) !== JSON.stringify(rule.rawSetId)) {
            failures.push(`lossless ${key}`);
            continue;
        }
        losslessReconstructionCount++;
        const setId = id(rule.rawSetId) ?? "0";
        const expectedFilters = (filtersBySet.get(setId) ?? []).map(row => {
            const value = id(row.target_value) ?? "";
            const members = membersBySet.get(value) ?? [];
            const projected = (0, team_analysis_db36_builder_1.projectDb36Filter)(row, categories.get(value), members.map(member => member.memberId));
            projected.provenance.runtime = { fileName: "libcocos2dcpp.so", sha256: expected.nativeSha256, evidenceFile: "native-sub-target-type-semantics.json", evidenceSha256: expected.evidenceSha256, proofRoles };
            if (projected.selector === "card_unique_info_set_id")
                projected.provenance.dictionary = members.map(member => ({ table: "card_unique_info_set_relations", rowId: member.rowId, columns: ["card_unique_info_set_id", "card_unique_info_id"] }));
            return projected;
        });
        const expectedStatus = expectedFilters.some(filter => filter.status === "unknown") ? "unknown" : expectedFilters.some(filter => filter.status === "partial") ? "partial" : "supported";
        if (rule.status !== expectedStatus || rule.composition !== "and" || rule.emptySetBehavior !== "identity" || JSON.stringify(rule.filters) !== JSON.stringify(expectedFilters) || JSON.stringify(rule.independentDimensions) !== JSON.stringify(expectedDimensions))
            failures.push(`projection ${key}`);
        const expectedDatabase = { table: "passive_skills", rowId: rule.passiveSkillId, columns: ["sub_target_type_set_id"] };
        const expectedRuntime = { fileName: "libcocos2dcpp.so", sha256: expected.nativeSha256, evidenceFile: "native-sub-target-type-semantics.json", evidenceSha256: expected.evidenceSha256, proofRoles };
        if (JSON.stringify(rule.provenance.database) !== JSON.stringify(expectedDatabase) || JSON.stringify(rule.provenance.runtime) !== JSON.stringify(expectedRuntime))
            failures.push(`provenance ${key}`);
    }
    if (seen.size !== db35Rules.size || dataset.ruleSubTargets.length !== db35Rules.size)
        failures.push(`cardinality ${seen.size}/${db35Rules.size}`);
    return { schemaVersion: 1, valid: failures.length === 0, ruleCount: dataset.ruleSubTargets.length, losslessReconstructionCount, failures };
}
exports.validateDatabaseTeamAnalysisDb36Dataset = validateDatabaseTeamAnalysisDb36Dataset;
//# sourceMappingURL=team-analysis-db36-validator.js.map