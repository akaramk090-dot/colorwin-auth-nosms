const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/salman/AppData/Local/npm-cache/_npx/af752b90495482d7/node_modules/playwright-core');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{try{sessionStorage.setItem('cw_welcome_login_preview:session','1');sessionStorage.setItem('cw_bonus_muted_login_preview:session',new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));}catch{}});
 await page.goto('http://127.0.0.1:5174/preview#/home');
 const frame=page.frames().find(f=>f.url().includes('source-home/index.html'));
 await frame.locator('.top-games__item').first().waitFor();
 await page.locator('#cw-live-loader').waitFor({state:'hidden'});
 await frame.evaluate(()=>{window.launchResponses=[];window.addEventListener('message',e=>{if(e.data?.type==='cw-source-response')launchResponses.push(e.data);});window.timeoutSeen=false;new MutationObserver(()=>{if(document.body.innerText.includes('Game loading timed out'))window.timeoutSeen=true;}).observe(document.body,{childList:true,subtree:true});});
 await frame.locator('.top-games__item').first().click();
 await frame.getByRole('button',{name:'Confirm',exact:true}).click();
 await page.waitForFunction(()=>location.hash==='#/games/play/800');
 await page.evaluate(()=>location.hash='#/home');
 await page.waitForFunction(()=>location.hash==='#/home'&&!document.querySelector('.source-frame-page').hidden);
 await page.waitForTimeout(11500);
 const result=await frame.evaluate(()=>({timeoutSeen,handled:launchResponses.some(r=>r.result?.handled===true),dialogs:[...document.querySelectorAll('.van-dialog')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.textContent)}));
 assert.equal(result.handled,true);assert.equal(result.timeoutSeen,false);assert.equal(result.dialogs.some(s=>s.includes('Game loading timed out')),false);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({nativeGameOpened:true,homeFramePreserved:page.frames().includes(frame),...result,errors}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

