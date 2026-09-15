import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSession} from './auth-session.mjs';
import {projectAnnouncements} from './project-announcements.mjs';
import {prepareNewsArtwork} from './news-artwork.mjs';

export const NEWS_PREFIX='staging/v2/news/';
const hash=b=>createHash('sha256').update(b).digest('hex');
const trusted=new WeakMap();
const encode=x=>Buffer.from(JSON.stringify(x));

/** Preserve first-party array order. Images precede text for observed layout 0. */
export async function projectNewsArticle(payload,expectedId,resolveImage) {
 const a=payload?.announcement;
 assert(a?.id===expectedId&&Array.isArray(a.bodies)&&a.bodies.length<=30);
 const blocks=[];let length=0;
 for(const b of a.bodies){
  assert(b&&typeof b.description==='string'&&b.description.length<=24000);
  length+=Buffer.byteLength(b.description);assert(length<=128*1024);
  if(b.layout_type!==0) blocks.push({kind:'unavailable'});
  else if(b.image){
   assert(typeof b.image==='string');
   const image=await resolveImage(b.image);
   blocks.push(image?{kind:'image',image}:{kind:'unavailable'});
  }
  // Native game markup is data, not executable HTML. Never publish URLs from text.
  const markup=b.description.replace(/\r\n?/g,'\n').replace(/https?:\/\/[^\s<>"{}]+/g,'[link unavailable]').trim();
  assert(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(markup));
  if(markup)blocks.push({kind:'text',markup});
 }
 return {schemaVersion:1,id:String(expectedId),blocks};
}

/** One bounded library observation, separate from Home's preview and byte budget. */
export async function collectNewsLibrary({config},{fetchImpl=fetch,now=Date.now}={}) {
 let session,timer;
 try{
  const observed=now();assert(Number.isSafeInteger(observed)&&observed>1230768000000);
  const check=()=>assert(now()>=observed&&now()-observed<180000);
  session=createSession(config,{apiScope:'news-library',fetchImpl});
  timer=setTimeout(()=>session.close(),180000);
  const response=await session.requestApi('/announcements');check();
  const rows=projectAnnouncements(response.body).announcements.filter(r=>r.startsAt*1000<=observed);
  const raw=new Map(response.body.announcements.map(r=>[r.id,r]));
  const operations=new Map(),images=new Map();let total=0;
  const add=(path,bytes,contentType)=>{
   const key=NEWS_PREFIX+path;
   if(!operations.has(key)){total+=bytes.length;assert(total<=64*1024*1024);operations.set(key,{key,bytes,sizeBytes:bytes.length,sha256:hash(bytes),contentType});}
  };
  const resolveImage=async url=>{
   const parsed=new URL(url);assert(parsed.protocol==='https:'&&parsed.hostname==='cf.ishin-global.aktsk.com'&&!parsed.username&&!parsed.password&&!parsed.port&&!parsed.hash&&/^\/banners\/en\/news\/[A-Za-z0-9_-]+\.png$/.test(parsed.pathname));
   const identity=parsed.pathname;
   if(!images.has(identity)){
    if(images.size>=256)return null;
    const prepared=await prepareNewsArtwork(await session.fetchImage(url));check();
    add('images/'+prepared.descriptor.sha256+'.png',prepared.bytes,'image/png');images.set(identity,prepared.descriptor);
   }
   return images.get(identity);
  };
  const items=[];
  for(const [position,row] of rows.entries()){
   check();const image=raw.get(row.id).banner?await resolveImage(raw.get(row.id).banner):null;
   let detail=null;
   if(position<100){
    const response=await session.requestApi('/announcements/'+row.id);check();
    const article=await projectNewsArticle(response.body,row.id,resolveImage);
    const bytes=encode(article);assert(bytes.length<=262144);
    detail={sha256:hash(bytes),sizeBytes:bytes.length};add('articles/'+detail.sha256+'.json',bytes,'application/json');
   }
   items.push({id:String(row.id),title:row.title,summary:row.summary,category:row.category,...(row.tabId==null?{}:{tabId:row.tabId}),publishedAt:new Date(row.startsAt*1000).toISOString(),image,detail});
  }
  const index={schemaVersion:1,coverage:'api-observation',observedAt:new Date(observed).toISOString(),validUntil:new Date(observed+21600000).toISOString(),items};
  const bytes=encode(index);assert(bytes.length<=1024*1024);
  const file='index/'+hash(bytes)+'.json';add(file,bytes,'application/json');
  add('manifest.json',encode({schemaVersion:1,file,sha256:hash(bytes),sizeBytes:bytes.length}),'application/json');
  const result=Object.freeze({status:'collected',count:items.length,articleCount:items.filter(x=>x.detail).length,imageCount:images.size,totalBytes:total});
  trusted.set(result,{index,operations:[...operations.values()],validUntil:observed+21600000});return result;
 }catch{return {status:'unavailable'};}finally{clearTimeout(timer);session?.close();}
}

export function preparedNewsLibrary(collection,now=Date.now()){
 const value=trusted.get(collection);assert(value&&now>=Date.parse(value.index.observedAt)&&now<value.validUntil);
 return {index:structuredClone(value.index),validUntil:value.validUntil,operations:value.operations.map(o=>({...o,bytes:Buffer.from(o.bytes)}))};
}
