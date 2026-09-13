import { createHash } from 'node:crypto';
import { prepareCampaignPreview } from './prepare-campaign-preview.mjs';

export const CAMPAIGN_DELIVERY_LIMITS = Object.freeze({
  indexBytes: 32 * 1024,
  detailBytes: 512 * 1024,
  totalBytes: 4 * 1024 * 1024,
});

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const encode = value => Buffer.from(JSON.stringify(value), 'utf8');

/** Offline packing only: no filesystem, network, Home integration or publication. */
export function prepareCampaignDelivery(input) {
  try {
    const preview = prepareCampaignPreview(input);
    const context = {
      schemaVersion: 1,
      mode: preview.mode,
      publicationAllowed: false,
      region: 'global',
      authority: preview.authority,
      observedAt: preview.observedAt,
      validUntil: preview.validUntil,
      observationSha256: preview.observationSha256,
      definitionSha256: preview.definitionSha256,
      databaseSha256: preview.databaseSha256,
    };
    const missions = new Map(preview.missions.map(mission => [mission.id, mission]));
    let totalBytes = 0;
    const details = preview.campaigns.map(campaign => {
      const required = new Set([campaign.campaignCompleteMissionId]);
      for (const board of campaign.boards) {
        for (const missionId of board.missionIds) required.add(missionId);
      }
      const rows = [...required].map(id => missions.get(id));
      if (rows.some(row => !row)) throw new Error();
      rows.sort((a, b) => a.priority - b.priority || a.id - b.id);
      const bytes = encode({
        ...context,
        contract: 'dokkan-campaign-detail-preview',
        textSemantics: preview.textSemantics,
        missionSemantics: preview.missionSemantics,
        rewardSemantics: preview.rewardSemantics,
        campaign,
        missions: rows,
      });
      totalBytes += bytes.length;
      if (bytes.length > CAMPAIGN_DELIVERY_LIMITS.detailBytes
          || totalBytes > CAMPAIGN_DELIVERY_LIMITS.totalBytes) throw new Error();
      return { campaignId: campaign.id, sha256: digest(bytes), sizeBytes: bytes.length, bytes };
    });
    const indexBytes = encode({
      ...context,
      contract: 'dokkan-campaign-index-preview',
      campaigns: preview.campaigns.map((campaign, index) => ({
        id: campaign.id,
        title: campaign.title,
        visibleDeadline: campaign.visibleDeadline,
        boardCount: campaign.boards.length,
        destination: {
          type: 'campaign-detail',
          campaignId: campaign.id,
          detailSha256: details[index].sha256,
        },
        detail: { sha256: details[index].sha256, sizeBytes: details[index].sizeBytes },
      })),
    });
    totalBytes += indexBytes.length;
    if (indexBytes.length > CAMPAIGN_DELIVERY_LIMITS.indexBytes
        || totalBytes > CAMPAIGN_DELIVERY_LIMITS.totalBytes) throw new Error();
    return { indexBytes, indexSha256: digest(indexBytes), details, totalBytes };
  } catch {
    throw new Error('Invalid offline campaign delivery');
  }
}
