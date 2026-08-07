import { SqliteScalar } from "./contract";
import { Db35TargetSemantic } from "./team-analysis-db35-contract";
import { Db36Filter } from "./team-analysis-db36-contract";
import { Db37DurationProjection, Db37OnceOnlyProjection } from "./team-analysis-db37-contract";
import { Db47RuleTiming } from "./team-analysis-db47-contract";

export interface Db49CodeRegion { role:string;symbol:string;vma:number;sizeBytes:number;codeSha256:string }
export interface Db49Relocation { offset:number;type:number;symbol:string;symbolValue:number;addend:number }
export interface Db49NativeEvidence {
    schemaVersion:1;sourceSha256:string;auditScope:string;sqliteBinding:Record<string,unknown>;dispatch:Record<string,unknown>;handlerBehavior:Record<string,unknown>;
    guardDecision:Record<string,unknown>;coefficient:Record<string,unknown>;consumerBehavior:Record<string,unknown>;
    directCalls:Array<{role:string;callVma:number;callHex:string;branchKind:"b"|"bl";pltVma:number;pltHex:string;relocation:Db49Relocation}>;
    enemyAbiFlow:Record<string,unknown>;codeRegions:Db49CodeRegion[];unknowns:string[];
}
export interface Db49RuleProjection {
    stateKey:string;ruleKey:string;passiveSkillId:string;efficacyType:78;sourceEffectCount:number;
    effect:{status:"supported";kind:"force_guard";unit:"boolean_presence";presence:true;guardCoefficient:0.5;normalGuardFormula:string;handlerParameters:{status:"preserved_not_read_by_type_78_handler";rawEffValue1:SqliteScalar;rawEffValue2:SqliteScalar;rawEffValue3:SqliteScalar;rawCalculationOption:SqliteScalar}};
    rawProbability:SqliteScalar;rawExecutionTimingType:SqliteScalar;
    target:{status:"supported";candidate:Db35TargetSemantic;subTarget:{status:"supported";rawSetId:SqliteScalar;composition:"and";emptySetBehavior:"identity";filters:Db36Filter[]}};
    executionTiming:Db47RuleTiming["executionTiming"];
    lifecycle:{duration:Db37DurationProjection;onceOnly:Db37OnceOnlyProjection;probabilityApplication:"unknown";recurrence:"partial";resetAndExpiry:"unknown"};
    consumers:{
        playerSource:{status:"supported";bucket:"after_enemy_defense_before_efficacy_13_damage_mitigation";formula:"trunc_toward_zero(pre_guard_damage_times_0_5)";laterModifiersRemain:true};
        enemySource:{status:"supported";bucket:"after_efficacy_13_counter_resist_defense_and_critical_correction_before_increase_received_damage_and_final_clamps";formula:"trunc_toward_zero(pre_guard_damage_times_0_5)";laterModifiersRemain:true};
        independentType78ElementCoefficientInput:{status:"unknown";value:"preserved_unknown"};attackKind:{status:"unknown";value:"unknown"};finalHpApplication:{status:"unknown";value:"unknown"};
    };
    simulationStatus:"partial";
    legacyProjectorComparison:{kind:string|null;value:number|null;unit:string|null;status:"representation_matches_native_projection"|"representation_conflict"|"not_comparable";authoritative:false};
    independentDimensions:{condition:"independent";operation:"native_boolean_presence_not_skill_calc_option";target:"inherited_db35_db36";timing:"inherited_db47_independent";duration:"inherited_db37_independent";probability:"unknown";recurrence:"partial";reset:"unknown";stacking:"boolean_presence_cross_status_lifecycle_unknown"};
    provenance:{database:{table:"passive_skills";rowId:string;columns:["efficacy_type","eff_value1","eff_value2","eff_value3","calc_option","probability","exec_timing_type","target_type","sub_target_type_set_id","turn","is_once"]};runtime:{fileName:"libcocos2dcpp.so";sha256:string;evidenceFile:"native-forced-guard-semantics.json";evidenceSha256:string;proofRoles:string[]};inherited:{db11Sha256:string;db35Sha256:string;db36Sha256:string;db37Sha256:string;db47Sha256:string}};
}
export interface DatabaseTeamAnalysisDb49Dataset {
    schemaVersion:1;contract:"dokkan-team-analysis-forced-guard-native-semantics-experiment";contractVersion:"0.48.0";generatedAt:string;sourceSnapshotVersion:string;sourceDatabaseSha256:string;
    sourceDb11:{fileName:"team-analysis-db11-experiment.json.gz";sha256:string;contractVersion:"0.10.0"};sourceDb35:{fileName:"team-analysis-db35-target-dispatch.json.gz";sha256:string;contractVersion:"0.34.0"};sourceDb36:{fileName:"team-analysis-db36-sub-target-semantics.json.gz";sha256:string;contractVersion:"0.35.0"};sourceDb37:{fileName:"team-analysis-db37-passive-lifecycle.json.gz";sha256:string;contractVersion:"0.36.0"};sourceDb47:{fileName:"team-analysis-db47-puzzle-move-end-timing.json.gz";sha256:string;contractVersion:"0.46.0"};
    nativeRuntime:{fileName:"libcocos2dcpp.so";sha256:string;sizeBytes:number};nativeEvidence:{fileName:"native-forced-guard-semantics.json";sha256:string};inheritedSemanticPromotionCount:69;semanticPromotionCount:7;sqliteEfficacyType78RowCount:number;ruleProjections:Db49RuleProjection[];
}
export interface DatabaseTeamAnalysisDb49Coverage {schemaVersion:1;sqliteRowCount:number;projectedUniqueSqliteRowCount:number;unprojectedSqliteRowCount:number;ruleCount:number;sourceEffectCount:number;passiveSkillCount:number;affectedStateCount:number;supportedEffectCount:number;supportedTargetCount:number;supportedTimingCount:number;unknownTimingCount:number;onceOnlyEnabledCount:number;legacyRepresentationMatchCount:number;legacyRepresentationConflictCount:number;simulationPartialCount:number;ruleCountsByTiming:Record<string,number>;ruleCountsByTarget:Record<string,number>;ruleCountsByCalculationOption:Record<string,number>;inheritedSemanticPromotionCount:69;semanticPromotionCount:7}
export interface DatabaseTeamAnalysisDb49Manifest {schemaVersion:1;contractVersion:"0.48.0";generatedAt:string;fileName:"team-analysis-db49-forced-guard.json.gz";compression:"gzip";sha256:string;sizeBytes:number;uncompressedSizeBytes:number;ruleCount:number;sqliteRowCount:number;affectedStateCount:number;inheritedSemanticPromotionCount:69;semanticPromotionCount:7;sourceDatabaseSha256:string;sourceDb47Sha256:string;nativeRuntimeSha256:string;nativeEvidenceSha256:string;coverageFile:"team-analysis-db49-coverage.json";reportFile:"team-analysis-db49-report.md";validationFile:"team-analysis-db49-validation.json";goldenValidationFile:"team-analysis-db49-golden-validation.json"}
