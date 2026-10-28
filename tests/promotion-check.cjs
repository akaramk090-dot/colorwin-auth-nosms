const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
let playwright;
try { playwright = require('playwright'); }
catch {
  playwright = require(path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
}
const { chromium } = playwright;
const root = path.resolve(__dirname, '../dist');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'})[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 640 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // All checks use a local auth stub; no real account or backend requests.
    await page.route('**/js/auth.js', route => route.fulfill({contentType:'text/javascript',body:'window.ColorWinAuth={ready:true,session:null,profile:null,promotion:async()=>({invitation_code:"10000000001",direct:[{uid:123456,phone_last4:"4321",deposit_amount:750,deposit_count:2,created_at:"2026-10-01T12:00:00Z"}],direct_stats:{registers:1,deposit_count:2,deposit_amount:750,first_deposits:1},team_stats:{registers:1,deposit_count:2,deposit_amount:750,first_deposits:1},this_week:1}),init:fn=>fn()};'}));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    for (const width of [320, 360, 390, 430, 480, 768]) {
      await page.setViewportSize({ width, height: 740 });
      for (const route of ['login', 'register', 'privacy', 'home', 'activity', 'account', 'games/slots', 'promotion']) {
        await page.evaluate(route => {
          ColorWinAuth.session = ['login','register','privacy'].includes(route) ? null : {user:{id:'test'}};
          location.hash = '#/' + route;
        }, route);
        await page.waitForTimeout(100);
        const metrics = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, fields: Array.from(document.querySelectorAll('.phone-row .input-shell')).map(el=>el.getBoundingClientRect().width) }));
        assert.ok(metrics.scroll <= width, `${route} overflow at ${width}: ${metrics.scroll}`);
        assert.ok(metrics.fields.every(w=>w>100), `${route} phone input too small: ${metrics.fields}`);
        if (route === 'login' || route === 'register') {
          await page.locator('.country-toggle').click();
          await page.locator('.hero').click();
          assert.equal(await page.locator('.country-toggle').getAttribute('aria-expanded'), 'false');
        }
      }
      console.log(`PASS layouts and dropdowns: ${width}px`);
    }

    await page.evaluate(()=>{
      const now=new Date(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
      ColorWinAuth.session={user:{id:'test'}};
      ColorWinAuth.promotion=async()=>({invitation_code:'10000000001',members:[{uid:123456,tier:1,phone_last4:'4321',deposit_count:2,deposit_amount:750,first_deposit_amount:500,created_at:now.toISOString()},{uid:654321,tier:6,phone_last4:'1234',deposit_count:0,deposit_amount:0,created_at:now.toISOString()}],direct_stats:{registers:1,deposit_count:2,deposit_amount:750,first_deposits:1},team_stats:{registers:2,deposit_count:2,deposit_amount:750,first_deposits:1},this_week:1,commissions:[{date,settled_at:now.toISOString(),bettors:8,bet_amount:2375.56,payout:0}]});
      location.hash='#/promotion';
    });
    await page.locator('#promo-code').waitFor();
    assert.equal(await page.locator('.promo-gold').first().textContent(),'750');
    assert.equal(await page.locator('.promo-invite img').count(),0);
    await page.context().grantPermissions(['clipboard-read','clipboard-write']);
    await page.locator('[data-promo="code"]').click();
    assert.ok(page.url().endsWith('#/promotion'));
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'10000000001');
    for(const width of [320,390,430,768]){
      await page.setViewportSize({width,height:844});
      for(const option of ['new','rewards','subordinates','commission','rules','support','rebate']){
        await page.evaluate(option=>location.hash='#/promotion/'+option,option);
        await page.locator('.agency-layout').waitFor();
        await page.waitForTimeout(100);
        const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>[e.className,e.getBoundingClientRect().right]).slice(0,12)}));if(overflow.scroll>width)console.log(overflow);assert.ok(overflow.scroll<=width,option+' overflows '+width);
        if(width===390)await page.screenshot({path:'tests/promotion-'+option+'.png',fullPage:true});
      }
      console.log('PASS all promotion subpages at '+width+'px');
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>location.hash='#/promotion/subordinates');
    await page.locator('.agency-member-detail').first().waitFor();
    assert.ok((await page.locator('.agency-member-detail').first().innerText()).includes('****4321'));
    assert.equal(await page.locator('.agency-member-detail').count(),2);
    await page.locator('#agency-tier').click();
    await page.locator('[data-tier="6"]').click();
    await page.locator('[data-confirm]').click();
    assert.equal(await page.locator('.agency-member-detail').count(),1);
    assert.ok((await page.locator('.agency-member-detail').innerText()).includes('654321'));
    await page.locator('#agency-uid').fill('99999');
    await page.locator('.agency-search button').click();
    assert.equal(await page.locator('.agency-member-detail').count(),0);
    await page.locator('#agency-date').click();
    await page.locator('[data-part="Year"][data-value="2025"]').click();
    await page.locator('[data-cancel]').click();
    assert.ok(!(await page.locator('#agency-date').innerText()).includes('2025'));
    await page.locator('#agency-date').click();
    await page.locator('[data-part="Year"][data-value="2025"]').click();
    await page.locator('[data-confirm]').click();
    assert.ok((await page.locator('#agency-date').innerText()).includes('2025'));
    assert.equal(await page.locator('.agency-member-detail').count(),0);
    await page.evaluate(()=>location.hash='#/promotion/commission');
    await page.locator('#agency-date').click();
    const now=new Date();
    await page.locator('[data-part="Day"][data-value="'+now.getDate()+'"]').click();
    await page.locator('[data-confirm]').click();
    await page.locator('.agency-settlement').waitFor();
    assert.ok((await page.locator('.agency-settlement').innerText()).includes('2,375.56'));
    await page.screenshot({path:'tests/promotion-commission.png',fullPage:true});
    await page.evaluate(()=>location.hash='#/promotion/new');
    await page.locator('.agency-new-list').waitFor();
    assert.ok((await page.locator('.agency-new-list').innerText()).includes('123456'));
    await page.locator('[data-period="1"]').click();
    assert.equal(await page.locator('.agency-new-list').count(),0);
    await page.locator('[data-period="2"]').click();
    assert.equal(await page.locator('.agency-new-list').count(),1);
    await page.evaluate(()=>location.hash='#/promotion/rebate');
    await page.locator('.agency-rebate-card').first().waitFor();
    assert.equal(await page.locator('.agency-rebate-card').count(),6);
    assert.ok((await page.locator('.agency-rebate-card').last().innerText()).includes('0.016608%'));
    await page.locator('[data-category="casino"]').click();
    assert.ok((await page.locator('.agency-note').innerText()).includes('awaiting configuration'));
    await page.evaluate(()=>location.hash='#/promotion/support');
    assert.equal(await page.locator('.agency-telegram').getAttribute('href'),'https://t.me/+7nI6oZj0wttkYzRl');
    await page.evaluate(()=>location.hash='#/promotion/link');
    await page.locator('.promo-copy-field').waitFor();
    assert.ok((await page.locator('.promo-copy-field').inputValue()).includes('?invite=10000000001#/register'));
    console.log('PASS direct copy, period tabs, Tier 6, search, date cancel, rates and Telegram link');
    await page.goto('http://127.0.0.1:'+server.address().port+'/?invite=10000000001#/register');
    await page.locator('#invite').waitFor();
    assert.equal(await page.locator('#invite').inputValue(),'10000000001');
    console.log('PASS promotion details, masked phone, deposits and referral auto-fill');
    await page.setViewportSize({width:480,height:240});
    await page.evaluate(()=>{window.captchaResult=null;openSlideCaptcha().then(value=>window.captchaResult=value);});
    await page.waitForFunction(()=>!document.querySelector('.captcha_handler').disabled);
    const canvasFits = await page.evaluate(()=>{const c=document.querySelector('.puzzle-captcha__background');return Math.abs(c.width-c.clientWidth)<=1 && Math.abs(c.height-c.clientHeight)<=1;});
    assert.ok(canvasFits, 'Captcha canvas must match its visible size');
    await page.locator('.captcha-close').click();
    await page.waitForFunction(()=>window.captchaResult===false);
    assert.deepEqual(errors, []);
    console.log('PASS captcha sizing/cancel and no JavaScript errors');
  } finally { await browser.close(); server.close(); }
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});

