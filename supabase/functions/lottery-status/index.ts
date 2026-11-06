// Separate access key + expiring session authentication lives in the private RPC.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {status, headers: {...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});
}
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, {status:204, headers:cors});
  if (req.method !== 'POST') return reply({ok:false,error:'Use POST.'},405);
  try {
    const reader=req.body?.getReader();if(!reader)return reply({ok:false,error:'Request body required.'},400);
    const chunks:Uint8Array[]=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();return reply({ok:false,error:'Request too large.'},413);}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    const body=JSON.parse(new TextDecoder().decode(bytes));
    if(!body||typeof body!=='object'||Array.isArray(body)||!['login','status','logout'].includes(body.action))return reply({ok:false,error:'Unsupported operation.'},400);
    const data:Record<string,unknown>={};
    if(body.action==='login')data.key=typeof body.key==='string'?body.key:'';
    else {data.session=typeof body.session==='string'?body.session:'';if(body.action==='status'){data.game=body.game;data.lane=body.lane;if(body.round!=null)data.round=body.round;}}
    const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!key)return reply({ok:false,error:'Panel configuration unavailable.'},503);
    const response=await fetch(url+'/rest/v1/rpc/colorwin_lottery_status',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({p_action:body.action,p_data:data}),signal:AbortSignal.timeout(12000)});
    if(!response.ok)return reply({ok:false,error:'Unable to load game status. Please retry.'},503);
    const result=await response.json();
    return reply(result,result.ok===false?(result.code==='rate_limited'?429:['unauthorized','invalid_key'].includes(result.code)?401:400):200);
  } catch {
    return reply({ok:false,error:'Unable to complete request. Please retry.'},400);
  }
});
