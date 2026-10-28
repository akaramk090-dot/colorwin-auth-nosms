const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(require('os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto('http://127.0.0.1:5173/preview#/deposit');await page.locator('#deposit-amount').waitFor();
for(const route of ['login','register','deposit','withdraw','withdraw/add/upi','withdraw/add/bank','withdraw/add/usdt']){
await page.evaluate(route=>{ColorWinAuth.session=['login','register'].includes(route)?null:{user:{id:'preview'}};location.hash='#/'+route;},route);await page.waitForTimeout(100);
const fields=page.locator('input:visible:not([disabled]):not([type=hidden]):not([type=checkbox]):not([type=radio]):not([readonly]),textarea:visible');await fields.first().waitFor();
for(let i=0;i<await fields.count();i++){const field=fields.nth(i);await field.click();const styles=await field.evaluate(el=>{const s=getComputedStyle(el);return {outline:s.outlineStyle,shadow:s.boxShadow,tap:s.webkitTapHighlightColor};});assert.equal(styles.outline,'none',route);assert.equal(styles.shadow,'none',route);assert.equal(styles.tap,'rgba(0, 0, 0, 0)',route);}
console.log('PASS clean input focus: '+route);
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
