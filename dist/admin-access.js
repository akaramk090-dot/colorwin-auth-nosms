(() => {
 'use strict';
 const config=window.COLORWIN_SUPABASE_CONFIG,storageKey='cw_admin_key_session';
 let bearer=sessionStorage.getItem(storageKey)||'',ready=true,panel='superadmin';
 const callbacks=new Set();
 const notify=()=>callbacks.forEach(fn=>fn());
 async function request(operation,data={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch(config.url+'/functions/v1/admin-key-access',{method:'POST',headers:{'Content-Type':'application/json',apikey:config.key},body:JSON.stringify({operation,session:bearer||null,data}),signal:controller.signal});
   const result=await response.json();
   if(!response.ok||result.error){if(String(result.error).includes('ADMIN_TOKEN_REQUIRED')){bearer='';sessionStorage.removeItem(storageKey);}throw Error(result.error||'Admin request failed');}
   return result;
  }catch(err){if(err.name==='AbortError')throw Error('Admin request timed out. Retry the request.');throw err;}finally{clearTimeout(timer);}
 }
 async function unlock(key,requestedPanel){
  panel=requestedPanel;
  const result=await request('unlock',{key,panel});
  bearer=result.session;sessionStorage.setItem(storageKey,bearer);notify();
  return result;
 }
 async function status(requestedPanel){
  panel=requestedPanel;
  if(!bearer)return request('panel-status',{panel});
  const result=await request('status');
  if(result.panel!==panel){await request('lock');bearer='';sessionStorage.removeItem(storageKey);return request('panel-status',{panel});}
  return result;
 }
 window.ColorWinAuth={get ready(){return ready;},get session(){return bearer?{user:{id:'key-session',email:'Access key session'}}:null;},profile:null,
  init(fn){callbacks.add(fn);fn();},
  async accountRpc(name,args={}){
   if(name==='colorwin_admin_token'){
    if(args.p_action==='unlock')return unlock(args.p_token,args.p_panel||panel);
    if(args.p_action==='status')return status(args.p_panel||panel);
    if(args.p_action==='lock'){if(bearer)await request('lock');bearer='';sessionStorage.removeItem(storageKey);notify();return {ok:true};}
    if(args.p_action==='rotate')return request('rotate',{token:args.p_token,current:args.p_current,totp:args.p_totp});
    throw Error('Unsupported token action');
   }
   if(name==='colorwin_admin_totp'){
    const operations={status:'totp-status',enroll:'totp-enroll',resume:'totp-resume',confirm:'totp-confirm'};
    const operation=operations[args.p_action];
    if(!operation)throw Error('Unsupported authenticator action');
    const data={};
    if(args.p_current_key)data.current_key=args.p_current_key;
    if(args.p_code)data.code=args.p_code;
    return request(operation,data);
   }
   if(name==='colorwin_admin_panel_keys')return request(args.p_action==='provision'?'provision':'keys',{panel:args.p_panel});
   if(name==='colorwin_admin_push')return request('push',args);
   if(name==='colorwin_admin_list')return request('list',args);
   if(name==='colorwin_admin_action')return request('action',args);
   throw Error('Unsupported admin operation');
  },async logout(){try{if(bearer)await request('lock');}finally{bearer='';sessionStorage.removeItem(storageKey);notify();}},
  async supportUrl(path){return (await request('attachment',{path})).url;}
 };
})();
