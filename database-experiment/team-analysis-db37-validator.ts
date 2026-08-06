import { DatabaseExperimentTables } from "./builder";
import { DatabaseTeamAnalysisDb36Dataset } from "./team-analysis-db36-contract";
import { DatabaseTeamAnalysisDb20Dataset } from "./team-analysis-db20-contract";
import { projectDb37Duration, projectDb37OnceOnly } from "./team-analysis-db37-builder";
import { DatabaseTeamAnalysisDb37Dataset, Db37NativeEvidence } from "./team-analysis-db37-contract";

const id = (value: unknown) => value === null || value === undefined ? undefined : String(value);

export function validateDatabaseTeamAnalysisDb37Dataset(dataset: DatabaseTeamAnalysisDb37Dataset, db36: DatabaseTeamAnalysisDb36Dataset, db20: DatabaseTeamAnalysisDb20Dataset, tables: DatabaseExperimentTables, expected: { db36Sha256: string, db20Sha256: string, nativeSha256: string, nativeSizeBytes: number, evidence: Db37NativeEvidence, evidenceSha256: string }) {
    const failures: string[] = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-team-analysis-passive-lifecycle-native-semantics-experiment" || dataset.contractVersion !== "0.36.0" || dataset.inheritedSemanticPromotionCount !== 29 || dataset.semanticPromotionCount !== 2) failures.push("contract identity");
    if (dataset.generatedAt !== db36.generatedAt || dataset.generatedAt !== db20.generatedAt || dataset.sourceSnapshotVersion !== db36.sourceSnapshotVersion || dataset.sourceSnapshotVersion !== db20.sourceSnapshotVersion || dataset.sourceDatabaseSha256 !== db36.sourceDatabaseSha256 || dataset.sourceDatabaseSha256 !== db20.sourceDatabaseSha256) failures.push("source lineage");
    if (JSON.stringify(dataset.sourceDb36) !== JSON.stringify({ fileName: "team-analysis-db36-sub-target-semantics.json.gz", sha256: expected.db36Sha256, contractVersion: "0.35.0" })) failures.push("artifact lineage");
    if (JSON.stringify(dataset.sourceDb20) !== JSON.stringify({ fileName: "team-analysis-db20-passive-turn-correlation.json.gz", sha256: expected.db20Sha256, contractVersion: "0.19.0" })) failures.push("legacy lineage");
    if (JSON.stringify(dataset.nativeRuntime) !== JSON.stringify({ fileName: "libcocos2dcpp.so", sha256: expected.nativeSha256, sizeBytes: expected.nativeSizeBytes }) || JSON.stringify(dataset.nativeEvidence) !== JSON.stringify({ fileName: "native-passive-lifecycle-semantics.json", sha256: expected.evidenceSha256 })) failures.push("runtime lineage");
    const numericallyEqual = db20.correlations.filter(value => value.correlationStatus === "exact_numeric_match").length, numericallyDifferent = db20.correlations.filter(value => value.correlationStatus === "numeric_mismatch").length;
    if (JSON.stringify(dataset.legacyComparison) !== JSON.stringify({ alignedAppearanceTurnCandidates: db20.correlations.length, numericallyEqual, numericallyDifferent, semanticAgreementCount: 0, confirmedBehaviorConflictCount: 0, classification: "independent_runtime_dimensions_not_directly_comparable" })) failures.push("legacy boundary");
    const passiveRows = new Map((tables.passive_skills ?? []).map(row => [id(row.id)!, row]));
    const sourceRules = new Map(db36.ruleSubTargets.map(rule => [`${rule.stateKey}|${rule.ruleKey}`, rule]));
    const proofRoles = expected.evidence.codeRegions.map(region => region.role);
    const dimensions = { condition: "independent", target: "inherited_db36", timing: "independent", operation: "independent", unit: "independent", calculationBucket: "independent", recurrence: "partial", stacking: "unknown" };
    const seen = new Set<string>(); let losslessReconstructionCount = 0;
    for (const lifecycle of dataset.ruleLifecycles) {
        const key = `${lifecycle.stateKey}|${lifecycle.ruleKey}`, source = sourceRules.get(key), row = passiveRows.get(lifecycle.passiveSkillId);
        if (seen.has(key)) failures.push(`duplicate ${key}`); seen.add(key);
        if (!source || !row || source.passiveSkillId !== lifecycle.passiveSkillId || source.effectCount !== lifecycle.effectCount) { failures.push(`lossless ${key}`); continue; }
        losslessReconstructionCount++;
        const onceOnly = projectDb37OnceOnly(row.is_once), duration = projectDb37Duration(row.turn), simulationStatus = onceOnly.status === "unknown" || duration.status === "unknown" ? "unknown" : "partial";
        if (JSON.stringify(lifecycle.onceOnly) !== JSON.stringify(onceOnly) || JSON.stringify(lifecycle.duration) !== JSON.stringify(duration) || lifecycle.simulationStatus !== simulationStatus) failures.push(`projection ${key}`);
        if (JSON.stringify(lifecycle.executedThisTurn) !== JSON.stringify({ status: "supported", successfulExecutionMutation: "set_true", endTurnMutation: "set_false", independentFromExecCount: true }) || JSON.stringify(lifecycle.independentDimensions) !== JSON.stringify(dimensions)) failures.push(`boundary ${key}`);
        if (JSON.stringify(lifecycle.provenance.database) !== JSON.stringify({ table: "passive_skills", rowId: lifecycle.passiveSkillId, columns: ["turn", "is_once"] }) || JSON.stringify(lifecycle.provenance.runtime) !== JSON.stringify({ fileName: "libcocos2dcpp.so", sha256: expected.nativeSha256, evidenceFile: "native-passive-lifecycle-semantics.json", evidenceSha256: expected.evidenceSha256, proofRoles })) failures.push(`provenance ${key}`);
    }
    if (seen.size !== sourceRules.size || dataset.ruleLifecycles.length !== sourceRules.size) failures.push(`cardinality ${seen.size}/${sourceRules.size}`);
    return { schemaVersion: 1 as const, valid: failures.length === 0, ruleCount: dataset.ruleLifecycles.length, losslessReconstructionCount, failures };
}
