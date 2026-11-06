// Custom access-key authentication. Service credentials stay inside this function.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import {deliver} from './push.ts';
import {decryptSecret,encryptSecret,generateSecret,matchingTotpCounter,provisioningUri} from './totp.mjs';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, apikey','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
class RequestError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status;}}
async function totpGateway(db:any,operation:string,session:string|null,data:Record<string,unknown>={}){
 const {data:result,error}=await db.rpc('colorwin_admin_totp_gateway',{p_operation:operation,p_session:session,p_data:data});
 if(error)throw new RequestError(error.message);
 if(result?.ok===false){const message=String(result.error||'Authenticator request failed');throw new RequestError(message,message.includes('Too many')?429:message.includes('ADMIN_TOKEN_REQUIRED')?401:400);}
 return result;
}
async function verifySubmittedTotp(db:any,session:string|null,code:unknown,allowPending=false){
 const factor=await totpGateway(db,'verify',session);
 if(!factor.enabled&&!allowPending)throw new RequestError('Set up and confirm your authenticator before rotating the key',403);
 const encryptionKey=Deno.env.get('ADMIN_TOTP_ENCRYPTION_KEY');
 if(!encryptionKey)throw new RequestError('Authenticator encryption is not configured on the server',503);
 let secret:string;
 try{secret=await decryptSecret(factor.secret_ciphertext,factor.secret_nonce,encryptionKey);}
 catch{throw new RequestError('Could not read the protected authenticator secret',503);}
 const counter=await matchingTotpCounter(secret,String(code??''));
 if(counter===null)throw new RequestError('Incorrect or expired authenticator code',401);
 await totpGateway(db,'verified',session,{counter});
 return secret;
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const raw=await req.text();if(raw.length>24000)return json({error:'Request too large'},413);
  const {operation,session,data={}}=JSON.parse(raw);
  if(!['unlock','panel-status','status','lock','rotate','list','action','attachment','push','keys','provision','totp-status','totp-enroll','totp-resume','totp-confirm'].includes(operation))return json({error:'Unknown operation'},400);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  if(operation==='totp-status'){
   return json(await totpGateway(db,'status',session||null));
  }
  if(operation==='totp-enroll'){
   const encryptionKey=Deno.env.get('ADMIN_TOTP_ENCRYPTION_KEY');
   if(!encryptionKey)return json({error:'Authenticator encryption is not configured on the server'},503);
   const secret=generateSecret();
   let encrypted;
   try{encrypted=await encryptSecret(secret,encryptionKey);}catch{return json({error:'Authenticator encryption is not configured correctly'},503);}
   const result=await totpGateway(db,'enroll',session||null,{current_key:data.current_key,...encrypted});
   return json({...result,secret,uri:provisioningUri(secret)});
  }
  if(operation==='totp-resume'){
   const result=await totpGateway(db,'resume',session||null,{current_key:data.current_key});
   const encryptionKey=Deno.env.get('ADMIN_TOTP_ENCRYPTION_KEY');
   if(!encryptionKey)return json({error:'Authenticator encryption is not configured on the server'},503);
   try{
    const secret=await decryptSecret(result.secret_ciphertext,result.secret_nonce,encryptionKey);
    return json({ok:true,pending:true,secret,uri:provisioningUri(secret)});
   }catch{return json({error:'Could not read the protected authenticator secret'},503);}
  }
  if(operation==='totp-confirm'){
   await verifySubmittedTotp(db,session||null,data.code,true);
   return json(await totpGateway(db,'enable',session||null));
  }
  if(operation==='rotate'){
   await verifySubmittedTotp(db,session||null,data.totp);
   const {data:result,error}=await db.rpc('colorwin_admin_key_gateway',{p_operation:'rotate',p_session:session||null,p_data:{token:data.token,current:data.current}});
   if(error)return json({error:error.message},400);
   if(result?.ok===false)return json({error:result.error},400);
   return json(result);
  }
  if(operation==='push'){
   const {data:access,error:accessError}=await db.rpc('colorwin_admin_key_gateway',{p_operation:'status',p_session:session||null,p_data:{}});
   if(accessError)return json({error:accessError.message},400);
   if(access?.ok!==true)return json({error:access?.error||'ADMIN_TOKEN_REQUIRED: Enter your access key'},401);
   if(!['superadmin','finance'].includes(access.panel))return json({error:'Phone notifications are available only in the Finance panel'},403);
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
  const {data:result,error}=await db.rpc('colorwin_admin_key_gateway',{p_operation:operation==='panel-status'?'panel_status':operation,p_session:session||null,p_data:data});
  if(error)return json({error:error.message},400);
  if(result?.ok===false)return json({error:result.error},String(result.error).startsWith('ADMIN_PANEL_FORBIDDEN:')?403:401);
  if(operation==='attachment'){
   const {data:signed,error:signError}=await db.storage.from('cw_support_files').createSignedUrl(result.path,120);
   if(signError)return json({error:'Could not open attachment'},400);
   return json({url:signed.signedUrl});
  }
  return json(result);
 }catch(error){if(error instanceof RequestError)return json({error:error.message},error.status);return json({error:'Unable to process admin request'},400);}
});
