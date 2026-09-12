import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { loadEventCatalog } from './event-catalog.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=Buffer.from('{"schemaVersion":1,"entries":[]}');
const zipped=gzipSync(bytes);
const manifest=()=>({schemaVersion:2,contract:'dokkan-stage-delivery',contractVersion:'1.1.0',source:'dokkan-game-db',catalog:{sha256:hash(zipped),contentType:'application/json',contentEncoding:'gzip',
  objectKey:`stage-details/objects/${hash(zipped)}.json.gz`,sizeBytes:zipped.length,expandedSizeBytes:bytes.length}});
function mock(value=manifest(),body=zipped) {
  const calls=[];
  return {calls,expectedCatalogSha256:hash(bytes),fetchImpl:async(url,options)=>{
    calls.push({url,options});
    return new Response(calls.length===1?JSON.stringify(value):body);
  }};
}
test('fixed public staging paths verify compressed and expanded identities',async()=>{
  const io=mock(),result=await loadEventCatalog(io);
  assert.deepEqual(result.catalogBytes,bytes);
  assert.equal(result.catalogSha256,hash(bytes));
  assert.notEqual(result.catalogSha256,hash(zipped));
  assert.equal(io.calls.length,2);
  for(const call of io.calls){
    assert(call.url.startsWith('https://assets.dkbcompanion.com/staging/v2/'));
    assert.equal(call.options.redirect,'error');
    assert.equal(call.options.headers.authorization,undefined);
  }
});
test('untrusted path and declared sizes fail before object request',async()=>{
  for(const update of [{objectKey:'https://private.invalid/secret'}, {sizeBytes:4*1024*1024+1},
    {expandedSizeBytes:16*1024*1024+1},{sizeBytes:0},{sha256:'bad'}]){
    const value=manifest();Object.assign(value.catalog,update);const io=mock(value);
    await assert.rejects(loadEventCatalog(io),/^Error: event_catalog_unavailable$/);
    assert.equal(io.calls.length,1);
  }
});
test('hash mismatch and decompression limits reject object',async()=>{
  await assert.rejects(loadEventCatalog(mock(manifest(),Buffer.alloc(zipped.length))));
  const short=manifest();short.catalog.expandedSizeBytes=bytes.length-1;
  await assert.rejects(loadEventCatalog(mock(short)));
  const long=manifest();long.catalog.expandedSizeBytes=bytes.length+1;
  await assert.rejects(loadEventCatalog(mock(long)));
});
test('oversized manifest and private transport failures are sanitized',async()=>{
  await assert.rejects(loadEventCatalog({expectedCatalogSha256:hash(bytes),fetchImpl:async()=>new Response('x'.repeat(1024*1024+1))}),
    /^Error: event_catalog_unavailable$/);
  await assert.rejects(loadEventCatalog({expectedCatalogSha256:hash(bytes),fetchImpl:async()=>{throw Error('PRIVATE')}}),
    /^Error: event_catalog_unavailable$/);
});
test('missing pin makes no requests and valid replacement pair cannot self-authorize',async()=>{
  const missing=mock(); delete missing.expectedCatalogSha256;
  await assert.rejects(loadEventCatalog(missing));assert.equal(missing.calls.length,0);
  const replacement=mock();replacement.expectedCatalogSha256='0'.repeat(64);
  await assert.rejects(loadEventCatalog(replacement));assert.equal(replacement.calls.length,2);
});
