const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('dist/js/auth.js','utf8');
async function setup(verifiedId='u1',email='member@example.com',fallbackOK=true){
  const calls=[];const user={id:'u1',email};
  const main={auth:{getSession:async()=>({data:{session:{user}}}),getUser:async()=>({data:{user}}),onAuthStateChange:()=>{},signInWithPassword:async()=>({data:{session:null},error:{code:'invalid_credentials'}}),setSession:async tokens=>{calls.push(['setSession',tokens]);return {data:{session:{user}},error:null};},updateUser:async value=>{calls.push(['update',value]);return {error:null};}},rpc:async()=>({data:true,error:null}),from:()=>({select:()=>({eq:()=>({single:async()=>({data:{id:'u1'},error:null})})})})};
  const verifier={auth:{signInWithPassword:async()=>({data:{user:{id:verifiedId}},error:null}),signOut:async options=>{calls.push(['signOut',options.scope]);return {error:null};}}};
  const storage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
  let instances=0;const context={window:{COLORWIN_SUPABASE_CONFIG:{url:'https://test.supabase.co',key:'sb_publishable_test'},supabase:{createClient:()=>instances++?verifier:main}},localStorage:storage,sessionStorage:storage,setTimeout,TypeError,fetch:async(url,options)=>{calls.push(['fetch',url,JSON.parse(options.body)]);return {ok:fallbackOK,json:async()=>fallbackOK?{session:{access_token:'test-access',refresh_token:'test-refresh'}}:{error:'Incorrect phone or password'}};}};
  vm.runInNewContext(source,context);const auth=context.window.ColorWinAuth;await auth.init(()=>{});return {auth,calls};
}
test('password changes reject a verifier session belonging to another user',async()=>{
  const {auth,calls}=await setup('u2');
  await assert.rejects(auth.changePassword('old-test-only','new-test-only'),/Current password is incorrect/);
  assert.equal(calls.some(c=>c[0]==='update'),false);
  assert.equal(calls[0][1],'local');
});
test('password changes update only after verification and close only the temporary session',async()=>{
  const {auth,calls}=await setup();await auth.changePassword('old-test-only','new-test-only');
  assert.equal(calls[0][0],'update');assert.equal(calls[0][1].password,'new-test-only');
  assert.equal(calls[1][1],'local');assert.equal(auth.session.user.id,'u1');
});
test('phone mailbox changes use the verified Supabase email-change flow',async()=>{
  const {auth,calls}=await setup('u1','phone_910000000000@auth.colorwin.invalid');
  await auth.sendEmailChange('member@example.com');
  assert.equal(calls[0][1].email,'member@example.com');
});
test('mailbox phone-login fallback installs the authenticated server session',async()=>{
  const {auth,calls}=await setup();await auth.authenticate('login','+910000000000','test-only');
  assert.equal(calls[0][1],'https://test.supabase.co/functions/v1/account-phone-login');
  assert.equal(calls[0][2].phone,'+910000000000');
  assert.equal(calls[1][0],'setSession');assert.equal(calls[1][1].access_token,'test-access');
});
test('failed server password validation cannot install a session',async()=>{
  const {auth,calls}=await setup('u1','member@example.com',false);
  await assert.rejects(auth.authenticate('login','+910000000000','wrong-test-only'),/Incorrect phone or password/);
  assert.equal(calls.some(c=>c[0]==='setSession'),false);
});
