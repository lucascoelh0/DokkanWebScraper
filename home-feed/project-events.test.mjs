import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { projectEvents } from './project-events.mjs';
const now = '2026-09-12T12:00:00.000Z';
const seconds = Date.parse(now) / 1000;
const event = (overrides = {}) => ({ id: 7, start_at: seconds - 60, end_at: seconds + 60, wday: [], quests: [{ id: 70 }], ...overrides });
const entry = (overrides = {}) => ({ kind: 'quest-level', id: '703', questId: '70', areaId: '99', ...overrides });
function input(body = { events: [event()], z_battle_stages: [] }, entries = [entry()]) {
  const catalogBytes = Buffer.from(JSON.stringify({ schemaVersion: 1, contract: 'dokkan-stage-delivery', source: 'dokkan-game-db', entries }));
  return { bodyBytes: Buffer.from(JSON.stringify(body)), catalogBytes,
    catalogSha256: createHash('sha256').update(catalogBytes).digest('hex'),
    status: 200, endpoint: '/events', observedAt: now, now };
}
test('joins quests to area instead of assuming event ID is area ID', () => {
  const result = projectEvents(input());
  assert.deepEqual(result.candidates[0], { id: 'event:7', target: { kind: 'event-area', id: '99' }, availability: {
    basis: 'overall-period', availableFrom: '2026-09-12T11:59:00.000Z', availableUntil: '2026-09-12T12:01:00.000Z',
    eventEndsAt: '2026-09-12T12:01:00.000Z', validUntil: '2026-09-12T12:01:00.000Z' } });
  assert.equal(result.publicationAllowed, false);
});
test('multiple difficulties join but ambiguous or missing quest destinations are excluded', () => {
  assert.equal(projectEvents(input(undefined, [entry(), entry({ id: '704' })])).candidates.length, 1);
  for (const entries of [[], [entry(), entry({ id: '704', areaId: '100' })]]) {
    assert.equal(projectEvents(input(undefined, entries)).excluded.unresolvedTarget, 1);
  }
  assert.equal(projectEvents(input({ events: [event({ quests: [{ id: 70 }, { id: 71 }] })], z_battle_stages: [] })).candidates.length, 0);
});
test('z-battle namespace remains distinct and super stage is not promoted', () => {
  const result = projectEvents(input({ events: [event()], z_battle_stages: [event({ super_z_battle_stage: { id: 8 } })] }, [entry(), { kind: 'z-battle', id: '7' }]));
  assert.equal(result.candidates.length, 2);
  assert.equal(result.excluded.superZBattleDeferred, 1);
  assert.deepEqual(result.candidates[1].target, { kind: 'z-battle', id: '7' });
});
test('account fields and arbitrary API text never survive projection', () => {
  const body = { events: [event({ name: 'SECRET', user_quest: { token: 'SECRET' }, quests: [{ id: 70, user_quest: 'SECRET' }] })], z_battle_stages: [], access_token: 'SECRET', eventkagi_events: [event()] };
  assert.equal(JSON.stringify(projectEvents(input(body))).includes('SECRET'), false);
  assert.equal(projectEvents(input(body)).candidates.length, 1);
});
test('recurrence absent, nonempty, malformed and weekday windows are excluded', () => {
  for (const extra of [{ wday: undefined }, { wday: ['monday'] }, { wday: 'SECRET' }, { wday_start_at: seconds }, { wday_end_at: seconds }]) {
    assert.equal(projectEvents(input({ events: [event(extra)], z_battle_stages: [] })).excluded.unavailableOrInvalidSchedule, 1);
  }
});
test('seconds are strict and invalid windows are excluded', () => {
  for (const extra of [{ end_at: 0 }, { end_at: seconds * 1000 }, { end_at: String(seconds) }, { end_at: seconds - 61 }, { start_at: null }]) {
    assert.equal(projectEvents(input({ events: [event(extra)], z_battle_stages: [] })).excluded.unavailableOrInvalidSchedule, 1);
  }
});
test('future and ended windows cannot become feed candidates', () => {
  const result = projectEvents(input({ events: [event({ start_at: seconds + 60, end_at: seconds + 120 }), event({ id: 8, end_at: seconds - 1 })], z_battle_stages: [] }));
  assert.deepEqual(result.candidates, []);
  assert.equal(result.excluded.unavailableOrInvalidSchedule, 2);
  assert.equal(result.candidates.some(v => 'active' in v), false);
});
test('304, missing arrays, duplicate identities and malformed JSON fail closed', () => {
  const cases = [{ ...input(), status: 304 }, input({ events: [] }), input({ events: [event(), event()], z_battle_stages: [] }), { ...input(), bodyBytes: Buffer.from('SECRET') }, { ...input(), endpoint: '/events/eventkagi_events' }];
  for (const value of cases) assert.throws(() => projectEvents(value), { message: 'Invalid local event observation' });
});
test('catalog digest, identity and size validation reject invalid inputs', () => {
  for (const value of [{ ...input(), catalogSha256: '0'.repeat(64) }, input(undefined, [entry(), entry()]), { ...input(), bodyBytes: Buffer.alloc(4 * 1024 * 1024 + 1) }, input({ events: Array.from({ length: 1001 }, (_, id) => event({ id: id + 1 })), z_battle_stages: [] })]) {
    assert.throws(() => projectEvents(value), { message: 'Invalid local event observation' });
  }
});
test('observation freshness and ISO dates are strict', () => {
  for (const extra of [{ now: '2026-09-12T18:00:00.000Z' }, { now: '2026-09-12T11:59:59.999Z' }, { observedAt: '2026-02-30T12:00:00.000Z' }]) assert.throws(() => projectEvents({ ...input(), ...extra }));
  assert.equal(projectEvents({ ...input(), now: '2026-09-12T17:59:59.999Z' }).validUntil, '2026-09-12T18:00:00.000Z');
});

test('weekly availability joins exactly and never fabricates an event deadline', () => {
  const weekly = event({ end_at: 2145916800, wday: ['monday', 'saturday'],
    wday_start_at: seconds - 3600, wday_end_at: seconds + 23 * 3600 });
  const result = projectEvents(input({ events: [weekly], z_battle_stages: [] }));
  assert.equal(result.schemaVersion, 2);
  assert.deepEqual(result.candidates[0].target, { kind: 'event-area', id: '99' });
  assert.equal(result.candidates[0].availability.eventEndsAt, null);
  assert.equal(result.candidates[0].availability.basis, 'observed-weekday-window');
  assert.equal(projectEvents(input({ events: [weekly], z_battle_stages: [] }, [])).excluded.unresolvedTarget, 1);
});

test('finite deadlines sort before rotations even when a rotation closes sooner', () => {
  const rows = [event({ id: 8, end_at: 2145916800, wday: ['saturday'],
    wday_start_at: seconds - 86390, wday_end_at: seconds + 10 }), event()];
  const result = projectEvents(input({ events: rows, z_battle_stages: [] }));
  assert.deepEqual(result.candidates.map(v => v.id), ['event:7', 'event:8']);
  assert.equal(result.candidates[1].availability.validUntil, '2026-09-12T12:00:10.000Z');
  assert.equal(projectEvents({ ...input({ events: rows, z_battle_stages: [] }), now: '2026-09-12T12:00:10.000Z' }).candidates.length, 1);
});

test('unavailable rows still require structurally valid quest identities', () => {
  for (const quests of ['bad', undefined, [{ id: 0 }], [{ id: 70 }, { id: 70 }]]) {
    assert.throws(() => projectEvents(input({ events: [event({ end_at: seconds - 1, quests })], z_battle_stages: [] })),
      { message: 'Invalid local event observation' });
  }
});

test('receipt identifies exact input bytes without disclosing them', () => {
  const value = input();
  assert.equal(projectEvents(value).observationSha256, createHash('sha256').update(value.bodyBytes).digest('hex'));
  assert.notEqual(projectEvents(value).observationSha256,
    projectEvents({ ...value, bodyBytes: Buffer.concat([value.bodyBytes, Buffer.from(' ')]) }).observationSha256);
});
