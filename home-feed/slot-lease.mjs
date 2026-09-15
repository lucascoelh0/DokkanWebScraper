import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PREFIX } from './prepare-candidate.mjs';
import { REFRESH_INTERVAL_MS } from './refresh-cycle.mjs';

export async function inspectSlot(store, now=Date.now, {manualRecovery=false}={}) {
  const started=now(),slot=Math.floor(started/REFRESH_INTERVAL_MS);
  const end=(slot+1)*REFRESH_INTERVAL_MS;
  if(end-started<20*60*1000)return {eligible:false,reason:'slot_boundary'};
  const previous=await store.get(PREFIX+`runs/${slot}.json`);
  if(previous){
    if(!manualRecovery)return {eligible:false,reason:'slot_reserved'};
    let state;
    try {state=JSON.parse(previous.bytes);} catch {return {eligible:false,reason:'invalid_reservation'};}
    if(!state || typeof state!=='object' || Array.isArray(state))return {eligible:false,reason:'invalid_reservation'};
    // Only a known failed collection can authorize another login. Publication
    // failures use the still-owned in-process candidate, never a fresh login.
    if(state.status!=='failed' || state.phase!=='collection')return {eligible:false,reason:'not_recoverable'};
    if(!Number.isSafeInteger(state.deadline) || started<=state.deadline)return {eligible:false,reason:'lease_active'};
    if(state.manualRecoveries!=null && state.manualRecoveries!==0)return {eligible:false,reason:'recovery_exhausted'};
    return {eligible:true,started,slot,previousEtag:previous.etag,manualRecoveries:1};
  }
  return {eligible:true,started,slot};
}

/** Scheduled ticks never reclaim. One explicit manual recovery may replace a
 * failed collection only after its ownership deadline, using compare-and-swap.
 * Host must enforce a 15-minute process timeout. Conditional manifest promotion
 * independently protects against stale publication; this lock limits login load.
 */
export async function acquireSlot(store, now=Date.now, {onSkip=()=>{},manualRecovery=false} = {}) {
  const availability=await inspectSlot(store,now,{manualRecovery});
  if(!availability.eligible){onSkip(availability.reason);return null;}
  const {started,slot}=availability;
  const key=PREFIX+`runs/${slot}.json`;
  const owner=randomUUID(),deadline=started+15*60*1000;
  const manualRecoveries=availability.manualRecoveries??0;
  let state={owner,deadline,status:'reserved',manualRecoveries},etag;
  // Caller reports this <=4 KiB control write before invoking acquisition.
  etag=await store.put(key,Buffer.from(JSON.stringify(state)),{
    ...(availability.previousEtag?{ifMatch:availability.previousEtag}:{ifNoneMatch:'*'}),
    contentType:'application/json',cacheControl:'no-store'});
  async function assertOwned(){
    assert(now()<deadline);const current=await store.get(key);
    assert(current?.etag===etag && JSON.parse(current.bytes).owner===owner);
  }
  async function writeState(next){
    await assertOwned();state={...next,owner,deadline,manualRecoveries};
    const bytes=Buffer.from(JSON.stringify(state));assert(bytes.length<=4096);
    etag=await store.put(key,bytes,{ifMatch:etag,contentType:'application/json',cacheControl:'no-store'});
  }
  return {deadline,assertOwned,readState:async()=>state,writeState,
    recordFailure:async failure=>writeState({...state,...failure}),
    release:async()=>{ /* Durable reservation remains until slot ends; no deletion. */ }};
}
