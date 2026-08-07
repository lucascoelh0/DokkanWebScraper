import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { applyDb49GuardCoefficient, evaluateDb49GuardDecision } from "./team-analysis-db49-builder";
import { DatabaseTeamAnalysisDb49Coverage, DatabaseTeamAnalysisDb49Dataset } from "./team-analysis-db49-contract";
export interface Db49GoldenValidation {schemaVersion:1;fixtureCount:number;passed:number;failures:Array<{fixture:string;issue:string}>}
export async function validateDatabaseTeamAnalysisDb49Goldens(dataset:DatabaseTeamAnalysisDb49Dataset,coverage:DatabaseTeamAnalysisDb49Coverage):Promise<Db49GoldenValidation>{
    const path=existsSync(resolve(__dirname,"team-analysis-db49-golden-fixtures.json"))?resolve(__dirname,"team-analysis-db49-golden-fixtures.json"):resolve(__dirname,"..","..","database-experiment","team-analysis-db49-golden-fixtures.json"),fixtures=JSON.parse(await readFile(path,"utf8"))as any[],failures:Array<{fixture:string;issue:string}>=[];
    const decide=(overrides:Partial<Parameters<typeof evaluateDb49GuardDecision>[0]>)=>evaluateDb49GuardDecision({elementAffinityResultEq1:false,defenderHasEfficacy24:false,independentRawAttackerOverride:false,defenderHasEfficacy78:false,independentPlayerModeOverride:false,...overrides});
    const synthetic:Array<[string,boolean]>=[
        ["forced positive",decide({defenderHasEfficacy78:true,defenderHasEfficacy24:true,independentRawAttackerOverride:true,independentPlayerModeOverride:true})===true],
        ["normal positive",decide({elementAffinityResultEq1:true})===true],
        ["guard disabled",decide({elementAffinityResultEq1:true,defenderHasEfficacy24:true})===false],
        ["negative",decide({})===false],
        ["zero damage",applyDb49GuardCoefficient(0,true)===0],
        ["positive truncation",applyDb49GuardCoefficient(3,true)===1],
        ["negative truncation",applyDb49GuardCoefficient(-3,true)===-1],
        ["guard false",applyDb49GuardCoefficient(3,false)===3]
    ];for(const [name,ok] of synthetic)if(!ok)failures.push({fixture:name,issue:"native guard formula differs"});
    for(const fixture of fixtures){const rule=dataset.ruleProjections.find(value=>value.stateKey===fixture.stateKey&&value.ruleKey===fixture.ruleKey);if(!rule){failures.push({fixture:fixture.name,issue:"rule missing"});continue;}const actual=[rule.passiveSkillId,rule.effect.kind,rule.effect.guardCoefficient,rule.target.candidate.scope,rule.executionTiming.status==="supported"?rule.executionTiming.event:"unknown",rule.effect.handlerParameters.rawCalculationOption,rule.legacyProjectorComparison.status],expected=[fixture.passiveSkillId,"force_guard",0.5,fixture.target,fixture.timing,fixture.calcOption,"representation_matches_native_projection"];if(JSON.stringify(actual)!==JSON.stringify(expected))failures.push({fixture:fixture.name,issue:"projection tuple differs"});}
    const expected:Partial<DatabaseTeamAnalysisDb49Coverage>={sqliteRowCount:485,projectedUniqueSqliteRowCount:296,unprojectedSqliteRowCount:189,ruleCount:305,sourceEffectCount:305,passiveSkillCount:296,affectedStateCount:267,supportedEffectCount:305,supportedTargetCount:305,supportedTimingCount:281,unknownTimingCount:24,onceOnlyEnabledCount:62,legacyRepresentationMatchCount:305,legacyRepresentationConflictCount:0,simulationPartialCount:305};for(const [k,v] of Object.entries(expected))if(coverage[k as keyof DatabaseTeamAnalysisDb49Coverage]!==v)failures.push({fixture:"coverage",issue:`${k} differs`});
    if(dataset.ruleProjections.some(value=>value.consumers.independentType78ElementCoefficientInput.status!=="unknown"||value.consumers.attackKind.status!=="unknown"||value.consumers.finalHpApplication.status!=="unknown"||value.lifecycle.probabilityApplication!=="unknown"))failures.push({fixture:"conservative boundaries",issue:"independent unknown promoted"});const fixtureCount=synthetic.length+fixtures.length+2;return{schemaVersion:1,fixtureCount,passed:fixtureCount-failures.length,failures};
}
