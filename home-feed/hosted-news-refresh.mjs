import assert from 'node:assert/strict';
import {collectNewsLibrary} from './news-library.mjs';
import {planNewsLibrary,publishNewsLibrary} from './publish-news-library.mjs';
import {newsGatewayStore} from './news-gateway-store.mjs';
import {readPublicNews} from './news-library-store.mjs';

export function hostedNewsRefresh(env,config,{makeStore=newsGatewayStore,collect=collectNewsLibrary,plan=planNewsLibrary,publish=publishNewsLibrary,report=v=>console.log(JSON.stringify(v)),now=Date.now}={}){
 if(env.HOME_FEED_NEWS_LIBRARY_ENABLED!=='true')return undefined;
 const settings={NEWS_GATEWAY_URL:env.NEWS_GATEWAY_URL,NEWS_GATEWAY_TOKEN:env.NEWS_GATEWAY_TOKEN};
 const attempted=new WeakSet();
 return async({lease})=>{
  let store,phase='configuration';
  try{
   assert(lease&&typeof lease.assertOwned==='function');if(attempted.has(lease))return {status:'already_attempted'};attempted.add(lease);
   await lease.assertOwned();store=makeStore(settings);phase='collection';
   const collection=await collect({config});assert(collection.status==='collected');await lease.assertOwned();
   phase='publication';const proposal=await plan(collection,store,now());
   await report({phase:'news_preflight',...proposal,count:collection.count,articleCount:collection.articleCount,imageCount:collection.imageCount});
   return await publish(collection,proposal,{store,lease,publicRead:readPublicNews,now});
  }catch{return {status:'failed',phase};}finally{store?.close();}
 };
}
