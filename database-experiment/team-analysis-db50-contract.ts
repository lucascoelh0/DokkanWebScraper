import { Db24CounterResolution } from "./team-analysis-db24-contract";
import { Db35TargetSemantic } from "./team-analysis-db35-contract";
import { Db47RuleTiming } from "./team-analysis-db47-contract";

export interface Db50Region { role: string; symbol: string; vma: number; sizeBytes: number; codeSha256: string }
export interface Db50Evidence {
    schemaVersion: 1;
    sourceSha256: string;
    auditScope: string;
    registrationGate: Record<string, unknown>;
    normalSelection: Record<string, unknown>;
    preference: Record<string, unknown>;
    damageConsumer: Record<string, unknown>;
    codeRegions: Db50Region[];
    directCalls: Array<{ role: string; callVma: number; callHex: string; pltVma: number; pltHex: string; relocation: { offset: number; type: number; symbol: string; symbolValue: number; addend: number } }>;
    unknowns: string[];
}
export interface Db50Projection {
    stateKey: string;
    ruleKey: string;
    passiveSkillId: string;
    efficacyType: 120;
    sourceEffectCount: number;
    payload: Db24CounterResolution["payload"];
    registrationGate: { status: "supported"; callChangeParamOffset: 4; registerWhenZero: true; nonzeroBehavior: "skip_registration"; fieldSemantic: "unknown" };
    target: { status: "supported"; value: Db35TargetSemantic };
    executionTiming: Db47RuleTiming["executionTiming"];
    selection: { status: "supported"; filters: ["efficacy_type_120", "deck_index_input"]; ranking: "highest_resist_damage_rate"; tieBehavior: "first_in_efficacy_info_order"; preference: "efficacy_128_dodge_then_efficacy_120_normal"; callerBoolean: "unknown"; externalActivation: "unknown" };
    damage: { status: "supported"; bucket: "enemy_source_after_efficacy_13_before_defense_and_guard"; formula: "pre_minus_trunc_toward_zero(pre_times_resist_damage_rate_div_100)"; rateAbove99SetsFlag: true; finalHpApplication: "unknown" };
    rawActivation: Db24CounterResolution["activation"];
    simulationStatus: "partial";
    provenance: { database: Db24CounterResolution["provenance"]["database"]; runtime: { fileName: "libcocos2dcpp.so"; sha256: string; evidenceFile: "native-counter-consumer-semantics.json"; evidenceSha256: string; proofRoles: string[] }; inherited: { db24Sha256: string; db35Sha256: string; db47Sha256: string } };
}
export interface DatabaseTeamAnalysisDb50Dataset {
    schemaVersion: 1;
    contract: "dokkan-team-analysis-counter-consumer-native-semantics-experiment";
    contractVersion: "0.49.0";
    generatedAt: string;
    sourceSnapshotVersion: string;
    sourceDatabaseSha256: string;
    sourceDb24: { fileName: "team-analysis-db24-counter-behavior.json.gz"; sha256: string; contractVersion: "0.23.0" };
    sourceDb35: { fileName: "team-analysis-db35-target-dispatch.json.gz"; sha256: string; contractVersion: "0.34.0" };
    sourceDb47: { fileName: "team-analysis-db47-puzzle-move-end-timing.json.gz"; sha256: string; contractVersion: "0.46.0" };
    nativeRuntime: { fileName: "libcocos2dcpp.so"; sha256: string; sizeBytes: number };
    nativeEvidence: { fileName: "native-counter-consumer-semantics.json"; sha256: string };
    inheritedSemanticPromotionCount: 76;
    semanticPromotionCount: 6;
    projections: Db50Projection[];
}
export interface DatabaseTeamAnalysisDb50Coverage {
    schemaVersion: 1;
    ruleCount: number;
    affectedStateCount: number;
    supportedPayloadFieldCount: number;
    supportedTargetCount: number;
    supportedTimingCount: number;
    supportedSelectionCount: number;
    supportedDamageCount: number;
    partialSimulationCount: number;
    resistRateCounts: Record<string, number>;
    probabilityCounts: Record<string, number>;
    inheritedSemanticPromotionCount: 76;
    semanticPromotionCount: 6;
}
export interface DatabaseTeamAnalysisDb50Manifest {
    schemaVersion: 1;
    contractVersion: "0.49.0";
    generatedAt: string;
    fileName: "team-analysis-db50-counter-consumer.json.gz";
    compression: "gzip";
    sha256: string;
    sizeBytes: number;
    uncompressedSizeBytes: number;
    ruleCount: number;
    affectedStateCount: number;
    inheritedSemanticPromotionCount: 76;
    semanticPromotionCount: 6;
    sourceDatabaseSha256: string;
    sourceDb24Sha256: string;
    sourceDb35Sha256: string;
    sourceDb47Sha256: string;
    nativeRuntimeSha256: string;
    nativeEvidenceSha256: string;
    coverageFile: "team-analysis-db50-coverage.json";
    reportFile: "team-analysis-db50-report.md";
    validationFile: "team-analysis-db50-validation.json";
    goldenValidationFile: "team-analysis-db50-golden-validation.json";
}
