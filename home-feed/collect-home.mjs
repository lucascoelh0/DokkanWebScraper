import { loadEventCatalog } from './event-catalog.mjs';
import { collectEvents } from './collect-events.mjs';
import { collectNews } from './collect-news.mjs';

/** Optional events are collected only after summons succeed, never in parallel login sessions. */
export async function collectHome({ collectSummons, config, enableEvents = false, enableNews = false, expectedCatalogSha256 },
  { loadCatalog = loadEventCatalog, collectEventObservation = collectEvents, collectNewsObservation = collectNews } = {}) {
  const observation = await collectSummons();
  const result = { observation };
  if (enableNews === true) {
    try { result.newsCollection = await collectNewsObservation({ config, includePresentation: true, banners: observation.snapshot?.banners ?? [] }); }
    catch { result.newsCollection = { status: 'unavailable' }; }
  }
  if (enableEvents !== true) return result;
  let eventCollection;
  try {
    const catalog = await loadCatalog({ expectedCatalogSha256 });
    eventCollection = await collectEventObservation({ config, ...catalog, includePresentation: true });
  } catch { eventCollection = { status: 'unavailable' }; }
  return { ...result, eventCollection };
}
