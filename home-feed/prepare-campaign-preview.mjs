import { createHash } from 'node:crypto';
import { projectCampaigns } from './project-campaigns.mjs';

const MAX_DEFINITION_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_CATEGORIES = 1000;
const MAX_MISSIONS = 5000;
const MAX_REWARDS = 20000;
const MAX_ID = 999999999;
const HASH = /^[a-f0-9]{64}$/;
const REWARD_TYPE = /^[A-Za-z][A-Za-z0-9]*(?:::[A-Za-z][A-Za-z0-9]*)?$/;
const UNSAFE_SINGLE_LINE = /[\u0000-\u001f\u007f-\u009f\ud800-\udfff\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const UNSAFE_DESCRIPTION = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\ud800-\udfff\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;

const fail = () => { throw new Error('Invalid local campaign preview'); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function exactKeys(value, keys) {
  if (!object(value)) fail();
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail();
}

function parse(bytes, limit) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > limit) fail();
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    fail();
  }
}

function id(value) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_ID) fail();
  return value;
}

function priority(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_ID) fail();
  return value;
}

function text(value, maximum, { nullable = false, allowEmpty = false, multiline = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string') fail();
  const normalized = multiline ? value.replace(/\r\n/g, '\n') : value;
  if ((!allowEmpty && normalized.trim().length === 0) || [...normalized].length > maximum
      || (multiline ? UNSAFE_DESCRIPTION : UNSAFE_SINGLE_LINE).test(normalized)) fail();
  return normalized;
}

function rewardType(value) {
  const normalized = text(value, 80);
  if (!REWARD_TYPE.test(normalized)) fail();
  return normalized;
}

function campaignTitle(value) {
  if (typeof value !== 'string') fail();
  const withCanonicalLines = value.replace(/\r\n/g, '\n');
  if (UNSAFE_DESCRIPTION.test(withCanonicalLines)) fail();
  const normalized = withCanonicalLines.replace(/[ \t\n]+/g, ' ').trim();
  if (normalized.length === 0 || [...normalized].length > 120) fail();
  return normalized;
}

function definition(definitionBytes, expectedDefinitionSha256, expectedDatabaseSha256) {
  if (!Buffer.isBuffer(definitionBytes) || definitionBytes.length === 0
      || definitionBytes.length > MAX_DEFINITION_BYTES
      || typeof expectedDefinitionSha256 !== 'string' || !HASH.test(expectedDefinitionSha256)
      || typeof expectedDatabaseSha256 !== 'string' || !HASH.test(expectedDatabaseSha256)
      || digest(definitionBytes) !== expectedDefinitionSha256) fail();

  const raw = parse(definitionBytes, MAX_DEFINITION_BYTES);
  exactKeys(raw, ['schemaVersion', 'contract', 'source', 'databaseSha256', 'categories', 'missions']);
  if (![1, 2].includes(raw.schemaVersion) || raw.contract !== 'dokkan-campaign-definitions'
      || raw.source !== 'dokkan-game-db' || raw.databaseSha256 !== expectedDatabaseSha256
      || !HASH.test(raw.databaseSha256) || !Array.isArray(raw.categories)
      || raw.categories.length > MAX_CATEGORIES || !Array.isArray(raw.missions)
      || raw.missions.length > MAX_MISSIONS) fail();

  const categories = new Map();
  for (const row of raw.categories) {
    exactKeys(row, ['id', 'name']);
    const categoryId = id(row.id);
    if (categories.has(categoryId)) fail();
    categories.set(categoryId, { id: categoryId, name: text(row.name, 256) });
  }

  const missions = new Map();
  const rewards = new Map();
  let rewardCount = 0;
  for (const row of raw.missions) {
    exactKeys(row, ['id', 'categoryId', 'type', 'name', 'description', 'priority', 'rewards',
      ...(raw.schemaVersion === 2 ? ['destination'] : [])]);
    let destination;
    if (raw.schemaVersion === 2) {
      destination = null;
      if (row.destination !== null) {
        exactKeys(row.destination, ['type', 'areaId']);
        if (row.destination.type !== 'event-area') fail();
        destination = { type: 'event-area', areaId: id(row.destination.areaId) };
      }
    }
    const missionId = id(row.id);
    if (missions.has(missionId) || !Array.isArray(row.rewards)) fail();
    const categoryId = id(row.categoryId);
    if (!categories.has(categoryId)) fail();
    const missionRewards = row.rewards.map(reward => {
      exactKeys(reward, ['id', 'itemId', 'itemType', 'quantity']);
      const rewardId = id(reward.id);
      rewardCount += 1;
      if (rewardCount > MAX_REWARDS || rewards.has(rewardId)) fail();
      const projected = {
        id: rewardId,
        itemId: id(reward.itemId),
        itemType: rewardType(reward.itemType),
        quantity: id(reward.quantity),
      };
      rewards.set(rewardId, { missionId, reward: projected });
      return projected;
    });
    missionRewards.sort((left, right) => left.id - right.id);
    missions.set(missionId, {
      id: missionId,
      categoryId,
      type: text(row.type, 80),
      name: text(row.name, 256),
      description: text(row.description, 4096, { nullable: true, allowEmpty: true, multiline: true }),
      priority: priority(row.priority),
      rewards: missionRewards,
      ...(raw.schemaVersion === 2 ? { destination } : {}),
    });
  }
  return { categories, missions, rewards };
}

function campaignTitles(bodyBytes) {
  const raw = parse(bodyBytes, 1024 * 1024);
  if (!object(raw) || !Array.isArray(raw.mission_board_campaigns)) fail();
  const titles = new Map();
  for (const campaign of raw.mission_board_campaigns) {
    if (!object(campaign)) fail();
    const campaignId = id(campaign.id);
    if (titles.has(campaignId)) fail();
    titles.set(campaignId, campaignTitle(campaign.name));
  }
  return titles;
}

/** Joins allowlisted campaign metadata from a bounded observation to pinned static definitions. */
export function prepareCampaignPreview(input) {
  try {
    return prepare(input);
  } catch {
    // Never leak raw response fields, definition contents, or parser details.
    fail();
  }
}

function prepare({ observation, definitionBytes, expectedDefinitionSha256, expectedDatabaseSha256 }) {
  const projected = projectCampaigns(observation);
  const titles = campaignTitles(observation?.bodyBytes);
  const parsed = definition(definitionBytes, expectedDefinitionSha256, expectedDatabaseSha256);

  const categoryMissions = new Map();
  for (const mission of parsed.missions.values()) {
    const rows = categoryMissions.get(mission.categoryId) ?? [];
    rows.push(mission);
    categoryMissions.set(mission.categoryId, rows);
  }
  for (const rows of categoryMissions.values()) {
    rows.sort((left, right) => left.priority - right.priority || left.id - right.id);
  }

  const requiredMissionIds = new Set();
  const campaigns = projected.campaigns.map(campaign => {
    const title = titles.get(campaign.id);
    const campaignCompletion = parsed.missions.get(campaign.campaignCompleteMissionId);
    if (title === undefined || !campaignCompletion) fail();
    requiredMissionIds.add(campaignCompletion.id);

    const boards = campaign.boards.map(board => {
      const category = parsed.categories.get(board.missionCategoryId);
      const completion = parsed.missions.get(board.completeMissionId);
      const displayReward = parsed.rewards.get(board.displayRewardId);
      if (!category || !completion || completion.categoryId !== category.id
          || !displayReward || displayReward.missionId !== completion.id) fail();
      const missionIds = (categoryMissions.get(category.id) ?? []).map(mission => mission.id);
      for (const missionId of missionIds) requiredMissionIds.add(missionId);
      return {
        id: board.id,
        number: board.number,
        categoryId: category.id,
        categoryName: category.name,
        completeMissionId: completion.id,
        displayRewardId: displayReward.reward.id,
        missionIds,
      };
    });
    return {
      id: campaign.id,
      title,
      visibleDeadline: campaign.visibleDeadline,
      boards,
      campaignCompleteMissionId: campaignCompletion.id,
    };
  });

  const missions = [...requiredMissionIds]
    .map(missionId => parsed.missions.get(missionId))
    .sort((left, right) => left.priority - right.priority || left.id - right.id);
  const output = {
    schemaVersion: 1,
    mode: 'offline-experiment',
    publicationAllowed: false,
    authority: 'partial-account-observation-plus-static-definitions-no-eligibility-authority',
    textSemantics: 'inert-plain-text',
    missionSemantics: 'definitions-only-not-progress-remaining-or-eligibility',
    rewardSemantics: 'definitions-only-not-remaining-eligibility-or-grant-claim',
    observedAt: projected.observedAt,
    validUntil: projected.validUntil,
    observationSha256: projected.observationSha256,
    definitionSha256: expectedDefinitionSha256,
    databaseSha256: expectedDatabaseSha256,
    campaigns,
    missions,
  };
  if (Buffer.byteLength(JSON.stringify(output), 'utf8') > MAX_OUTPUT_BYTES) fail();
  return output;
}
