import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHmac} from 'node:crypto';
import {Readable} from 'node:stream';
import {Database,runMigrations,MerchantRepository,ReceivingAccountRepository,PaymentSessionRepository,ObservationRepository} from '@youpi/db';
import {QueueEngine,TimingEngine,matchesColorwinObservation,AttributionEngine,ObservationNormalizer} from '@youpi/core';
import {HttpServer} from '../apps/payment-api/src/server.js';
import {verifyColorwinEnvelope,registerColorwinRoutes} from '../apps/payment-api/src/routes/colorwin.routes.js';
const secret='test-only-colorwin-merchant-secret';
const sign=body=>{const payload=JSON.stringify(body);return {payload,signature:'sha256='+createHmac('sha256',secret).update(payload).digest('hex')};};
test('trusted checkout rejects tampering and expired authentication',()=>{
 const signed=sign({timestamp:Date.now(),action:'create'});assert.equal(verifyColorwinEnvelope(signed,secret).action,'create');
 assert.throws(()=>verifyColorwinEnvelope({...signed,payload:signed.payload+' '},secret));
 assert.throws(()=>verifyColorwinEnvelope(sign({timestamp:Date.now()-61000}),secret));
 assert.throws(()=>verifyColorwinEnvelope(signed,'wrong-secret'));
});
test('merchant-authenticated checkout needs no WhatsApp and supports independent QR windows and payment invariants',async()=>{
 const db=new Database({inMemory:true});const {defaultMerchant}=runMigrations(db);
 const merchantRepo=new MerchantRepository(db),accountRepo=new ReceivingAccountRepository(db),sessionRepo=new PaymentSessionRepository(db);
 accountRepo.create({merchantId:defaultMerchant.id,upiId:'fixture@bank',payeeName:'Fixture'});
 const queueEngine=new QueueEngine({sessionRepo,accountRepo}),timingEngine=new TimingEngine({sessionRepo,queueEngine});
 const obsRepo=new ObservationRepository(db);let successEvents=0;const eventEmitter={emit(name){if(name==='PAYMENT.SUCCESS')successEvents++;}};
 const server=new HttpServer();registerColorwinRoutes(server,{merchantRepo,accountRepo,sessionRepo,queueEngine,timingEngine,obsRepo,eventEmitter});
 const prior=process.env.COIN_STORE_WEBHOOK_SECRET;process.env.COIN_STORE_WEBHOOK_SECRET=secret;
 async function call(body,valid=true){const req=Readable.from([JSON.stringify(valid?sign({...body,timestamp:Date.now()}):{payload:'bad',signature:'bad'})]);let status,result;const res={writeHead(s){status=s;},end(v){result=JSON.parse(v);}};await server.routes.find(r=>r.regex.test('/api/v1/colorwin/payment')).handler(req,res);return {status,result};}
 const first={merchantId:defaultMerchant.id,ownerId:randomUUID(),orderId:randomUUID(),amount:'100.00',orderNumber:'RC1234567890ABCDEF1234567890ABCDEF'};
 try{
  assert.equal((await call({...first,action:'create'},false)).status,401);
  const a=await call({...first,action:'create'});assert.equal(a.status,200);assert.equal(a.result.status,'ACTIVE');assert.equal(a.result.recipientUpi,'fixture@bank');assert(a.result.expiresAt);assert.equal(sessionRepo.findById(a.result.paymentId).customerId,null);
  assert.equal((await call({...first,action:'create'})).result.paymentId,a.result.paymentId);
  assert.equal((await call({...first,action:'state',ownerId:randomUUID()})).status,400);
  assert.equal((await call({...first,action:'create',amount:'101.00'})).status,400);
  assert.equal((await call({...first,action:'submit',utr:'123'})).status,400);
  const second={...first,orderId:randomUUID(),ownerId:randomUUID()};const b=await call({...second,action:'create'});assert.equal(b.result.status,'ACTIVE');
  assert.equal((await call({...second,action:'state'})).result.status,'ACTIVE');
  assert.equal((await call({...first,action:'submit',utr:'123456789012'})).result.status,'PROCESSING');
  assert.equal((await call({...first,action:'submit',utr:'123456789012'})).result.status,'PROCESSING');
  assert.equal((await call({...first,action:'cancel'})).status,400);
  assert.equal((await call({...second,action:'cancel'})).result.status,'CANCELLED');
  const processing=sessionRepo.findById(a.result.paymentId);
  assert(processing.processingExpiresAt.getTime()-processing.processingStartedAt.getTime()>=299000,'Color Win must wait five minutes rather than thirty seconds');
  sessionRepo.transitionToTerminal(a.result.paymentId,'FAILED');
  const failed=sessionRepo.findById(a.result.paymentId);
  const proof={receivingAccountId:failed.receivingAccountId,source:'ANDROID_OBSERVER',amountPaise:10000n,observedAt:new Date(failed.createdAt.getTime()+116000),fingerprintHash:randomUUID(),rawPayload:{rawNotification:{title:'Paid you 100',text:'Color Win deposit '+first.orderNumber.slice(0,30)}}};
  assert(matchesColorwinObservation(failed,proof));
  assert(!matchesColorwinObservation(failed,{...proof,amountPaise:20000n}));
  assert(!matchesColorwinObservation(failed,{...proof,rawPayload:{rawNotification:{text:'Unrelated payment'}}}));
  assert(!matchesColorwinObservation(failed,{...proof,bankReferenceNumber:'000000000000'}));
  assert(!matchesColorwinObservation(failed,{...proof,attributedPaymentId:randomUUID()}));
  const saved=obsRepo.create(proof);obsRepo.markLateUnmatched(saved.id);
  const recovered=await call({...first,action:'state'});assert.equal(recovered.result.status,'SUCCESS');assert.equal(successEvents,1);
  assert.equal(obsRepo.findById(saved.id).attributedPaymentId,a.result.paymentId);
  assert.equal((await call({...first,action:'state'})).result.status,'SUCCESS');assert.equal(successEvents,1);

 }finally{timingEngine.destroy();db.close();if(prior===undefined)delete process.env.COIN_STORE_WEBHOOK_SECRET;else process.env.COIN_STORE_WEBHOOK_SECRET=prior;}
});

for (const scenario of ['same','different','mixed']) test(`10 ${scenario}-amount users get QR immediately and out-of-order notifications credit only their matching order`,async()=>{
 const db=new Database({inMemory:true});const {defaultMerchant}=runMigrations(db);
 const merchantRepo=new MerchantRepository(db),accountRepo=new ReceivingAccountRepository(db),sessionRepo=new PaymentSessionRepository(db),obsRepo=new ObservationRepository(db);
 const account=accountRepo.create({merchantId:defaultMerchant.id,upiId:'fixture@bank',payeeName:'Fixture'});
 const queueEngine=new QueueEngine({sessionRepo,accountRepo}),timingEngine=new TimingEngine({sessionRepo,queueEngine});
 const successes=[];const eventEmitter={emit(name,data){if(name==='PAYMENT.SUCCESS')successes.push(data.paymentId);}};
 const engine=new AttributionEngine({sessionRepo,obsRepo,eventEmitter,gracePeriodMs:0});
 const server=new HttpServer();registerColorwinRoutes(server,{merchantRepo,accountRepo,sessionRepo,queueEngine,timingEngine,obsRepo,eventEmitter});
 const prior=process.env.COIN_STORE_WEBHOOK_SECRET;process.env.COIN_STORE_WEBHOOK_SECRET=secret;
 const call=async body=>{const req=Readable.from([JSON.stringify(sign({...body,timestamp:Date.now()}))]);let status,result;await server.routes.find(r=>r.regex.test('/api/v1/colorwin/payment')).handler(req,{writeHead(s){status=s;},end(v){result=JSON.parse(v);}});assert.equal(status,200,JSON.stringify(result));return result;};
 const users=[];
 try {
  for(let i=0;i<10;i++){
   const body={action:'create',merchantId:defaultMerchant.id,ownerId:randomUUID(),orderId:randomUUID(),orderNumber:'RC'+randomUUID().replaceAll('-','').toUpperCase(),amount:String(scenario==='same'||scenario==='mixed'&&i<5?100:101+i)};
   const payment=await call(body);assert.equal(payment.status,'ACTIVE');assert.equal(payment.queuePosition,0);assert(payment.expiresAt);users.push({body,payment});
  }
  assert.equal(db.queryOne("SELECT count(*) AS n FROM payment_sessions WHERE status='ACTIVE'").n,10);
  const proof=(user,overrides={})=>ObservationNormalizer.normalize({receivingAccountId:account.id,source:'ANDROID_OBSERVER',amountPaise:BigInt(Math.round(Number(user.body.amount)*100)),observedAt:new Date(),fingerprintHash:randomUUID(),rawPayload:{rawNotification:{title:'Paid you money',text:'Color Win deposit '+user.body.orderNumber}},...overrides});
  assert.equal(new Set(users.map(user=>proof(user).fingerprintHash)).size,10,'Same-minute same-amount orders must have separate notification fingerprints');
  const missing=engine.processObservation(proof(users[0],{rawPayload:{rawNotification:{text:'Payment received'}}}));assert.equal(missing.attributed,false);assert.equal(successes.length,0);
  const wrongAmount=engine.processObservation(proof(users[0],{amountPaise:999999n}));assert.equal(wrongAmount.attributed,false);
  const wrongOrder=engine.processObservation(proof(users[0],{rawPayload:{rawNotification:{text:'Color Win deposit RC'+randomUUID().replaceAll('-','').toUpperCase()}}}));assert.equal(wrongOrder.attributed,false);
  const wrongReceiver=engine.processObservation(proof(users[0],{receivingAccountId:accountRepo.create({merchantId:defaultMerchant.id,upiId:'other@bank',payeeName:'Other',isActive:false}).id}));assert.equal(wrongReceiver.attributed,false);
  // A truncated reference shared by two orders must remain unresolved.
  const twin=sessionRepo.findById(users[1].payment.paymentId),originalMetadata=twin.metadata;
  db.execute('UPDATE payment_sessions SET metadata=? WHERE id=?',[JSON.stringify({...originalMetadata,colorwinOrderNumber:users[0].body.orderNumber.slice(0,26)+'00000000'}),twin.id]);
  if(users[0].body.amount===users[1].body.amount){const ambiguous=engine.processObservation(proof(users[0],{rawPayload:{rawNotification:{text:'Color Win deposit '+users[0].body.orderNumber.slice(0,26)}}}));assert.equal(ambiguous.attributed,false);}
  db.execute('UPDATE payment_sessions SET metadata=? WHERE id=?',[JSON.stringify(originalMetadata),twin.id]);
  for(const user of [...users].reverse()){
   const observation=proof(user,user===users[9]?{bankReferenceNumber:'100000000009'}:{});const result=engine.processObservation(observation);assert.equal(result.paymentSessionId,user.payment.paymentId);assert.equal(result.outcomeStatus,'SUCCESS');
   const count=successes.length;engine.processObservation(observation);assert.equal(successes.length,count);
   if(user===users[9]){const duplicate=()=>engine.processObservation(proof(users[0],{bankReferenceNumber:observation.bankReferenceNumber}));if(users[0].body.amount===users[9].body.amount)duplicate();else assert.throws(duplicate,/Bank transaction already used/);assert.equal(successes.length,count);}
  }
  assert.equal(new Set(successes).size,10);assert.equal(successes.length,10);
  assert.equal(db.queryOne("SELECT count(*) AS n FROM payment_sessions WHERE status='SUCCESS'").n,10);
  assert.equal(db.queryOne("SELECT count(*) AS n FROM payment_sessions WHERE status='QUEUED'").n,0);
 }finally{engine.destroy();timingEngine.destroy();db.close();if(prior===undefined)delete process.env.COIN_STORE_WEBHOOK_SECRET;else process.env.COIN_STORE_WEBHOOK_SECRET=prior;}
});

test('SMS then Android replays do not flood observations; exact submitted UTR resolves bank-only evidence',()=>{
 const db=new Database({inMemory:true});const {defaultMerchant}=runMigrations(db);
 const accounts=new ReceivingAccountRepository(db),sessionRepo=new PaymentSessionRepository(db),obsRepo=new ObservationRepository(db);
 const account=accounts.create({merchantId:defaultMerchant.id,upiId:'fixture@bank',payeeName:'Fixture'});
 const session=sessionRepo.create({merchantId:defaultMerchant.id,receivingAccountId:account.id,orderId:randomUUID(),amountPaise:10000n,metadata:{colorwinTrusted:true,colorwinOrderNumber:'RC'+randomUUID().replaceAll('-','').toUpperCase()}});
 sessionRepo.activateColorwin(session.id);let credits=0;const engine=new AttributionEngine({sessionRepo,obsRepo,eventEmitter:{emit(name){if(name==='PAYMENT.SUCCESS')credits++;}},gracePeriodMs:0});
 try {
  const payload={receivingAccountId:account.id,amountPaise:10000n,observedAt:new Date(),bankReferenceNumber:'006074341032',rawPayload:{body:'A/c credited Rs.100 Ref 006074341032'}};
  const sms=ObservationNormalizer.normalize({...payload,source:'GOOGLE_MESSAGES'}),android=ObservationNormalizer.normalize({...payload,source:'ANDROID_OBSERVER'});
  engine.processObservation(sms);engine.processObservation(android);
  for(let i=0;i<100;i++)engine.processObservation(android);
  assert.equal(db.queryOne('SELECT count(*) AS n FROM payment_observations').n,2);assert.equal(credits,0);assert.equal(obsRepo.findUnattributed(account.id).length,2);
  const stored=sessionRepo.findById(session.id);db.execute('UPDATE payment_sessions SET metadata=? WHERE id=?',[JSON.stringify({...stored.metadata,colorwinUtr:'006074341032'}),stored.id]);
  const normalized=obsRepo.findByFingerprint(android.fingerprintHash,'ANDROID_OBSERVER');assert(matchesColorwinObservation(sessionRepo.findById(session.id),normalized));
 }finally{engine.destroy();db.close();}
});
