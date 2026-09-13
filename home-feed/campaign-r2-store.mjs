import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const BUCKET='dokkanpanion-data';
const PREFIX='staging/v2/campaigns/';
function limitFor(key) {
  assert(typeof key==='string' && key.startsWith(PREFIX));
  const relative=key.slice(PREFIX.length);
  if(relative==='manifest.json')return 4096;
  if(/^index\/[a-f0-9]{64}\.json$/.test(relative))return 32768;
  if(/^details\/[a-f0-9]{64}\.json$/.test(relative))return 524288;
  if(/^images\/[a-f0-9]{64}\.png$/.test(relative))return 524288;
  throw Error('campaign_key_rejected');
}
const versionOk=v=>typeof v==='string' && /^"[a-fA-F0-9-]{1,128}"$/.test(v);

/** Dedicated local adapter. No Home gateway expansion, delete or credential export. */
export function campaignR2Store(env,{client: injectedClient}={}) {
  assert(/^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ACCOUNT_ID));
  assert(env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);
  const client=injectedClient??new S3Client({region:'auto',
    endpoint:`https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials:{accessKeyId:env.R2_ACCESS_KEY_ID,secretAccessKey:env.R2_SECRET_ACCESS_KEY},
    maxAttempts:1,followRegionRedirects:false,
    requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
  let closed=false;
  const send=command=>{assert(!closed);return client.send(command,{abortSignal:AbortSignal.timeout(20000)});};
  return {
    close(){closed=true;client.destroy();},
    async readBucketBytes(){
      try {
        let cursor,total=0;const seen=new Set();const started=Date.now();
        for(let page=0;page<1000;page++){
          assert(Date.now()-started<45000);
          const result=await send(new ListObjectsV2Command({Bucket:BUCKET,MaxKeys:1000,ContinuationToken:cursor}));
          for(const row of result.Contents??[]){assert(Number.isSafeInteger(row.Size)&&row.Size>=0);total+=row.Size;}
          assert(Number.isSafeInteger(total));
          if(result.IsTruncated===false || result.IsTruncated===undefined)return total;
          assert(result.IsTruncated===true);
          cursor=result.NextContinuationToken;
          assert(typeof cursor==='string'&&cursor.length>0&&cursor.length<=8192&&!seen.has(cursor));seen.add(cursor);
        }
        throw Error();
      }catch{throw Error('campaign_inventory_failed');}
    },
    async readObject(key){
      const limit=limitFor(key);let result;
      const deadline=Date.now()+20000;
      const timer=setTimeout(()=>result?.Body?.destroy(Error('campaign_read_timeout')),20000);
      try {
        try{result=await send(new GetObjectCommand({Bucket:BUCKET,Key:key}));}
        catch(error){if(error?.name==='NoSuchKey')return null;throw Error();}
        assert(Number.isSafeInteger(result.ContentLength)&&result.ContentLength>0&&result.ContentLength<=limit&&versionOk(result.ETag));
        const parts=[];let total=0;
        for await(const chunk of result.Body){assert(Date.now()<deadline);total+=chunk.length;assert(total<=limit);parts.push(Buffer.from(chunk));}
        assert(total===result.ContentLength);
        return {bytes:Buffer.concat(parts),version:result.ETag};
      }catch{throw Error('campaign_read_failed');}
      finally{clearTimeout(timer);result?.Body?.destroy();}
    },
    async putObject(key,bytes,options){
      try {
        const limit=limitFor(key);assert(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=limit);
        const manifest=key===PREFIX+'manifest.json';
        const image=key.startsWith(PREFIX+'images/');
        assert(options.contentType===(image?'image/png':'application/json'));
        assert(options.cacheControl===(manifest?'no-cache, no-transform':'public, max-age=31536000, immutable'));
        assert((options.ifNoneMatch==='*'&&options.ifMatch===undefined)
          ||(manifest&&versionOk(options.ifMatch)&&options.ifNoneMatch===undefined));
        if(!manifest)assert(key.endsWith('/'+createHash('sha256').update(bytes).digest('hex')+(image?'.png':'.json')));
        const result=await send(new PutObjectCommand({Bucket:BUCKET,Key:key,Body:bytes,
          IfMatch:options.ifMatch,IfNoneMatch:options.ifNoneMatch,
          ContentType:options.contentType,CacheControl:options.cacheControl}));
        assert(versionOk(result.ETag));return result.ETag;
      }catch{throw Error('campaign_write_unconfirmed');}
    },
  };
}

export async function campaignPublicRead(key,size,{fetchImpl=fetch}={}) {
  try {
    assert(Number.isSafeInteger(size)&&size>0&&size<=limitFor(key));
    const response=await fetchImpl('https://assets.dkbcompanion.com/'+key,{redirect:'error',
      signal:AbortSignal.timeout(20000),headers:{'accept-encoding':'identity','cache-control':'no-cache'}});
    assert(response.status===200);
    const reader=response.body.getReader();let total=0;const parts=[];
    try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;assert(total<=size);parts.push(Buffer.from(value));}}
    finally{await reader.cancel();}
    assert(total===size);return Buffer.concat(parts);
  }catch{throw Error('campaign_public_read_failed');}
}
