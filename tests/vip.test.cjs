const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dist=path.resolve(__dirname,'../dist');
function load(id='preview',name='Member'){
 const ctx={Intl,Date,window:{ColorWinAuth:{session:{user:{id}}},ColorWinAccount:{nickname:()=>name}}};
 vm.runInNewContext(fs.readFileSync(path.join(dist,'vip.js'),'utf8'),ctx);return ctx.window.ColorWinVIP;
}
test('VIP renders ten reachable tier cards with all referenced local assets',()=>{
 const vip=load(),html=vip.view('#/vip');
 assert.equal((html.match(/class="vip-tier"/g)||[]).length,10);
 assert.equal(vip.tiers.length,10);assert.equal(vip.tiers[9].experience,10000000000);
 assert.ok(vip.tiers.every((t,i)=>t.level===i+1&&(!i||t.experience>vip.tiers[i-1].experience)));
 for(const [,asset] of html.matchAll(/src="(assets\/[^\"]+)"/g))assert.ok(fs.existsSync(path.join(dist,asset)),asset);
 assert.ok(vip.matches('#/vip/history'));assert.match(vip.view('#/vip/history'),/VIP History/);
});
test('Live accounts without a VIP ledger do not display made-up experience or active reward claims',()=>{
 const html=load('real-account').view('#/vip');
 assert.match(html,/id="vip-experience">0/);
 assert.doesNotMatch(html,/vip-carousel-controls|id="vip-prev"|id="vip-next"/);
 assert.match(html,/class="vip-user-avatar"/);
 assert.doesNotMatch(html,/vip-programme-note|◇/);
 assert.doesNotMatch(html,/data-claim|Successfully claimed|625 EXP/);
});
test('Member names are escaped in the VIP profile',()=>{
 const html=load('preview','<img src=x onerror=alert(1)>').view('#/vip');
 assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
 assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
});
