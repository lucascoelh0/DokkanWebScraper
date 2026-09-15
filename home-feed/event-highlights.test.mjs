import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { eventCategory, projectBurstPeriods, isHomeHighlight } from './event-highlights.mjs';
import { projectEvents } from './project-events.mjs';
import { prepareEventSection } from './prepare-events.mjs';
const at = Date.parse('2026-09-14T12:00:00.000Z'), now = new Date(at).toISOString(), sec=at/1000;
const root = {id:49,area_id:507,genkai_battle_schedule_id:54,start_at:sec-86400,end_at:sec+86400};
const body = (rows=[root]) => ({genkai_battles:{expire_at:sec+3600,genkai_battles:rows}});
function collection(category='growth',burst=true) {
  const catalogBytes=Buffer.from(JSON.stringify({schemaVersion:1,contract:'dokkan-stage-delivery',source:'dokkan-game-db',
    entries:[{kind:'quest-level',id:'5070011',areaId:'507',questId:'507001',browseCategory:category}]}));
  const catalogSha256=createHash('sha256').update(catalogBytes).digest('hex');
  // Ordinary daily rotation already ended; Burst remains explicitly active.
  const bodyBytes=Buffer.from(JSON.stringify({events:[{id:999,quests:[{id:507001}],start_at:sec-864000,end_at:sec+864000,
    wday:['monday'],wday_start_at:sec-86401,wday_end_at:sec-1}],z_battle_stages:[]}));
  const p=projectEvents({bodyBytes,catalogBytes,catalogSha256,status:200,endpoint:'/events',observedAt:now,now,
    ...(burst?{burstBodyBytes:Buffer.from(JSON.stringify(body()))}:{})});
  return {status:'collected',projection:p,receipt:{source:'fresh-global-events-session',requestStartedAt:now,receivedAt:now,
    catalogSha256,normalizedBodySha256:p.observationSha256,burstBodySha256:p.burstObservationSha256}};
}
test('only requested event families and active Burst growth are highlights',()=>{
  for(const type of ['bonus','challenge','limited','z-battles']) assert(isHomeHighlight(type,null));
  for(const type of ['story','db-story','quests','unknown','growth']) assert(!isHomeHighlight(type,null));
  assert(isHomeHighlight('growth',root));
  assert(!isHomeHighlight('story',root));
  assert.equal(eventCategory([{browseCategory:'story'},{browseCategory:'challenge'}],'event'),'unknown');
});
test('Burst identity and period are separate from daily rotation and base event identity',()=>{
  const c=collection();const out=prepareEventSection(c,at);
  assert.equal(out.items.length,1);
  const item=out.items[0];
  assert.equal(item.id,'event:999');assert.equal(item.target.id,'507');
  assert.equal(item.burstMode.id,'49');assert.equal(item.burstMode.scheduleId,'54');
  assert.equal(item.eventEndsAt,null);assert.equal(item.eventStartsAt,undefined);
  assert.equal(item.availableUntil,new Date(at+3600000).toISOString());
  assert.equal(prepareEventSection(c,at+3600000).items.length,0);
  assert.equal(prepareEventSection(collection('growth',false),at).items.length,0);
  assert.equal(prepareEventSection(collection('story'),at).items.length,0);
});
test('Burst metadata must be bound to its own fresh receipt',()=>{
  const c=collection();delete c.receipt.burstBodySha256;
  assert.equal(prepareEventSection(c,at),null);
});
test('source expiry, ended/future/invalid periods and conflicting active roots never highlight',()=>{
  for(const extra of [{start_at:sec+1},{end_at:sec},{end_at:2145916800},{area_id:'507'},{genkai_battle_schedule_id:0}])
    assert.equal(projectBurstPeriods(body([{...root,...extra}]),now,now).size,0);
  assert.equal(projectBurstPeriods({genkai_battles:{...body().genkai_battles,expire_at:sec}},now,now).size,0);
  assert.equal(projectBurstPeriods(body([root,{...root,id:50}]),now,now).size,0);
  assert.equal(projectBurstPeriods(body(),now,new Date(at+21600000).toISOString()).size,0);
});
test('account flags do not create novelty or leak into public Burst metadata',()=>{
  const projected=projectBurstPeriods(body([{...root,is_new:true,previous_score:'PRIVATE',listbutton_image:'PRIVATE'}]),now,now);
  assert(!JSON.stringify([...projected.values()]).includes('PRIVATE'));
  assert.equal(projected.get('507').startsAt,new Date(root.start_at*1000).toISOString());
});
