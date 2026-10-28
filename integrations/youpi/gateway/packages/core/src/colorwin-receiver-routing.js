// Called only after Android device authentication. Never route a payment by amount alone.
export function resolveColorwinReceiver(ctx,merchantId,body) {
 const note=body.rawNotification||{};
 const text=[note.title,note.text,body.body,body.text,body.rawText].filter(v=>typeof v==='string').join(' ');
 const references=text.match(/\bRC[A-F0-9]{24,32}\b/gi)||[];
 const uuids=text.match(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi)||[];
 const utr=String(body.bankReferenceNumber||body.utr||text.match(/(?:utr|ref(?:erence)?\s*(?:no|number)?)\s*[:#-]?\s*(\d{12})\b/i)?.[1]||'');
 if(!references.length&&!uuids.length&&!utr)return null;
 const observed=Number(body.observedAt||body.timestamp)||Date.now();
 const rows=ctx.db.query("SELECT receiving_account_id,order_id,metadata FROM payment_sessions WHERE merchant_id=? AND created_at>=? AND json_extract(metadata,'$.colorwinTrusted')=1",[merchantId,new Date(observed-15*60000).toISOString()]);
 const matches=rows.filter(r=>{const m=JSON.parse(r.metadata);return references.some(ref=>String(m.colorwinOrderNumber||'').startsWith(ref.toUpperCase()))||uuids.includes(r.order_id)||(!references.length&&!uuids.length&&utr&&m.colorwinUtr===utr);});
 return matches.length===1?matches[0].receiving_account_id:null;
}
