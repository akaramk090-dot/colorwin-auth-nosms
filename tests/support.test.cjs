const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const dist=path.resolve(__dirname,'../dist');
const ctx={URL,localStorage:{getItem:()=>null},window:{ColorWinAuth:{session:{user:{id:'preview'}}},ColorWinBanks:['State Bank of India']}};
vm.createContext(ctx);
for(const file of ['account-pages.js','social-config.js','support.js'])vm.runInContext(fs.readFileSync(path.join(dist,file),'utf8'),ctx);
const {ColorWinAccount:account,ColorWinSupport:support}=ctx.window;
test('Customer Service dispatches to support without being intercepted by account subpages',()=>{
 assert.equal(account.routes.Customer,'#/support');
 for(const route of ['#/support','#/support/progress','#/support/bank-rebind/manual']){
  assert.equal(account.matches(route),false);assert.equal(support.matches(route),true);
 }
 assert.equal(account.matches('#/account/settings'),true);
});
test('Every support topic renders and references existing bundled assets',()=>{
 const home=support.view('#/support');
 const routes=[...home.matchAll(/href="(#\/support\/[^"/]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(routes).size,11);
 for(const route of ['#/support',...routes,'#/support/deposit/request','#/support/withdrawal/request','#/support/password/contact']){
  const html=support.view(route);assert.doesNotMatch(html,/Page not found|undefined/);
  for(const [,asset] of html.matchAll(/src="(assets\/[^\"]+)"/g))assert.ok(fs.existsSync(path.join(dist,asset)),asset);
 }
});
test('Support password link uses the existing verified Settings change-password form',()=>{
 const home=support.view('#/support');
 assert.match(home,/href="#\/account\/settings\/password"[^>]*>.*?Change ID Login Password/);
 assert.doesNotMatch(home,/data-choice="password"/);
 assert.equal(support.view('#/support/password'),account.view('#/account/settings/password'));
});
test('Bank name uses the withdrawal picker and unavailable OTP cannot claim success',()=>{
 const bank=support.view('#/support/bank-name');
 assert.match(bank,/id="cs-choose-bank"/);
 assert.match(bank,/name="bank_name"/);
 assert.doesNotMatch(bank,/<select/);
 const otp=support.view('#/support/upi-rebind/contact');
 assert.match(otp,/SMS verification is not enabled/);assert.match(otp,/type="submit" disabled/);
});
test('Official Channel opens the configured Telegram link and keeps unspecified accounts inactive',()=>{
 const html=support.view('#/support/official');
 assert.match(html,/href="https:\/\/t.me\/\+7nI6oZj0wttkYzRl" target="_blank" rel="noopener noreferrer"/);
 for(const name of ['Instagram','X','YouTube','Facebook'])assert.ok(html.includes(`aria-label="${name} link coming soon"`));
});
