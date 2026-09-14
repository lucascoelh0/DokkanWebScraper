import test from 'node:test';
import assert from 'node:assert/strict';
import { summonDescription, projectSummonDiscount } from './project-summon-presentation.mjs';
const description = '{center: begin}{color : #FF7700}400 hours only!{color} Perform 3 Multi-Summons and {color : #FFFF00}get one FREE{color}!\nNew character arrives!{center}';
const row = () => ({ type: 'Gasha::StoneGasha', timer_layout_type: 2, open_at: 1_700_000_000,
  end_at: 1_701_439_999, description });
test('removes observed style tags without leaking raw game markup', () => {
  assert.equal(summonDescription(description), '400 hours only! Perform 3 Multi-Summons and get one FREE! New character arrives!');
  assert.equal(summonDescription('Simple text'), 'Simple text');
});
test('rejects unknown markup, HTML, controls and unbounded descriptions', () => {
  for (const text of ['{unknown}text', '<b>text</b>', 'a\u0000b', 'x'.repeat(2001), null]) assert.equal(summonDescription(text), '');
});
test('uses actual API end time, never feed expiry or a newly synthesized deadline', () => {
  assert.deepEqual(projectSummonDiscount(row()), { kind: 'three-plus-one', endsAt: new Date(row().end_at * 1000).toISOString() });
});
test('timer type or duration alone do not establish discount semantics', () => {
  for (const patch of [{ description: '400 hours only!' }, { description: 'Perform 3 Multi-Summons and get one FREE!' },
    { timer_layout_type: 1 }, { type: 'Gasha::TicketGasha' }, { end_at: row().end_at + 1 },
    { open_at: '1700000000' }, { end_at: NaN }]) assert.equal(projectSummonDiscount({ ...row(), ...patch }), null);
  assert.equal(projectSummonDiscount(null), null);
});
