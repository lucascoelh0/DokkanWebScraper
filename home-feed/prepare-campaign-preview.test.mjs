import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareCampaignPreview } from './prepare-campaign-preview.mjs';

const observedAt = '2026-09-12T12:00:00.000Z';
const seconds = Date.parse(observedAt) / 1000;
const databaseSha256 = 'a'.repeat(64);
const reward = (overrides = {}) => ({ id: 72, itemId: 100, itemType: 'Point::Stone', quantity: 1, ...overrides });
const mission = (overrides = {}) => ({ id: 71, categoryId: 73, type: 'Mission', name: 'Complete the board', description: null, priority: 0, rewards: [reward()], ...overrides });
const board = (overrides = {}) => ({ id: 70, complete_mission_id: 71, contents_lv: 0, display_reward_id: 72, mission_category_id: 73, number: 1, ...overrides });
const campaign = (overrides = {}) => ({ id: 7, name: 'Synthetic Campaign', start_at: seconds - 60, end_at: seconds + 60, end_at_hidden: false, announcement_id: 8, campaign_complete_mission_id: 9, priority: 0, mission_boards: [board()], ...overrides });

function definition(overrides = {}) {
  return {
    schemaVersion: 1,
    contract: 'dokkan-campaign-definitions',
    source: 'dokkan-game-db',
    databaseSha256,
    categories: [{ id: 73, name: 'Board Category' }, { id: 74, name: 'Campaign Category' }],
    missions: [
      mission(),
      mission({ id: 75, name: 'Another mission', priority: 1, rewards: [reward({ id: 76, itemId: 101, itemType: 'Card' })] }),
      mission({ id: 9, categoryId: 74, name: 'Complete the campaign', rewards: [reward({ id: 90, itemId: 102, itemType: 'SupportMemory' })] }),
    ],
    ...overrides,
  };
}

function args({ body = { mission_board_campaigns: [campaign()] }, definitions = definition(), now = observedAt } = {}) {
  const bodyBytes = Buffer.from(JSON.stringify(body));
  const definitionBytes = Buffer.from(JSON.stringify(definitions));
  return {
    observation: { bodyBytes, status: 200, endpoint: '/missions/mission_board_campaigns', observedAt, now, timestampUnit: 'unix-seconds' },
    definitionBytes,
    expectedDefinitionSha256: createHash('sha256').update(definitionBytes).digest('hex'),
    expectedDatabaseSha256: databaseSha256,
  };
}

test('joins campaign, board category, completion missions, and display reward structurally', () => {
  const result = prepareCampaignPreview(args());
  assert.equal(result.mode, 'offline-experiment');
  assert.equal(result.publicationAllowed, false);
  assert.equal(result.textSemantics, 'inert-plain-text');
  assert.deepEqual(result.campaigns, [{
    id: 7,
    title: 'Synthetic Campaign',
    visibleDeadline: '2026-09-12T12:01:00.000Z',
    boards: [{ id: 70, number: 1, categoryId: 73, categoryName: 'Board Category', completeMissionId: 71, displayRewardId: 72, missionIds: [71, 75] }],
    campaignCompleteMissionId: 9,
  }]);
  assert.deepEqual(result.missions.map(value => value.id), [9, 71, 75]);
  assert.equal(result.missionSemantics, 'definitions-only-not-progress-remaining-or-eligibility');
  assert.equal(result.rewardSemantics, 'definitions-only-not-remaining-eligibility-or-grant-claim');
  assert.equal(result.definitionSha256, args().expectedDefinitionSha256);
  assert.equal(result.databaseSha256, databaseSha256);
});

test('deduplicates mission definitions across boards while retaining board mission references', () => {
  const body = { mission_board_campaigns: [campaign({ mission_boards: [board(), board({ id: 80, number: 2 })] })] };
  const result = prepareCampaignPreview(args({ body }));
  assert.deepEqual(result.campaigns[0].boards.map(value => value.missionIds), [[71, 75], [71, 75]]);
  assert.deepEqual(result.missions.map(value => value.id), [9, 71, 75]);
});

test('raw progress, account data, messages, images, and unlisted fields never survive', () => {
  const body = {
    access_token: 'PRIVATE-TOKEN',
    missions: [{ id: 999, current_value: 'PRIVATE-PROGRESS', accepted_reward_at: 'PRIVATE-REWARD' }],
    mission_board_campaigns: [campaign({
      complete_message: 'PRIVATE-MESSAGE', banner_image_path: 'PRIVATE-BANNER',
      mission_boards: [board({ background_image_path: 'PRIVATE-IMAGE', missions: ['PRIVATE-NESTED'] })],
    })],
  };
  const serialized = JSON.stringify(prepareCampaignPreview(args({ body })));
  assert.equal(serialized.includes('PRIVATE'), false);
  assert.equal(serialized.includes('current_value'), false);
});

test('definition and database pins are both independently enforced', () => {
  const valid = args();
  for (const value of [
    { ...valid, expectedDefinitionSha256: 'b'.repeat(64) },
    { ...valid, expectedDatabaseSha256: 'b'.repeat(64) },
    { ...valid, expectedDefinitionSha256: 'A'.repeat(64) },
    args({ definitions: definition({ databaseSha256: 'b'.repeat(64) }) }),
  ]) assert.throws(() => prepareCampaignPreview(value), { message: 'Invalid local campaign preview' });
});

test('relational mismatches fail even when every referenced ID exists', () => {
  const wrongCategory = definition({
    missions: definition().missions.map(row => row.id === 71 ? { ...row, categoryId: 74 } : row),
  });
  const wrongRewardOwner = definition({
    missions: definition().missions.map(row => row.id === 71
      ? { ...row, rewards: [reward({ id: 91 })] }
      : row.id === 75 ? { ...row, rewards: [...row.rewards, reward()] } : row),
  });
  for (const definitions of [wrongCategory, wrongRewardOwner]) {
    assert.throws(() => prepareCampaignPreview(args({ definitions })), { message: 'Invalid local campaign preview' });
  }
});

test('missing board categories, completions, display rewards, and root completions fail closed', () => {
  const values = [
    definition({ categories: [{ id: 74, name: 'Campaign Category' }] }),
    definition({ missions: definition().missions.filter(value => value.id !== 71) }),
    definition({ missions: definition().missions.map(value => value.id === 71 ? { ...value, rewards: [] } : value) }),
    definition({ missions: definition().missions.filter(value => value.id !== 9) }),
  ];
  for (const definitions of values) assert.throws(() => prepareCampaignPreview(args({ definitions })));
});

test('duplicate category, mission, and globally duplicate reward IDs fail closed', () => {
  const base = definition();
  const values = [
    definition({ categories: [...base.categories, { ...base.categories[0] }] }),
    definition({ missions: [...base.missions, { ...base.missions[0] }] }),
    definition({ missions: base.missions.map(value => value.id === 75 ? { ...value, rewards: [reward()] } : value) }),
  ];
  for (const definitions of values) assert.throws(() => prepareCampaignPreview(args({ definitions })));
});

test('definition schema and nested rows use exact keys and required references', () => {
  const base = definition();
  const values = [
    { ...base, PRIVATE: 'ignored?' },
    definition({ categories: [{ ...base.categories[0], extra: true }, base.categories[1]] }),
    definition({ missions: [{ ...base.missions[0], startAt: seconds }, ...base.missions.slice(1)] }),
    definition({ missions: [{ ...base.missions[0], rewards: [{ ...base.missions[0].rewards[0], url: 'https://invalid' }] }, ...base.missions.slice(1)] }),
    definition({ missions: [{ ...base.missions[0], categoryId: 999 }, ...base.missions.slice(1)] }),
  ];
  for (const definitions of values) assert.throws(() => prepareCampaignPreview(args({ definitions })));
});

test('titles and definition strings are bounded printable inert text', () => {
  assert.equal(prepareCampaignPreview(args({ body: { mission_board_campaigns: [campaign({ name: '<b>Plain text</b>' })] } })).campaigns[0].title, '<b>Plain text</b>');
  assert.equal(prepareCampaignPreview(args({ body: { mission_board_campaigns: [campaign({ name: 'First line\r\n  Second\n\tThird' })] } })).campaigns[0].title,
    'First line Second Third');
  const multiline = definition({ missions: definition().missions.map(value => value.id === 71
    ? { ...value, description: 'First line\r\n\tSecond line' } : value) });
  assert.equal(prepareCampaignPreview(args({ definitions: multiline })).missions.find(value => value.id === 71).description,
    'First line\n\tSecond line');
  const invalid = [
    args({ body: { mission_board_campaigns: [campaign({ name: '' })] } }),
    args({ body: { mission_board_campaigns: [campaign({ name: ' \t ' })] } }),
    args({ body: { mission_board_campaigns: [campaign({ name: 'x'.repeat(121) })] } }),
    args({ body: { mission_board_campaigns: [campaign({ name: 'unsafe\u202etext' })] } }),
    args({ body: { mission_board_campaigns: [campaign({ name: '\ud800' })] } }),
    args({ body: { mission_board_campaigns: [campaign({ name: 'unsafe\rtext' })] } }),
    args({ body: { mission_board_campaigns: [campaign({ name: 'unsafe\u000btext' })] } }),
    args({ definitions: definition({ categories: [{ id: 73, name: 'bad\nname' }, { id: 74, name: 'Campaign Category' }] }) }),
    args({ definitions: definition({ categories: [{ id: 73, name: '   ' }, { id: 74, name: 'Campaign Category' }] }) }),
    args({ definitions: definition({ missions: definition().missions.map(value => value.id === 71 ? { ...value, name: '\t' } : value) }) }),
    args({ definitions: definition({ missions: definition().missions.map(value => value.id === 71 ? { ...value, type: '  ' } : value) }) }),
    args({ definitions: definition({ missions: definition().missions.map(value => value.id === 71 ? { ...value, description: 'x'.repeat(4097) } : value) }) }),
    args({ definitions: definition({ missions: definition().missions.map(value => value.id === 71 ? { ...value, description: 'bad\rline' } : value) }) }),
    args({ definitions: definition({ missions: definition().missions.map(value => value.id === 71 ? { ...value, description: 'bad\u000bline' } : value) }) }),
    args({ definitions: definition({ missions: definition().missions.map(value => value.id === 71 ? { ...value, description: 'bad\u202eline' } : value) }) }),
  ];
  for (const value of invalid) assert.throws(() => prepareCampaignPreview(value), { message: 'Invalid local campaign preview' });
});

test('reward types, quantities, IDs, and priorities are strictly bounded', () => {
  for (const badReward of [
    reward({ itemType: 'Point:Stone' }), reward({ itemType: 'Point::Stone::More' }), reward({ itemType: 'Point Stone' }),
    reward({ itemType: '1Point' }), reward({ itemType: 'Point::1Stone' }),
    reward({ quantity: 0 }), reward({ itemId: 1000000000 }), reward({ id: '72' }),
  ]) {
    const definitions = definition({ missions: [mission({ rewards: [badReward] }), ...definition().missions.slice(1)] });
    assert.throws(() => prepareCampaignPreview(args({ definitions })));
  }
  assert.throws(() => prepareCampaignPreview(args({ definitions: definition({ missions: [mission({ priority: -1 }), ...definition().missions.slice(1)] }) })));
});

test('hidden and unknown dates propagate no visible deadline and stale observations reject', () => {
  for (const dates of [{ end_at_hidden: true }, { end_at: null, end_at_hidden: null }]) {
    const result = prepareCampaignPreview(args({ body: { mission_board_campaigns: [campaign(dates)] } }));
    assert.equal(result.campaigns[0].visibleDeadline, null);
  }
  assert.throws(() => prepareCampaignPreview(args({ now: '2026-09-12T18:00:00.000Z' })), { message: 'Invalid local campaign preview' });
});

test('malformed or oversized definition bytes fail with one fixed redacted error', () => {
  const base = args();
  const cases = [Buffer.from('PRIVATE MALFORMED'), Buffer.from([0xff]), Buffer.alloc(0), Buffer.alloc(2 * 1024 * 1024 + 1)];
  for (const definitionBytes of cases) {
    const value = { ...base, definitionBytes, expectedDefinitionSha256: createHash('sha256').update(definitionBytes).digest('hex') };
    assert.throws(() => prepareCampaignPreview(value), error => {
      assert.equal(error.message, 'Invalid local campaign preview');
      assert.equal(String(error).includes('PRIVATE'), false);
      return true;
    });
  }
});

test('category, mission, and reward collection limits fail closed', () => {
  const tooManyCategories = Array.from({ length: 1001 }, (_, index) => ({ id: index + 1, name: `Category ${index}` }));
  assert.throws(() => prepareCampaignPreview(args({ definitions: definition({ categories: tooManyCategories }) })));

  const tooManyMissions = Array.from({ length: 5001 }, (_, index) => mission({ id: index + 1, rewards: [], name: `Mission ${index}` }));
  assert.throws(() => prepareCampaignPreview(args({ definitions: definition({ missions: tooManyMissions }) })));

  const tooManyRewards = Array.from({ length: 20001 }, (_, index) => reward({ id: index + 1, itemId: index + 1 }));
  assert.throws(() => prepareCampaignPreview(args({ definitions: definition({ missions: [mission({ rewards: tooManyRewards }), ...definition().missions.slice(1)] }) })));
});

test('preview output is deterministic, bounded, and rejects excessive expansion', () => {
  const value = args();
  assert.equal(JSON.stringify(prepareCampaignPreview(value)), JSON.stringify(prepareCampaignPreview(value)));
  assert.ok(Buffer.byteLength(JSON.stringify(prepareCampaignPreview(value)), 'utf8') <= 2 * 1024 * 1024);

  const manyMissions = Array.from({ length: 700 }, (_, index) => mission({
    id: index + 1000,
    name: `Mission ${index}`,
    rewards: index === 0 ? [reward()] : [],
  }));
  const manyBoards = Array.from({ length: 1000 }, (_, index) => board({ id: index + 1, complete_mission_id: 1000, number: index % 100 + 1 }));
  const manyCampaigns = Array.from({ length: 10 }, (_, index) => campaign({
    id: index + 1,
    campaign_complete_mission_id: 9,
    mission_boards: manyBoards.slice(index * 100, index * 100 + 100),
  }));
  const definitions = definition({ missions: [...manyMissions, definition().missions.find(value => value.id === 9)] });
  assert.throws(() => prepareCampaignPreview(args({ body: { mission_board_campaigns: manyCampaigns }, definitions })), { message: 'Invalid local campaign preview' });
});
