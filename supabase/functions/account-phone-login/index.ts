// Login endpoint: never returns the mailbox lookup, only a password-authenticated session.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
Deno.serve(async (req: Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers});
 try{
  if(Number(req.headers.get('content-length')||0)>4096)return new Response(JSON.stringify({error:'Invalid request'}),{status:400,headers});
  const body=await req.text();
  if(new TextEncoder().encode(body).length>4096)return new Response(JSON.stringify({error:'Invalid request'}),{status:400,headers});
  const {phone,password}=JSON.parse(body);
  if(typeof phone!=='string'||!/^\+\d{8,15}$/.test(phone)||typeof password!=='string'||!password.length||password.length>128)return new Response(JSON.stringify({error:'Incorrect phone or password'}),{status:400,headers});
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,options);
  const lookup=await admin.rpc('colorwin_phone_login_email',{p_phone:phone});
  if(lookup.error)throw Error('Lookup unavailable');
  const auth=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,options);
  const {data,error}=await auth.auth.signInWithPassword({email:lookup.data||'not-found@auth.colorwin.invalid',password});
  if(error||!data.session)return new Response(JSON.stringify({error:error?.status===429?'Too many attempts. Please try again later.':'Incorrect phone or password'}),{status:error?.status===429?429:400,headers});
  return new Response(JSON.stringify({session:data.session}),{headers});
 }catch{return new Response(JSON.stringify({error:'Login unavailable. Please retry.'}),{status:503,headers});}
});
