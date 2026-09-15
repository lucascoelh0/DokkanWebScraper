import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import Ajv from 'ajv/dist/2020.js';
import {prepareArtworkIndex,validateArtworkItems,loadPreviousEventArtwork} from './event-artwork-index.mjs';
import {createHash} from 'node:crypto';

const now = Date.parse('2026-09-15T12:00:00Z'), cat = 'a'.repeat(64), png = 'b'.repeat(64);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
test('shared index is canonical, deterministic, compact and bounded at 2000 targets', async () => {
  const items = Object.fromEntries(Array.from({length:2000},(_,i)=>[`event-area:${i+1}`,[png,Math.floor(now/1000)]]));
  const result = prepareArtworkIndex(cat,items,now);
  assert.equal(result.operations.length,8);
  assert.deepEqual(result,prepareArtworkIndex(cat,Object.fromEntries(Object.entries(items).reverse()),now));
  const schema = JSON.parse(await readFile(new URL('./contracts/event-artwork-v1.schema.json',import.meta.url)));
  const ajv = new Ajv({strict:false}); ajv.addSchema(schema);
  assert(ajv.validate(schema.$id,result.index));
  for (const op of result.operations) {
    assert(op.bytes.length <= 65536 && op.key.includes(digest(op.bytes)));
    assert(ajv.validate(schema.$id+'#/$defs/shard',JSON.parse(op.bytes)),JSON.stringify(ajv.errors));
  }
  assert.throws(()=>prepareArtworkIndex(cat,{...items,'event-area:2001':[png,Math.floor(now/1000)]},now));
});
test('rejects unsafe identifiers/hash/clock and keeps checkedAt independent of availability', () => {
  for (const items of [{bad:[png,1]}, {'event-area:1':['../x',1230768000]},
    {'event-area:1':[png,now/1000+1]}, {'event-area:1':[png,1]}, {'event-area:1':[png,now/1000,'extra']}]) {
    assert.throws(()=>validateArtworkItems(items,now));
  }
});
function source(items) {
  const prepared = prepareArtworkIndex(cat,items,now);
  const bytes = Buffer.from(JSON.stringify({eventArtwork:prepared.index}));
  const sha256 = digest(bytes);
  const manifest = Buffer.from(JSON.stringify({schemaVersion:1,file:sha256+'.json',sha256,sizeBytes:bytes.length}));
  const objects = new Map([['manifest.json',manifest],[sha256+'.json',bytes],...prepared.operations.map(o=>[o.key.split('/').at(-1),o.bytes])]);
  return {prepared,objects,fetchImpl:async url=>new Response(objects.get(new URL(url).pathname.split('/').at(-1)) ?? '',{status:objects.has(new URL(url).pathname.split('/').at(-1))?200:404})};
}
test('loads published hash graph and preserves last checked art regardless of Home expiry', async () => {
  const items = {'event-area:507':[png,1230768000]}; const s=source(items);
  assert.deepEqual((await loadPreviousEventArtwork(cat,{fetchImpl:s.fetchImpl,now:()=>now})).items,items);
  assert.deepEqual(await loadPreviousEventArtwork(cat,{fetchImpl:async()=>new Response('',{status:404})}),{catalogSha256:cat,items:{}});
  s.objects.set(s.prepared.index.shards[0].file,Buffer.from('{}'));
  assert.equal(await loadPreviousEventArtwork(cat,{fetchImpl:s.fetchImpl,now:()=>now}),null);
});

test('duplicate shard filenames and aggregate over 2000 targets are rejected',async()=>{
  const s=source({'event-area:1':[png,now/1000]});
  const index={...s.prepared.index,shards:[...s.prepared.index.shards,...s.prepared.index.shards]};
  const bytes=Buffer.from(JSON.stringify({eventArtwork:index})),sha256=digest(bytes);
  s.objects.set(sha256+'.json',bytes);
  s.objects.set('manifest.json',Buffer.from(JSON.stringify({schemaVersion:1,file:sha256+'.json',sha256,sizeBytes:bytes.length})));
  assert.equal(await loadPreviousEventArtwork(cat,{fetchImpl:s.fetchImpl,now:()=>now}),null);
  assert.throws(()=>validateArtworkItems(Object.fromEntries(Array.from({length:2001},(_,i)=>[`event-area:${i+1}`,[png,now/1000]])),now));
});
test('cancelled traversal retains prior publication rather than returning empty artwork', async () => {
  let calls = 0;
  const result = await loadPreviousEventArtwork('a'.repeat(64), {
    signal:AbortSignal.abort(), fetchImpl:async()=>{calls++; throw Error('unexpected');},
  });
  assert.equal(result, null);
  assert.equal(calls, 0);
});
