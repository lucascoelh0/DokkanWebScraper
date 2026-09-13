import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCampaignGateway } from './check-campaign-gateway.mjs';
const env = { CAMPAIGN_GATEWAY_URL: 'https://test.test.workers.dev', CAMPAIGN_GATEWAY_TOKEN: 'a'.repeat(64) };
test('hosted gateway check only reads and returns sanitized metadata', async () => {
  const result = await checkCampaignGateway(env, async (url, options) => {
    assert(!options.method || options.method === 'GET');
    if (new URL(url).pathname === '/campaign-inventory') return Response.json({bytes:12,truncated:false,cursor:null});
    return new Response('missing', {status:404});
  });
  assert.equal(result.status,'passed');assert.equal(result.bucketBytes,12);assert.equal(result.manifestPresent,false);
});
test('failed gateway checks never expose bodies, exceptions or credentials', async () => {
  for (const fn of [async()=>new Response('PRIVATE',{status:401}), async()=>{throw Error('PRIVATE');}]) {
    const result=await checkCampaignGateway(env,fn);
    assert.equal(result.status,'failed');assert(!JSON.stringify(result).includes('PRIVATE'));
    assert(!JSON.stringify(result).includes(env.CAMPAIGN_GATEWAY_TOKEN));
  }
});
