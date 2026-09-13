import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { verifyPublicCampaigns } from './verify-public-campaigns.mjs';
const at = Date.parse('2026-09-13T20:00:00Z');
const sha = b => createHash('sha256').update(b).digest('hex');
async function fixture({version=2,expired=false,unsafeDestination=false,mismatch=false,legacyDestination=false}={}) {
  const objects=new Map(),calls=[];
  const image=await sharp({create:{width:2,height:2,channels:4,background:'#ff8000'}}).png().toBuffer();
  const artwork={sha256:sha(image),sizeBytes:image.length,width:2,height:2};
  const context={schemaVersion:version,region:'global',source:'global-game-campaigns',coverage:'partial-observation',
    contentSemantics:'mission-definitions',revisionSha256:'a'.repeat(64),observedAt:new Date(at-1000).toISOString(),validUntil:new Date(at+(expired?-1:60000)).toISOString()};
  const campaign={id:1,title:'Campaign',boards:[{id:1}],...(version===2?{artwork}:{})};
  const detail=Buffer.from(JSON.stringify({...context,contract:'dokkan-campaign-detail',campaign,
    missions:[{id:1,...(version===2||legacyDestination?{destination:unsafeDestination?{type:'url',url:'https://PRIVATE'}:{type:'event-area',areaId:12}}:{})}]}));
  const descriptor={sha256:sha(detail),sizeBytes:detail.length};
  const index=Buffer.from(JSON.stringify({...context,contract:'dokkan-campaign-index',campaigns:[{
    id:1,title:'Campaign',boardCount:mismatch?2:1,...(version===2?{artwork}:{}),detail:descriptor,
    destination:{type:'campaign-detail',campaignId:1,detailSha256:descriptor.sha256}}]}));
  objects.set('manifest.json',Buffer.from(JSON.stringify({schemaVersion:1,region:'global',contract:'dokkan-campaign-manifest',
    file:`index/${sha(index)}.json`,sha256:sha(index),sizeBytes:index.length})));
  objects.set(`index/${sha(index)}.json`,index);objects.set(`details/${sha(detail)}.json`,detail);objects.set(`images/${sha(image)}.png`,image);
  return {objects,calls,options:{now:()=>at,fetchImpl:async(url,options)=>{
    assert.equal(new URL(url).origin,'https://assets.dkbcompanion.com');assert.equal(options.redirect,'error');
    assert(!options.method || options.method==='GET');assert(!options.headers.authorization);
    const key=new URL(url).pathname.replace('/staging/v2/campaigns/','');calls.push(key);
    return objects.has(key)?new Response(objects.get(key)):new Response('PRIVATE',{status:404});
  }}};
}
test('verifies complete v2 public graph, decodes image and rechecks manifest',async()=>{
  const f=await fixture();const r=await verifyPublicCampaigns({...f.options,requireV2:true});
  assert.equal(r.status,'verified');assert.equal(r.images,1);assert.equal(r.eventLinks,1);assert.equal(r.campaigns,1);
  assert.equal(f.calls.filter(k=>k==='manifest.json').length,2);
});
test('legacy remains verifiable but cannot satisfy enriched rollout gate',async()=>{
  const f=await fixture({version:1});assert.equal((await verifyPublicCampaigns(f.options)).status,'verified');
  assert.deepEqual(await verifyPublicCampaigns({...f.options,requireV2:true}),{status:'failed',phase:'index'});
});
for(const [options,phase] of [[{expired:true},'index'],[{unsafeDestination:true},'detail'],[{mismatch:true},'detail'],[{version:1,legacyDestination:true},'detail']])
 test(`fails closed ${JSON.stringify(options)}`,async()=>{
  const f=await fixture(options);assert.deepEqual(await verifyPublicCampaigns(f.options),{status:'failed',phase});
 });
test('tampered or missing image cannot count as verified',async()=>{
  for(const missing of [false,true]){
    const f=await fixture(),key=[...f.objects.keys()].find(k=>k.startsWith('images/'));
    if(missing)f.objects.delete(key);else f.objects.set(key,Buffer.from('PRIVATE'));
    assert.deepEqual(await verifyPublicCampaigns(f.options),{status:'failed',phase:'images'});
  }
});
test('manifest cannot send verifier to an arbitrary host',async()=>{
  const f=await fixture();f.objects.set('manifest.json',Buffer.from(JSON.stringify({schemaVersion:1,region:'global',contract:'dokkan-campaign-manifest',sha256:'a'.repeat(64),file:'https://PRIVATE',sizeBytes:3})));
  assert.deepEqual(await verifyPublicCampaigns(f.options),{status:'failed',phase:'manifest'});assert.equal(f.calls.length,1);
});
test('mid-audit manifest change cannot report a stable snapshot',async()=>{
  const f=await fixture();let reads=0;const original=f.options.fetchImpl;
  f.options.fetchImpl=async(url,options)=>{
    if(url.endsWith('/manifest.json')&&++reads===2)return new Response('{}');
    return original(url,options);
  };
  assert.deepEqual(await verifyPublicCampaigns(f.options),{status:'failed',phase:'stability'});
});
test('overlarge response is stopped and exception text is sanitized',async()=>{
  const r=await verifyPublicCampaigns({fetchImpl:async()=>new Response(Buffer.alloc(4097))});
  assert.deepEqual(r,{status:'failed',phase:'manifest'});
});
