import assert from 'node:assert/strict';
import {S3Client,GetObjectCommand,PutObjectCommand,ListObjectsV2Command} from '@aws-sdk/client-s3';
function limit(key){
 assert(key.startsWith('staging/v2/news/'));
 const p=key.slice('staging/v2/news/'.length);
 if(p==='manifest.json')return 1024;
 if(/^index\/[a-f0-9]{64}\.json$/.test(p))return 1048576;
 if(/^articles\/[a-f0-9]{64}\.json$/.test(p))return 262144;
 if(/^images\/[a-f0-9]{64}\.png$/.test(p))return 2097152;
 throw Error('news_key_rejected');
}
export function newsLibraryStore(env){
 assert(/^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ACCOUNT_ID)&&env.R2_ACCESS_KEY_ID&&env.R2_SECRET_ACCESS_KEY);
 const client=new S3Client({region:'auto',endpoint:`https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,credentials:{accessKeyId:env.R2_ACCESS_KEY_ID,secretAccessKey:env.R2_SECRET_ACCESS_KEY},maxAttempts:1,followRegionRedirects:false,requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
 const send=c=>client.send(c,{abortSignal:AbortSignal.timeout(20000)});
 const Bucket='dokkanpanion-data';
 return {
  close:()=>client.destroy(),
  async inventoryBytes(){let token,total=0;const seen=new Set();for(let page=0;page<1000;page++){
   const r=await send(new ListObjectsV2Command({Bucket,MaxKeys:1000,ContinuationToken:token}));
   for(const row of r.Contents??[]){assert(Number.isSafeInteger(row.Size)&&row.Size>=0);total+=row.Size;}
   if(!r.IsTruncated)return total;token=r.NextContinuationToken;assert(token&&!seen.has(token));seen.add(token);
  }throw Error('inventory_limit');},
  async get(key){const maximum=limit(key);let r;try{r=await send(new GetObjectCommand({Bucket,Key:key}));}catch(e){if(e?.name==='NoSuchKey')return null;throw Error('news_read_failed');}
   try{assert(r.ContentLength>0&&r.ContentLength<=maximum&&r.ETag);let size=0;const chunks=[];for await(const b of r.Body){size+=b.length;assert(size<=maximum);chunks.push(Buffer.from(b));}assert(size===r.ContentLength);return {bytes:Buffer.concat(chunks),etag:r.ETag,contentType:r.ContentType,cacheControl:r.CacheControl};}finally{r.Body?.destroy();}
  },
  async put(key,bytes,options){assert(bytes.length>0&&bytes.length<=limit(key));assert((options.ifMatch&&!options.ifNoneMatch)||(options.ifNoneMatch==='*'&&!options.ifMatch));
   const r=await send(new PutObjectCommand({Bucket,Key:key,Body:bytes,IfMatch:options.ifMatch,IfNoneMatch:options.ifNoneMatch,ContentType:options.contentType,CacheControl:options.cacheControl}));assert(r.ETag);return r.ETag;
  }
 };
}
export async function readPublicNews(key,size){
 assert(size>0&&size<=limit(key));
 const r=await fetch('https://assets.dkbcompanion.com/'+key,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{'accept-encoding':'identity','cache-control':'no-cache'}});assert(r.ok);
 let count=0;const chunks=[];for await(const b of r.body){count+=b.length;assert(count<=size);chunks.push(Buffer.from(b));}assert(count===size);return Buffer.concat(chunks);
}
