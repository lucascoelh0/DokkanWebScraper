import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireSlot } from './slot-lease.mjs';
import { sha } from './prepare-candidate.mjs';
function storage(){const data=new Map();return {data,
 get:async k=>data.get(k)??null,
 put:async(k,bytes,o)=>{assert(o.ifNoneMatch?!data.has(k):o.ifMatch===data.get(k)?.etag);
 const etag=sha(bytes);data.set(k,{bytes,etag});return etag;}};}
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
 const store=storage();assert.equal(await acquireSlot(store,()=>43199999),null);
 assert.equal(store.data.size,0);
});
