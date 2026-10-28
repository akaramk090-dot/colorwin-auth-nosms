(() => {
 const enabled=()=>window.ColorWinPaymentConfig?.youpiEnabled===true;
 const normalize=(r,result)=>({id:r.id,number:r.number,amount:Number(r.amount),method:r.method,recipientUpi:r.recipient_upi,recipientName:r.recipient_name,utr:r.utr,status:r.status,reviewNote:r.review_note,gatewayProvider:r.gateway_provider,gatewayStatus:result.gateway_status,queuePosition:result.queue_position,createdAt:new Date(r.created_at).getTime(),expiresAt:new Date(r.expires_at).getTime()});
 async function request(action,data){
  const auth=window.ColorWinAuth,owner=auth?.session?.user?.id,token=auth?.session?.access_token;
  if(!owner||owner==='preview'||!token)throw Error('Sign in to make a deposit');
  const base=window.COLORWIN_SUPABASE_CONFIG?.url||auth?.url;if(!base)throw Error('Payment service configuration missing');
  const response=await fetch(base.replace(/\/$/,'')+'/functions/v1/youpi-payments',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action,...data})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Payment unavailable');
  if(owner!==window.ColorWinAuth?.session?.user?.id)throw Error('Account changed');
  return normalize(result.order,result);
 }
 window.ColorWinYoupi={enabled,start:(amount,requestId,method='upi')=>request('create',{amount,request_id:requestId,method}),state:id=>request('state',{deposit_id:id}),submit:(id,utr)=>request('submit',{deposit_id:id,utr}),cancel:(id,reason)=>request('cancel',{deposit_id:id,reason})};
})();
