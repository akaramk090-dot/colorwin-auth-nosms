import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {deliver} from './push.ts';
declare const EdgeRuntime:{waitUntil(p:Promise<unknown>):void};
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const token=req.headers.get('x-cw-push-secret')||'';if(!/^[a-f0-9]{64}$/.test(token))return new Response('Unauthorized',{status:401});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const {data:config,error}=await db.rpc('colorwin_admin_push_backend',{p_action:'config'});if(error||!config||token!==config.secret)return new Response('Unauthorized',{status:401});
 const {data:jobs,error:claimError}=await db.rpc('colorwin_admin_push_backend',{p_action:'claim'});if(claimError)return new Response('Queue unavailable',{status:503});
 const work=async()=>{for(let start=0;start<jobs.length;start+=5){await Promise.all(jobs.slice(start,start+5).map(async(job:any)=>{let result='sent';try{await deliver(job.subscription,{title:job.kind==='deposit'?'New deposit request':'New withdrawal request',body:'₹'+Number(job.amount).toLocaleString('en-IN')+' request is waiting for review.',tag:'cw-admin-'+job.event_id,url:job.origin+'/admin.html#'+(job.kind==='deposit'?'deposits':'withdrawals')},config);}catch(e){result=[404,410].includes((e as any).statusCode)?'gone':'retry';}await db.rpc('colorwin_admin_push_backend',{p_action:'ack',p_data:{event_id:job.event_id,subscription_id:job.subscription_id,result}});}));}};
 EdgeRuntime.waitUntil(work());return new Response(JSON.stringify({queued:jobs.length}),{headers:{'Content-Type':'application/json'}});
});
