import { parseDb33ExecutionTiming } from "./team-analysis-db33-builder";
import { DatabaseTeamAnalysisDb32Dataset } from "./team-analysis-db32-contract";
import { DatabaseTeamAnalysisDb33Dataset } from "./team-analysis-db33-contract";

export function validateDatabaseTeamAnalysisDb33Dataset(dataset: DatabaseTeamAnalysisDb33Dataset, db32: DatabaseTeamAnalysisDb32Dataset) {
    const failures: string[] = [];
    if (dataset.contract !== "dokkan-team-analysis-player-attack-setup-timing-experiment" || dataset.contractVersion !== "0.32.0" || dataset.sourceDb32.contractVersion !== "0.31.0") failures.push("contract identity");
    if (dataset.sourceDatabaseSha256 !== db32.sourceDatabaseSha256 || dataset.sourceSnapshotVersion !== db32.sourceSnapshotVersion || dataset.generatedAt !== db32.generatedAt || dataset.currentTeamAnalysis.sha256 !== db32.currentTeamAnalysis.sha256 || dataset.nativeRuntime.sha256 !== db32.nativeRuntime.sha256 || dataset.nativeRuntime.sizeBytes !== db32.nativeRuntime.sizeBytes) failures.push("source lineage");
    const source = new Map(db32.ruleTimings.map(value => [`${value.stateKey}|${value.ruleKey}`, value]));
    const seen = new Set<string>();
    let losslessReconstructionCount = 0;
    for (const rule of dataset.ruleTimings) {
        const key = `${rule.stateKey}|${rule.ruleKey}`;
        const original = source.get(key);
        if (seen.has(key)) failures.push(`duplicate ${key}`);
        seen.add(key);
        if (!original) { failures.push(`unexpected ${key}`); continue; }
        if (rule.passiveSkillId !== original.passiveSkillId || JSON.stringify(rule.rawExecutionTimingType) !== JSON.stringify(original.rawExecutionTimingType) || rule.effectCount !== original.effectCount || JSON.stringify(rule.calculationOperation) !== JSON.stringify(original.calculationOperation) || JSON.stringify(rule.independentDimensions) !== JSON.stringify(original.independentDimensions) || JSON.stringify(rule.provenance.database) !== JSON.stringify(original.provenance.database)) failures.push(`lossless mismatch ${key}`); else losslessReconstructionCount++;
        const raw = parseDb33ExecutionTiming(rule.rawExecutionTimingType);
        if (raw === 1) {
            if (JSON.stringify(rule.executionTiming) !== JSON.stringify(original.executionTiming) || JSON.stringify(rule.provenance.runtime) !== JSON.stringify(original.provenance.runtime)) failures.push(`inherited turn-start mismatch ${key}`);
        } else if (raw === 4) {
            if (rule.executionTiming.status !== "supported" || rule.executionTiming.event !== "player_attack_setup" || rule.executionTiming.sequence !== "inside_player_attack_damage_and_action_bank_setup_before_setup_result_consumer" || rule.provenance.runtime?.evidenceFile !== "native-execution-timing-value-4-semantics.json" || rule.provenance.runtime.sha256 !== dataset.nativeRuntime.sha256 || rule.provenance.runtime.evidenceSha256 !== dataset.nativeEvidence.sha256 || JSON.stringify(rule.provenance.runtime.proofRoles) !== JSON.stringify(["execution_filter", "player_attack_setup", "setup_extra_attacks", "execute_player_attack_order", "setup_player_attack_wrapper", "execute_counter_attack", "public_passive_creator", "shared_passive_creator", "base_status_constructor", "transformation_passive_creation", "metamorphic_passive_creation", "initial_passive_creation"])) failures.push(`attack-setup semantics ${key}`);
        } else if (rule.executionTiming.status !== "unknown" || rule.provenance.runtime) failures.push(`unknown boundary ${key}`);
        if (Object.values(rule.independentDimensions).some(value => value !== "unknown")) failures.push(`independent dimension ${key}`);
    }
    if (seen.size !== source.size) failures.push(`cardinality ${seen.size}/${source.size}`);
    return { schemaVersion: 1 as const, valid: failures.length === 0, ruleCount: dataset.ruleTimings.length, losslessReconstructionCount, failures };
}
