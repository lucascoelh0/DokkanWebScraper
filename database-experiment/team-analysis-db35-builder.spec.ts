import {deepStrictEqual,equal} from "assert";import {projectDb35Target} from "./team-analysis-db35-builder";
describe("database Team Analysis DB35 passive target dispatch",()=>{
it("maps every target value present in projected passive rules",()=>{deepStrictEqual([1,2,3,4,12,13,14,15,16].map(x=>projectDb35Target(x).status),Array(9).fill("supported"));});
it("preserves values outside the proved current domain",()=>{for(const x of [0,5,6,7,8,9,10,11,17,-1,"bad",null])deepStrictEqual(projectDb35Target(x),{status:"unknown",value:"unknown"});});
it("pins owner inclusion independently of scope",()=>{const self=projectDb35Target(1),exceptSelf=projectDb35Target(16);equal(self.status==="supported"&&self.value.selfInclusion,"included");equal(exceptSelf.status==="supported"&&exceptSelf.value.selfInclusion,"excluded");});
it("pins native class predicates including dual-class raw value 3",()=>{const a=projectDb35Target(12),b=projectDb35Target(13);deepStrictEqual(a.status==="supported"&&a.value.classPredicateRaw,[1,3]);deepStrictEqual(b.status==="supported"&&b.value.classPredicateRaw,[2,3]);});
});
