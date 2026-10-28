// Web Push encryption and VAPID signing stay on the server.
// @ts-ignore npm CommonJS package uses default interop in Deno.
import webpush from 'npm:web-push@3.6.7';
export async function deliver(subscription:any,payload:any,config:any){
 const endpoint=new URL(subscription.endpoint);if(endpoint.protocol!=='https:'||!['fcm.googleapis.com','updates.push.services.mozilla.com'].includes(endpoint.hostname)&&!endpoint.hostname.endsWith('.notify.windows.com'))throw Error('Invalid push endpoint');
 const details=webpush.generateRequestDetails(subscription,JSON.stringify(payload),{TTL:3600,urgency:'high',vapidDetails:{subject:config.origin,publicKey:config.publicKey,privateKey:config.privateKey}});
 const response=await fetch(endpoint.href,{method:'POST',headers:details.headers,body:new Uint8Array(details.body),signal:AbortSignal.timeout(10000)});
 if(!response.ok){const err:any=new Error('Push delivery failed');err.statusCode=response.status;throw err;}
}
