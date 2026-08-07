import { DatabaseTeamAnalysisDb24Dataset } from "./team-analysis-db24-contract";
import { DatabaseTeamAnalysisDb35Dataset } from "./team-analysis-db35-contract";
import { DatabaseTeamAnalysisDb47Dataset } from "./team-analysis-db47-contract";
import { hasDb50JoinIdentity, hasDb50PayloadIdentity } from "./team-analysis-db50-builder";
import { DatabaseTeamAnalysisDb50Dataset, Db50Projection } from "./team-analysis-db50-contract";

export interface Db50Validation { schemaVersion: 1; valid: boolean; ruleCount: number; losslessReconstructionCount: number; failures: string[] }
export interface Db50ValidationContext { db24Sha256: string; db35Sha256: string; db47Sha256: string; nativeSha256: string; nativeSizeBytes: number; evidenceSha256: string; proofRoles: string[] }
const key = (value: { stateKey: string; ruleKey: string }) => `${value.stateKey}|${value.ruleKey}`;
const REGISTRATION = { status: "supported", callChangeParamOffset: 4, registerWhenZero: true, nonzeroBehavior: "skip_registration", fieldSemantic: "unknown" };
const SELECTION = { status: "supported", filters: ["efficacy_type_120", "deck_index_input"], ranking: "highest_resist_damage_rate", tieBehavior: "first_in_efficacy_info_order", preference: "efficacy_128_dodge_then_efficacy_120_normal", callerBoolean: "unknown", externalActivation: "unknown" };
const DAMAGE = { status: "supported", bucket: "enemy_source_after_efficacy_13_before_defense_and_guard", formula: "pre_minus_trunc_toward_zero(pre_times_resist_damage_rate_div_100)", rateAbove99SetsFlag: true, finalHpApplication: "unknown" };

export function hasDb50ConservativeBoundaries(projection: Pick<Db50Projection, "registrationGate" | "selection" | "damage" | "simulationStatus">): boolean {
    return JSON.stringify(projection.registrationGate) === JSON.stringify(REGISTRATION) && JSON.stringify(projection.selection) === JSON.stringify(SELECTION) && JSON.stringify(projection.damage) === JSON.stringify(DAMAGE) && projection.simulationStatus === "partial";
}

export function validateDatabaseTeamAnalysisDb50Dataset(dataset: DatabaseTeamAnalysisDb50Dataset, db24: DatabaseTeamAnalysisDb24Dataset, db35: DatabaseTeamAnalysisDb35Dataset, db47: DatabaseTeamAnalysisDb47Dataset, context: Db50ValidationContext): Db50Validation {
    const failures: string[] = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-team-analysis-counter-consumer-native-semantics-experiment" || dataset.contractVersion !== "0.49.0" || dataset.generatedAt !== db47.generatedAt || dataset.sourceSnapshotVersion !== db47.sourceSnapshotVersion || dataset.sourceDatabaseSha256 !== db47.sourceDatabaseSha256 || dataset.inheritedSemanticPromotionCount !== 76 || dataset.semanticPromotionCount !== 6) failures.push("identity");
    const lineage = {
        sourceDb24: { fileName: "team-analysis-db24-counter-behavior.json.gz", sha256: context.db24Sha256, contractVersion: "0.23.0" },
        sourceDb35: { fileName: "team-analysis-db35-target-dispatch.json.gz", sha256: context.db35Sha256, contractVersion: "0.34.0" },
        sourceDb47: { fileName: "team-analysis-db47-puzzle-move-end-timing.json.gz", sha256: context.db47Sha256, contractVersion: "0.46.0" },
        nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: context.nativeSha256, sizeBytes: context.nativeSizeBytes },
        nativeEvidence: { fileName: "native-counter-consumer-semantics.json", sha256: context.evidenceSha256 },
    };
    if (JSON.stringify({ sourceDb24: dataset.sourceDb24, sourceDb35: dataset.sourceDb35, sourceDb47: dataset.sourceDb47, nativeRuntime: dataset.nativeRuntime, nativeEvidence: dataset.nativeEvidence }) !== JSON.stringify(lineage)) failures.push("lineage");
    const sources = new Map(db24.counterBehaviorResolutions.map(value => [key(value), value]));
    const targets = new Map(db35.ruleTargets.map(value => [key(value), value]));
    const timings = new Map(db47.ruleTimings.map(value => [key(value), value]));
    const seen = new Set<string>();
    let losslessReconstructionCount = 0;
    for (const projection of dataset.projections) {
        const projectionKey = key(projection);
        const source = sources.get(projectionKey);
        const target = targets.get(projectionKey);
        const timing = timings.get(projectionKey);
        if (seen.has(projectionKey)) failures.push(`duplicate ${projectionKey}`);
        seen.add(projectionKey);
        if (!source || !target || target.target.status !== "supported" || !timing || !hasDb50PayloadIdentity(source) || !hasDb50JoinIdentity(projection.passiveSkillId, projection.sourceEffectCount, target, timing) || source.passiveSkillId !== projection.passiveSkillId || projection.efficacyType !== 120) {
            failures.push(`source ${projectionKey}`);
            continue;
        }
        if (JSON.stringify(projection.payload) !== JSON.stringify(source.payload) || JSON.stringify(projection.rawActivation) !== JSON.stringify(source.activation)) failures.push(`lossless ${projectionKey}`); else losslessReconstructionCount++;
        if (projection.rawActivation.targetType !== target.rawTargetType || projection.rawActivation.executionTimingType !== timing.rawExecutionTimingType || JSON.stringify(projection.target) !== JSON.stringify({ status: "supported", value: target.target.value }) || JSON.stringify(projection.executionTiming) !== JSON.stringify(timing.executionTiming)) failures.push(`inherited ${projectionKey}`);
        if (!hasDb50ConservativeBoundaries(projection)) failures.push(`boundaries ${projectionKey}`);
        const expectedProvenance = { database: source.provenance.database, runtime: { fileName: "libcocos2dcpp.so", sha256: context.nativeSha256, evidenceFile: "native-counter-consumer-semantics.json", evidenceSha256: context.evidenceSha256, proofRoles: context.proofRoles }, inherited: { db24Sha256: context.db24Sha256, db35Sha256: context.db35Sha256, db47Sha256: context.db47Sha256 } };
        if (JSON.stringify(projection.provenance) !== JSON.stringify(expectedProvenance)) failures.push(`provenance ${projectionKey}`);
    }
    if (dataset.projections.length !== sources.size || seen.size !== sources.size || [...sources.keys()].some(value => !seen.has(value))) failures.push(`cardinality ${dataset.projections.length}/${sources.size}`);
    return { schemaVersion: 1, valid: failures.length === 0, ruleCount: dataset.projections.length, losslessReconstructionCount, failures };
}
