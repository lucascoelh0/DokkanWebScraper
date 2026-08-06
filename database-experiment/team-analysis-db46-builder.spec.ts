import { equal, throws } from "assert";
import { readFileSync } from "fs";
import { resolve } from "path";
import { projectDb46Timing, validateDb46Evidence } from "./team-analysis-db46-builder";
const evidence=JSON.parse(readFileSync(resolve(__dirname,"..","..","database-experiment","native-enemy-attack-timing-semantics.json"),"utf8"));
describe("database Team Analysis DB46 enemy attack timing",()=>{it("maps only timings 6 and 7",()=>{equal(projectDb46Timing(6)?.event,"enemy_attack_pre_damage_calculation_setup");equal(projectDb46Timing(7)?.event,"enemy_attack_post_damage_calculation_setup");for(const x of [1,4,5,8,-1,"bad"])equal(projectDb46Timing(x),null)});it("rejects semantic promotion by evidence mutation",()=>{for(const mutate of [(x:any)=>x.events[0].event="before_hit",(x:any)=>x.doesNotImply=[], (x:any)=>x.events[1].calls[0].skillTypeRaw=99,(x:any)=>x.owner.vma+=4,(x:any)=>x.events[0].calls[0].callVma+=4]){const x=JSON.parse(JSON.stringify(evidence));mutate(x);throws(()=>validateDb46Evidence({} as any,x,evidence.sourceSha256),/identity|calls/)}})});
