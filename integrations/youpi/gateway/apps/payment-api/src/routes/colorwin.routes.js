import {reconcileColorwinObservation,findColorwinObservationMatch,resolveColorwinReceiver} from '@youpi/core';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {PaymentStatus,toPaise} from '@youpi/common';
import {HttpServer} from '../server.js';

// Only the authenticated Color Win Edge service may activate an embedded checkout.
// The customer uses their existing Color Win session; no second OTP identity is created.
export function verifyColorwinEnvelope(envelope,secret,now=Date.now()) {
 if(!secret||typeof envelope?.payload!=='string'||envelope.payload.length>4096||!/^sha256=[a-f0-9]{64}$/.test(envelope.signature||''))throw Error('Invalid gateway authentication');
 const expected='sha256='+createHmac('sha256',secret).update(envelope.payload).digest('hex');
 if(!timingSafeEqual(Buffer.from(expected),Buffer.from(envelope.signature)))throw Error('Invalid gateway authentication');
 const body=JSON.parse(envelope.payload);
 if(!Number.isSafeInteger(body.timestamp)||Math.abs(now-body.timestamp)>60000)throw Error('Expired gateway authentication');
 return body;
}
export function registerColorwinRoutes(server,ctx) {
 server.use((req,res,pathname)=>{
  const match=/^\/api\/v1\/checkout\/([a-f0-9-]{36})(?:\/|$)/i.exec(pathname);
  if(req.method!=='GET'&&req.method!=='OPTIONS'&&match&&ctx.sessionRepo.findById(match[1])?.metadata?.colorwinTrusted===true){HttpServer.json(res,403,{error:'Use the authenticated Color Win checkout'});return true;}return false;
 });

 server.get('/api/v1/admin/colorwin/receivers',async(req,res)=>{const merchant=ctx.merchantRepo.getDefault();HttpServer.json(res,200,{receivers:ctx.poolRepo.list(merchant.id)});});
 server.post('/api/v1/admin/colorwin/receivers',async(req,res)=>{try{const body=await HttpServer.parseBody(req);const merchant=ctx.merchantRepo.getDefault();HttpServer.json(res,200,{receivers:ctx.poolRepo.configure(merchant.id,body.receivers)});}catch(e){HttpServer.json(res,400,{error:e.message});}});

 server.post('/api/v1/colorwin/payment',async(req,res)=>{
  let body;try{body=verifyColorwinEnvelope(await HttpServer.parseBody(req),process.env.COIN_STORE_WEBHOOK_SECRET);}catch{return HttpServer.json(res,401,{error:'Invalid gateway authentication'});}
  try {
   const merchant=ctx.merchantRepo.findById(body.merchantId);
   if(!merchant||!/^[-a-f0-9]{36}$/i.test(body.orderId||'')||!/^[-a-f0-9]{36}$/i.test(body.ownerId||''))throw Error('Invalid Color Win order');
   if(!['create','state','submit','cancel'].includes(body.action))throw Error('Unknown operation');
   if(body.action==='create'&&!/^RC[A-F0-9]{32}$/.test(body.orderNumber||''))throw Error('Invalid Color Win order number');
   let session=ctx.sessionRepo.findByOrderId(merchant.id,body.orderId);
   if(body.action==='create'&&!session){
    const amountPaise=toPaise(body.amount);if(amountPaise<=0n)throw Error('Invalid amount');
    const create=account=>{if(!account)throw Error('Payment receiver unavailable');return ctx.sessionRepo.create({merchantId:merchant.id,customerId:null,receivingAccountId:account.id,orderId:body.orderId,amountPaise,currency:'INR',method:'UPI',status:PaymentStatus.INITIATED,idempotencyKey:body.orderId,metadata:{colorwin_deposit_id:body.orderId,colorwinOwner:body.ownerId,colorwinTrusted:true,colorwinOrderNumber:body.orderNumber,receivingAccountSnapshot:{id:account.id,upiId:account.upiId,payeeName:account.payeeName}}});};
    session=ctx.poolRepo?.list(merchant.id).length?ctx.poolRepo.allocate(merchant.id,create):create(ctx.accountRepo.findActiveForMerchant(merchant.id));
   }
   if(!session||session.metadata?.colorwinTrusted!==true||session.metadata?.colorwinOwner!==body.ownerId)throw Error('Color Win payment not found');
   if(body.paymentId&&body.paymentId!==session.id)throw Error('Payment identity mismatch');
   // These values come from the signed owner-checked Color Win service, never a public browser.
   const metadata={...session.metadata,...(body.orderNumber?{colorwinOrderNumber:body.orderNumber}:{}),...(/^\d{12}$/.test(body.utr||'')?{colorwinUtr:body.utr}:{})};
   ctx.sessionRepo.db.execute('UPDATE payment_sessions SET metadata = ? WHERE id = ?',[JSON.stringify(metadata),session.id]);
   session=ctx.sessionRepo.findById(session.id);
   if(['INITIATED','QUEUED'].includes(session.status)){session=ctx.sessionRepo.activateColorwin(session.id);ctx.timingEngine.startActiveTimer(session.id,session.expiresAt);}
   if(['state','submit'].includes(body.action)&&ctx.obsRepo){
    // A bank-only SMS may have arrived before its owner supplied the UTR.
    if(body.utr&&ctx.poolRepo){
     const unresolved=ctx.sessionRepo.db.query("SELECT o.* FROM payment_observations o JOIN payment_receiving_accounts a ON a.id=o.receiving_account_id WHERE a.merchant_id=? AND o.attributed_payment_id IS NULL AND o.amount_paise=? AND json_extract(o.raw_payload,'$.colorwinReceiverUnresolved')=1 AND o.observed_at>=? GROUP BY o.fingerprint_hash,o.source LIMIT 200",[merchant.id,Number(session.amountPaise),new Date(session.createdAt.getTime()-5000).toISOString()]);
     for(const row of unresolved){const raw=JSON.parse(row.raw_payload);raw.bankReferenceNumber=row.bank_reference_number;const receiver=resolveColorwinReceiver({db:ctx.sessionRepo.db},merchant.id,raw);if(receiver===session.receivingAccountId){raw.colorwinOriginallyUnresolved=true;raw.colorwinReceiverUnresolved=false;ctx.sessionRepo.db.execute('UPDATE payment_observations SET receiving_account_id=?,raw_payload=? WHERE id=?',[receiver,JSON.stringify(raw),row.id]);}}
    }
    const observations=ctx.obsRepo.findByReceivingAccount(session.receivingAccountId,100);
    const matches=observations.filter(obs=>!obs.attributedPaymentId);
    for(const obs of matches){const matched=findColorwinObservationMatch(ctx.sessionRepo,obs);if(matched?.id===session.id&&reconcileColorwinObservation(ctx,session,obs))break;}
    session=ctx.sessionRepo.findById(session.id);
   }
   if(body.action==='create'){
    if(session.amountPaise!==toPaise(body.amount))throw Error('Payment amount mismatch');

   }
   session=ctx.sessionRepo.findById(session.id);
   if(body.action==='submit'){
    if(!/^\d{12}$/.test(body.utr||''))throw Error('Enter a valid 12-digit UTR');
    if(session.status===PaymentStatus.ACTIVE){
     if(session.expiresAt?.getTime()<=Date.now())throw Error('Payment window expired');
     ctx.timingEngine.handlePaymentDone(session.id,300000);
    }else if(![PaymentStatus.PROCESSING,PaymentStatus.SUCCESS].includes(session.status))throw Error('This payment is not accepting UTR submissions');
   }
   if(body.action==='cancel'){
    if(session.status===PaymentStatus.PROCESSING||session.status===PaymentStatus.SUCCESS)throw Error('Payment is already being verified');
    if([PaymentStatus.INITIATED,PaymentStatus.QUEUED,PaymentStatus.ACTIVE].includes(session.status))ctx.timingEngine.handleCancel(session.id);
   }
   session=ctx.sessionRepo.findById(session.id);
   const receiver=session.metadata?.receivingAccountSnapshot||{};
   return HttpServer.json(res,200,{paymentId:session.id,orderId:session.orderId,amountPaise:String(session.amountPaise),currency:session.currency,status:session.status,queuePosition:session.queuePosition||0,expiresAt:session.expiresAt,recipientUpi:receiver.upiId,recipientName:receiver.payeeName});
  }catch(error){return HttpServer.json(res,400,{error:error.message||'Payment unavailable'});}
 });
}
