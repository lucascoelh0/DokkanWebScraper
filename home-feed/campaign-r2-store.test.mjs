import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {campaignR2Store,campaignPublicRead} from './campaign-r2-store.mjs';
const prefix='staging/v2/campaigns/';
const bytes=Buffer.from('{}');
const key=prefix+'details/'+createHash('sha256').update(bytes).digest('hex')+'.json';
const opts={ifNoneMatch:'*',contentType:'application/json',cacheControl:'public, max-age=31536000, immutable'};
function adapter(send){return campaignR2Store({CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),R2_ACCESS_KEY_ID:'test',R2_SECRET_ACCESS_KEY:'test'},
  {client:{send,destroy(){}}});}
test('store rejects other prefixes and mismatched immutable bytes without I/O',async()=>{
  let calls=0;const store=adapter(async()=>{calls++;throw Error();});
  for(const target of ['v2/campaigns/manifest.json','staging/v2/home/manifest.json',prefix+'../manifest.json']){
    await assert.rejects(store.readObject(target));await assert.rejects(store.putObject(target,bytes,opts));
  }
  await assert.rejects(store.putObject(key,Buffer.from('[]'),opts));
  await assert.rejects(store.putObject(key,bytes,{...opts,ifNoneMatch:undefined,ifMatch:'"abc"'}));
  assert.equal(calls,0);
});
test('store pins bucket, immutable create and manifest conditional replacement',async()=>{
  const calls=[];const store=adapter(async command=>{calls.push(command.input);return {ETag:'"abc"'};});
  await store.putObject(key,bytes,opts);
  await store.putObject(prefix+'manifest.json',bytes,{contentType:'application/json',cacheControl:'no-cache, no-transform',ifMatch:'"abc1"'});
  assert.equal(calls[0].Bucket,'dokkanpanion-data');assert.equal(calls[0].IfNoneMatch,'*');assert.equal(calls[1].IfMatch,'"abc1"');
  store.close();await assert.rejects(store.putObject(key,bytes,opts));assert.equal(calls.length,2);
});
test('bounded reads distinguish missing objects from failed access',async()=>{
  assert.equal(await adapter(async()=>{throw Object.assign(Error(),{name:'NoSuchKey'});}).readObject(key),null);
  await assert.rejects(adapter(async()=>{throw Error('PRIVATE');}).readObject(key),/^Error: campaign_read_failed$/);
  const valid=adapter(async()=>({ContentLength:2,ETag:'"abc"',Body:Readable.from([bytes])}));
  assert.deepEqual(await valid.readObject(key),{bytes,version:'"abc"'});
  await assert.rejects(adapter(async()=>({ContentLength:999999,ETag:'"abc"',Body:Readable.from([])})).readObject(key));
});
test('inventory paginates and rejects repeated cursor or malformed size',async()=>{
  let calls=0;const store=adapter(async()=>++calls===1?{Contents:[{Size:10}],IsTruncated:true,NextContinuationToken:'next'}:{Contents:[{Size:20}],IsTruncated:false});
  assert.equal(await store.readBucketBytes(),30);
  await assert.rejects(adapter(async()=>({IsTruncated:true,NextContinuationToken:'same'})).readBucketBytes());
  await assert.rejects(adapter(async()=>({Contents:[{Size:-1}],IsTruncated:false})).readBucketBytes());
});
test('public reader pins host and rejects unexpected size and routes',async()=>{
  let calls=0;const fetchImpl=async(url,options)=>{calls++;assert.equal(url,'https://assets.dkbcompanion.com/'+key);assert.equal(options.redirect,'error');return new Response(bytes);};
  assert.deepEqual(await campaignPublicRead(key,2,{fetchImpl}),bytes);
  await assert.rejects(campaignPublicRead(key,1,{fetchImpl}));
  await assert.rejects(campaignPublicRead('v2/campaigns/manifest.json',2,{fetchImpl}));assert.equal(calls,2);
});
