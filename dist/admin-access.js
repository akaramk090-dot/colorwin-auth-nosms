(() => {
 'use strict';
 const config=window.COLORWIN_SUPABASE_CONFIG,storageKey='cw_admin_key_session';
 let bearer=sessionStorage.getItem(storageKey)||'',ready=true;
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
 window.ColorWinAuth={get ready(){return ready;},get session(){return bearer?{user:{email:'Access key session'}}:null;},profile:null,
  init(fn){callbacks.add(fn);fn();},
  async accountRpc(name,args={}){
   if(name==='colorwin_admin_token'){
    if(args.p_action==='unlock'){const result=await request('unlock',{key:args.p_token});bearer=result.session;sessionStorage.setItem(storageKey,bearer);return result;}
    if(args.p_action==='status'){if(!bearer)return {configured:true,unlocked:false,role:'owner'};return request('status');}
    if(args.p_action==='lock'){if(bearer)await request('lock');bearer='';sessionStorage.removeItem(storageKey);return {ok:true};}
    if(args.p_action==='rotate')return request('rotate',{token:args.p_token,current:args.p_current});
    throw Error('Unsupported token action');
   }
   if(name==='colorwin_admin_push')return request('push',args);
   if(name==='colorwin_admin_list')return request('list',args);
   if(name==='colorwin_admin_action')return request('action',args);
   throw Error('Unsupported admin operation');
  },async logout(){bearer='';sessionStorage.removeItem(storageKey);notify();},
  async supportUrl(path){return (await request('attachment',{path})).url;}
 };
})();
