const assert=require('node:assert/strict');const {chromium}=require('C:/Users/salman/AppData/Local/npm-cache/_npx/af752b90495482d7/node_modules/playwright-core');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{sessionStorage.setItem('cw_welcome_login_preview:session','1');sessionStorage.setItem('cw_bonus_muted_login_preview:session',new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));});
 await page.goto('http://127.0.0.1:5173/preview#/home');await page.waitForTimeout(800);
 await page.locator('[data-source-section="slot"] [data-source-all]').click();assert.equal(await page.locator('[data-source-section="slot"] .source-game').count(),10);
 await page.locator('[data-source-section="slot"] [data-source-all]').click();assert.equal(await page.locator('[data-source-section="slot"] .source-game').count(),6);
 await page.locator('[data-source-section="slot"] [data-source-step="1"]').click();assert.equal(await page.locator('[data-source-section="slot"] .source-game').count(),4);
 await page.locator('[data-source-jump="lottery"]').click();assert.equal(new URL(page.url()).hash,'#/home');
 await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(600);await page.screenshot({path:'reference-home/implemented-home-clean.png',fullPage:true});
 for(const game of ['k3','5d','trx-wingo']){
  await page.goto('http://127.0.0.1:5173/preview?check='+game+'#/games/play/'+game);await page.waitForTimeout(400);
  if(game==='trx-wingo')await page.route('**/functions/v1/trx-lottery',async route=>{const body=route.request().postDataJSON();const state=await page.evaluate(({action,data})=>window.testLotRequest(action,data),{action:body.action,data:body.data});await route.fulfill({json:state});});
  await page.evaluate(g=>{
   window.testLotCalls=[];let balance=100,bets=[];
   window.testLotRequest=(action,d)=>{window.testLotCalls.push({action,data:d});if(action==='bet'){balance-=d.amount;bets=[{id:'test',selection:d.selection,round_index:d.round,stake:d.amount,status:'pending',payout:0}];}return {balance,lane:d.lane,round:100,remaining:45,history:[{index:99,numbers:g==='k3'?[1,2,3]:g==='5d'?[1,2,3,4,5]:[7]}],bets};};
   window.ColorWinAuth={session:{user:{id:'ui-fixture'},access_token:'ui-fixture'}};
   window.ColorWinOperations.rpc=async(name,args)=>{if(name==='colorwin_lottery')return window.testLotRequest(args.p_action,args.p_data);throw Error('Unexpected test RPC');};
   window.ColorWinLottery.bind();
  },game);
  await page.locator('.lottery-ready').waitFor();const choice=game==='5d'?'A:0':game==='k3'?'Big':'Green';
  await page.locator(`[data-lottery-select="${choice}"]`).click();await page.locator('.lottery-sheet input').fill('5');await page.locator('.lottery-sheet button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-lottery-sheet]').hidden);
  assert.equal(await page.locator('[data-lottery-balance]').textContent(),'₹95.00');
  const bets=await page.evaluate(()=>window.testLotCalls.filter(x=>x.action==='bet'));assert.equal(bets.length,1);assert.equal(bets[0].data.amount,5);assert.ok(bets[0].data.request_id);
  await page.locator('[data-lottery-tab="bets"]').click();assert.match(await page.locator('[data-lottery-history]').textContent(),/Pending/);
  await page.screenshot({path:'reference-home/'+game+'-connected.png',fullPage:true});console.log(game+': bet sheet, request, balance and history pass (isolated UI fixture)');
 }
 assert.deepEqual(errors,[]);console.log('Home paging and category navigation pass; no browser exceptions.');await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
