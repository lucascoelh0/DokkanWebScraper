import {newsGatewayStore} from './news-gateway-store.mjs';
let store;
try{
 store=newsGatewayStore(process.env);
 const bucketBytes=await store.inventoryBytes();
 const manifest=await store.get('staging/v2/news/manifest.json');
 console.log(JSON.stringify({status:'gateway_ready',bucketBytes,manifestPresent:manifest!==null,gameRequests:0,writes:0}));
}catch{console.log(JSON.stringify({status:'gateway_check_failed',gameRequests:0,writes:0}));process.exitCode=1;}
finally{store?.close();}
