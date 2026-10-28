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
    await page.route('**/js/auth.js', route => route.fulfill({contentType:'text/javascript',body:'window.ColorWinAuth={ready:true,session:null,profile:null,init:fn=>fn()};'}));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    for (const width of [320, 360, 390, 430, 480, 768]) {
      await page.setViewportSize({ width, height: 740 });
      for (const route of ['login', 'register', 'privacy', 'home', 'activity', 'account', 'games/slots']) {
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
