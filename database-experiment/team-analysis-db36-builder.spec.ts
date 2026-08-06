import {deepStrictEqual,equal} from "assert";import {projectDb36Filter} from "./team-analysis-db36-builder";
describe("database Team Analysis DB36 sub-target semantics",()=>{
it("maps category include and exclude",()=>{equal(projectDb36Filter({id:1,sub_target_type_set_id:1,target_value_type:1,target_value:10}).inclusion,"include");equal(projectDb36Filter({id:2,sub_target_type_set_id:1,target_value_type:2,target_value:10}).inclusion,"exclude")});
it("maps unique-info-set include and exclude without losing members",()=>{const a=projectDb36Filter({id:1,target_value_type:4,target_value:30},undefined,["1","2"]),b=projectDb36Filter({id:2,target_value_type:5,target_value:30});deepStrictEqual(a.memberCardUniqueInfoIds,["1","2"]);equal(a.inclusion,"include");equal(b.inclusion,"exclude")});
it("keeps metamorphic type partial",()=>{const x=projectDb36Filter({id:1,target_value_type:3,target_value:2});equal(x.status,"partial");equal(x.selector,"metamorphic_type_raw");equal(x.inclusion,"unknown")});
it("keeps invalid and out-of-domain types unknown",()=>{for(const value of [0,6,-1,1.5,"bad",null])equal(projectDb36Filter({id:1,target_value_type:value,target_value:2}).status,"unknown")});
});
