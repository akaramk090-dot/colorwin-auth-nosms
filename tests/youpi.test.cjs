const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const contract=()=>import('../supabase/functions/youpi-payments/contract.mjs');
const event={event:'SUCCESS',method:'UPI',currency:'INR',paymentId:'11111111-1111-4111-8111-111111111111',orderId:'22222222-2222-4222-8222-222222222222',amountPaise:10000};
const payment={...event,status:'SUCCESS',verificationLevel:1};
test('YouPI verifies exact raw bytes and rejects modified payloads',async()=>{const {validSignature}=await contract();const secret='test-only-secret',raw=Buffer.from(JSON.stringify(event));const signature='sha256='+crypto.createHmac('sha256',secret).update(raw).digest('hex');assert(await validSignature(raw,signature,secret));assert(!await validSignature(Buffer.from(JSON.stringify({...event,amountPaise:20000})),signature,secret));assert(!await validSignature(raw,'sha256=bad',secret));});
test('Only matched bank-verified INR UPI can credit a deposit',async()=>{const {verifyPayment}=await contract();assert.equal(verifyPayment(event,payment).amount_paise,10000);for(const p of [{...payment,amountPaise:1},{...payment,status:'ACTIVE'},{...payment,verificationLevel:undefined},{...payment,verificationLevel:0},{...payment,orderId:crypto.randomUUID()}])assert.throws(()=>verifyPayment(event,p));for(const method of ['COD','CASH_COUNTER','CARD_COUNTER'])assert.throws(()=>verifyPayment({...event,method},payment));});
test('Checkout redirects are restricted to the configured portal',async()=>{const {checkoutUrl}=await contract();assert(checkoutUrl('https://pay.example.com/checkout/'+event.paymentId,'https://pay.example.com'));assert.throws(()=>checkoutUrl('https://evil.example/checkout/'+event.paymentId,'https://pay.example.com'));});

test('Embedded QR stays blocked until gateway confirms its slot, then submits UTR through YouPI',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),{parseHTML}=require('linkedom');const {window}=parseHTML('<html><body></body></html>');
 const order={id:crypto.randomUUID(),number:'fixture',amount:100,method:'upi',gatewayProvider:'youpi',status:'to be paid',recipientUpi:'fixture@bank',expiresAt:Date.now()+300000};
 let state={orders:[order]},resolveState,submitted,toast;window.ColorWinYoupi={state:()=>new Promise(r=>resolveState=r),submit:async(id,utr)=>{submitted={id,utr};}};window.ColorWinOperations={loadWallet:async()=>{}};
 function QRCode(el){el.textContent='QR';}QRCode.CorrectLevel={M:1};const location={hash:'#/deposit/pay/'+order.id,href:'https://example.test/'};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../dist/checkout.js'),'utf8'),{window,document:window.document,QRCode,location,history:{},setInterval:()=>1,clearInterval:()=>{},setTimeout:fn=>{fn();},URLSearchParams,Date});
 window.document.body.innerHTML=window.ColorWinCheckout.view(order);const page=window.document.body;
 window.ColorWinCheckout.bind(page,order,{read:()=>state,write:s=>{state=s;},toast:v=>{toast=v;}});
 assert.equal(page.querySelector('#payment-qr').hidden,true);assert.equal(page.querySelector('#utr-submit').disabled,true);
 resolveState({...order,gatewayStatus:'ACTIVE'});await new Promise(r=>setImmediate(r));
 assert.equal(page.querySelector('#payment-qr').hidden,false);assert.equal(page.querySelector('#payment-qr').textContent,'QR');
 const input=page.querySelector('#payment-utr');input.value='123456789012';input.oninput();assert.equal(page.querySelector('#utr-submit').disabled,false);
 await page.querySelector('#utr-submit').onclick();assert.equal(submitted.id,order.id);assert.equal(submitted.utr,'123456789012');assert.equal(toast,'Submission successful');assert.equal(location.hash,'#/deposit/pay/'+order.id);assert.equal(page.querySelector('#payment-help'),null);
});

test('Embedded connector retains Color Win identity and never redirects to OTP checkout',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');const owner=crypto.randomUUID(),window={ColorWinPaymentConfig:{youpiEnabled:true},ColorWinAuth:{session:{user:{id:owner},access_token:'fixture'}},COLORWIN_SUPABASE_CONFIG:{url:'https://fixture.supabase.co'}};let sent;
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../dist/youpi.js'),'utf8'),{window,fetch:async(url,options)=>{sent=JSON.parse(options.body);assert.equal(options.headers.Authorization,'Bearer fixture');return {ok:true,json:async()=>({order:{id:owner,amount:100,method:sent.method,gateway_provider:'youpi',created_at:new Date().toISOString(),expires_at:new Date().toISOString()},gateway_status:'ACTIVE'})};}});
 const result=await window.ColorWinYoupi.start('100',owner);assert.equal(result.gatewayProvider,'youpi');assert.equal(sent.action,'create');assert.equal(sent.request_id,owner);for(const method of ['upi','innate','paytm']){const channel=await window.ColorWinYoupi.start('100',owner,method);assert.equal(sent.method,method);assert.equal(channel.method,method);}
});

test('Polling errors retain the QR; only confirmed completion shows the success tick',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),{parseHTML}=require('linkedom');const {window}=parseHTML('<html><body></body></html>');
 const order={id:crypto.randomUUID(),number:'fixture',amount:100,method:'upi',gatewayProvider:'youpi',status:'to be paid',recipientUpi:'fixture@bank',expiresAt:Date.now()+300000};
 let state={orders:[order]},mode='ACTIVE',poll,draws=0;
 window.ColorWinYoupi={state:async()=>{if(mode==='ERROR')throw Error('Network unavailable');return {...order,status:mode==='SUCCESS'?'complete':mode==='PROCESSING'?'pending':'to be paid',gatewayStatus:mode};}};
 function QRCode(el){draws++;el.textContent='QR';}QRCode.CorrectLevel={M:1};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../dist/checkout.js'),'utf8'),{window,document:window.document,QRCode,location:{hash:'#/deposit/pay/'+order.id,href:'https://example.test/'},setInterval:(fn,ms)=>{if(ms===5000)poll=fn;return 1;},clearInterval:()=>{},URLSearchParams,Date});
 window.document.body.innerHTML=window.ColorWinCheckout.view(order);const page=window.document.body;
 window.ColorWinCheckout.bind(page,order,{read:()=>state,write:s=>{state=s;},toast:()=>{}});await new Promise(r=>setImmediate(r));
 const qr=page.querySelector('#payment-qr'),success=page.querySelector('#payment-success');assert.equal(draws,1);assert.equal(qr.hidden,false);assert.equal(success.hidden,true);
 mode='ERROR';poll();await new Promise(r=>setImmediate(r));assert.equal(qr.hidden,false);assert.equal(draws,1);
 mode='ACTIVE';poll();await new Promise(r=>setImmediate(r));assert.equal(draws,1);assert.equal(qr.hidden,false);
 mode='PROCESSING';poll();await new Promise(r=>setImmediate(r));assert.equal(qr.hidden,true);assert.equal(success.hidden,true);
 mode='SUCCESS';poll();await new Promise(r=>setImmediate(r));assert.equal(success.hidden,false);assert.match(success.textContent,/Payment successful/);assert.equal(page.querySelector('.checkout').classList.contains('checkout-payment-complete'),true);assert.equal(page.querySelector('#payment-expired').hidden,true);assert.equal(draws,1);
});
