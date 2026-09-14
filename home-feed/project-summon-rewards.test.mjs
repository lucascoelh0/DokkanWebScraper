import test from 'node:test';
import assert from 'node:assert/strict';
import { projectSummonRewards as project } from './project-summon-rewards.mjs';
test('keeps rewards scoped to course and independent of cost and drawn characters', () => {
  assert.deepEqual(project({ treasure_item_id: 7204, courses: [
    { no: 1, price: 5, items_count: 1, treasure_item_count: null },
    { no: 2, price: 50, items_count: 5, treasure_item_count: 1, drawable_count: 3 },
  ] }), [{ courseNo: 2, itemType: 'TreasureItem', itemId: 7204, quantity: 1 }]);
});
test('retains differing single and multi quantities, without summing them', () => {
  assert.deepEqual(project({ treasure_item_id: 7304, courses: [
    { no: 1, treasure_item_count: 1 }, { no: 2, treasure_item_count: 10 },
  ] }).map(r => r.quantity), [1, 10]);
});
test('old or absent optional enrichment stays absent', () => {
  assert.deepEqual(project({}), []);
  assert.deepEqual(project({ treasure_item_id: 1, courses: [{ no: 1, treasure_item_count: 0 }] }), []);
});
test('rejects invalid IDs, quantities and ambiguous duplicate courses', () => {
  for (const value of [
    { treasure_item_id: -1, courses: [] },
    { treasure_item_id: 1, courses: [{ no: 1, treasure_item_count: -1 }] },
    { treasure_item_id: 1, courses: [{ no: 1 }, { no: 1 }] },
  ]) assert.throws(() => project(value), { message: 'Invalid summon rewards' });
});
