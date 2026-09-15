import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {collectEvents,prepareCollectedSharedArtwork} from './collect-events.mjs';
import {prepareCandidate} from './prepare-candidate.mjs';
import {publication} from './publication.mjs';

const now=Date.parse('2026-09-15T12:00:00Z');
const hash=b=>createHash('sha256').update(b).digest('hex');
const config={nonceHeaders:{authorization:'Basic test'},loginHeaders:{authorization:'Basic test'},loginBody:{account_id:'PRIVATE'},apiHeaders:{}};
const catalogBytes=Buffer.from(JSON.stringify({schemaVersion:1,contract:'dokkan-stage-delivery',source:'dokkan-game-db',entries:Array.from({length:31},(_,i)=>({kind:'z-battle',id:String(i+1)}))}));
const catalogSha256=hash(catalogBytes);
async function fixture({color='#123456',broken=false,tall=false}={}) {
  const requests=[];
  const png=await sharp({create:{width:500,height:tall?600:110,channels:4,background:color}}).png().toBuffer();
  const fetchImpl=async(url,options)=>{
    const path=new URL(url).pathname;requests.push(path);
    if(path.startsWith('/banners/')) {
      assert.equal(options.headers.authorization,undefined);
      return new Response(broken?'invalid':png);
    }
    return Response.json(path==='/auth/nonce'?{auth_transaction_id:'fresh'}:path==='/auth/sign_in'?{access_token:'PRIVATE',token_type:'bearer'}:{events:[],z_battle_stages:Array.from({length:31},(_,i)=>({id:i+1,start_at:1788411600,end_at:1792483199,
      listbutton_image:`https://cf.ishin-global.aktsk.com/banners/en/event/eve_listbutton/zb_${i+1}.png?Signature=PRIVATE`}))});
  };
  return {fetchImpl,requests};
}
const observation=()=>({snapshot:{observedAt:new Date(now).toISOString(),source:'authorized_manual_global_gashas_read',banners:[]},receipts:[],images:new Map(),featuredResponses:[]});
async function run(fix,previousArtwork,at=now) {
  const collection=await collectEvents({config,catalogBytes,catalogSha256,includePresentation:true,previousArtwork},{fetchImpl:fix.fetchImpl,now:()=>at});
  assert.equal(collection.status,'collected');
  const shared=prepareCollectedSharedArtwork(collection,at);
  const candidate=await prepareCandidate(observation(),at,{enableEvents:true,eventCollection:collection,previousArtwork});
  const content=JSON.parse(candidate.operations.at(-2).bytes);
  const items=Object.assign({},...(content.eventArtwork?.shards??[]).map(s=>JSON.parse(candidate.operations.find(op=>op.sha256===s.sha256).bytes).items));
  return {collection,shared,candidate,content,items};
}
test('bounded rotation covers events beyond Home cap and uses immutable horizontal art',async()=>{
  const fix=await fixture();const first=await run(fix);
  assert.equal(first.shared.images.length,20);
  assert.equal(fix.requests.filter(p=>p.startsWith('/banners/')).length,20);
  assert.equal(first.content.eventSchedule.items.length,20);
  assert.equal(Object.keys(first.items).length,20);
  assert(first.candidate.operations.length<=42);
  assert(!JSON.stringify(first.content).includes('PRIVATE'));
  const second=await run(await fixture(),{catalogSha256,items:first.items},now+1000);
  assert.equal(Object.keys(second.items).length,31);
  assert(second.shared.images.some(i=>!Object.hasOwn(first.items,i.targetKey)));
  assert.equal(prepareCollectedSharedArtwork(structuredClone(first.collection),now),null);
  first.collection.projection.artworkTargets[0].target.id='999';
  assert.equal(prepareCollectedSharedArtwork(first.collection,now),null);
});
test('same source path with new bytes changes image hash; failed or tall art retains prior',async()=>{
  const first=await run(await fixture());const previousArtwork={catalogSha256,items:first.items};
  const changed=await run(await fixture({color:'#654321'}),previousArtwork,now+1000);
  const changedKey=changed.shared.images[0].targetKey;
  assert.notEqual(changed.items[changedKey][0],first.shared.images[0].sha256);
  for(const options of [{broken:true},{tall:true}]) {
    const result=await run(await fixture(options),previousArtwork,now+1000);
    assert.deepEqual(result.items,first.items);
  }
});
test('candidate publishes shards and image before Home pointer with no duplicate upload',async()=>{
  const result=await run(await fixture());const objects=new Map();const puts=[];
  const store={inventoryBytes:async()=>0,get:async key=>objects.has(key)?{bytes:objects.get(key),etag:'e'}:null,
    put:async(key,bytes)=>{objects.set(key,bytes);puts.push(key);}};
  const pub=publication(store,async key=>objects.get(key),()=>now);
  const proposal=await pub.plan(result.candidate);
  assert(proposal.writeBytes<16*1024*1024);
  await pub.publish(result.candidate,proposal,{assertOwned:async()=>{}});
  assert.equal(puts.at(-1),'staging/v2/home/manifest.json');
  const second=await pub.plan(result.candidate);
  assert.equal(second.newBytes,0);
});

test('shared art still progresses with forty distinct summon assets within 70 objects and 16 MiB',async()=>{
  const {collection}=await run(await fixture()); const obs=observation();
  for(let id=1;id<=40;id++) {
    const png=await sharp({create:{width:1,height:1,channels:4,background:{r:id,g:0,b:0,alpha:1}}}).png().toBuffer();
    const sha256=hash(png),imagePath=`/banners/en/gashasocool/a${id}.png`;
    obs.snapshot.banners.push({id,name:'Fixture',open_at:now/1000-1,end_at:now/1000+3600,imageHost:'cf.ishin-global.aktsk.com',imagePath});
    obs.receipts.push({bannerId:id,sourcePath:imagePath,sha256,sizeBytes:png.length,width:1,height:1});
    obs.images.set(sha256+'.png',png);
    obs.featuredResponses.push({path:`/gashas/${id}/featured_cards`,status:200,error:null,observedAt:new Date(now).toISOString(),publicIds:{gasha_items:[]}});
  }
  const candidate=await prepareCandidate(obs,now,{enableEvents:true,eventCollection:collection});
  const content=JSON.parse(candidate.operations.at(-2).bytes);
  assert.equal(content.summons.length,40);assert(content.eventArtwork.shards.length>0);
  assert(candidate.operations.length>42&&candidate.operations.length<=70);
  await publication({inventoryBytes:async()=>0,get:async()=>null},null,()=>now).plan(candidate);
});

test('Burst 503 does not erase independently collected horizontal art',async()=>{
  const fix=await fixture();const fetchImpl=(url,options)=>new URL(url).pathname==='/resources/login'
    ? Promise.resolve(new Response('',{status:503})):fix.fetchImpl(url,options);
  const collection=await collectEvents({config,catalogBytes,catalogSha256,includePresentation:true,includeBurst:true},{fetchImpl,now:()=>now});
  assert.equal(collection.status,'collected');
  assert.equal(prepareCollectedSharedArtwork(collection,now).images.length,20);
  assert.equal(collection.receipt.burstBodySha256,undefined);
});

test('a failed oldest target advances cursor instead of blocking all later art forever',async()=>{
  const first=await run(await fixture({broken:true}));
  assert.equal(first.shared.images.length,0);assert(first.content.eventArtwork.cursor);
  const next=await run(await fixture(),{catalogSha256,items:first.items,index:first.content.eventArtwork},now+1000);
  assert.equal(next.shared.images.length,20);
  assert.notEqual(next.shared.images[0].targetKey,first.content.eventArtwork.cursor);
});
test('unreadable previous graph blocks destructive replacement rather than becoming empty',async()=>{
  await assert.rejects(prepareCandidate(observation(),now,{enableEvents:true,previousArtwork:null}));
});
