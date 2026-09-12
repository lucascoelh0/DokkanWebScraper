import { createHash } from 'node:crypto';
import { createSession } from './auth-session.mjs';
import { projectEvents } from './project-events.mjs';

/** Internal trusted collector. Never accepts an externally supplied observation date/body. */
export async function collectEvents({ config, catalogBytes, catalogSha256 }, { fetchImpl = fetch, now = Date.now } = {}) {
  let session;
  try {
    const started = now();
    if (!Number.isSafeInteger(started) || started < 1230768000000 || started >= 4102444800000) throw Error();
    // Snapshot and validate the independently pinned public catalog before login.
    if (!Buffer.isBuffer(catalogBytes) || catalogBytes.length > 16 * 1024 * 1024) throw Error();
    const catalog = Buffer.from(catalogBytes);
    const date = new Date(started).toISOString();
    projectEvents({ bodyBytes: Buffer.from('{"events":[],"z_battle_stages":[]}'),
      catalogBytes: catalog, catalogSha256, endpoint: '/events', status: 200, observedAt: date, now: date });
    session = createSession(config, { fetchImpl, apiScope: 'events' });
    const response = await session.requestApi('/events');
    const completed = now();
    if (!Number.isSafeInteger(completed) || completed < started || completed - started >= 60000) throw Error();
    // Begin-time freshness is conservative: a slow response never extends the lease.
    const bodyBytes = Buffer.from(JSON.stringify(response.body));
    const result = projectEvents({ bodyBytes, catalogBytes: catalog, catalogSha256,
      endpoint: '/events', status: response.status, observedAt: date, now: new Date(completed).toISOString() });
    return { status: 'collected', projection: result, receipt: {
      source: 'fresh-global-events-session', requestStartedAt: date,
      receivedAt: new Date(completed).toISOString(),
      normalizedBodySha256: createHash('sha256').update(bodyBytes).digest('hex'),
      catalogSha256,
    } };
  } catch {
    // Optional enrichment failure must not reveal response/config or erase summons.
    return { status: 'unavailable' };
  } finally {
    session?.close();
  }
}
