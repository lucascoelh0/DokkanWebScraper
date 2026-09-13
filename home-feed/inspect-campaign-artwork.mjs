import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { campaignArtworkUrl, prepareCampaignArtwork } from './campaign-artwork.mjs';

/** Owner-supplied HAR inspection. No login, API replay, publication or freshness claim. */
async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw Error();
  const raw = await readFile(input);
  if (raw.length > 16 * 1024 * 1024) throw Error();
  const har = JSON.parse(raw.toString('utf8'));
  const entry = har.log.entries.find(e => e.request.method === 'GET' && e.response.status === 200
    && new URL(e.request.url).origin === 'https://ishin-global.aktsk.com'
    && new URL(e.request.url).pathname === '/missions/mission_board_campaigns');
  const content = entry.response.content;
  const bodyBytes = content.encoding === 'base64' ? Buffer.from(content.text, 'base64') : Buffer.from(content.text);
  if (bodyBytes.length > 1024 * 1024) throw Error();
  const rows = JSON.parse(bodyBytes).mission_board_campaigns;
  if (!Array.isArray(rows) || rows.length > 8) throw Error();
  const directory = resolve(output);
  await mkdir(directory, { recursive: true });
  const result = [];
  for (const row of rows) {
    if (!Number.isSafeInteger(row.id) || row.id <= 0) throw Error();
    const url = campaignArtworkUrl(row.banner_image_path);
    const response = await fetch(url, { redirect: 'error', credentials: 'omit',
      signal: AbortSignal.timeout(15000), headers: { accept: 'image/png', 'accept-encoding': 'identity' } });
    if (response.status !== 200) throw Error();
    const parts = []; let length = 0;
    for await (const part of response.body) {
      length += part.length;
      if (length > 512 * 1024) throw Error();
      parts.push(part);
    }
    const image = await prepareCampaignArtwork(Buffer.concat(parts));
    await writeFile(resolve(directory, `${image.descriptor.sha256}.png`), image.bytes, { flag: 'wx' });
    result.push({ campaignId: row.id, sourcePath: new URL(url).pathname, ...image.descriptor });
  }
  const report = { mode: 'historical-capture-artwork-inspection', published: false, apiRequests: 0, artwork: result };
  await writeFile(resolve(directory, 'receipt.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(report));
}
main().catch(() => { console.error('campaign_artwork_inspection_failed'); process.exitCode = 1; });
