const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
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
test('Live VIP rewards start disabled until authenticated server data confirms eligibility',()=>{
 const html=load('real-account').view('#/vip');
 assert.match(html,/id="vip-experience">0/);
 assert.doesNotMatch(html,/vip-carousel-controls|id="vip-prev"|id="vip-next"/);
 assert.match(html,/class="vip-user-avatar"/);
 assert.doesNotMatch(html,/vip-programme-note|◇/);
 assert.match(html,/data-vip-claim="1" disabled>Checking eligibility…<\/button>/);
 assert.doesNotMatch(html,/Successfully claimed|625 EXP/);
});
test('Member names are escaped in the VIP profile',()=>{
 const html=load('preview','<img src=x onerror=alert(1)>').view('#/vip');
 assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
 assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
});
test('Eligible members can claim a server-verified level reward once and see it in history',async()=>{
 const {window,document}=parseHTML('<html><body><main id="app"></main></body></html>');
 let balanceRefreshes=0;const calls=[],toasts=[];
 const data={experience:3000,claimed_levels:[],history:[]};
 window.ColorWinAuth={
  session:{user:{id:'vip-test-user'}},
  accountRpc:async(name,args)=>{
   calls.push([name,args]);
   if(name==='colorwin_vip_data')return data;
   if(name==='colorwin_vip_claim'){data.claimed_levels=[1];data.history=[{title:'VIP1 level-up reward',amount:60,created_at:'2026-01-01T00:00:00.000Z'}];return data;}
   throw Error('Unexpected RPC');
  }
 };
 window.ColorWinAccount={avatar:()=>'',nickname:()=> 'Member',refreshBalance:async()=>{balanceRefreshes++;}};
 window.matchMedia=()=>({matches:true});
 const context={Intl,Date,window,document};
 vm.runInNewContext(fs.readFileSync(path.join(dist,'vip.js'),'utf8'),context);
 const vip=window.ColorWinVIP;
 document.querySelector('#app').innerHTML=vip.view('#/vip');
 await vip.bind('#/vip',(...args)=>toasts.push(args));
 const claim=document.querySelector('[data-vip-claim="1"]');
 assert.equal(claim.disabled,false);
 assert.equal(claim.textContent,'Claim reward');
 claim.dispatchEvent(new window.Event('click',{bubbles:true}));
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.deepEqual(calls.map(([name])=>name),['colorwin_vip_data','colorwin_vip_claim']);
 assert.equal(calls[1][1].p_level,1);
 assert.equal(document.querySelector('[data-vip-claim="1"]').disabled,true);
 assert.match(document.querySelector('[data-vip-claim="1"]').textContent,/Reward claimed/);
 assert.equal(balanceRefreshes,1);
 assert.match(document.querySelector('#vip-tab-content').textContent,/VIP1 level-up reward/);
 assert.deepEqual(toasts,[['VIP1 reward ₹60 claimed.']]);
});
