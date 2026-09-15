import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { collectSummons } from './collect-summons.mjs';
import { createSession } from './auth-session.mjs';
import { prepareCandidate } from './prepare-candidate.mjs';
import { publication } from './publication.mjs';
import { publicRead } from './r2-store.mjs';
import { gatewayStore } from './gateway-store.mjs';
import { acquireSlot, inspectSlot } from './slot-lease.mjs';
import { refreshCycle } from './refresh-cycle.mjs';
import { collectHome } from './collect-home.mjs';
import { hostedCampaignRefresh } from './hosted-campaign-refresh.mjs';
import { hostedNewsRefresh } from './hosted-news-refresh.mjs';
import { loadPreviousEventArtwork } from './event-artwork-index.mjs';
import { checkRefreshHealth } from './refresh-health.mjs';

// Only fixed operation labels and HTTP status codes may leave the runner.
export function summarizeResponses(responses) {
  return responses.slice(0, 96).map(({stage, status}) => ({
    stage: stage === '/auth/nonce' ? 'nonce'
      : stage === '/auth/sign_in' ? 'sign_in'
      : stage === '/gashas' ? 'summons'
      : /^\/gashas\/[0-9]+\/featured_cards$/.test(stage) ? 'featured_cards'
      : stage === 'image' ? 'image' : 'other',
    status: Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
  }));
}

export async function run(args=process.argv.slice(2),env=process.env) {
  assert(args.length===2 && ['--validate-auth','--collect-only','--publish-staging'].includes(args[0]));
  const destination=resolve(args[1]);
  // Refuse overwrite; no raw responses or secrets are stored here.
  await mkdir(destination);
  let secret=env.HOME_GAME_AUTH_JSON;
  if(secret===undefined){
    const chunks=[];let size=0;
    for await(const chunk of process.stdin){size+=chunk.length;assert(size<=32768);chunks.push(Buffer.from(chunk));}
    secret=Buffer.concat(chunks).toString('utf8');
  }
  assert(secret.length<=32768);
  const config=JSON.parse(secret);
  if(args[0]==='--validate-auth'){createSession(config).close();return {status:'auth_config_valid',networkRequests:0};}
  let session,store;
  let phase='configuration';
  const responses=[];
  const start=Date.now();
  try {
    const collectBanners=async()=>{
      phase='collection';
      session=await createSession(config,{fetchImpl:async(url,options)=>{
        const path=new URL(url).pathname;
        const kind=path.startsWith('/banners/')?'image':path;
        try {
          const response=await fetch(url,options);
          responses.push({stage:kind,status:response.status,
            ...(kind==='image'?{mime:response.headers.get('content-type'),encoding:response.headers.get('content-encoding')}: {})});
          return response;
        }catch {responses.push({stage:kind,status:null});throw Error('request_failed');}
      }});
      try { return await collectSummons({...session,now:()=>new Date()}); }
      finally { session.close(); }
    };
    const enableEvents=env.HOME_FEED_EVENTS_ENABLED==='true';
    const enableNews=env.HOME_FEED_NEWS_ENABLED==='true';
    const collect=async()=>collectHome({collectSummons:collectBanners,config,enableEvents,enableNews,
      expectedCatalogSha256:env.HOME_FEED_EVENTS_CATALOG_SHA256,
      ...(enableEvents ? {previousArtwork:await loadPreviousEventArtwork(env.HOME_FEED_EVENTS_CATALOG_SHA256)} : {})});
    const prepare=async({observation,eventCollection,newsCollection,previousArtwork})=>{
      const candidate=await prepareCandidate(observation,Date.now(),{enableEvents,eventCollection,enableNews,newsCollection,previousArtwork});
      console.log(JSON.stringify({phase:'candidate_prepared',...candidate.summary}));
      return candidate;
    };
    if(args[0]==='--collect-only') {
      const observation=await collect();phase='preparation';
      const candidate=await prepare(observation);
      phase='local_output';
      for(const op of candidate.operations)await writeFile(resolve(destination,op.key.split('/').at(-1)),op.bytes,{flag:'wx'});
      const report={status:'candidate_only',durationMs:Date.now()-start,
        objects:candidate.operations.length,totalBytes:candidate.operations.reduce((n,o)=>n+o.sizeBytes,0),
        validUntil:new Date(candidate.validUntil).toISOString(),published:false,
        content:candidate.summary};
      await writeFile(resolve(destination,'summary.json'),JSON.stringify(report),{flag:'wx'});
      return report;
    }
    assert(env.HOME_FEED_ENABLE_PUBLICATION==='true');
    // Hosted publication must go through the server-enforced staging boundary.
    store=gatewayStore(env);
    const healthOptions={events:enableEvents,news:enableNews,
      campaigns:env.HOME_FEED_CAMPAIGNS_ENABLED==='true',newsLibrary:env.HOME_FEED_NEWS_LIBRARY_ENABLED==='true'};
    // Cheap hourly skipped ticks must not scan the full bucket or touch the game.
    const availability=await inspectSlot(store);
    if(!availability.eligible)return {status:'already_running',skipReason:availability.reason,
      health:await checkRefreshHealth(healthOptions),durationMs:Date.now()-start};
    const bytes=await store.inventoryBytes();assert(bytes+4096<8_000_000_000);
    console.log(JSON.stringify({phase:'control_preflight',maxWriteBytes:4096,bucketBytes:bytes}));
    const pub=publication(store,publicRead);
    let skipReason;
    const result=await refreshCycle({acquireLease:()=>acquireSlot(store,Date.now,{onSkip:reason=>{skipReason=reason;}}),collect,prepare,
      refreshCampaigns:hostedCampaignRefresh(env,config),
      refreshNews:hostedNewsRefresh(env,config),
      plan:async (candidate,lease)=>{const plan=await pub.plan(candidate,lease);console.log(JSON.stringify({phase:'preflight',...plan}));return plan;},
      publish:pub.publish});
    const health=result.status==='failed'?undefined:await checkRefreshHealth(healthOptions);
    return {...result,...(skipReason?{skipReason}:{}),...(health?{health}:{}),...(result.status==='failed'?{responses:summarizeResponses(responses)}:{}),
      durationMs:Date.now()-start};
  } catch {
    console.error(JSON.stringify({status:'failed',phase,responses:summarizeResponses(responses),durationMs:Date.now()-start}));
    throw Error('refresh_failed');
  } finally {session?.close();store?.close();}
}

// Preserve the successful Home receipt while exposing partial failure to the host.
// This is an exit status only: it must not retry or undo any publication.
export function refreshExitCode(result) {
  return result.status === 'failed' || result.health?.fresh === false || result.campaigns?.status === 'failed' || result.news?.status === 'failed' ? 1 : 0;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try {const result=await run();console.log(JSON.stringify(result));process.exitCode=refreshExitCode(result);}
  catch {console.error(JSON.stringify({status:'failed',reason:'refresh_stopped_no_retry'}));process.exitCode=1;}
}
