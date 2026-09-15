import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireSlot } from './slot-lease.mjs';
import { sha } from './prepare-candidate.mjs';
function storage(){const data=new Map();return {data,
 get:async k=>data.get(k)??null,
 put:async(k,bytes,o)=>{assert(o.ifNoneMatch?!data.has(k):o.ifMatch===data.get(k)?.etag);
 const etag=sha(bytes);data.set(k,{bytes,etag});return etag;}};}

test('manual recovery is expired, failed-collection only and once per slot',async()=>{
 const store=storage();let time=21600001;const now=()=>time;
 const first=await acquireSlot(store,now);
 await first.recordFailure({status:'failed',phase:'collection'});
 assert.equal(await acquireSlot(store,now,{manualRecovery:true}),null);
 time+=16*60*1000;
 assert.equal(await acquireSlot(store,now),null);
 const recovered=await acquireSlot(store,now,{manualRecovery:true});assert(recovered);
 await assert.rejects(first.writeState({status:'running'}));
 await recovered.recordFailure({status:'failed',phase:'collection'});
 time+=16*60*1000;
 assert.equal(await acquireSlot(store,now,{manualRecovery:true}),null);
});

test('manual recovery never recollects publication failures, success or crashed running state',async()=>{
 for(const state of [{status:'failed',phase:'publication'},{status:'success'},{status:'running'}]){
  const store=storage();let time=21600001;
  const lease=await acquireSlot(store,()=>time);await lease.writeState(state);
  time+=16*60*1000;
  assert.equal(await acquireSlot(store,()=>time,{manualRecovery:true}),null);
 }
});

test('concurrent manual recoveries have only one CAS winner',async()=>{
 const store=storage();let time=21600001;
 const lease=await acquireSlot(store,()=>time);
 await lease.recordFailure({status:'failed',phase:'collection'});time+=16*60*1000;
 const results=await Promise.allSettled([1,2].map(()=>acquireSlot(store,()=>time,{manualRecovery:true})));
 assert.equal(results.filter(r=>r.status==='fulfilled'&&r.value).length,1);
});
test('reservation blocks duplicate login slots even after release',async()=>{
 const store=storage(),now=()=>21600001;
 const lease=await acquireSlot(store,now);assert(lease);
 await lease.writeState({status:'running'});await lease.assertOwned();await lease.release();
 assert.equal(await acquireSlot(store,now),null);
});
test('expired or altered lease cannot write status',async()=>{
 const store=storage();let time=21600001;const lease=await acquireSlot(store,()=>time);
 time+=16*60*1000;await assert.rejects(lease.writeState({status:'success'}));
});
test('skips collection close to slot boundary',async()=>{
 const store=storage(),reasons=[];assert.equal(await acquireSlot(store,()=>43199999,{onSkip:r=>reasons.push(r)}),null);
 assert.deepEqual(reasons,['slot_boundary']);
 assert.equal(store.data.size,0);
});

test('hourly wakeups do not multiply logins; next slot gets a fresh chance',async()=>{
 const store=storage(),reasons=[];const start=21600001;
 assert(await acquireSlot(store,()=>start));
 for(let hour=1;hour<6;hour++)assert.equal(await acquireSlot(store,()=>start+hour*3600000,{onSkip:r=>reasons.push(r)}),null);
 assert.deepEqual(reasons,Array(5).fill('slot_reserved'));
 assert(await acquireSlot(store,()=>start+21600000));
});
