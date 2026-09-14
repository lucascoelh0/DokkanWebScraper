/** Preserve first-party reward quantities per course, never infer from price or items_count. */
export function projectSummonRewards(banner) {
  const fail = () => { throw new Error('Invalid summon rewards'); };
  const positive = value => Number.isSafeInteger(value) && value > 0 && value <= 999_999_999;
  if (banner.treasure_item_id == null) return [];
  if (!positive(banner.treasure_item_id) || !Array.isArray(banner.courses) || banner.courses.length > 30) fail();
  const seen = new Set();
  return banner.courses.flatMap(course => {
    if (!course || !positive(course.no) || seen.has(course.no)) fail();
    seen.add(course.no);
    if (course.treasure_item_count == null || course.treasure_item_count === 0) return [];
    if (!positive(course.treasure_item_count)) fail();
    return [{ courseNo: course.no, itemType: 'TreasureItem', itemId: banner.treasure_item_id,
      quantity: course.treasure_item_count }];
  });
}
