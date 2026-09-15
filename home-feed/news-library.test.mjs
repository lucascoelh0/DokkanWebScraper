import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {collectNewsLibrary,preparedNewsLibrary,projectNewsArticle} from './news-library.mjs';
import {createSession} from './auth-session.mjs';
import sharp from 'sharp';
import {planNewsLibrary,publishNewsLibrary} from './publish-news-library.mjs';
const schema=JSON.parse(readFileSync(new URL('./contracts/news-library-v1.schema.json',import.meta.url)));
// Small test-only evaluator for the explicitly used schema vocabulary. Unknown keywords
// are not introduced here; schema authority remains the versioned artifact above.
function matches(value,s){
 if(s.$ref){assert(s.$ref.startsWith('#/$defs/'));return matches(value,schema.$defs[s.$ref.split('/').at(-1)]);}
 if(s.oneOf)return s.oneOf.filter(x=>matches(value,x)).length===1;
 if('const'in s&&value!==s.const)return false;
 if(s.type==='null')return value===null;
 if(s.type==='integer')return Number.isSafeInteger(value)&&value>=s.minimum&&value<=s.maximum;
 if(s.type==='string')return typeof value==='string'&&(!s.pattern||new RegExp(s.pattern).test(value))&&(s.minLength==null||value.length>=s.minLength)&&(s.maxLength==null||value.length<=s.maxLength)&&(!s.format||Number.isFinite(Date.parse(value)));
 if(s.type==='array')return Array.isArray(value)&&value.length<=s.maxItems&&value.every(v=>matches(v,s.items));
 if(s.type==='object')return value!==null&&typeof value==='object'&&!Array.isArray(value)&&s.required.every(k=>Object.hasOwn(value,k))&&Object.entries(value).every(([k,v])=>s.properties[k]?matches(v,s.properties[k]):s.additionalProperties!==false);
 return true;
}
const at=Date.parse('2026-09-14T22:00:00Z');
const config={nonceHeaders:{authorization:'Basic test'},loginHeaders:{authorization:'Basic test'},loginBody:{account_id:'PRIVATE'},apiHeaders:{}};
const json=x=>new Response(JSON.stringify(x),{headers:{'content-type':'application/json'}});
const signed='https://cf.ishin-global.aktsk.com/banners/en/news/inside.png?Signature=PRIVATE';
async function transport(count=91){
 const png=await sharp({create:{width:20,height:10,channels:4,background:'#ffffff'}}).png().toBuffer();
 const calls=[];
 const fetchImpl=async(url)=>{const path=new URL(url).pathname;calls.push(path);
  if(path==='/auth/nonce')return json({auth_transaction_id:'PRIVATE'});
  if(path==='/auth/sign_in')return json({access_token:'PRIVATE',token_type:'bearer'});
  if(path==='/announcements')return json({announcements:Array.from({length:count},(_,i)=>({id:i+1,category:0,announcement_tab_id:1,title:'News '+i,summary:'',start_at:100,banner:null}))});
  if(/^\/announcements\/\d+$/.test(path))return json({announcement:{id:Number(path.split('/').at(-1)),bodies:[{layout_type:0,image:signed,description:'{color:#FFFF00}Offer{color}\n\nBody'}]}});
  if(url===signed)return new Response(png,{headers:{'content-type':'image/png'}});
  throw Error('unexpected');
 };return {fetchImpl,calls};
}
test('library lists91 announcements separately and delivers image/text order; schema validates all bytes',async()=>{
 const io=await transport();const c=await collectNewsLibrary({config},{fetchImpl:io.fetchImpl,now:()=>at});
 assert.equal(c.status,'collected');assert.equal(c.count,91);assert.equal(c.articleCount,91);assert.equal(c.imageCount,1);
 const p=preparedNewsLibrary(c,at);assert(matches(p.index,schema.$defs.index));
 assert.equal(p.operations.filter(o=>o.contentType==='image/png').length,1);
 for(const o of p.operations.filter(o=>o.key.includes('/articles/'))){const b=JSON.parse(o.bytes);assert(matches(b,schema.$defs.article));assert.deepEqual(b.blocks.map(b=>b.kind),['image','text']);assert(!o.bytes.includes(Buffer.from('PRIVATE')));}
 assert.equal(io.calls.filter(p=>p.startsWith('/announcements/')).length,91);
 assert.throws(()=>preparedNewsLibrary({...c},at));assert.throws(()=>preparedNewsLibrary(c,at+21600000));
});
test('index above100 remains listed with explicit unavailable details',async()=>{
 const io=await transport(101);const c=await collectNewsLibrary({config},{fetchImpl:io.fetchImpl,now:()=>at});
 assert.equal(c.count,101);assert.equal(c.articleCount,100);assert.equal(preparedNewsLibrary(c,at).index.items.filter(i=>i.detail===null).length,1);
});
test('unknown layout keeps text but does not invent media ordering',async()=>{
 const body=await projectNewsArticle({announcement:{id:1,bodies:[{layout_type:99,image:signed,description:'Known text'}]}},1,()=>{throw Error();});
 assert.deepEqual(body.blocks,[{kind:'unavailable'},{kind:'text',markup:'Known text'}]);
 await assert.rejects(()=>projectNewsArticle({announcement:{id:2,bodies:[]}},1,()=>null));
});
test('news library refuses unobserved assets, routes and repeated detail IDs',async()=>{
 for(const op of [s=>s.fetchImage(signed),s=>s.requestApi('/events'),s=>s.requestApi('/announcements/999')]){
  const io=await transport(1);const s=createSession(config,{apiScope:'news-library',fetchImpl:io.fetchImpl});await s.requestApi('/announcements');const n=io.calls.length;await assert.rejects(()=>op(s));assert.equal(io.calls.length,n);s.close();
 }
 const io=await transport(1);const s=createSession(config,{apiScope:'news-library',fetchImpl:io.fetchImpl});await s.requestApi('/announcements');await s.requestApi('/announcements/1');await s.fetchImage(signed);await assert.rejects(()=>s.requestApi('/announcements/1'));s.close();
});
test('timeouts and malformed inputs do not return a publishable library',async()=>{
 const io=await transport();let time=at;
 const c=await collectNewsLibrary({config},{now:()=>time,fetchImpl:async(...a)=>{const r=await io.fetchImpl(...a);time+=180000;return r;}});assert.equal(c.status,'unavailable');
});

async function releaseFixture(){
 const io=await transport(1);const collection=await collectNewsLibrary({config},{fetchImpl:io.fetchImpl,now:()=>at});
 const objects=new Map(),writes=[];
 const store={inventoryBytes:async()=>1000,get:async key=>objects.get(key)??null,put:async(key,bytes,options)=>{
  const previous=objects.get(key);assert(previous?options.ifMatch===previous.etag:options.ifNoneMatch==='*');
  objects.set(key,{bytes,etag:String(writes.length),contentType:options.contentType,cacheControl:options.cacheControl});writes.push(key);
 }};
 return {collection,objects,writes,store,lease:{assertOwned:async()=>{}},publicRead:async key=>objects.get(key).bytes,now:()=>at};
}
test('release is conditional, manifest-last, verifies public bytes and consumes plan once',async()=>{
 const f=await releaseFixture();const plan=await planNewsLibrary(f.collection,f.store,at);
 assert(plan.writeBytes>0);await publishNewsLibrary(f.collection,plan,f);
 assert(f.writes.at(-1).endsWith('/manifest.json'));
 await assert.rejects(()=>publishNewsLibrary(f.collection,plan,f));
 const repeat=await planNewsLibrary(f.collection,f.store,at);assert.equal(repeat.writeBytes,0);
 const image=[...f.objects.keys()].find(k=>k.endsWith('.png'));f.objects.get(image).contentType='text/plain';
 const repair=await planNewsLibrary(f.collection,f.store,at);assert(repair.writeBytes>0);await publishNewsLibrary(f.collection,repair,f);
 assert.equal(f.objects.get(image).contentType,'image/png');
});
test('lease loss and corrupted public response prevent manifest publication',async()=>{
 for(const mode of ['lease','public','write']){
  const f=await releaseFixture();const plan=await planNewsLibrary(f.collection,f.store,at);
  if(mode==='lease')f.lease.assertOwned=async()=>{throw Error('lost');};
  if(mode==='public')f.publicRead=async()=>Buffer.from('corrupt');
  if(mode==='write')f.store.put=async()=>{throw Error('CAS failed');};
  await assert.rejects(()=>publishNewsLibrary(f.collection,plan,f));
  assert(!f.writes.some(k=>k.endsWith('/manifest.json')));
 }
});
