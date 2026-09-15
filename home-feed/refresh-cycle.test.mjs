import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshCycle, REFRESH_INTERVAL_MS } from './refresh-cycle.mjs';

test('news shares the original slot after Home, partial failure preserves Home success',async()=>{
 for(const fail of [false,true]){
  const h=harness();h.args.refreshNews=async({lease})=>{assert.equal(lease,h.lease);h.calls.push('news');return fail?{status:'failed',secret:'PRIVATE'}:{status:'published',manifestSha256:'c'.repeat(64)};};
  const r=await refreshCycle(h.args);assert.equal(r.status,'success');assert.equal(r.news.status,fail?'failed':'published');assert(h.calls.indexOf('news')>h.calls.indexOf('publish'));assert(!JSON.stringify(r).includes('PRIVATE'));
 }
 const h=harness();h.args.acquireLease=async()=>null;h.args.refreshNews=()=>assert.fail('occupied slot');await refreshCycle(h.args);
});

function harness(state = {}) {
  const calls = [], records = [];
  const lease = {
    readState: async () => state,
    writeState: async v => { records.push(v); state = v; },
    assertOwned: async () => { calls.push('fence'); },
    recordFailure: async v => records.push(v),
    release: async () => { calls.push('release'); },
  };
  return { calls, records, lease, args: {
    now: () => 1000, acquireLease: async () => lease,
    collect: async () => { calls.push('collect'); return {}; },
    prepare: async () => { calls.push('prepare'); return { validUntil: 100000 }; },
    plan: async () => { calls.push('plan'); return {
      target: 'staging/v2/home/', conflicts: 0, writeBytes: 100, newBytes: 50, bucketBytes: 1000 }; },
    publish: async () => { calls.push('publish'); return { verified: true, manifestSha256: 'a'.repeat(64) }; },
  } };
}

test('publication recovery re-plans same candidate once without collecting again',async()=>{
 const h=harness();h.args.publicationRecovery=true;
 let attempts=0,firstCandidate;
 h.args.publish=async c=>{
  attempts++;firstCandidate??=c;assert.equal(c,firstCandidate);
  if(attempts===1)throw Error('PRIVATE');
  return {verified:true,manifestSha256:'a'.repeat(64)};
 };
 assert.equal((await refreshCycle(h.args)).status,'success');
 assert.equal(attempts,2);
 assert.equal(h.calls.filter(x=>x==='collect').length,1);
 assert.equal(h.calls.filter(x=>x==='plan').length,2);
});

test('publication recovery is bounded and expired candidates cannot retry',async()=>{
 for(const expire of [false,true]){
  const h=harness();h.args.publicationRecovery=true;let attempts=0;
  // Use a mutable clock captured by refreshCycle.
  let clock=1000;h.args.now=()=>clock;
  h.args.publish=async()=>{attempts++;if(expire)clock=200000;throw Error('PRIVATE');};
  assert.equal((await refreshCycle(h.args)).status,'failed');
  assert.equal(attempts,expire?1:2);
  assert.equal(h.calls.filter(x=>x==='collect').length,1);
 }
});

test('News failure records only a safe phase without erasing Home success',async()=>{
 for(const phase of ['configuration','collection','publication','PRIVATE']){
  const h=harness();h.args.refreshNews=async()=>({status:'failed',phase,body:'PRIVATE'});
  const r=await refreshCycle(h.args);
  assert.equal(r.status,'success');
  assert.deepEqual(r.news,{status:'failed',...(phase==='PRIVATE'?{}:{phase})});
  assert(!JSON.stringify(r).includes('PRIVATE'));
 }
});

test('reserves interval before collecting; dry-run precedes fenced publication', async () => {
  const h = harness();
  assert.equal((await refreshCycle(h.args)).status, 'success');
  assert.deepEqual(h.calls, ['collect','prepare','plan','fence','publish','release']);
  assert.equal(h.records[0].nextAttemptAt, 1000 + REFRESH_INTERVAL_MS);
  assert.equal(h.records.at(-1).status, 'success');
});
test('duplicate or overlapping tick cannot collect', async () => {
  const h = harness(); h.args.acquireLease = async () => null;
  assert.equal((await refreshCycle(h.args)).status, 'already_running');
  assert.deepEqual(h.calls, []);
});
for (const state of [{ disabled: true }, { nextAttemptAt: 2000 }])
  test(`skips without login ${JSON.stringify(state)}`, async () => {
    const h = harness(state); await refreshCycle(h.args);
    assert.deepEqual(h.calls, ['release']);
  });
test('collection failure is sanitized, has no publication or retry', async () => {
  const h = harness(); h.args.collect = async () => { throw Error('secret-token'); };
  assert.deepEqual(await refreshCycle(h.args), { status: 'failed', phase: 'collection' });
  assert.deepEqual(h.calls, ['release']);
  assert(!JSON.stringify(h.records).includes('secret-token'));
});
for (const change of [{ target: 'v2/home/' }, { conflicts: 1 }, { newBytes: 101 },
  { bucketBytes: 8_000_000_000 }, { writeBytes: 17 * 1024 * 1024 }, { writeBytes: NaN }])
  test(`rejects unsafe dry-run ${JSON.stringify(change)}`, async () => {
    const h = harness(), original = h.args.plan;
    h.args.plan = async () => ({ ...await original(), ...change });
    assert.equal((await refreshCycle(h.args)).phase, 'preflight');
    assert(!h.calls.includes('publish'));
  });
test('expired candidate does not get published', async () => {
  const h = harness(); h.args.prepare = async () => ({ validUntil: 999 });
  assert.equal((await refreshCycle(h.args)).phase, 'preparation');
  assert(!h.calls.includes('publish'));
});
test('lost lease stops publication', async () => {
  const h = harness(); h.lease.assertOwned = async () => { throw Error(); };
  assert.equal((await refreshCycle(h.args)).phase, 'publication');
  assert(!h.calls.includes('publish'));
});
test('unverified receipt cannot mark success', async () => {
  const h = harness(); h.args.publish = async () => ({ verified: false });
  assert.equal((await refreshCycle(h.args)).status, 'failed');
  assert(!h.records.some(r => r.status === 'success'));
});

test('optional campaigns share the Home slot after verified publication', async () => {
  const h = harness();
  h.args.refreshCampaigns = async ({ lease }) => {
    assert.equal(lease, h.lease); h.calls.push('campaigns');
    return { status: 'published', manifestSha256: 'b'.repeat(64), private: 'PRIVATE' };
  };
  const result = await refreshCycle(h.args);
  assert.equal(result.campaigns.status, 'published');
  assert(h.calls.indexOf('campaigns') > h.calls.indexOf('publish'));
  assert(!JSON.stringify([result, h.records]).includes('PRIVATE'));
});

test('optional campaign failure preserves Home success without leaking errors', async () => {
  const h = harness(); h.args.refreshCampaigns = async () => { throw Error('PRIVATE'); };
  const result = await refreshCycle(h.args);
  assert.equal(result.status, 'success'); assert.deepEqual(result.campaigns, { status: 'failed' });
  assert(!JSON.stringify([result, h.records]).includes('PRIVATE'));
});

test('Home publication failure cannot start a campaign login', async () => {
  const h = harness(); h.args.publish = async () => { throw Error(); };
  let called = false; h.args.refreshCampaigns = async () => { called = true; };
  assert.equal((await refreshCycle(h.args)).status, 'failed'); assert.equal(called, false);
});

test('campaign failures retain only explicitly safe phase labels', async () => {
  for (const phase of ['configuration','ownership','collection','publication','PRIVATE token',undefined]) {
    const h = harness();
    h.args.refreshCampaigns = async () => ({ status:'failed',phase,body:'PRIVATE' });
    const result = await refreshCycle(h.args);
    assert.equal(result.status,'success');
    assert.deepEqual(result.campaigns, {status:'failed',
      ...(['configuration','ownership','collection','publication'].includes(phase)?{phase}:{})});
    assert(!JSON.stringify([result,h.records]).includes('PRIVATE'));
  }
});
