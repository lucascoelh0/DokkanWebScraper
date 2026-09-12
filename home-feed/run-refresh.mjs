import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { collectSummons } from './collect-summons.mjs';
import { createSession } from './auth-session.mjs';
import { prepareCandidate } from './prepare-candidate.mjs';
import { publication } from './publication.mjs';
import { r2Store, publicRead } from './r2-store.mjs';
import { acquireSlot } from './slot-lease.mjs';
import { refreshCycle } from './refresh-cycle.mjs';

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
    const collect=async()=>{
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
      return collectSummons({...session,now:()=>new Date()});
    };
    if(args[0]==='--collect-only') {
      const observation=await collect();phase='preparation';
      const candidate=await prepareCandidate(observation);
      phase='local_output';
      for(const op of candidate.operations)await writeFile(resolve(destination,op.key.split('/').at(-1)),op.bytes,{flag:'wx'});
      const report={status:'candidate_only',durationMs:Date.now()-start,
        objects:candidate.operations.length,totalBytes:candidate.operations.reduce((n,o)=>n+o.sizeBytes,0),
        validUntil:new Date(candidate.validUntil).toISOString(),published:false};
      await writeFile(resolve(destination,'summary.json'),JSON.stringify(report),{flag:'wx'});
      return report;
    }
    assert(env.HOME_FEED_ENABLE_PUBLICATION==='true');
    store=r2Store(env);
    const bytes=await store.inventoryBytes();assert(bytes+4096<8_000_000_000);
    console.log(JSON.stringify({phase:'control_preflight',maxWriteBytes:4096,bucketBytes:bytes}));
    const pub=publication(store,publicRead);
    const result=await refreshCycle({acquireLease:()=>acquireSlot(store),collect,prepare:prepareCandidate,
      plan:async candidate=>{const plan=await pub.plan(candidate);console.log(JSON.stringify({phase:'preflight',...plan}));return plan;},
      publish:pub.publish});
    return {...result,durationMs:Date.now()-start};
  } catch {
    console.error(JSON.stringify({status:'failed',phase,responses,durationMs:Date.now()-start}));
    throw Error('refresh_failed');
  } finally {session?.close();store?.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try {const result=await run();console.log(JSON.stringify(result));if(result.status==='failed')process.exitCode=1;}
  catch {console.error(JSON.stringify({status:'failed',reason:'refresh_stopped_no_retry'}));process.exitCode=1;}
}
