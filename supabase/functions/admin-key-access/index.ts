// Custom access-key authentication. Service credentials stay inside this function.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import {deliver} from './push.ts';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, apikey','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const raw=await req.text();if(raw.length>24000)return json({error:'Request too large'},413);
  const {operation,session,data={}}=JSON.parse(raw);
  if(!['unlock','status','lock','rotate','list','action','attachment','push'].includes(operation))return json({error:'Unknown operation'},400);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  if(operation==='push'){
   const {data:push,error:pushError}=await db.rpc('colorwin_admin_push',{p_session:session||null,p_action:data.p_action,p_data:data.p_data||{}});
   if(pushError)return json({error:pushError.message},400);
   if(data.p_action==='test'){
    if(!push?.subscription)return json({error:'Enable notifications on this device first'},400);
    const {data:cfg,error:cfgError}=await db.rpc('colorwin_admin_push_backend',{p_action:'config'});if(cfgError)return json({error:'Push setup unavailable'},503);
    try{await deliver(push.subscription,{title:'Color Win Admin',body:'Phone notifications are enabled. New deposit and withdrawal requests will appear here.',tag:'cw-admin-test',url:push.origin+'/admin.html'},cfg);}catch{return json({error:'Test delivery failed. Check browser notification settings and retry.'},502);}
    return json({sent:true});
   }
   return json(push);
  }
  const {data:result,error}=await db.rpc('colorwin_admin_key_gateway',{p_operation:operation,p_session:session||null,p_data:data});
  if(error)return json({error:error.message},400);
  if(result?.ok===false)return json({error:result.error},401);
  if(operation==='attachment'){
   const {data:signed,error:signError}=await db.storage.from('cw_support_files').createSignedUrl(result.path,120);
   if(signError)return json({error:'Could not open attachment'},400);
   return json({url:signed.signedUrl});
  }
  return json(result);
 }catch{return json({error:'Unable to process admin request'},400);}
});
