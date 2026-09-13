import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { projectCampaigns } from './project-campaigns.mjs';

const observedAt = '2026-09-12T12:00:00.000Z';
const observedSeconds = Date.parse(observedAt) / 1000;

const board = (overrides = {}) => ({
  id: 70,
  complete_mission_id: 71,
  contents_lv: 0,
  display_reward_id: 72,
  mission_category_id: 73,
  number: 1,
  ...overrides,
});

const campaign = (overrides = {}) => ({
  id: 7,
  start_at: observedSeconds - 60,
  end_at: observedSeconds + 60,
  end_at_hidden: false,
  announcement_id: 8,
  campaign_complete_mission_id: 9,
  priority: 0,
  mission_boards: [board()],
  ...overrides,
});

function input(body = { mission_board_campaigns: [campaign()] }) {
  return {
    bodyBytes: Buffer.from(JSON.stringify(body)),
    status: 200,
    endpoint: '/missions/mission_board_campaigns',
    observedAt,
    now: observedAt,
    timestampUnit: 'unix-seconds',
  };
}

test('projects only bounded structural fields and labels authority uncertainty', () => {
  const value = input({
    access_token: 'TOP-SECRET-TOKEN',
    processed_at: 'TOP-SECRET-PROCESSED',
    missions: [{ id: 999, current_value: 5, accepted_reward_at: 'TOP-SECRET-REWARD' }],
    mission_board_campaigns: [campaign({
      name: 'TOP-SECRET-NAME',
      banner_image_path: 'TOP-SECRET-BANNER',
      complete_message: 'TOP-SECRET-MESSAGE',
      completed_at: 'TOP-SECRET-COMPLETION',
      mission_boards: [board({
        background_image_path: 'TOP-SECRET-IMAGE',
        missions: [{ id: 998, current_value: 4 }],
      })],
    })],
  });
  const result = projectCampaigns(value);
  assert.deepEqual(result.campaigns, [{
    id: 7,
    startAt: '2026-09-12T11:59:00.000Z',
    endAt: '2026-09-12T12:01:00.000Z',
    endAtHidden: false,
    visibleDeadline: '2026-09-12T12:01:00.000Z',
    boundedObservationInterval: {
      from: observedAt,
      until: '2026-09-12T12:01:00.000Z',
      basis: 'reported-window-intersected-with-receipt-freshness-not-eligibility',
    },
    announcementId: 8,
    campaignCompleteMissionId: 9,
    priority: 0,
    boards: [{ id: 70, completeMissionId: 71, contentsLevel: 0, displayRewardId: 72, missionCategoryId: 73, number: 1 }],
  }]);
  assert.equal(result.publicationAllowed, false);
  assert.equal(result.mode, 'offline-experiment');
  assert.equal(result.inventoryCompleteness, 'unknown-partial-observation');
  assert.equal(result.eligibilityPolicy, 'unknown-not-inferred');
  assert.equal(JSON.stringify(result).includes('TOP-SECRET'), false);
  assert.equal(JSON.stringify(result).includes('missions'), false);
});

test('hidden, unknown, sentinel, and long-horizon ends never become visible deadlines', () => {
  const cases = [
    campaign({ end_at_hidden: true }),
    campaign({ id: 8, end_at: null, end_at_hidden: false, mission_boards: [board({ id: 80 })] }),
    campaign({ id: 9, end_at_hidden: null, mission_boards: [board({ id: 90 })] }),
    campaign({ id: 10, end_at: Date.UTC(2038, 0, 1) / 1000, mission_boards: [board({ id: 100 })] }),
    campaign({ id: 11, end_at: observedSeconds + 367 * 86400, mission_boards: [board({ id: 110 })] }),
  ];
  const result = projectCampaigns(input({ mission_board_campaigns: cases }));
  assert.deepEqual(result.campaigns.map(value => value.visibleDeadline), [null, null, null, null, null]);
  assert.equal(result.campaigns[0].endAtHidden, true);
  assert.equal(result.campaigns[0].endAt, '2026-09-12T12:01:00.000Z');
  assert.equal(result.campaigns[1].endAt, null);
});

test('reported windows produce only finite receipt-bounded structural intervals', () => {
  const result = projectCampaigns(input({ mission_board_campaigns: [
    campaign({ id: 7, end_at: observedSeconds + 8 * 3600 }),
    campaign({ id: 8, start_at: observedSeconds + 1, end_at: observedSeconds + 60, mission_boards: [board({ id: 80 })] }),
    campaign({ id: 9, start_at: observedSeconds - 60, end_at: observedSeconds, mission_boards: [board({ id: 90 })] }),
    campaign({ id: 10, start_at: null, end_at: null, mission_boards: [board({ id: 100 })] }),
  ] }));
  assert.equal(result.campaigns[0].boundedObservationInterval.until, '2026-09-12T18:00:00.000Z');
  assert.equal(result.campaigns[1].boundedObservationInterval, null);
  assert.equal(result.campaigns[1].visibleDeadline, null);
  assert.equal(result.campaigns[2].boundedObservationInterval, null);
  assert.equal(result.campaigns[3].boundedObservationInterval, null);
  assert.equal(result.campaigns[3].visibleDeadline, null);
  assert.equal(JSON.stringify(result).includes('active'), false);
  assert.equal(JSON.stringify(result).includes('eligible'), false);

  const later = projectCampaigns({
    ...input({ mission_board_campaigns: [campaign({ start_at: observedSeconds + 1, end_at: observedSeconds + 60 })] }),
    now: '2026-09-12T12:00:02.000Z',
  });
  assert.equal(later.campaigns[0].boundedObservationInterval, null);
  assert.equal(later.campaigns[0].visibleDeadline, null);
  const missingStart = projectCampaigns(input({ mission_board_campaigns: [campaign({ start_at: null })] }));
  assert.equal(missingStart.campaigns[0].visibleDeadline, null);
});

test('explicit empty campaign list is valid but never claims a complete inventory', () => {
  const result = projectCampaigns(input({ mission_board_campaigns: [], missions: 'ignored-private-shape' }));
  assert.deepEqual(result.campaigns, []);
  assert.equal(result.inventoryCompleteness, 'unknown-partial-observation');
});

test('campaigns and boards are deterministically ordered independent of response ordering', () => {
  const low = campaign({ id: 8, priority: 0, mission_boards: [board({ id: 82, number: 2 }), board({ id: 81, number: 1 })] });
  const high = campaign({ id: 7, priority: 2, mission_boards: [board({ id: 70 })] });
  const first = projectCampaigns(input({ mission_board_campaigns: [high, low] }));
  const second = projectCampaigns(input({ mission_board_campaigns: [low, high] }));
  assert.deepEqual(first.campaigns.map(value => value.id), [8, 7]);
  assert.deepEqual(first.campaigns[0].boards.map(value => value.id), [81, 82]);
  assert.equal(JSON.stringify(first.campaigns), JSON.stringify(second.campaigns));
});

test('receipt digest binds exact bytes while projection fields stay deterministic', () => {
  const value = input();
  const expected = createHash('sha256').update(value.bodyBytes).digest('hex');
  const first = projectCampaigns(value);
  const second = projectCampaigns(value);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.observationSha256, expected);
  const spaced = { ...value, bodyBytes: Buffer.concat([value.bodyBytes, Buffer.from(' ')]) };
  assert.notEqual(projectCampaigns(spaced).observationSha256, expected);
});

test('transport, endpoint, timestamp unit, and required response shape fail closed', () => {
  const cases = [
    { ...input(), status: 304 },
    { ...input(), status: '200' },
    { ...input(), endpoint: '/missions/mission_board_campaigns/7/images' },
    { ...input(), timestampUnit: 'milliseconds' },
    { ...input(), timestampUnit: undefined },
    input({}),
    input({ mission_board_campaigns: null }),
    input({ mission_board_campaigns: 'not-an-array' }),
  ];
  for (const value of cases) assert.throws(() => projectCampaigns(value), { message: 'Invalid local campaign observation' });
});

test('malformed, non-UTF8, empty, and oversized bytes fail with a fixed redacted error', () => {
  const cases = [
    { ...input(), bodyBytes: Buffer.from('TOP-SECRET MALFORMED') },
    { ...input(), bodyBytes: Buffer.from([0xff]) },
    { ...input(), bodyBytes: Buffer.alloc(0) },
    { ...input(), bodyBytes: Buffer.alloc(1024 * 1024 + 1) },
    { ...input(), bodyBytes: new Uint8Array([123, 125]) },
  ];
  for (const value of cases) {
    assert.throws(() => projectCampaigns(value), error => {
      assert.equal(error.message, 'Invalid local campaign observation');
      assert.equal(String(error).includes('TOP-SECRET'), false);
      return true;
    });
  }
});

test('freshness is valid immediately before expiry and rejects the exact exclusive boundary', () => {
  const fresh = projectCampaigns({ ...input(), now: '2026-09-12T17:59:59.999Z' });
  assert.equal(fresh.validUntil, '2026-09-12T18:00:00.000Z');
  for (const extra of [
    { now: '2026-09-12T18:00:00.000Z' },
    { now: '2026-09-12T11:59:59.999Z' },
    { observedAt: '2026-02-30T12:00:00.000Z' },
    { now: '2026-09-12T12:00:00Z' },
  ]) assert.throws(() => projectCampaigns({ ...input(), ...extra }), { message: 'Invalid local campaign observation' });
});

test('receipt validity cannot overflow canonical UTC output', () => {
  assert.throws(() => projectCampaigns({
    ...input({ mission_board_campaigns: [] }),
    observedAt: '9999-12-31T20:00:00.000Z',
    now: '9999-12-31T20:00:00.000Z',
  }), { message: 'Invalid local campaign observation' });
  const safe = projectCampaigns({
    ...input({ mission_board_campaigns: [] }),
    observedAt: '9999-12-31T17:59:59.999Z',
    now: '9999-12-31T17:59:59.999Z',
  });
  assert.equal(safe.validUntil, '9999-12-31T23:59:59.999Z');
});

test('milliseconds, strings, fractional timestamps, regressions, and invalid hidden flags fail closed', () => {
  const badCampaigns = [
    campaign({ start_at: observedSeconds * 1000 }),
    campaign({ end_at: observedSeconds * 1000 }),
    campaign({ start_at: String(observedSeconds) }),
    campaign({ end_at: observedSeconds + 0.5 }),
    campaign({ start_at: observedSeconds + 1, end_at: observedSeconds }),
    campaign({ end_at_hidden: 0 }),
  ];
  for (const value of badCampaigns) {
    assert.throws(() => projectCampaigns(input({ mission_board_campaigns: [value] })), { message: 'Invalid local campaign observation' });
  }
});

test('invalid and duplicate campaign or board identities fail closed', () => {
  const cases = [
    [campaign({ id: 0 })],
    [campaign({ id: 1000000000 })],
    [campaign(), campaign({ mission_boards: [board({ id: 80 })] })],
    [campaign({ mission_boards: [board(), board()] })],
    [campaign(), campaign({ id: 8 })],
  ];
  for (const mission_board_campaigns of cases) {
    assert.throws(() => projectCampaigns(input({ mission_board_campaigns })), { message: 'Invalid local campaign observation' });
  }
  assert.equal(projectCampaigns(input({ mission_board_campaigns: [campaign({ id: 999999999 })] })).campaigns[0].id, 999999999);
});

test('malformed structural candidates never degrade into partial or empty successes', () => {
  for (const mission_board_campaigns of [
    [null],
    [{ ...campaign(), mission_boards: undefined }],
    [{ ...campaign(), mission_boards: 'not-an-array' }],
    [campaign({ mission_boards: [null] })],
    [campaign({ mission_boards: ['not-an-object'] })],
  ]) assert.throws(
    () => projectCampaigns(input({ mission_board_campaigns })),
    { message: 'Invalid local campaign observation' },
  );
});

test('all projected structural references and integers are validated', () => {
  const badBoards = [
    board({ complete_mission_id: 0 }), board({ contents_lv: -1 }), board({ display_reward_id: null }),
    board({ mission_category_id: '73' }), board({ number: 0 }), board({ id: Number.MAX_SAFE_INTEGER }),
  ];
  for (const value of badBoards) {
    assert.throws(() => projectCampaigns(input({ mission_board_campaigns: [campaign({ mission_boards: [value] })] })));
  }
  for (const value of [
    campaign({ announcement_id: 0 }), campaign({ campaign_complete_mission_id: null }), campaign({ priority: -1 }),
  ]) assert.throws(() => projectCampaigns(input({ mission_board_campaigns: [value] })));
});

test('campaign, per-campaign board, total-board, and byte bounds are exact', () => {
  const oneHundredCampaigns = Array.from({ length: 100 }, (_, index) => campaign({
    id: index + 1,
    mission_boards: [board({ id: index + 1000 })],
  }));
  assert.equal(projectCampaigns(input({ mission_board_campaigns: oneHundredCampaigns })).campaigns.length, 100);
  assert.throws(() => projectCampaigns(input({ mission_board_campaigns: [...oneHundredCampaigns, campaign({ id: 101, mission_boards: [board({ id: 5000 })] })] })));

  const oneHundredBoards = Array.from({ length: 100 }, (_, index) => board({ id: index + 1, number: index + 1 }));
  assert.equal(projectCampaigns(input({ mission_board_campaigns: [campaign({ mission_boards: oneHundredBoards })] })).campaigns[0].boards.length, 100);
  assert.throws(() => projectCampaigns(input({ mission_board_campaigns: [campaign({ mission_boards: [...oneHundredBoards, board({ id: 101, number: 101 })] })] })));

  const tenByHundred = Array.from({ length: 10 }, (_, campaignIndex) => campaign({
    id: campaignIndex + 1,
    mission_boards: Array.from({ length: 100 }, (_, boardIndex) => board({
      id: campaignIndex * 100 + boardIndex + 1,
      number: boardIndex + 1,
    })),
  }));
  assert.equal(projectCampaigns(input({ mission_board_campaigns: tenByHundred })).campaigns.length, 10);
  const overTotal = [...tenByHundred, campaign({ id: 11, mission_boards: [board({ id: 1001 })] })];
  assert.throws(() => projectCampaigns(input({ mission_board_campaigns: overTotal })));

  const padded = input({ mission_board_campaigns: [], ignored: 'x'.repeat(1024 * 1024) });
  assert.ok(padded.bodyBytes.length > 1024 * 1024);
  assert.throws(() => projectCampaigns(padded));

  const prefix = '{"mission_board_campaigns":[],"ignored":"';
  const suffix = '"}';
  const exactBytes = Buffer.from(prefix + 'x'.repeat(1024 * 1024 - prefix.length - suffix.length) + suffix);
  assert.equal(exactBytes.length, 1024 * 1024);
  assert.deepEqual(projectCampaigns({ ...input(), bodyBytes: exactBytes }).campaigns, []);
});
