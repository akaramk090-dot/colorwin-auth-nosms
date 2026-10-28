const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('dist/js/auth.js','utf8');
function device(server,id){
 let tick,focus,requests=[],signedOut=[],timers=[],events=[],clients=0,intervals=0;
 const session={user:{id:'player'},access_token:id};
 const client={auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>{},signInWithPassword:async()=>({data:{session}}),signOut:async o=>{signedOut.push(o.scope);return {}; }},rpc:async(name,args)=>{requests.push(args.p_claim);if(server.offline)return {error:{message:'network'}};if(args.p_claim&&(!server.winner||id>server.winner))server.winner=id;return {data:server.winner===id};},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{public_uid:123},error:null})})})})};
 const storage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
 const context={window:{COLORWIN_SUPABASE_CONFIG:{url:'https://test.supabase.co',key:'sb_publishable_test'},supabase:{createClient:()=>{clients++;return client;}},addEventListener:(e,f)=>focus=f,dispatchEvent:e=>events.push(e.type)},CustomEvent:class{constructor(type){this.type=type;}},localStorage:storage,sessionStorage:storage,setInterval:(f,ms)=>{assert.equal(ms,1000);intervals++;tick=f;},setTimeout:(f,ms)=>{timers.push({f,ms});},TypeError};
 vm.runInNewContext(source,context);
 return {auth:context.window.ColorWinAuth,tick:()=>tick(),focus:()=>focus(),requests,signedOut,events,timers,finish:()=>timers.shift().f(),counts:()=>[clients,intervals]};
}
test('new login signs the first device out locally without signing the winner out; old session cannot reclaim',async()=>{
 const server={},first=device(server,1),second=device(server,2);
 await first.auth.init(()=>{});await second.auth.init(()=>{});
 await first.auth.authenticate('login','123','test');await second.auth.authenticate('login','123','test');
 await first.tick();assert.equal(first.auth.session,null);assert.equal(first.auth.profile,null);assert.deepEqual(first.signedOut,[]);assert.deepEqual(first.events,['colorwin:session-replaced']);assert.equal(first.timers[0].ms,5000);first.finish();assert.deepEqual(first.signedOut,['local']);assert.ok(second.auth.session);
 await second.focus();assert.ok(second.auth.session);assert.deepEqual(second.requests,[true,false]);
 await assert.rejects(first.auth.authenticate('login','123','test'),/another device/);assert.equal(server.winner,2);
});
test('notification initialization cannot replace the page render subscriber or duplicate the auth client',async()=>{
 const server={},first=device(server,1),second=device(server,2);let page=0,notifications=0;
 await first.auth.init(()=>page++);await first.auth.init(()=>notifications++);assert.deepEqual(first.counts(),[1,1]);
 await second.auth.init(()=>{});await first.auth.authenticate('login','123','test');await second.auth.authenticate('login','123','test');
 const before=page;await first.tick();assert.equal(page,before);first.finish();assert.equal(page,before+1);assert.ok(notifications>=2);assert.equal(first.auth.session,null);
});
test('temporary polling errors retain the session but failed initial session claim fails closed',async()=>{
 const server={},d=device(server,1);await d.auth.init(()=>{});await d.auth.authenticate('login','123','test');
 server.offline=true;await d.tick();assert.ok(d.auth.session);
 const other=device(server,2);await other.auth.init(()=>{});await assert.rejects(other.auth.authenticate('login','123','test'),/check unavailable/);assert.equal(other.auth.session,null);assert.deepEqual(other.signedOut,['local']);
});
