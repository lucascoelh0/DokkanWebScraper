// Synthetic cross-language fixture. Never reads the HAR or account/game files.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareCampaignDelivery } from '../prepare-campaign-delivery.mjs';

const observedAt = '2026-09-12T12:00:00.000Z';
const seconds = Date.parse(observedAt) / 1000;
const databaseSha256 = 'a'.repeat(64);
const mission = (id, categoryId) => ({ id, categoryId, type: 'Mission', name: `Synthetic mission ${id}`,
  description: 'First line\nSecond line', priority: 0,
  rewards: [{ id, itemId: id, itemType: 'Point::Stone', quantity: 1 }] });
const campaign = id => ({ id, name: `Synthetic campaign ${id}`, start_at: seconds - 60,
  end_at: seconds + 3600, end_at_hidden: id === 2, priority: id, announcement_id: id,
  campaign_complete_mission_id: id * 100,
  mission_boards: [{ id, number: 1, contents_lv: 0, mission_category_id: id * 10,
    complete_mission_id: id * 100, display_reward_id: id * 100 }] });
const definitionBytes = Buffer.from(JSON.stringify({ schemaVersion: 1,
  contract: 'dokkan-campaign-definitions', source: 'dokkan-game-db', databaseSha256,
  categories: [{ id: 10, name: 'Synthetic board 1' }, { id: 20, name: 'Synthetic board 2' }],
  missions: [mission(100, 10), mission(101, 10), mission(200, 20)] }));
const result = prepareCampaignDelivery({
  observation: { bodyBytes: Buffer.from(JSON.stringify({ mission_board_campaigns: [campaign(1), campaign(2)] })),
    status: 200, endpoint: '/missions/mission_board_campaigns', timestampUnit: 'unix-seconds', observedAt, now: observedAt },
  definitionBytes, expectedDefinitionSha256: createHash('sha256').update(definitionBytes).digest('hex'),
  expectedDatabaseSha256: databaseSha256,
});
if (process.argv.length !== 3) throw new Error('Expected explicit synthetic-fixture output directory');
const directory = resolve(process.argv[2]);
await mkdir(directory, { recursive: true });
const files = [ ['index.json', result.indexBytes],
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
