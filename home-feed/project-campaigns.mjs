import { createHash } from 'node:crypto';

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_CAMPAIGNS = 100;
const MAX_BOARDS_PER_CAMPAIGN = 100;
const MAX_TOTAL_BOARDS = 1000;
const MAX_ID = 999999999;
const MAX_UNIX_SECONDS = 253402300799;
const MAX_DATE_MS = Date.parse('9999-12-31T23:59:59.999Z');
const FRESHNESS_MS = 6 * 60 * 60 * 1000;
const VISIBLE_DEADLINE_HORIZON_MS = 366 * 24 * 60 * 60 * 1000;
const SENTINEL_END_MS = Date.UTC(2038, 0, 1);

const fail = () => { throw new Error('Invalid local campaign observation'); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function parse(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_BODY_BYTES) fail();
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    fail();
  }
}

function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) fail();
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) fail();
  return milliseconds;
}

function positiveId(value) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_ID) fail();
  return value;
}

function nonNegativeInteger(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_ID) fail();
  return value;
}

function unixSeconds(value, { optional = false } = {}) {
  if (optional && (value === undefined || value === null)) return null;
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_UNIX_SECONDS) fail();
  const milliseconds = value * 1000;
  if (!Number.isSafeInteger(milliseconds)) fail();
  return milliseconds;
}

function optionalBoolean(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'boolean') fail();
  return value;
}

function iso(milliseconds) {
  return milliseconds === null ? null : new Date(milliseconds).toISOString();
}

function boundedInterval({ startMs, endMs, observedMs, currentMs, validUntilMs }) {
  if (startMs === null || endMs === null || startMs > observedMs || currentMs >= endMs) return null;
  const untilMs = Math.min(validUntilMs, endMs);
  if (untilMs <= currentMs) return null;
  return {
    from: iso(currentMs),
    until: iso(untilMs),
    basis: 'reported-window-intersected-with-receipt-freshness-not-eligibility',
  };
}

function visibleDeadline({ startMs, endMs, endAtHidden, observedMs, currentMs }) {
  if (startMs === null || startMs > observedMs || endAtHidden !== false || endMs === null || endMs <= currentMs
      || endMs >= SENTINEL_END_MS || endMs - observedMs > VISIBLE_DEADLINE_HORIZON_MS) return null;
  return iso(endMs);
}

function projectBoard(board, seenBoardIds) {
  if (!object(board)) fail();
  const id = positiveId(board.id);
  if (seenBoardIds.has(id)) fail();
  seenBoardIds.add(id);
  return {
    id,
    completeMissionId: positiveId(board.complete_mission_id),
    contentsLevel: nonNegativeInteger(board.contents_lv),
    displayRewardId: positiveId(board.display_reward_id),
    missionCategoryId: positiveId(board.mission_category_id),
    number: positiveId(board.number),
  };
}

/**
 * Sanitizes an already-received mission-board response for an offline experiment.
 * This function performs no network access and its result is never publication-ready.
 */
export function projectCampaigns(input) {
  try {
    return project(input);
  } catch {
    // Do not expose response text, parser details, account values, or private fields.
    fail();
  }
}

function project({ bodyBytes, status, endpoint, observedAt, now, timestampUnit }) {
  if (status !== 200 || endpoint !== '/missions/mission_board_campaigns'
      || timestampUnit !== 'unix-seconds') fail();

  const observedMs = instant(observedAt);
  const currentMs = instant(now);
  if (currentMs < observedMs || currentMs - observedMs >= FRESHNESS_MS) fail();
  const validUntilMs = observedMs + FRESHNESS_MS;
  if (!Number.isSafeInteger(validUntilMs) || validUntilMs > MAX_DATE_MS) fail();

  const body = parse(bodyBytes);
  if (!object(body) || !Array.isArray(body.mission_board_campaigns)
      || body.mission_board_campaigns.length > MAX_CAMPAIGNS) fail();

  const seenCampaignIds = new Set();
  const seenBoardIds = new Set();
  let totalBoards = 0;
  const campaigns = body.mission_board_campaigns.map(campaign => {
    if (!object(campaign) || !Array.isArray(campaign.mission_boards)
        || campaign.mission_boards.length > MAX_BOARDS_PER_CAMPAIGN) fail();
    totalBoards += campaign.mission_boards.length;
    if (totalBoards > MAX_TOTAL_BOARDS) fail();

    const id = positiveId(campaign.id);
    if (seenCampaignIds.has(id)) fail();
    seenCampaignIds.add(id);

    const startMs = unixSeconds(campaign.start_at, { optional: true });
    const endMs = unixSeconds(campaign.end_at, { optional: true });
    if (startMs !== null && endMs !== null && endMs <= startMs) fail();
    const endAtHidden = optionalBoolean(campaign.end_at_hidden);
    const boards = campaign.mission_boards.map(board => projectBoard(board, seenBoardIds));
    boards.sort((left, right) => left.number - right.number || left.id - right.id);

    return {
      id,
      startAt: iso(startMs),
      endAt: iso(endMs),
      endAtHidden,
      visibleDeadline: visibleDeadline({ startMs, endMs, endAtHidden, observedMs, currentMs }),
      boundedObservationInterval: boundedInterval({ startMs, endMs, observedMs, currentMs, validUntilMs }),
      announcementId: positiveId(campaign.announcement_id),
      campaignCompleteMissionId: positiveId(campaign.campaign_complete_mission_id),
      priority: nonNegativeInteger(campaign.priority),
      boards,
    };
  });
  campaigns.sort((left, right) => left.priority - right.priority || left.id - right.id);

  return {
    schemaVersion: 1,
    mode: 'offline-experiment',
    publicationAllowed: false,
    authority: 'partial-account-observation-no-live-eligibility-authority',
    timestampSemantics: 'explicit-unix-seconds-structural-window-only',
    inventoryCompleteness: 'unknown-partial-observation',
    eligibilityPolicy: 'unknown-not-inferred',
    observedAt,
    validUntil: iso(validUntilMs),
    observationSha256: digest(bodyBytes),
    campaigns,
  };
}
