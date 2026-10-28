import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {Database,runMigrations,ColorwinReceivingPool,PaymentSessionRepository,ReceivingAccountRepository,MerchantRepository} from '@youpi/db';
import {resolveColorwinReceiver,AttributionEngine,ObservationNormalizer} from '@youpi/core';
import {ObservationRepository} from '@youpi/db';

test('Pool rotates equal loads, prefers a free receiver, pins retries and scales to ten without changing old orders',()=>{
 const db=new Database({inMemory:true});const {defaultMerchant:m}=runMigrations(db);const pool=new ColorwinReceivingPool(db),sessions=new PaymentSessionRepository(db);
 try{
  pool.configure(m.id,[{upiId:'first@bank'},{upiId:'second@bank'}]);
  const create=()=>pool.allocate(m.id,a=>{const session=sessions.create({merchantId:m.id,receivingAccountId:a.id,orderId:randomUUID(),amountPaise:10000n,metadata:{colorwinTrusted:true,colorwinOrderNumber:'RC'+randomUUID().replaceAll('-','').toUpperCase(),receivingAccountSnapshot:{id:a.id,upiId:a.upiId,payeeName:a.payeeName}}});return sessions.findById(session.id);});
  const a=create();sessions.activateColorwin(a.id);const b=create();sessions.activateColorwin(b.id);assert.notEqual(a.receivingAccountId,b.receivingAccountId);
  const c=create();sessions.activateColorwin(c.id);assert.equal(c.receivingAccountId,a.receivingAccountId);
  sessions.transitionToTerminal(b.id,'CANCELLED');const d=create();sessions.activateColorwin(d.id);assert.equal(d.receivingAccountId,b.receivingAccountId);
  assert.equal(sessions.findByOrderId(m.id,a.orderId).metadata.receivingAccountSnapshot.upiId,'first@bank');
  assert.throws(()=>pool.configure(m.id,Array.from({length:11},(_,i)=>({upiId:'user'+i+'@bank'}))));assert.throws(()=>pool.configure(m.id,[{upiId:'same@bank'},{upiId:'same@bank'}]));
  pool.configure(m.id,Array.from({length:10},(_,i)=>({upiId:'user'+i+'@bank'})));const selected=new Set();for(let i=0;i<10;i++){const s=create();sessions.activateColorwin(s.id);selected.add(s.receivingAccountId);}assert.equal(selected.size,10);
  assert.equal(sessions.findById(a.id).metadata.receivingAccountSnapshot.upiId,'first@bank');
 }finally{db.close();}
});

test('Authenticated notification routing resolves the second UPI by exact order reference and matches only that receiver',()=>{
 const db=new Database({inMemory:true});const {defaultMerchant:m}=runMigrations(db);const pool=new ColorwinReceivingPool(db),sessions=new PaymentSessionRepository(db),obsRepo=new ObservationRepository(db);
 pool.configure(m.id,[{upiId:'first@bank'},{upiId:'second@bank'}]);const orders=[];let successes=0;
 const engine=new AttributionEngine({sessionRepo:sessions,obsRepo,eventEmitter:{emit(name){if(name==='PAYMENT.SUCCESS')successes++;}},gracePeriodMs:0});
 try{
  for(let i=0;i<2;i++){const s=pool.allocate(m.id,a=>sessions.create({merchantId:m.id,receivingAccountId:a.id,orderId:randomUUID(),amountPaise:10000n,metadata:{colorwinTrusted:true,colorwinOrderNumber:'RC'+randomUUID().replaceAll('-','').toUpperCase()}}));sessions.activateColorwin(s.id);orders.push(sessions.findById(s.id));}
  const second=orders[1],body={rawNotification:{title:'Paid you 100',text:'Color Win deposit '+second.metadata.colorwinOrderNumber},amountPaise:10000,observedAt:Date.now()};
  const id=resolveColorwinReceiver({db},m.id,body);assert.equal(id,second.receivingAccountId);assert.notEqual(id,orders[0].receivingAccountId);
  assert.equal(resolveColorwinReceiver({db},m.id,{rawNotification:{text:'Received 100'}}),null);
  const result=engine.processObservation(ObservationNormalizer.normalize({source:'ANDROID_OBSERVER',receivingAccountId:id,amountPaise:10000n,observedAt:new Date(),rawPayload:body}));assert.equal(result.paymentSessionId,second.id);assert.equal(successes,1);assert.equal(sessions.findById(orders[0].id).status,'ACTIVE');
 }finally{engine.destroy();db.close();}
});

test('Receiver management page ships valid browser JavaScript',async()=>{const {receiversPage}=await import('./colorwin-receivers-ui.mjs');const script=receiversPage.match(/<script>([\s\S]*)<\/script>/)[1];assert.doesNotThrow(()=>new Function(script));});

test('Opening admin queue cannot remap the second-UPI checkout, and previous bad mappings restore from pinned snapshots',async()=>{
 const {HttpServer}=await import('../apps/payment-api/src/server.js');const {registerAdminRoutes}=await import('../apps/payment-api/src/routes/admin.routes.js');
 const db=new Database({inMemory:true});const {defaultMerchant:m}=runMigrations(db);const pool=new ColorwinReceivingPool(db),sessions=new PaymentSessionRepository(db),accounts=new ReceivingAccountRepository(db);
 try{
  pool.configure(m.id,[{upiId:'first@bank'},{upiId:'second@bank'}]);const receiver=pool.list(m.id)[1];
  const session=sessions.create({merchantId:m.id,receivingAccountId:receiver.id,orderId:randomUUID(),amountPaise:10000n,metadata:{colorwinTrusted:true,receivingAccountSnapshot:{id:receiver.id,upiId:receiver.upiId}}});sessions.activateColorwin(session.id);
  const server=new HttpServer();registerAdminRoutes(server,{db,sessionRepo:sessions,accountRepo:accounts,merchantRepo:new MerchantRepository(db)});
  const handler=server.routes.find(r=>r.regex.test('/api/v1/admin/queue'));let status;
  await handler.handler({query:{merchantId:m.id},headers:{}},{writeHead(s){status=s;},end(){}});
  assert.equal(status,200);assert.equal(sessions.findById(session.id).receivingAccountId,receiver.id);
  db.execute('UPDATE payment_sessions SET receiving_account_id=? WHERE id=?',[accounts.findActiveForMerchant(m.id).id,session.id]);
  const fixed=pool.restorePinnedSessions();assert.equal(fixed.length,1);assert.equal(sessions.findById(session.id).receivingAccountId,receiver.id);assert.equal(pool.restorePinnedSessions().length,0);
 }finally{db.close();}
});
