/** Strip only observed game formatting; unknown markup is not displayable prose. */
export function summonDescription(value) {
  if (typeof value !== 'string' || value.length > 2000 || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) return '';
  const text = value.replace(/\{\s*center\s*(?::\s*begin\s*)?\}/giu, '')
    .replace(/\{\s*color\s*(?::\s*#[a-f0-9]{6}\s*)?\}/giu, '')
    .replace(/\s+/gu, ' ').trim();
  return /[{}]/u.test(text) || text.length > 1000 ? '' : text;
}

/** Evidence-bounded offer classification, not a general meaning for timer_layout_type=2. */
export function projectSummonDiscount(row) {
  const description = summonDescription(row?.description);
  if (row?.type !== 'Gasha::StoneGasha' || row.timer_layout_type !== 2 ||
      !Number.isSafeInteger(row.open_at) || !Number.isSafeInteger(row.end_at) ||
      row.open_at < 0 || row.end_at > 9_999_999_999 ||
      row.end_at - row.open_at + 1 !== 400 * 3600 ||
      !/\b400 hours only!\s*Perform 3 Multi-Summons and get one FREE!/iu.test(description)) return null;
  return { kind: 'three-plus-one', endsAt: new Date(row.end_at * 1000).toISOString() };
}
