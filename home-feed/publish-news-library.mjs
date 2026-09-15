import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {preparedNewsLibrary,NEWS_PREFIX} from './news-library.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');

/** Explicit release adapter, not automatically enabled by the Home runner. */
export async function planNewsLibrary(collection,store,now=Date.now()){
 const candidate=preparedNewsLibrary(collection,now);
 const bucketBytes=await store.inventoryBytes();
 const ops=[];let writeBytes=0,newBytes=0;
 for(const o of candidate.operations){
  const previous=await store.get(o.key);
  const mutable=o.key===NEWS_PREFIX+'manifest.json';
  if(previous&&!mutable)assert(previous.bytes.equals(o.bytes),'immutable_collision');
  const cacheControl=mutable?'no-cache':'public,max-age=31536000,immutable';
  const write=!previous||!previous.bytes.equals(o.bytes)||previous.contentType!==o.contentType||previous.cacheControl!==cacheControl;
  if(write){writeBytes+=o.sizeBytes;newBytes+=Math.max(0,o.sizeBytes-(previous?.bytes.length??0));}
  ops.push({...o,write,condition:previous?{ifMatch:previous.etag}:{ifNoneMatch:'*'}});
 }
 assert(ops.length<=358&&writeBytes<=64*1024*1024&&bucketBytes+newBytes<8000000000);
 const report=Object.freeze({target:NEWS_PREFIX,objects:ops.length,bucketBytes,newBytes,writeBytes,projectedBucketBytes:bucketBytes+newBytes});
 plans.set(report,{collection,ops,validUntil:candidate.validUntil});return report;
}
const plans=new WeakMap();
export async function publishNewsLibrary(collection,plan,{store,lease,publicRead,now=Date.now}){
 const p=plans.get(plan);assert(p&&p.collection===collection);plans.delete(plan);
 assert(p.ops.at(-1).key===NEWS_PREFIX+'manifest.json');
 for(const o of p.ops){
  assert(now()<p.validUntil);await lease.assertOwned();
  if(o.write)await store.put(o.key,o.bytes,{...o.condition,contentType:o.contentType,cacheControl:o.key.endsWith('/manifest.json')?'no-cache':'public,max-age=31536000,immutable'});
  const publicBytes=await publicRead(o.key,o.sizeBytes);
  assert(publicBytes.length===o.sizeBytes&&sha(publicBytes)===o.sha256);
 }
 return {status:'published',manifestSha256:p.ops.at(-1).sha256};
}
