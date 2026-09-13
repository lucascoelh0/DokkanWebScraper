import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from './run-refresh.mjs';

test('collect-only logs prepared counts without claiming publication or leaking private failures',async t=>{
  const root=await mkdtemp(join(tmpdir(),'home-refresh-report-'));
  const logs=[];
  t.mock.method(console,'log',line=>logs.push(JSON.parse(line)));
  t.mock.method(globalThis,'fetch',async url=>{
    const target=new URL(url);
    if(target.hostname==='assets.dkbcompanion.com')throw Error('PRIVATE catalog response');
    const body=target.pathname==='/auth/nonce'?{auth_transaction_id:'PRIVATE nonce'}
      :target.pathname==='/auth/sign_in'?{access_token:'PRIVATE-token',token_type:'bearer'}
      :target.pathname==='/gashas'?{gashas:[]}:null;
    assert.notEqual(body,null);
    return new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
  });
  const config={nonceHeaders:{authorization:'Basic test'},loginHeaders:{authorization:'Basic test'},
    loginBody:{account_id:'PRIVATE account'},apiHeaders:{}};
  try {
    const destination=join(root,'candidate');
    const result=await run(['--collect-only',destination],{
      HOME_GAME_AUTH_JSON:JSON.stringify(config),HOME_FEED_EVENTS_ENABLED:'true',
      HOME_FEED_EVENTS_CATALOG_SHA256:'a'.repeat(64),
    });
    assert.equal(result.status,'candidate_only');
    assert.equal(result.published,false);
    assert.equal(result.content.eventsStatus,'unavailable');
    assert.equal(result.content.summonsCount,0);
    assert.deepEqual(logs,[{phase:'candidate_prepared',...result.content}]);
    assert.equal(JSON.stringify(logs).includes('PRIVATE'),false);
    assert.deepEqual(JSON.parse(await readFile(join(destination,'summary.json'),'utf8')),result);
    const manifest=JSON.parse(await readFile(join(destination,'manifest.json'),'utf8'));
    assert.equal(manifest.sha256,result.content.payloadSha256);
    assert.equal(manifest.sizeBytes,result.content.payloadBytes);
    const payload=JSON.parse(await readFile(join(destination,manifest.file),'utf8'));
    assert.equal('summary' in payload,false);
    assert.equal('eventsStatus' in payload,false);
  } finally { await rm(root,{recursive:true,force:true}); }
});
