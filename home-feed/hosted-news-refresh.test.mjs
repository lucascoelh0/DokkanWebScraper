import test from 'node:test';
import assert from 'node:assert/strict';
import {hostedNewsRefresh} from './hosted-news-refresh.mjs';
import {refreshExitCode} from './run-refresh.mjs';
test('disabled library constructs nothing; enabled step fences and reports before publishing once',async()=>{
 const calls=[];const deps={makeStore:()=>{calls.push('store');return {close:()=>calls.push('close')};},collect:async()=>{calls.push('collect');return {status:'collected',count:90};},plan:async()=>{calls.push('plan');return {writeBytes:10};},report:async()=>calls.push('report'),publish:async()=>{calls.push('publish');return {status:'published',manifestSha256:'a'.repeat(64)};}};
 assert.equal(hostedNewsRefresh({}, {},deps),undefined);assert.deepEqual(calls,[]);
 const step=hostedNewsRefresh({HOME_FEED_NEWS_LIBRARY_ENABLED:'true'}, {},deps);
 const lease={assertOwned:async()=>calls.push('fence')};assert.equal((await step({lease})).status,'published');
 assert.deepEqual(calls,['fence','store','collect','fence','plan','report','publish','close']);
 assert.equal((await step({lease})).status,'already_attempted');
 assert.equal(refreshExitCode({status:'success',news:{status:'failed'}}),1);
});
test('failed collection preserves old library and closes capability without retry',async()=>{
 let close=0;const step=hostedNewsRefresh({HOME_FEED_NEWS_LIBRARY_ENABLED:'true'}, {},{makeStore:()=>({close:()=>close++}),collect:async()=>({status:'unavailable'}),plan:()=>assert.fail('must not plan')});
 assert.deepEqual(await step({lease:{assertOwned:async()=>{}}}),{status:'failed',phase:'collection'});assert.equal(close,1);
});
