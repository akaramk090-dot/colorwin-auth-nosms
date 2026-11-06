const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const script=fs.readFileSync(path.resolve(__dirname,'../dist/admin-access.js'),'utf8');
const admin=fs.readFileSync(path.resolve(__dirname,'../dist/admin.js'),'utf8');
const sql=fs.readFileSync(path.resolve(__dirname,'../supabase/admin-panel-separation.sql'),'utf8');
function createAuth(responses,initialSession=''){
 const values=new Map(initialSession?[['cw_admin_key_session',initialSession]]:[]),calls=[];
 const sessionStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
 const fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});const result=responses.shift();return {ok:true,json:async()=>result};};
 const window={COLORWIN_SUPABASE_CONFIG:{url:'https://example.supabase.co',key:'public-key'}};
 const context={window,sessionStorage,fetch,AbortController,setTimeout,clearTimeout,JSON,Error,String};
 vm.runInNewContext(script,context,{filename:'admin-access.js'});
 return {auth:window.ColorWinAuth,calls,values};
}

test('Panel status lookup is key-only and requests the selected route',async()=>{
 const harness=createAuth([{ok:true,panel:'finance',configured:false}]);
 const status=await harness.auth.accountRpc('colorwin_admin_token',{p_action:'status',p_panel:'finance'});
 assert.equal(status.panel,'finance');
 assert.deepEqual(harness.calls[0].body,{operation:'panel-status',session:null,data:{panel:'finance'}});
});

test('Unlock sends the key only to the server and stores only its opaque session',async()=>{
 const session='a'.repeat(64),harness=createAuth([{ok:true,session,panel:'gifts_users'}]);
 await harness.auth.accountRpc('colorwin_admin_token',{p_action:'unlock',p_token:'PrivateFixtureKey1234',p_panel:'gifts_users'});
 assert.equal(harness.calls[0].body.operation,'unlock');
 assert.deepEqual(harness.calls[0].body.data,{key:'PrivateFixtureKey1234',panel:'gifts_users'});
 assert.equal(harness.values.get('cw_admin_key_session'),session);
 assert.equal(harness.values.get('cw_admin_key_session').includes('PrivateFixtureKey1234'),false);
});

test('A session for another panel is locked before checking the requested panel',async()=>{
 const harness=createAuth([
  {ok:true,unlocked:true,panel:'superadmin'},
  {ok:true},
  {ok:true,panel:'finance',configured:true}
 ],'b'.repeat(64));
 const status=await harness.auth.accountRpc('colorwin_admin_token',{p_action:'status',p_panel:'finance'});
 assert.equal(status.panel,'finance');
 assert.deepEqual(harness.calls.map(call=>call.body.operation),['status','lock','panel-status']);
 assert.equal(harness.values.has('cw_admin_key_session'),false);
});

test('FF key provisioning is a server operation scoped to the merged panel',async()=>{
 const harness=createAuth([{ok:true,panel:'ff',key:'c'.repeat(64)}],'d'.repeat(64));
 const result=await harness.auth.accountRpc('colorwin_admin_panel_keys',{p_action:'provision',p_panel:'ff'});
 assert.equal(result.key,'c'.repeat(64));
 assert.deepEqual(harness.calls[0].body.data,{panel:'ff'});
 assert.equal(harness.calls[0].body.operation,'provision');
});

test('Database scopes merge users and gift codes, FF work, and all support sections',()=>{
 assert.match(sql,/p_panel='gifts_users' and p_data->>'p_section' in \('gifts','users'\)/);
 assert.match(sql,/p_panel='ff' and p_data->>'p_section' in \('tournaments','entries'\)/);
 assert.match(sql,/p_panel='support' and p_data->>'p_section' in \('support','feedback','announcements'\)/);
 assert.match(sql,/p_panel='gifts_users' and p_data->>'p_action' in \('gift_create','user_update','wallet_adjustment'\)/);
 assert.match(sql,/p_panel='ff' and p_data->>'p_action' in \('save_tournament','delete_tournament','tournament_result','tournament_most_kills','tournament_both_rewards'\)/);
 assert.match(sql,/p_panel='support' and p_data->>'p_action' in \('support_update','feedback_update','announcement'\)/);
 assert.match(sql,/order by case panel_scope when 'gifts_users' then 0 when 'gifts' then 1 else 2 end/);
 assert.match(sql,/Gift Codes & Users/);
 assert.match(sql,/Free Fire Tournaments & Players\/Rewards/);
 assert.match(sql,/All Support/);
});

test('Admin routes group users and gifts under one key alongside FF and all support',()=>{
 for(const [section,scope] of [['users','gifts_users'],['gifts','gifts_users'],['tournaments','ff'],['entries','ff'],['support','support'],['feedback','support'],['announcements','support']]){
  assert.match(admin,new RegExp(`\\['${section}'.*?'${scope}'\\]`));
 }
});

test('Superadmin accepts long custom keys and bcrypt verifies the full key digest',()=>{
 assert.match(admin,/maxlength="256" autocomplete="off"/);
 assert.doesNotMatch(admin,/pattern="\[A-Za-z0-9_-]\{16,64\}"/);
 assert.match(sql,/char_length\(k\) not between 16 and 256/);
 assert.match(sql,/extensions\.digest\(convert_to\(k,'UTF8'\),'sha256'\)/);
});
