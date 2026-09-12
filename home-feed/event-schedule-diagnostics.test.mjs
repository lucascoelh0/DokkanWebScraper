import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseEventSchedules } from './event-schedule-diagnostics.mjs';
const run = (rows, z = []) => diagnoseEventSchedules({ bodyBytes: Buffer.from(JSON.stringify({ events: rows, z_battle_stages: z, token: 'SECRET' })), endpoint: '/events', status: 200 });
test('separates all-seven, subsets, empty and malformed weekdays without leaking text', () => {
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const values = [days, ['monday'], [], ['SECRET'], ['monday','monday'], null, undefined];
  const result = run(values.map((wday, i) => ({ id: i + 1, wday, name: 'SECRET', user_quest: 'SECRET' })));
  assert.deepEqual(result.rows.map(r => r.weekdays.state), ['all-seven','subset','empty','invalid','invalid','null','absent']);
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
});
test('distinguishes exclusion reasons without asserting permanence', () => {
  const start = 1789214400;
  const pairs = [[null,start],[0,start],[start,9999999999],[start,start],[start,start+400*86400],[start,start+86400]];
  const result = run(pairs.map(([start_at,end_at], i) => ({ id:i+1,start_at,end_at,wday_start_at:'SECRET',wday_end_at:-1 })));
  assert.deepEqual(result.rows.map(r=>r.periodReason), ['missing-or-invalid','zero-boundary','outside-seconds-policy','non-increasing','longer-than-366-days','finite-within-policy']);
  assert.equal(JSON.stringify(result).includes('SECRET'),false);
  assert.equal(result.publicationAllowed,false);
});
test('rejects wrong route, status, duplicate IDs, oversized input and malformed JSON safely', () => {
  for (const patch of [{endpoint:'/missions'}, {status:304}, {bodyBytes:Buffer.from('SECRET')}, {bodyBytes:Buffer.alloc(4*1024*1024+1)}]) {
    assert.throws(()=>diagnoseEventSchedules({endpoint:'/events',status:200,bodyBytes:Buffer.from('{"events":[],"z_battle_stages":[]}'),...patch}), {message:'Invalid event schedule diagnostic'});
  }
  assert.throws(()=>run([{id:1},{id:1}]));
  assert.equal(run([{id:1}],[{id:1}]).rows.length,2);
});
