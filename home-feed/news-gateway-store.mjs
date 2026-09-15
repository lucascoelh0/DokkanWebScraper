import assert from 'node:assert/strict';
const versionOk=v=>typeof v==='string'&&/^"[^"\u0000-\u001f\u007f,]{1,254}"$/.test(v);
function limit(key){
 if(key==='staging/v2/news/manifest.json')return 1024;
 const m=/^staging\/v2\/news\/(index|articles|images)\/[a-f0-9]{64}\.(json|png)$/.exec(key);
 assert(m&&(m[1]==='images')===(m[2]==='png'));
 return m[1]==='images'?2097152:m[1]==='index'?1048576:262144;
}
/** Dedicated News credential; no Home token or broad R2 credential fallback. */
export function newsGatewayStore(env,{fetchImpl=fetch,now=Date.now}={}){
 const origin=new URL(env.NEWS_GATEWAY_URL);
 assert(origin.protocol==='https:'&&!origin.username&&!origin.password&&!origin.port&&origin.pathname==='/'&&!origin.search&&!origin.hash);
 assert(/^[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/.test(origin.hostname));
 let token=env.NEWS_GATEWAY_TOKEN;assert(typeof token==='string'&&/^[a-f0-9]{64}$/.test(token));
 async function request(path,options={},maximum=65536){
  try{
   assert(token);
   const r=await fetchImpl(new URL(path,origin),{...options,redirect:'error',signal:AbortSignal.timeout(20000),headers:{...options.headers,'accept-encoding':'identity',authorization:`Bearer ${token}`}});
   const chunks=[];let count=0;
   try{for await(const b of r.body){count+=b.length;assert(count<=maximum);chunks.push(Buffer.from(b));}}finally{if(r.body&&!r.body.locked)await r.body.cancel();}
   return {status:r.status,bytes:Buffer.concat(chunks),etag:r.headers.get('etag'),contentType:r.headers.get('x-stored-content-type'),cacheControl:r.headers.get('x-stored-cache-control')};
  }catch{throw Error('news_gateway_request_failed');}
 }
 return {
  close(){token=null;},
  async inventoryBytes(){const start=now(),seen=new Set();let cursor='',total=0;
   for(let n=0;n<1000;n++){assert(now()-start<45000);const r=await request('/news-inventory'+(cursor?'?cursor='+encodeURIComponent(cursor):''));assert(r.status===200&&now()-start<45000);
    const p=JSON.parse(r.bytes);assert(Number.isSafeInteger(p.bytes)&&p.bytes>=0&&typeof p.truncated==='boolean');total+=p.bytes;assert(Number.isSafeInteger(total));
    if(!p.truncated)return total;assert(typeof p.cursor==='string'&&p.cursor.length>0&&p.cursor.length<=4096&&!seen.has(p.cursor));cursor=p.cursor;seen.add(cursor);
   }throw Error('inventory_limit');
  },
  async get(key){const r=await request('/news-object?key='+encodeURIComponent(key),{},limit(key));if(r.status===404)return null;assert(r.status===200&&versionOk(r.etag));return r;},
  async put(key,bytes,o){assert(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=limit(key));assert((o.ifNoneMatch==='*'&&!o.ifMatch)||(versionOk(o.ifMatch)&&!o.ifNoneMatch));
   const r=await request('/news-object?key='+encodeURIComponent(key),{method:'PUT',body:bytes,headers:o.ifMatch?{'if-match':o.ifMatch}:{'if-none-match':'*'}});assert(r.status===200&&versionOk(r.etag));return r.etag;
  }
 };
}
