import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { collectEvents } from './collect-events.mjs';

const at = Date.parse('2026-09-12T21:00:00.000Z');
const catalogBytes = Buffer.from(JSON.stringify({ schemaVersion: 1, contract: 'dokkan-stage-delivery',
  source: 'dokkan-game-db', entries: [{ kind: 'z-battle', id: '211' }] }));
const input = () => ({ catalogBytes, catalogSha256: createHash('sha256').update(catalogBytes).digest('hex'),
  config: { nonceHeaders: { authorization: 'Basic test' }, loginHeaders: { authorization: 'Basic test' },
    loginBody: { account_id: 'PRIVATE' }, apiHeaders: {} } });
function io(body = { events: [], z_battle_stages: [{ id: 211, start_at: 1788411600, end_at: 1792483199 }] }) {
  const calls = [];
  return { calls, fetchImpl: async (url, options) => {
    const path = new URL(url).pathname;
    calls.push({ path, options });
    const data = path === '/auth/nonce' ? { auth_transaction_id: 'transaction' }
      : path === '/auth/sign_in' ? { access_token: 'PRIVATE', token_type: 'bearer' } : body;
    return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
  } };
}
test('one fresh session binds normalized response and capture times to projection', async () => {
  const mock = io(); let tick = 0;
  const value = await collectEvents(input(), { fetchImpl: mock.fetchImpl, now: () => at + tick++ * 1000 });
  assert.equal(value.status, 'collected');
  assert.deepEqual(mock.calls.map(c => c.path), ['/auth/nonce', '/auth/sign_in', '/events']);
  assert.equal(mock.calls[2].options.headers.authorization, 'Bearer PRIVATE');
  assert.equal(value.projection.observedAt, '2026-09-12T21:00:00.000Z');
  assert.equal(value.receipt.receivedAt, '2026-09-12T21:00:01.000Z');
  assert.equal(value.receipt.normalizedBodySha256, value.projection.observationSha256);
  assert.equal(value.projection.candidates.length, 1);
  assert.equal(value.projection.publicationAllowed, false);
  assert.equal(JSON.stringify(value).includes('PRIVATE'), false);
});
test('invalid catalog is rejected before authentication', async () => {
  const mock = io();
  assert.deepEqual(await collectEvents({ ...input(), catalogSha256: '0'.repeat(64) }, { fetchImpl: mock.fetchImpl, now: () => at }), { status: 'unavailable' });
  assert.equal(mock.calls.length, 0);
});
test('private errors and malformed observations become optional unavailability', async () => {
  for (const fetchImpl of [async () => { throw Error('PRIVATE'); }, io({ token: 'PRIVATE' }).fetchImpl]) {
    assert.deepEqual(await collectEvents(input(), { fetchImpl, now: () => at }), { status: 'unavailable' });
  }
});
test('clock rollback or excessively slow capture fails without retry', async () => {
  for (const delta of [-1, 60000]) {
    const mock = io(); let tick = 0;
    assert.deepEqual(await collectEvents(input(), { fetchImpl: mock.fetchImpl, now: () => at + (tick++ ? delta : 0) }), { status: 'unavailable' });
    assert.equal(mock.calls.length, 3);
  }
});
