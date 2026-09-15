import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {checkRefreshHealth} from './refresh-health.mjs';
import {refreshExitCode} from './run-refresh.mjs';
const now=Date.parse('2026-09-15T12:00:00Z');
const window={schemaVersion:1,observedAt:new Date(now-1000).toISOString(),validUntil:new Date(now+1000).toISOString(),items:[]};
function fixture(home={...window,summons:[],eventSchedule:window,news:window}) {
 const values=new Map();
 for(const [section,payload] of Object.entries({home,campaigns:{...window,contract:'dokkan-campaign-index',region:'global',source:'global-game-campaigns',coverage:'partial-observation',contentSemantics:'mission-definitions',revisionSha256:'a'.repeat(64),campaigns:[]},news:{...window,coverage:'api-observation'}})){
  const bytes=Buffer.from(JSON.stringify(payload)),sha256=createHash('sha256').update(bytes).digest('hex');
  const file=(section==='home'?'':'index/')+sha256+'.json';
  values.set(section+'/manifest.json',JSON.stringify({schemaVersion:1,...(section==='campaigns'?{contract:'dokkan-campaign-manifest',region:'global'}:{}),file,sha256,sizeBytes:bytes.length}));
  values.set(section+'/'+file,bytes);
 }
 return async url=>new Response(values.get(new URL(url).pathname.replace('/staging/v2/',''))??'',{status:200});
}
test('healthy skipped tick remains success only when published sections are fresh',async()=>{
 const health=await checkRefreshHealth({events:true,news:true,campaigns:true,newsLibrary:true},{fetchImpl:fixture(),now:()=>now});
 assert.deepEqual(health,{fresh:true,problems:[]});assert.equal(refreshExitCode({status:'already_running',health}),0);
});
test('expired or missing optional feed sections cannot report a green skipped refresh',async()=>{
 const health=await checkRefreshHealth({events:true,news:true},{fetchImpl:fixture({...window,summons:[],eventSchedule:{...window,validUntil:new Date(now).toISOString()}}),now:()=>now});
 assert.deepEqual(health,{fresh:false,problems:['events','news']});
 assert.equal(refreshExitCode({status:'already_running',skipReason:'slot_boundary',health}),1);
});

test('fresh timestamps without a supported payload contract are not healthy',async()=>{
 for(const home of [{...window,schemaVersion:99,summons:[]},{...window},{...window,summons:[{id:'x',title:'bad'}]}]){
  const health=await checkRefreshHealth({}, {fetchImpl:fixture(home),now:()=>now});
  assert.equal(health.fresh,false);assert.deepEqual(health.problems,['home_unavailable']);
 }
});
test('cancelled or invalid public graph is degraded without credentials or detail leakage',async()=>{
 const health=await checkRefreshHealth({}, {fetchImpl:fixture(),now:()=>now,signal:AbortSignal.abort()});
 assert.deepEqual(health,{fresh:false,problems:['home_unavailable']});
});
