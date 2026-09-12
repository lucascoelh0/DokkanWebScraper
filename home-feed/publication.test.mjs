import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareCandidate, PREFIX, sha } from './prepare-candidate.mjs';
import { publication } from './publication.mjs';
const now = Date.parse('2026-09-12T12:00:00Z');
async function setup() {
  const candidate = await prepareCandidate({snapshot:{source:'authorized_manual_global_gashas_read',
    observedAt:new Date(now).toISOString(),banners:[]},receipts:[],images:new Map(),featuredResponses:[]},now);
  const data = new Map(), writes = [], reads = [];
  const store = {
    inventoryBytes: async () => 1000,
    get: async k => data.has(k) ? {bytes:data.get(k),etag:sha(data.get(k))} : null,
    put: async (k,b,c) => {
      if (c.ifNoneMatch) assert(!data.has(k));
      else assert.equal(c.ifMatch, sha(data.get(k)));
      writes.push(k); data.set(k,b);
    },
  };
  const pub = publication(store, async k => {reads.push(k); return data.get(k);}, () => now);
  return {candidate, data, writes, reads, store, pub, lease:{assertOwned:async()=>{}}};
}
test('read-only plan then immutable payload verified before manifest', async () => {
  const h=await setup(), plan=await h.pub.plan(h.candidate);
  assert.deepEqual(h.writes,[]);
  assert.equal((await h.pub.publish(h.candidate,plan,h.lease)).verified,true);
  assert.equal(h.writes.at(-1),PREFIX+'manifest.json');
  assert.deepEqual(h.reads,h.writes);
  await assert.rejects(h.pub.publish(h.candidate,plan,h.lease));
});
test('concurrent manifest update is never overwritten',async()=>{
  const h=await setup(), plan=await h.pub.plan(h.candidate);
  h.data.set(PREFIX+'manifest.json',Buffer.from('newer'));
  await assert.rejects(h.pub.publish(h.candidate,plan,h.lease));
  assert.equal(h.data.get(PREFIX+'manifest.json').toString(),'newer');
});
test('immutable collision and full bucket reject before write',async()=>{
  const h=await setup();h.data.set(h.candidate.operations[0].key,Buffer.from('wrong'));
  await assert.rejects(h.pub.plan(h.candidate)); assert.deepEqual(h.writes,[]);
  h.data.clear();h.store.inventoryBytes=async()=>8_000_000_000;
  await assert.rejects(h.pub.plan(h.candidate));
});
test('failed public verification leaves manifest alone',async()=>{
  const h=await setup(); const pub=publication(h.store,async()=>Buffer.from('wrong'),()=>now);
  await assert.rejects(pub.publish(h.candidate,await pub.plan(h.candidate),h.lease));
  assert(!h.data.has(PREFIX+'manifest.json'));
});
test('foreign plan and changed candidate rejected',async()=>{
  const h=await setup();await assert.rejects(h.pub.publish(h.candidate,{},h.lease));
  h.candidate.operations[0].key='v2/home/manifest.json';
  await assert.rejects(h.pub.plan(h.candidate));
});
