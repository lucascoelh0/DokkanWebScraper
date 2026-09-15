import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, summarizeResponses, refreshExitCode } from './run-refresh.mjs';
import sharp from 'sharp';
import { createHash } from 'node:crypto';

test('collect-only runner gates complete news and official artwork without publishing', async t => {
  const root = await mkdtemp(join(tmpdir(), 'home-news-runner-'));
  const image = await sharp({ create: { width: 20, height: 10, channels: 4, background: '#ff8800' } }).png().toBuffer();
  let newsCalls = 0;
  t.mock.method(console, 'log', () => {});
  t.mock.method(globalThis, 'fetch', async url => {
    const path = new URL(url).pathname;
    if (path === '/auth/nonce') return Response.json({ auth_transaction_id: 'PRIVATE' });
    if (path === '/auth/sign_in') return Response.json({ access_token: 'PRIVATE', token_type: 'bearer' });
    if (path === '/gashas') return Response.json({ gashas: [] });
    if (path === '/announcements') {
      newsCalls++;
      return Response.json({ announcements: [{ id: 1, category: 0, title: 'Test news', summary: '',
        start_at: Math.floor(Date.now() / 1000) - 60, banner: 'https://cf.ishin-global.aktsk.com/banners/en/news/test.png?Signature=PRIVATE' }] });
    }
    if (path === '/announcements/1') return Response.json({ announcement: { id: 1, bodies: [{ description: 'Complete text' }] } });
    if (path === '/banners/en/news/test.png') return new Response(image);
    throw Error('Unexpected request');
  });
  try {
    for (const flag of ['false', 'true']) {
      const destination = join(root, flag);
      await run(['--collect-only', destination], { HOME_FEED_NEWS_ENABLED: flag,
        HOME_GAME_AUTH_JSON: JSON.stringify({ nonceHeaders: { authorization: 'Basic test' }, loginHeaders: { authorization: 'Basic test' }, loginBody: {}, apiHeaders: {} }) });
      const manifest = JSON.parse(await readFile(join(destination, 'manifest.json')));
      const payload = JSON.parse(await readFile(join(destination, manifest.file)));
      assert.equal(!!payload.news, flag === 'true');
      if (flag === 'true') {
        assert.deepEqual(payload.news.items[0].paragraphs, ['Complete text']);
        assert.match(payload.news.items[0].imageUrl, /^https:\/\/assets.dkbcompanion.com\/staging\/v2\/home\/images\/[a-f0-9]{64}\.png$/);
        const imageFile = payload.news.items[0].imageUrl.split('/').at(-1);
        const delivered = await readFile(join(destination, imageFile));
        assert.equal(createHash('sha256').update(delivered).digest('hex'), imageFile.slice(0, -4));
        assert.ok(!JSON.stringify(payload).includes('PRIVATE'));
      }
    }
    assert.equal(newsCalls, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('host exit status exposes partial campaign failure without changing the Home receipt', () => {
  const result = Object.freeze({status:'success',campaigns:Object.freeze({status:'failed'})});
  assert.equal(refreshExitCode(result),1);
  assert.equal(result.status,'success');
  assert.equal(refreshExitCode({status:'failed'}),1);
  for(const status of ['success','candidate_only','not_due','already_running','disabled']) {
    assert.equal(refreshExitCode({status}),0);
  }
  for(const status of ['published','disabled','already_attempted']) {
    assert.equal(refreshExitCode({status:'success',campaigns:{status}}),0);
  }
});

test('failure diagnostics keep only bounded operation labels and HTTP codes',()=>{
  const rows=[{stage:'/auth/nonce',status:200},{stage:'/auth/sign_in',status:401},
    {stage:'/gashas',status:200},{stage:'/gashas/12345/featured_cards',status:503},
    {stage:'image',status:null,mime:'PRIVATE'},
    {stage:'/PRIVATE?token=PRIVATE',status:999,body:'PRIVATE'}];
  assert.deepEqual(summarizeResponses(rows),[
    {stage:'nonce',status:200},{stage:'sign_in',status:401},
    {stage:'summons',status:200},{stage:'featured_cards',status:503},
    {stage:'image',status:null},{stage:'other',status:null}]);
  assert.equal(summarizeResponses(Array(100).fill(rows[0])).length,96);
  assert.equal(JSON.stringify(summarizeResponses(rows)).includes('PRIVATE'),false);
});

test('collection failure reports safe response statuses without retry',async t=>{
  const root=await mkdtemp(join(tmpdir(),'home-refresh-failure-'));
  const logs=[];let calls=0;
  t.mock.method(console,'error',line=>logs.push(JSON.parse(line)));
  t.mock.method(globalThis,'fetch',async()=>{
    calls++;
    return new Response('PRIVATE response',{status:401,headers:{'content-type':'application/json'}});
  });
  try {
    await assert.rejects(run(['--collect-only',join(root,'candidate')],{
      HOME_GAME_AUTH_JSON:JSON.stringify({nonceHeaders:{authorization:'Basic test'},
        loginHeaders:{authorization:'Basic test'},loginBody:{account_id:'PRIVATE'},apiHeaders:{}}),
    }),/refresh_failed/);
    assert.equal(calls,1);
    assert.deepEqual(logs[0].responses,[{stage:'nonce',status:401}]);
    assert.equal(JSON.stringify(logs).includes('PRIVATE'),false);
  } finally {await rm(root,{recursive:true,force:true});}
});

test('hosted coordinator returns safe collection diagnostics without publishing',async t=>{
  const root=await mkdtemp(join(tmpdir(),'home-hosted-failure-'));
  let stored=null,version=0,gameCalls=0;
  const writes=[];
  t.mock.method(Date,'now',()=>1789257600000);
  t.mock.method(console,'log',()=>{});
  t.mock.method(globalThis,'fetch',async(url,options={})=>{
    const target=new URL(url);
    if(target.hostname==='test.test.workers.dev') {
      if(target.pathname==='/inventory')return Response.json({bytes:100,truncated:false});
      const key=target.searchParams.get('key');
      assert.match(key,/^staging\/v2\/home\/runs\/[0-9]+\.json$/);
      if(options.method==='PUT') {
        writes.push(key);stored=Buffer.from(options.body);version++;
        return new Response('',{headers:{etag:`"${version}"`}});
      }
      return stored?new Response(stored,{headers:{etag:`"${version}"`}}):new Response('',{status:404});
    }
    gameCalls++;
    return new Response('PRIVATE',{status:401,headers:{'content-type':'application/json'}});
  });
  try {
    const result=await run(['--publish-staging',join(root,'candidate')],{
      HOME_GAME_AUTH_JSON:JSON.stringify({nonceHeaders:{authorization:'Basic test'},
        loginHeaders:{authorization:'Basic test'},loginBody:{account_id:'PRIVATE'},apiHeaders:{}}),
      HOME_FEED_ENABLE_PUBLICATION:'true',HOME_GATEWAY_URL:'https://test.test.workers.dev',
      HOME_GATEWAY_TOKEN:'a'.repeat(64),
    });
    assert.equal(result.status,'failed');assert.equal(result.phase,'collection');
    assert.deepEqual(result.responses,[{stage:'nonce',status:401}]);
    assert.equal(gameCalls,1);assert.equal(writes.length,3);
    assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
  } finally {await rm(root,{recursive:true,force:true});}
});

test('collect-only logs prepared counts without claiming publication or leaking private failures',async t=>{
  const root=await mkdtemp(join(tmpdir(),'home-refresh-report-'));
  const logs=[];
  t.mock.method(console,'log',line=>logs.push(JSON.parse(line)));
  t.mock.method(globalThis,'fetch',async url=>{
    const target=new URL(url);
    if(target.pathname==='/staging/v2/home/manifest.json')return new Response('',{status:404});
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
