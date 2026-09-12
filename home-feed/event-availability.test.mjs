import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretEventAvailability as interpret } from './event-availability.mjs';
const options = { kind: 'event', observedAt: '2026-09-12T21:38:35.426Z', now: '2026-09-12T21:38:35.426Z' };
const weekly = { start_at: 1664865000, end_at: 2145916800, wday: ['monday', 'saturday'], wday_start_at: 1789194600, wday_end_at: 1789281000 };

test('observed Prodigy Prince rotation has an availability boundary but no event deadline', () => {
  assert.deepEqual(interpret(weekly, options), {
    basis: 'observed-weekday-window', availableFrom: '2026-09-12T06:30:00.000Z',
    availableUntil: '2026-09-13T06:30:00.000Z', eventEndsAt: null,
    validUntil: '2026-09-13T03:38:35.426Z',
  });
});
test('Bulma overall deadline clips the daily window', () => {
  const value = interpret({ ...weekly, start_at: 1787994000, end_at: 1789257599,
    wday: ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],
    wday_start_at: 1789192800, wday_end_at: 1789279200 }, options);
  assert.equal(value.availableUntil, '2026-09-12T23:59:59.000Z');
  assert.equal(value.eventEndsAt, value.availableUntil);
  assert.equal(value.validUntil, value.availableUntil);
});
test('long Z-Battle window has no permanent claim or countdown', () => {
  const result = interpret({ start_at: 1735264800, end_at: 2145916800 }, { ...options, kind: 'z-battle' });
  assert.equal(result.eventEndsAt, null);
  assert.equal(result.basis, 'overall-period');
  assert.equal('permanent' in result, false);
});
test('finite Z-Battle retains a distinct overall deadline', () => {
  assert.equal(interpret({ start_at: 1788411600, end_at: 1792483199 }, { ...options, kind: 'z-battle' }).eventEndsAt,
    '2026-10-20T07:59:59.000Z');
});
test('invalid or incomplete weekday input cannot create availability', () => {
  for (const extra of [{ wday: undefined }, { wday: ['SECRET'] }, { wday: ['saturday','SATURDAY'] },
    { wday: [] }, { wday_end_at: undefined }, { wday_end_at: 1789281001 },
    { start_at: '1664865000' }, { end_at: 0 }, { end_at: 1789281000000 }]) {
    assert.equal(interpret({ ...weekly, ...extra }, options), null);
  }
});
test('does not extrapolate future, ended or stale observations', () => {
  for (const extra of [{ now: '2026-09-13T03:38:35.426Z' }, { now: '2026-09-12T21:38:35.425Z' },
    { observedAt: '2026-09-13T06:30:00.000Z', now: '2026-09-13T06:30:00.000Z' },
    { observedAt: '2026-09-12T06:29:59.000Z', now: '2026-09-12T06:30:00.000Z' },
    { now: '2026-02-30T21:38:35.426Z' }]) assert.equal(interpret(weekly, { ...options, ...extra }), null);
});
test('arbitrary account fields never survive and inputs are not mutated', () => {
  const row = Object.freeze({ ...weekly, access_token: 'SECRET', user_quest: 'SECRET', name: 'SECRET' });
  assert.equal(JSON.stringify(interpret(row, options)).includes('SECRET'), false);
  assert.equal(interpret(null, options), null);
  assert.equal(interpret(weekly), null);
});
