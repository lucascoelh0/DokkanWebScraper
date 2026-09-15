import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const BASE = 'https://assets.dkbcompanion.com/staging/v2/';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

/** Read-only metadata-contract/freshness check; not a full image/detail audit. */
export async function checkRefreshHealth({events=false,news=false,campaigns=false,newsLibrary=false}={},
  {fetchImpl=fetch,now=Date.now,signal=AbortSignal.timeout(20000)}={}) {
  const problems=[];
  async function read(path,maximum) {
    signal.throwIfAborted();
    const response=await fetchImpl(BASE+path,{redirect:'error',signal,headers:{'cache-control':'no-cache','accept-encoding':'identity'}});
    assert(response.status===200&&response.body);
    const chunks=[];let size=0;const reader=response.body.getReader();
    try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;assert(size<=maximum);chunks.push(Buffer.from(value));}}
    finally {await reader.cancel();}
    return Buffer.concat(chunks);
  }
  async function snapshot(section) {
    const manifest=JSON.parse(await read(section+'/manifest.json',4096));
    assert(manifest.schemaVersion===1);
    if(section==='campaigns')assert(manifest.contract==='dokkan-campaign-manifest'&&manifest.region==='global');
    assert(/^[a-f0-9]{64}$/.test(manifest.sha256));
    assert(manifest.file===(section==='home'?'':'index/')+manifest.sha256+'.json');
    const limit=section==='home'?65536:section==='campaigns'?32768:262144;
    assert(Number.isSafeInteger(manifest.sizeBytes)&&manifest.sizeBytes>0&&manifest.sizeBytes<=limit);
    const bytes=await read(section+'/'+manifest.file,manifest.sizeBytes);
    assert(bytes.length===manifest.sizeBytes&&sha(bytes)===manifest.sha256);
    const value=JSON.parse(bytes);
    assert(section==='campaigns'?[1,2].includes(value.schemaVersion):value.schemaVersion===1);
    if(section==='home') {
      assert(Array.isArray(value.summons)&&value.summons.length<=40);
      assert(value.summons.every(row=>typeof row.id==='string'&&typeof row.title==='string'&&row.title.length>0&&row.action==='catalog'&&
        /^https:\/\/assets\.dkbcompanion\.com\/staging\/v2\/home\/images\/[a-f0-9]{64}\.png$/.test(row.imageUrl)));
    } else if(section==='news') {
      assert(value.coverage==='api-observation'&&Array.isArray(value.items)&&value.items.length<=500);
      assert(value.items.every(row=>/^[1-9][0-9]{0,8}$/.test(row.id)&&typeof row.title==='string'&&typeof row.summary==='string'));
    } else {
      assert(value.contract==='dokkan-campaign-index'&&value.region==='global'&&value.source==='global-game-campaigns'&&
        value.coverage==='partial-observation'&&value.contentSemantics==='mission-definitions'&&/^[a-f0-9]{64}$/.test(value.revisionSha256));
      assert(Array.isArray(value.campaigns)&&value.campaigns.length<=100);
      assert(value.campaigns.every(row=>Number.isSafeInteger(row.id)&&row.id>0&&row.destination?.type==='campaign-detail'&&
        row.destination.campaignId===row.id&&/^[a-f0-9]{64}$/.test(row.detail?.sha256)&&row.destination.detailSha256===row.detail.sha256));
    }
    return value;
  }
  function fresh(value,section) {
    const start=Date.parse(value?.observedAt??value?.generatedAt),end=Date.parse(value?.validUntil);
    const collection=section==='events'||section==='news';
    if(!(Number.isFinite(start)&&start<=now()&&now()<end)||
      (collection&&(!Array.isArray(value?.items)||value?.schemaVersion!==1)))problems.push(section);
  }
  try {const home=await snapshot('home');fresh(home,'home');
    if(events)fresh(home.eventSchedule,'events');if(news)fresh(home.news,'news');
  }catch{problems.push('home_unavailable');}
  for(const section of [...(campaigns?['campaigns']:[]),...(newsLibrary?['news']:[])]){
    try {fresh(await snapshot(section),section==='news'?'news_library':section);}
    catch{problems.push(section+'_unavailable');}
  }
  return {fresh:problems.length===0,problems};
}
