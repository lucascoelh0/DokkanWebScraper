import test from 'node:test';
import assert from 'node:assert/strict';
import { projectSummonPeriod } from './project-summon-period.mjs';
const banner = { id: 12472, information_announcement_id: 107229, gasha_category_id: 1, open_at: 1789273800, end_at: 1790713799 };
const block = '- Dokkan Festival x Legendary Summon Carnival\n- Deathmatch at the Cell Games Packs{color}\n{duration:1789273800,1792483140,DT,U}';
const payload = (value = block) => ({ announcement: { id: 107229, bodies: [{ description: '= Event Period =\n' + value + '\n- Ticket Summons{color}\n{duration:1789273800,1793087940,DT,U}\n- Coin Exchange Period{color}\n{duration:1789273800,1793174340,DT,U}\n= Notes =' }] } });
test('selects labelled full stone period, not discount, tickets or exchange', () => {
  assert.equal(projectSummonPeriod(payload('- 400 Hours Only! Super Multi-Summon Discounts!{color}\n{duration:1789273800,1790713740,DT,U}\n' + block), banner), '2026-10-20T07:59:00.000Z');
});
test('ambiguous, missing, malformed and wrong start periods are omitted', () => {
  for (const text of ['', block + '\n' + block, block.replace('1789273800', '1789273801'), block.replace('1792483140', '1789273900'), block.replace('DT,U', 'DT,L')]) assert.equal(projectSummonPeriod(payload(text), banner), null);
});
test('wrong announcement, ticket category and malformed body cannot supply dates', () => {
  for (const b of [{ ...banner, information_announcement_id: 107189 }, { ...banner, gasha_category_id: 3 }, { ...banner, open_at: null }]) assert.equal(projectSummonPeriod(payload(), b), null);
  assert.equal(projectSummonPeriod({ announcement: { id: 107229, bodies: [{}] } }, banner), null);
});
