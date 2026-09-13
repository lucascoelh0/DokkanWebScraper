import { createSession } from './auth-session.mjs';
import { prepareCampaignDelivery } from './prepare-campaign-delivery.mjs';
import { createHash } from 'node:crypto';
import { campaignArtworkUrl, prepareCampaignArtwork } from './campaign-artwork.mjs';

// Only an in-process successful collector result can prepare a public candidate.
// Store private copies: callers may mutate their returned experimental buffers.
const collected = new WeakMap();
const encode = value => Buffer.from(JSON.stringify(value), 'utf8');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

/** Explicit one-shot collection only. Not wired into scheduled Home refresh. */
export async function collectCampaigns({ enabled = false, includePresentation = false, config, definitionBytes,
  expectedDefinitionSha256, expectedDatabaseSha256 } = {}, { fetchImpl = fetch, now = Date.now } = {}) {
  if (enabled !== true) return { status: 'disabled' };
  let session;
  try {
    if (typeof includePresentation !== 'boolean') throw Error();
    const started = now();
    if (!Number.isSafeInteger(started) || started < 1230768000000 || started >= 4102444800000) throw Error();
    const observedAt = new Date(started).toISOString();
    if (!Buffer.isBuffer(definitionBytes) || definitionBytes.length > 2 * 1024 * 1024) throw Error();
    const definitions = Buffer.from(definitionBytes);
    const input = { definitionBytes: definitions, expectedDefinitionSha256, expectedDatabaseSha256,
      observation: { bodyBytes: Buffer.from('{"mission_board_campaigns":[]}'),
        status: 200, endpoint: '/missions/mission_board_campaigns', observedAt, now: observedAt,
        timestampUnit: 'unix-seconds' } };
    // Verify the complete pinned static definition before spending a login.
    prepareCampaignDelivery(input);
    session = createSession(config, { fetchImpl, apiScope: includePresentation ? 'campaigns-media' : 'campaigns' });
    const response = await session.requestApi('/missions/mission_board_campaigns');
    const completed = now();
    if (!Number.isSafeInteger(completed) || completed < started || completed - started >= 60000) throw Error();
    const receivedAt = new Date(completed).toISOString();
    const delivery = prepareCampaignDelivery({ ...input, observation: { ...input.observation,
      bodyBytes: Buffer.from(JSON.stringify(response.body)), status: response.status, now: receivedAt } });
    const artwork = new Map();
    if (includePresentation) {
      const unique = new Map();
      for (const row of response.body.mission_board_campaigns) {
        if (row.banner_image_path == null) continue;
        const url = campaignArtworkUrl(row.banner_image_path);
        if (!unique.has(url)) {
          if (unique.size >= 8) throw Error();
          unique.set(url, await prepareCampaignArtwork(await session.fetchImage(url)));
        }
        artwork.set(row.id, unique.get(url));
        const instant = now();
        if (!Number.isSafeInteger(instant) || instant < started || instant - started >= 60000) throw Error();
      }
    }
    const result = { status: 'collected', delivery, receipt: {
      source: 'fresh-global-campaign-session', requestStartedAt: observedAt, receivedAt,
      indexSha256: delivery.indexSha256, indexSizeBytes: delivery.indexBytes.length,
      campaignCount: delivery.details.length, totalBytes: delivery.totalBytes, published: false,
    } };
    collected.set(result, { indexBytes: Buffer.from(delivery.indexBytes),
      details: delivery.details.map(detail => Buffer.from(detail.bytes)), artwork,
      includePresentation });
    return result;
  } catch {
    return { status: 'unavailable' };
  } finally {
    session?.close();
  }
}

/** Separate public projection, never a flag edit of the experimental documents.
 * Returns candidate bytes only: no network/store/publisher is connected here.
 */
export function prepareCollectedCampaignCandidate(collection, { now = Date.now } = {}) {
  try {
    const stored = collected.get(collection);
    if (!stored) throw Error();
    const index = JSON.parse(stored.indexBytes);
    const instant = now();
    if (!Number.isSafeInteger(instant) || instant < Date.parse(index.observedAt)
        || instant >= Date.parse(index.validUntil)) throw Error();
    const campaigns = stored.details.map(bytes => {
      const detail = JSON.parse(bytes);
      // These nested definitions were whitelist-projected and deep-joined by
      // the collector. No raw observation, account wrapper or observation hash.
      const image = stored.artwork.get(detail.campaign.id)?.descriptor;
      return { campaign: { ...detail.campaign, ...(image ? { artwork: image } : {}) }, missions: detail.missions };
    });
    const enriched = stored.includePresentation || campaigns.some(c => c.missions.some(m => Object.hasOwn(m, 'destination')));
    const publicContext = { schemaVersion: enriched ? 2 : 1, region: 'global', source: 'global-game-campaigns',
      coverage: 'partial-observation', contentSemantics: 'mission-definitions',
      observedAt: index.observedAt, validUntil: index.validUntil };
    const revisionSha256 = digest(encode({ ...publicContext, campaigns }));
    const context = { ...publicContext, revisionSha256 };
    const details = campaigns.map(({ campaign, missions }) => {
      const bytes = encode({ ...context, contract: 'dokkan-campaign-detail', campaign, missions });
      if (bytes.length > 512 * 1024) throw Error();
      const sha256 = digest(bytes);
      return { campaignId: campaign.id, objectKey: `details/${sha256}.json`, sha256, sizeBytes: bytes.length, bytes };
    });
    const indexBytes = encode({ ...context, contract: 'dokkan-campaign-index',
      campaigns: campaigns.map(({ campaign }, n) => ({ id: campaign.id, title: campaign.title,
        ...(campaign.artwork ? { artwork: campaign.artwork } : {}),
        visibleDeadline: campaign.visibleDeadline, boardCount: campaign.boards.length,
        destination: { type: 'campaign-detail', campaignId: campaign.id, detailSha256: details[n].sha256 },
        detail: { sha256: details[n].sha256, sizeBytes: details[n].sizeBytes } })) });
    const indexSha256 = digest(indexBytes);
    const manifestBytes = encode({ schemaVersion: 1, contract: 'dokkan-campaign-manifest', region: 'global',
      file: `index/${indexSha256}.json`, sha256: indexSha256, sizeBytes: indexBytes.length });
    const images = [...new Map([...stored.artwork.values()].map(image => [image.descriptor.sha256, image])).values()]
      .map(image => ({ objectKey: `images/${image.descriptor.sha256}.png`, bytes: Buffer.from(image.bytes), ...image.descriptor }));
    const totalBytes = manifestBytes.length + indexBytes.length + details.reduce((n, d) => n + d.sizeBytes, 0)
      + images.reduce((n, image) => n + image.sizeBytes, 0);
    if (manifestBytes.length > 4096 || indexBytes.length > 32 * 1024 || totalBytes > 4 * 1024 * 1024) throw Error();
    return { target: 'staging/v2/campaigns/', publicationAllowed: false,
      manifestBytes, indexBytes, indexSha256, revisionSha256, details, images, totalBytes,
      validUntil: index.validUntil };
  } catch {
    throw new Error('campaign_public_candidate_failed');
  }
}
