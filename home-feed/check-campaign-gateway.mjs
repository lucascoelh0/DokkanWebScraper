import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { campaignGatewayStore } from './campaign-gateway-store.mjs';

/** Read-only hosted diagnostic: never signs in to the game or writes an object. */
export async function checkCampaignGateway(env, fetchImpl = fetch) {
  const responses = [];
  let store;
  try {
    store = campaignGatewayStore(env, { fetchImpl: async (url, options) => {
      assert(!options.method || options.method === 'GET');
      const response = await fetchImpl(url, options);
      responses.push({ operation: new URL(url).pathname === '/campaign-inventory' ? 'inventory' : 'manifest', status: response.status });
      return response;
    } });
    const bucketBytes = await store.readBucketBytes();
    const manifest = await store.readObject('staging/v2/campaigns/manifest.json');
    return { status: 'passed', bucketBytes, manifestPresent: manifest !== null, responses };
  } catch { return { status: 'failed', responses }; }
  finally { store?.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await checkCampaignGateway(process.env);
  console.log(JSON.stringify(result));
  process.exitCode = result.status === 'passed' ? 0 : 1;
}
