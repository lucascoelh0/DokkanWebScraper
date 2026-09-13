import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignArtworkUrl, prepareCampaignArtwork } from './campaign-artwork.mjs';

test('artwork URL scope rejects arbitrary origins, paths, encoded paths and credentials', () => {
  for (const url of ['http://cf.ishin-global.aktsk.com/images/en/panel_mission/a.png',
    'https://other.test/images/en/panel_mission/a.png',
    'https://cf.ishin-global.aktsk.com@other.test/images/en/panel_mission/a.png',
    'https://cf.ishin-global.aktsk.com/images/en/panel_mission/%61.png',
    'https://cf.ishin-global.aktsk.com/other/a.png']) assert.throws(() => campaignArtworkUrl(url));
});
test('corrupt and oversized artwork is rejected before publication', async () => {
  await assert.rejects(prepareCampaignArtwork(Buffer.alloc(600000)));
  await assert.rejects(prepareCampaignArtwork(Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.alloc(100)])));
});
