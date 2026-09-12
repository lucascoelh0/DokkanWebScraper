import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareEventSection } from './prepare-events.mjs';
const at = Date.parse('2026-09-12T12:00:00.000Z');
const date = ms => new Date(ms).toISOString();
function fixture() {
  return { status: 'collected', receipt: { source: 'fresh-global-events-session',
    requestStartedAt: date(at), receivedAt: date(at), catalogSha256: 'a'.repeat(64), normalizedBodySha256: 'b'.repeat(64) },
  projection: { schemaVersion: 2, publicationAllowed: false, mode: 'offline-experiment',
    authority: 'partial-global-account-observation', timestampSemantics: 'absolute-window-intersection',
    observedAt: date(at), validUntil: date(at+21600000), catalogSha256: 'a'.repeat(64), observationSha256: 'b'.repeat(64),
    candidates: [{ id: 'event:1', target: { kind: 'event-area', id: '99' }, availability: {
      basis: 'observed-weekday-window', availableFrom: date(at-1000), availableUntil: date(at+60000),
      eventEndsAt: null, validUntil: date(at+60000) } }] } };
}
test('bounded public projection drops internal and arbitrary fields', () => {
  const c = fixture(); c.projection.candidates[0].token = 'PRIVATE';
  const out = prepareEventSection(c, at);
  assert.equal(out.items[0].target.id, '99');
  assert.equal(out.coverage, 'partial');
  assert.equal(JSON.stringify(out).includes('PRIVATE'), false);
  assert.equal('publicationAllowed' in out, false);
});
test('expired items disappear without extending their deadline', () => {
  assert.deepEqual(prepareEventSection(fixture(), at+60000).items, []);
  assert.equal(prepareEventSection(fixture(), at+21600000), null);
  assert.equal(prepareEventSection(fixture(), at-1), null);
});
test('mismatched receipt and invalid structure omit optional section', () => {
  for (const mutate of [c => c.receipt.catalogSha256 = 'c'.repeat(64),
    c => c.receipt.normalizedBodySha256 = 'c'.repeat(64),
    c => c.projection.candidates.push(c.projection.candidates[0]),
    c => c.projection.candidates[0].availability.validUntil = date(at+60001),
    c => c.projection.candidates[0].target.kind = 'url',
    c => c.projection.candidates[0].availability.eventEndsAt = 'bad']) {
    const c = fixture(); mutate(c); assert.equal(prepareEventSection(c, at), null);
  }
  assert.equal(prepareEventSection({status:'unavailable'}, at), null);
});
test('validates every row before truncating to twenty', () => {
  const c = fixture(); const row = c.projection.candidates[0];
  c.projection.candidates = Array.from({length:30},(_,i)=>({...row,id:`event:${i+1}`}));
  assert.equal(prepareEventSection(c, at).items.length,20);
  c.projection.candidates[29].target = {kind:'event-area',id:'bad'};
  assert.equal(prepareEventSection(c, at),null);
});
