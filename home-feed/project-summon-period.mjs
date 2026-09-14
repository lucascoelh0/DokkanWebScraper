/** Deliberately narrow: official paired stone-summon Event Period only. */
export function projectSummonPeriod(payload, banner) {
  const article = payload?.announcement;
  if (banner?.gasha_category_id !== 1 || !Number.isSafeInteger(banner.information_announcement_id) ||
      article?.id !== banner.information_announcement_id || !Array.isArray(article.bodies) || article.bodies.length > 100) return null;
  if (!article.bodies.every(b => typeof b.description === 'string' && b.description.length <= 50000)) return null;
  const text = article.bodies.map(b => b.description).join('\n');
  if (text.length > 100000 || text.split('= Event Period =').length !== 2) return null;
  const section = text.split('= Event Period =')[1].split('= Notes =')[0];
  const matches = [...section.matchAll(/- Dokkan Festival x Legendary Summon Carnival\s*(?:\r?\n- [^{}\r\n]+ Packs)?\{color\}\s*\{duration:(\d{1,10}),(\d{1,10}),DT,U\}/g)];
  if (matches.length !== 1) return null;
  const start = Number(matches[0][1]), end = Number(matches[0][2]);
  if (!Number.isSafeInteger(banner.open_at) || !Number.isSafeInteger(banner.end_at) ||
      start !== banner.open_at || end <= start || end + 59 < banner.end_at || end - start > 366 * 86400) return null;
  return new Date(end * 1000).toISOString();
}
