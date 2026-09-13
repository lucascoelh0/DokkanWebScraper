// Synthetic public producer interop fixture. All authentication/network is mocked.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { collectCampaigns, prepareCollectedCampaignCandidate } from '../collect-campaigns.mjs';
import sharp from 'sharp';

const presentation = process.argv[3] === '--presentation';
const png = presentation ? await sharp({ create: { width: 620, height: 300, channels: 4, background: '#123456' } }).png().toBuffer() : null;

const observedAt = '2026-09-12T12:00:00.000Z';
const at = Date.parse(observedAt), seconds = at / 1000;
const mission = (id, categoryId) => ({ id, categoryId, type: 'Mission', name: `Synthetic mission ${id}`,
  description: 'First line\nSecond line', priority: 0,
  rewards: [{ id, itemId: id, itemType: 'Point::Stone', quantity: 1 }] });
const campaign = id => ({ id, name: `Synthetic campaign ${id}`, start_at: seconds - 60,
  end_at: seconds + 3600, end_at_hidden: id === 2, priority: id, announcement_id: id,
  campaign_complete_mission_id: id * 100,
  mission_boards: [{ id, number: 1, contents_lv: 0, mission_category_id: id * 10,
    complete_mission_id: id * 100, display_reward_id: id * 100 }] });
const definitionBytes = Buffer.from(JSON.stringify({ schemaVersion: presentation ? 2 : 1,
  contract: 'dokkan-campaign-definitions', source: 'dokkan-game-db', databaseSha256: 'a'.repeat(64),
  categories: [{ id: 10, name: 'Synthetic board 1' }, { id: 20, name: 'Synthetic board 2' }],
  missions: [mission(100, 10), mission(101, 10), mission(200, 20)].map(m => presentation
    ? { ...m, destination: m.id === 101 ? { type: 'event-area', areaId: 1768 } : null } : m) }));
const collection = await collectCampaigns({ enabled: true, includePresentation: presentation, definitionBytes,
  expectedDefinitionSha256: createHash('sha256').update(definitionBytes).digest('hex'),
  expectedDatabaseSha256: 'a'.repeat(64), config: { nonceHeaders: {}, loginHeaders: { authorization: 'Basic test' },
    loginBody: {}, apiHeaders: {} } }, { now: () => at, fetchImpl: async url => {
    const path = new URL(url).pathname;
    if (presentation && path === '/images/en/panel_mission/synthetic.png') return new Response(png, { headers: { 'content-type': 'image/png' } });
    let body;
    if (path === '/auth/nonce') body = { auth_transaction_id: 'SYNTHETIC-NONCE' };
    else if (path === '/auth/sign_in') body = { token_type: 'bearer', access_token: 'SYNTHETIC-TOKEN' };
    else if (path === '/missions/mission_board_campaigns') body = { mission_board_campaigns: [campaign(1), campaign(2)].map(c => presentation
      ? { ...c, banner_image_path: 'https://cf.ishin-global.aktsk.com/images/en/panel_mission/synthetic.png?synthetic' } : c) };
    else throw Error('Unexpected fixture request');
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  } });
const result = prepareCollectedCampaignCandidate(collection, { now: () => at });
if (process.argv.length !== (presentation ? 4 : 3)) throw new Error('Expected explicit synthetic-fixture output directory');
const directory = resolve(process.argv[2]);
await mkdir(directory, { recursive: true });
const files = [['manifest.json', result.manifestBytes], ['index.json', result.indexBytes],
  ...result.details.map(d => [`detail-${d.campaignId}.json`, d.bytes]),
  ['receipt.json', Buffer.from(JSON.stringify({ synthetic: true, observedAt,
    indexSha256: result.indexSha256, indexSizeBytes: result.indexBytes.length,
    details: result.details.map(({ campaignId, sha256, sizeBytes }) => ({ campaignId, sha256, sizeBytes })) }))],
];
for (const [name, bytes] of files) {
  try { await writeFile(resolve(directory, name), bytes, { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST' || !(await readFile(resolve(directory, name))).equals(bytes)) throw new Error('Fixture conflict');
  }
}
console.log(JSON.stringify({ synthetic: true, files: files.length, indexBytes: result.indexBytes.length }));
