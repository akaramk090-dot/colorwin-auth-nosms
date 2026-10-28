import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {validSignature,verifyPayment,checkoutUrl} from './contract.mjs';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const opts={auth:{persistSession:false,autoRefreshToken:false}};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,opts);
 const configured=await admin.rpc('colorwin_youpi_configuration');const settings=configured.data||{};
 const api=Deno.env.get('YOUPI_API_URL')||settings.api_url,merchant=Deno.env.get('YOUPI_MERCHANT_ID')||settings.merchant_id,secret=Deno.env.get('YOUPI_WEBHOOK_SECRET')||settings.webhook_secret,portal=Deno.env.get('YOUPI_CHECKOUT_ORIGIN')||settings.checkout_origin,site=Deno.env.get('COLORWIN_PUBLIC_ORIGIN')||settings.site_origin;
 if(!api||!merchant||!secret||!portal||!site)return json({error:'Payment gateway setup is not complete'},503);
 try{
  for(const value of [api,portal,site])if(new URL(value).protocol!=='https:')throw Error('Gateway requires HTTPS');
  if(Number(req.headers.get('content-length')||0)>8192)return json({error:'Request too large'},413);
  const bytes=await req.arrayBuffer();if(bytes.byteLength>8192)return json({error:'Request too large'},413);
  const gateway=async(path:string,init:RequestInit={})=>{const response=await fetch(api.replace(/\/$/,'')+path,{...init,redirect:'error',headers:{'Content-Type':'application/json','X-Merchant-Id':merchant,...init.headers},signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Gateway could not process this payment');return response.json();};
  if(req.headers.has('x-gateway-signature')){
   if(!await validSignature(bytes,req.headers.get('x-gateway-signature')||'',secret))return json({error:'Invalid signature'},401);
   const event=JSON.parse(new TextDecoder().decode(bytes));
   if(event.event!=='SUCCESS')return json({received:true});
   if(!/^[a-f0-9-]{36}$/i.test(event.paymentId||''))return json({error:'Invalid payment ID'},400);
   const status=await gateway('/api/v1/payments/'+event.paymentId);
   const data=verifyPayment(event,status);const result=await admin.rpc('colorwin_youpi_backend',{p_action:'credit',p_data:data});if(result.error)throw Error(result.error.message);return json(result.data);
  }
  if(settings.enabled!==true)return json({error:'Android bank observer setup is pending'},503);
  const authorization=req.headers.get('authorization')||'';if(!authorization.startsWith('Bearer '))return json({error:'Sign in required'},401);
  const user=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{...opts,global:{headers:{Authorization:authorization}}});
  const auth=await user.auth.getUser();if(auth.error||!auth.data.user)return json({error:'Sign in required'},401);
  const body=JSON.parse(new TextDecoder().decode(bytes));
  const action=body.action||'create';
  if(!['create','state','submit','cancel'].includes(action))throw Error('Unknown payment operation');
  let deposit,paymentId;
  if(action==='create'){
   const order=await user.rpc('colorwin_youpi_reserve_channel',{p_amount:body.amount,p_request:body.request_id,p_method:body.method||'upi'});if(order.error)throw Error(order.error.message);deposit=order.data;
  }else{
   if(!/^[a-f0-9-]{36}$/i.test(body.deposit_id||''))throw Error('Invalid deposit order');
   const owned=await user.rpc('colorwin_youpi_order',{p_id:body.deposit_id});if(owned.error)throw Error(owned.error.message);deposit=owned.data.deposit;paymentId=owned.data.payment_id;
   if(!paymentId)throw Error('Payment order is not ready');
   if(action==='submit'&&!/^\d{12}$/.test(body.utr||''))throw Error('Enter a valid 12-digit UTR');
  }
  const payload=JSON.stringify({action,merchantId:merchant,ownerId:auth.data.user.id,orderId:deposit.id,orderNumber:deposit.number,paymentId,amount:Number(deposit.amount).toFixed(2),utr:action==='submit'?body.utr:deposit.utr,timestamp:Date.now()});
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature='sha256='+Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload))),b=>b.toString(16).padStart(2,'0')).join('');
  const payment=await gateway('/api/v1/colorwin/payment',{method:'POST',body:JSON.stringify({payload,signature})});
  if(payment.orderId!==deposit.id||String(payment.amountPaise)!==String(Math.round(Number(deposit.amount)*100))||payment.currency!=='INR')throw Error('Gateway order mismatch');
  if(action==='create'){
   const url=checkoutUrl(new URL('/checkout/'+payment.paymentId,portal).href,portal);
   const bound=await admin.rpc('colorwin_youpi_backend',{p_action:'bind',p_data:{deposit_id:deposit.id,payment_id:payment.paymentId,checkout_url:url}});if(bound.error)throw Error(bound.error.message);
  }else if(payment.paymentId!==paymentId)throw Error('Payment identity mismatch');
  const synced=await admin.rpc('colorwin_youpi_checkout_sync',{p_id:deposit.id,p_payment:payment.paymentId,p_upi:payment.recipientUpi,p_name:payment.recipientName,p_expires:payment.expiresAt});if(synced.error)throw Error(synced.error.message);
  if(action==='submit'&&synced.data.status!=='complete'){
   const submitted=await user.rpc('colorwin_wallet',{p_action:'submit_utr',p_data:{id:deposit.id,utr:body.utr}});if(submitted.error)throw Error(submitted.error.message);
  }
  if(action==='cancel'){
   const cancelled=await user.rpc('colorwin_wallet',{p_action:'cancel_deposit',p_data:{id:deposit.id,reason:String(body.reason||'Cancelled by customer').slice(0,300)}});if(cancelled.error)throw Error(cancelled.error.message);
  }
  const current=await user.rpc('colorwin_youpi_order',{p_id:deposit.id});if(current.error)throw Error(current.error.message);
  return json({order:current.data.deposit,gateway_status:payment.status,queue_position:payment.queuePosition});
 }catch(error){return json({error:error instanceof Error?error.message:'Payment unavailable'},400);}
});
