import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshCycle, REFRESH_INTERVAL_MS } from './refresh-cycle.mjs';

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
