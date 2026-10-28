const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{parseHTML}=require('linkedom');
const code=fs.readFileSync(require('node:path').join(__dirname,'../dist/activity.js'),'utf8');
function setup(route,rpc){const {window}=parseHTML('<html><body></body></html>');window.ColorWinAuth={session:{user:{id:'fixture'}},accountRpc:rpc};let refreshed=0;window.ColorWinAccount={refreshBalance:async()=>refreshed++};vm.runInNewContext(code,{window,document:window.document,location:{hash:route}});const api=window.ColorWinActivity;window.document.body.innerHTML=api.view('','',()=>'',route);return {window,api,refreshed:()=>refreshed};}
const ready={claimed_days:0,earned:0,approved_today:300,next_day:1,required:300,reward:5,reason:'eligible',eligible:true,history:[]};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('Attendance reads server eligibility, claims and refreshes wallet without advancing twice',async()=>{
 const calls=[];const ctx=setup('#/activity/dailysignin',async(name,args)=>{calls.push(args.p_claim);return args.p_claim?{...ready,claimed_days:1,earned:5,next_day:2,required:1000,reward:18,reason:'claimed_today',eligible:false}:ready;});
 ctx.api.bind();await settle();const button=ctx.window.document.querySelector('.attendance-claim');assert.equal(button.disabled,false);assert.match(button.textContent,/Claim Day 1/);button.click();await settle();assert.equal(button.disabled,true);assert.equal(button.textContent,'Claimed today');assert.equal(ctx.refreshed(),1);assert.deepEqual(calls,[false,true]);assert.equal(ctx.window.document.querySelectorAll('.is-claimed').length,1);
});
test('Attendance history shows actual claims and rules contain approved daily deposit thresholds',async()=>{
 const ctx=setup('#/activity/dailysignin/history',async()=>({...ready,history:[{day:1,date:'2026-10-07',reward:5,approved_total:350}]}));ctx.api.bind();await settle();assert.match(ctx.window.document.querySelector('.attendance-history').textContent,/Day 1.*₹5.00/);assert.match(ctx.window.document.body.textContent,/350.00/);
 const rules=ctx.api.view('','',()=>'', '#/activity/dailysignin/rules');assert.match(rules,/10,00,000/);assert.match(rules,/Multiple approved deposits/);assert.doesNotMatch(rules,/not active yet/);
});
test('Late attendance response cannot update a different signed-in user',async()=>{
 let resolve;const ctx=setup('#/activity/dailysignin',()=>new Promise(r=>resolve=r));ctx.api.bind();ctx.window.ColorWinAuth.session.user.id='other';resolve(ready);await settle();assert.equal(ctx.window.document.querySelector('.attendance-claim').disabled,true);
});
