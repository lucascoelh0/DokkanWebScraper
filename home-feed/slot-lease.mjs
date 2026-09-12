import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PREFIX } from './prepare-candidate.mjs';
import { REFRESH_INTERVAL_MS } from './refresh-cycle.mjs';

/** No reclaim within a slot: failed authentication/process waits for next slot.
 * Host must enforce a 15-minute process timeout. Conditional manifest promotion
 * independently protects against stale publication; this lock limits login load.
 */
export async function acquireSlot(store, now=Date.now) {
  const started=now(),slot=Math.floor(started/REFRESH_INTERVAL_MS);
  const end=(slot+1)*REFRESH_INTERVAL_MS;
  if(end-started<20*60*1000)return null;
  const key=PREFIX+`runs/${slot}.json`;
  if(await store.get(key))return null;
  const owner=randomUUID(),deadline=started+15*60*1000;
  let state={owner,deadline,status:'reserved'},etag;
  // Caller reports this <=4 KiB control write before invoking acquisition.
  etag=await store.put(key,Buffer.from(JSON.stringify(state)),{
    ifNoneMatch:'*',contentType:'application/json',cacheControl:'no-store'});
  async function assertOwned(){
    assert(now()<deadline);const current=await store.get(key);
    assert(current?.etag===etag && JSON.parse(current.bytes).owner===owner);
  }
  async function writeState(next){
    await assertOwned();state={...next,owner,deadline};
    const bytes=Buffer.from(JSON.stringify(state));assert(bytes.length<=4096);
    etag=await store.put(key,bytes,{ifMatch:etag,contentType:'application/json',cacheControl:'no-store'});
  }
  return {assertOwned,readState:async()=>state,writeState,
    recordFailure:async failure=>writeState({...state,...failure}),
    release:async()=>{ /* Durable reservation remains until slot ends; no deletion. */ }};
}
