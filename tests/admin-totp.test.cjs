const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'dist/admin-access.js'),'utf8');

test('Admin access client routes authenticator operations and sends rotation codes only to the server',async()=>{
 const values=new Map([['cw_admin_key_session','a'.repeat(64)]]);
 const calls=[];
 const sessionStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
 const fetch=async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:true})};};
 const window={COLORWIN_SUPABASE_CONFIG:{url:'https://example.supabase.co',key:'public-key'}};
 vm.runInNewContext(source,{window,sessionStorage,fetch,AbortController,setTimeout,clearTimeout,JSON,Error,String});
 for(const [action,operation] of [['status','totp-status'],['enroll','totp-enroll'],['resume','totp-resume'],['confirm','totp-confirm']]){
  await window.ColorWinAuth.accountRpc('colorwin_admin_totp',{p_action:action,p_current_key:'LocalOnlyKey-123456789012345678901',p_code:'123456'});
  assert.equal(calls.at(-1).operation,operation);
 }
 await window.ColorWinAuth.accountRpc('colorwin_admin_token',{p_action:'rotate',p_current:'OldKey',p_token:'NewKey',p_totp:'123456'});
 assert.equal(calls.at(-1).operation,'rotate');
 assert.deepEqual(calls.at(-1).data,{current:'OldKey',token:'NewKey',totp:'123456'});
 assert.equal(values.get('cw_admin_key_session'),'a'.repeat(64));
});

test('Authenticator utility produces standard Google-compatible TOTP and encrypted-at-rest secrets',async()=>{
 const {generateSecret,encryptSecret,decryptSecret,verifyTotp,testCode,matchingTotpCounter,provisioningUri}=await import('../supabase/functions/admin-key-access/totp.mjs');
 const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
 assert.equal(await testCode(secret,59000),'287082');
 assert.equal(await matchingTotpCounter(secret,'287082',59000),1);
 assert.equal(await verifyTotp(secret,'287082',59000),true);
 assert.equal(await verifyTotp(secret,'287082',89000),true);
 assert.equal(await verifyTotp(secret,'000000',59000),false);
 assert.equal(await verifyTotp(secret,'12345',59000),false);
 assert.equal(generateSecret(size=>size.fill(255)).length,32);
 const key=Buffer.alloc(32,7).toString('base64');
 const encrypted=await encryptSecret(secret,key);
 assert.notEqual(encrypted.secret_ciphertext,secret);
 assert.equal(await decryptSecret(encrypted.secret_ciphertext,encrypted.secret_nonce,key),secret);
 await assert.rejects(decryptSecret(encrypted.secret_ciphertext,encrypted.secret_nonce,Buffer.alloc(32,8).toString('base64')));
 assert.match(provisioningUri(secret),/^otpauth:\/\/totp\/Color%20Win%20Superadmin\?/);
});

test('Server gateway keeps TOTP secrets private and rotation is MFA-gated before the privileged RPC',()=>{
 const migration=fs.readFileSync(path.join(root,'supabase/admin-superadmin-totp.sql'),'utf8');
 const edge=fs.readFileSync(path.join(root,'supabase/functions/admin-key-access/index.ts'),'utf8');
 assert.match(migration,/admin_superadmin_totp/);
 assert.match(migration,/enable row level security/i);
 assert.match(migration,/revoke all .*from public,anon,authenticated/i);
 assert.match(migration,/g\.panel_scope<>'superadmin'/);
 assert.match(migration,/attempts>=10/);
 assert.match(migration,/counter<=factor\.last_verified_counter/);
 assert.match(migration,/secret_ciphertext/);
 assert.match(edge,/operation==='rotate'[\s\S]*?verifySubmittedTotp\(db,session\|\|null,data\.totp\)[\s\S]*?colorwin_admin_key_gateway/);
 assert.match(edge,/ADMIN_TOTP_ENCRYPTION_KEY/);
 assert.match(edge,/matchingTotpCounter\(secret,String\(code/);
 assert.match(edge,/totp-enroll/);
});
