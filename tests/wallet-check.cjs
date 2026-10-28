const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:5173/preview#/account');
    await page.locator('.enter-wallet').click();await page.locator('.wallet-rings').waitFor();assert.ok(page.url().endsWith('#/wallet'));
    await page.locator('#wallet-transfer').click();assert.match(await page.locator('#wallet-transfer-status').innerText(),/No funds/);
    for(const width of [320,360,390,430,768]){
      await page.setViewportSize({width,height:844});
      for(const route of ['wallet','deposit','withdraw','deposit/history','withdraw/history','withdraw/add/upi','withdraw/add/bank','withdraw/add/usdt']){
        await page.evaluate(route=>location.hash='#/'+route,route);await page.locator('.wallet-page').waitFor();await page.waitForTimeout(60);
        const scroll=await page.evaluate(()=>document.documentElement.scrollWidth);assert.ok(scroll<=width,route+' overflow at '+width+': '+scroll);
        if(width===390)await page.screenshot({path:'tests/wallet-'+route.replaceAll('/','-')+'.png',fullPage:true});
      }
      console.log('PASS all wallet layouts '+width+'px');
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>location.hash='#/deposit');await page.locator('#create-deposit').waitFor();assert.ok(await page.locator('#create-deposit').isDisabled());
    await page.locator('#deposit-amount').fill('99');assert.ok(await page.locator('#create-deposit').isDisabled());
    await page.locator('#deposit-amount').fill('100.001');assert.ok(await page.locator('#create-deposit').isDisabled());
    await page.locator('[data-amount="300"]').click();assert.equal(await page.locator('#deposit-amount').inputValue(),'300');
    await page.locator('[data-pay="paytm"]').click();await page.locator('#create-deposit').click();await page.locator('#payment-qr canvas').waitFor({state:'attached'});
    const payload=await page.locator('#payment-qr').getAttribute('title');assert.match(payload,/upi:\/\/pay\?/);const params=new URL(payload).searchParams;assert.ok((await page.evaluate(()=>window.ColorWinPaymentConfig.upiIds)).includes(params.get('pa')));assert.equal(params.get('pn'),'Color Win');assert.equal(params.get('am'),'300.00');
    assert.match(await page.locator('#payment-timer').textContent(),/^0?9:5\d$|^10:00$/);
    await page.screenshot({path:'tests/wallet-payment.png',fullPage:true});
    const id=page.url().split('/').at(-1);await page.reload();await page.locator('#payment-qr canvas').waitFor({state:'attached'});assert.ok(page.url().endsWith(id));
    await page.locator('#payment-check').click();assert.match(await page.locator('#payment-status').textContent(),/stays unpaid/);
    await page.evaluate(()=>{const key='cw_wallet_demo_preview',s=JSON.parse(sessionStorage.getItem(key));s.orders[0].expiresAt=Date.now()-100;sessionStorage.setItem(key,JSON.stringify(s));});await page.reload();await page.locator('#payment-expired').waitFor();assert.equal(await page.locator('#payment-timer').textContent(),'00:00');assert.ok(await page.locator('#payment-check').isDisabled());
    await page.evaluate(()=>location.hash='#/deposit/history');await page.locator('.wallet-order').waitFor();assert.match(await page.locator('.wallet-order').textContent(),/Expired/);
    await page.locator('#history-status').click();await page.locator('[data-value="Complete"]').click();await page.locator('[data-confirm]').click();assert.equal(await page.locator('.wallet-order').count(),0);
    await page.locator('#history-status').click();await page.locator('[data-value="All"]').click();await page.locator('[data-confirm]').click();assert.equal(await page.locator('.wallet-order').count(),1);
    await page.locator('#history-date').click();await page.locator('[data-part="Year"][data-value="2025"]').click();await page.locator('[data-confirm]').click();assert.equal(await page.locator('.wallet-order').count(),0);
    await page.evaluate(()=>location.hash='#/withdraw/add/upi');await page.locator('#payout-form').waitFor();
    await page.locator('[name="name"]').fill('Test Member');await page.locator('[name="phone"]').fill('9876543210');await page.locator('[name="account"]').fill('test.member@ybl');await page.locator('[name="confirm"]').fill('other@ybl');assert.ok(await page.locator('.payout-save').isEnabled());await page.locator('.payout-save').click();assert.ok(await page.locator('#toast.show').count());
    await page.locator('[name="confirm"]').fill('test.member@ybl');await page.locator('.payout-save').click();await page.locator('.payout-saved').waitFor();assert.match(await page.locator('.payout-saved').textContent(),/test.member@ybl/);
    await page.locator('#withdraw-amount').fill('100');assert.ok(await page.locator('#submit-withdraw').isDisabled());assert.match(await page.locator('#withdraw-error').textContent(),/Insufficient/);
    await page.evaluate(()=>location.hash='#/withdraw/add/bank');await page.locator('#payout-form').waitFor();assert.equal(await page.locator('[name="name"]').inputValue(),'Test Member');assert.ok(await page.locator('[name="name"]').getAttribute('readonly')!==null);
    await page.locator('#choose-bank').click();assert.equal(await page.locator('.bank-picker [data-confirm]').count(),0);await page.locator('[data-value="HDFC Bank"]').click();await page.locator('.bank-picker').waitFor({state:'detached'});assert.equal(await page.locator('[name=bank]').inputValue(),'HDFC Bank');await page.locator('[name="account"]').fill('123456789012');assert.equal(await page.locator('[name="confirm"]').count(),0);await page.locator('[name="phone"]').fill('9876543210');await page.locator('[name="email"]').fill('test@example.com');await page.locator('[name="ifsc"]').fill('HDFC0001234');await page.locator('.payout-save').click();await page.locator('.withdraw-tabs').waitFor();
    await page.evaluate(()=>location.hash='#/withdraw/add/usdt');await page.locator('[name="account"]').fill('not-an-address');await page.locator('[name="alias"]').fill('My wallet');assert.ok(await page.locator('.payout-save').isEnabled());await page.locator('.payout-save').click();assert.ok(await page.locator('#toast.show').count());
    await page.locator('#choose-network').click();await page.locator('[data-value="ERC20"]').click();await page.locator('[data-confirm]').click();await page.locator('[name="account"]').fill('0x'+'a'.repeat(40));await page.locator('.payout-save').click();await page.locator('.withdraw-tabs').waitFor();
    assert.equal(await page.locator('[data-withdraw-method="usdt"]').getAttribute('aria-pressed'),'true');assert.match(await page.locator('.payout-saved').textContent(),/My wallet/);
    assert.ok(await page.locator('#withdraw-usdt-field').isVisible());assert.ok(await page.locator('.wallet-balance').isVisible());assert.match(await page.locator('#withdraw-rate').textContent(),/1 USDT = ₹104\.00/);assert.equal(await page.locator('#withdraw-network').textContent(),'ERC20');
    await page.locator('#withdraw-amount').fill('104');assert.equal(await page.locator('#withdraw-usdt').inputValue(),'1');
    await page.locator('#withdraw-amount').fill('312');assert.equal(await page.locator('#withdraw-usdt').inputValue(),'3');await page.locator('#withdraw-usdt').fill('2.5');assert.equal(await page.locator('#withdraw-amount').inputValue(),'260');assert.ok(await page.locator('#submit-withdraw').isDisabled());
    await page.locator('#withdraw-amount').fill('52');assert.equal(await page.locator('#withdraw-usdt').inputValue(),'0.5');await page.locator('#withdraw-usdt').fill('0.125');assert.equal(await page.locator('#withdraw-amount').inputValue(),'13');
    await page.locator('#withdraw-usdt').fill('');assert.equal(await page.locator('#withdraw-amount').inputValue(),'');await page.reload();await page.locator('#withdraw-usdt-field').waitFor();assert.ok(await page.locator('.wallet-balance').isVisible());assert.match(await page.locator('#withdraw-rate').textContent(),/104\.00/);
    await page.locator('#withdraw-usdt').fill('-1');assert.equal(await page.locator('#withdraw-amount').inputValue(),'');assert.match(await page.locator('#withdraw-error').textContent(),/valid positive/);
    await page.locator('#withdraw-all').click();assert.equal(await page.locator('#withdraw-usdt').inputValue(),'0');
    await page.screenshot({path:'tests/withdraw-usdt-converter.png',fullPage:true});
    await page.locator('[data-withdraw-method="bank"]').click();assert.match(await page.locator('.saved-bank-number').textContent(),/^123456\*{4}012$/);assert.match(await page.locator('.saved-bank-brand').textContent(),/HDFC Bank/);assert.ok(await page.locator('#withdraw-presets').isHidden());await page.screenshot({path:'tests/withdraw-saved-bank.png',fullPage:true});
    await page.locator('#withdraw-beneficiary').click();assert.match(await page.locator('.wallet-picker').textContent(),/Choose beneficiary/);await page.locator('[data-confirm]').click();
    await page.locator('[data-withdraw-method="upi"]').click();await page.locator('[data-withdraw-amount="5000"]').click();assert.equal(await page.locator('#withdraw-amount').inputValue(),'5000');assert.match(await page.locator('.saved-recipient-account').textContent(),/test.member@ybl/);await page.screenshot({path:'tests/withdraw-saved-upi.png',fullPage:true});
    await page.evaluate(()=>sessionStorage.clear());await page.reload();await page.locator('.withdraw-tabs').waitFor();assert.equal(await page.locator('.wallet-header a').first().getAttribute('href'),'#/account');
    for(const kind of ['upi','bank','usdt']){await page.locator('[data-withdraw-method="'+kind+'"]').click();assert.equal(await page.locator('.payout-saved').count(),1);assert.equal(await page.locator('.payout-add').getAttribute('href'),'#/withdraw/add/'+kind);}
    await page.evaluate(()=>location.hash='#/withdraw/add/upi');await page.locator('[name="phone"]').fill('12');assert.equal(await page.locator('#payout-error').count(),0);assert.ok(await page.locator('.payout-neon-icon').evaluateAll(images=>images.length>=4&&images.every(i=>i.complete&&i.naturalWidth>0)));
    await page.evaluate(()=>location.hash='#/withdraw/history');await page.locator('#history-status').click();assert.ok(await page.locator('[data-value="Processing"]').count());assert.ok(await page.locator('[data-value="Rejected"]').count());await page.locator('[data-cancel]').click();
    await page.evaluate(()=>location.hash='#/account');await page.locator('[data-account-panel="Deposit History"]').click();assert.ok(page.url().endsWith('#/deposit/history'));
    await page.evaluate(()=>location.hash='#/home');await page.locator('[data-home-topbar-route="#/deposit"]').first().click();await page.locator('#deposit-amount').waitFor();
    assert.deepEqual(errors,[]);console.log('PASS account/home routes, amount validation, UPI payload, QR refresh/expiry, history filters, UPI/bank/USDT methods, name lock and zero-balance withdrawal');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});


