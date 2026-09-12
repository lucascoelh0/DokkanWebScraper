import { loadEventCatalog } from './event-catalog.mjs';
import { collectEvents } from './collect-events.mjs';

/** Optional events are collected only after summons succeed, never in parallel login sessions. */
export async function collectHome({ collectSummons, config, enableEvents = false, expectedCatalogSha256 },
  { loadCatalog = loadEventCatalog, collectEventObservation = collectEvents } = {}) {
  const observation = await collectSummons();
  if (enableEvents !== true) return { observation };
  let eventCollection;
  try {
    const catalog = await loadCatalog({ expectedCatalogSha256 });
    eventCollection = await collectEventObservation({ config, ...catalog });
  } catch { eventCollection = { status: 'unavailable' }; }
  return { observation, eventCollection };
}
