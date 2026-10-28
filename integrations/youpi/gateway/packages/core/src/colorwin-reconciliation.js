// Reconcile only a persisted, authenticated bank observation with a strong order reference.
// Amount alone is insufficient once a checkout's verification window has ended.
export function matchesColorwinObservation(session,obs) {
 if(session.metadata?.colorwinTrusted!==true||!['ACTIVE','PROCESSING','FAILED','EXPIRED'].includes(session.status))return false;
 if(obs.rawPayload?.colorwinReceiverUnresolved===true)return false;
 if(obs.attributedPaymentId||!['ANDROID_OBSERVER','GMAIL','GOOGLE_MESSAGES'].includes(obs.source))return false;
 if(obs.receivingAccountId!==session.receivingAccountId||obs.amountPaise!==session.amountPaise)return false;
 const start=(session.slotAcquiredAt||session.createdAt).getTime(),time=obs.observedAt.getTime();
 if(!Number.isFinite(time)||time<start-5000||time>start+15*60000)return false;
 const metadata=session.metadata,utr=metadata.colorwinUtr;
 if(utr&&obs.bankReferenceNumber){if(utr!==obs.bankReferenceNumber)return false;return true;}
 const notification=obs.rawPayload?.rawNotification||{};
 const text=[notification.text,notification.title,obs.rawPayload?.body,obs.rawPayload?.text,obs.rawPayload?.rawText].filter(v=>typeof v==='string').join(' ');
 if(text.includes(session.orderId))return true;
 const references=text.match(/\bRC[A-F0-9]{24,32}\b/gi)||[];
 return references.some(ref=>String(metadata.colorwinOrderNumber||'').startsWith(ref));
}
export function findColorwinObservationMatch(sessionRepo,obs) {
 const rows=sessionRepo.db.query("SELECT * FROM payment_sessions WHERE receiving_account_id=? AND amount_paise=? AND status IN ('ACTIVE','PROCESSING','FAILED','EXPIRED') AND json_extract(metadata,'$.colorwinTrusted')=1 AND created_at>=?",[obs.receivingAccountId,Number(obs.amountPaise),new Date(obs.observedAt.getTime()-15*60000).toISOString()]);
 const matches=rows.map(row=>sessionRepo.mapRow(row)).filter(session=>matchesColorwinObservation(session,obs));
 return matches.length===1?matches[0]:null;
}
export function reconcileColorwinObservation(ctx,session,obs) {
 if(!matchesColorwinObservation(session,obs))return false;
 const result=ctx.sessionRepo.recordVerificationSource(session.id,obs.source,obs.id,{finalizeSuccess:true,claimObservation:true});
 ctx.auditRepo?.log({merchantId:session.merchantId,entityType:'PAYMENT_SESSION',entityId:session.id,action:'COLORWIN_BANK_OBSERVATION_RECONCILED',actorType:'SYSTEM',details:{observationId:obs.id,previousStatus:session.status,source:obs.source}});
 ctx.eventEmitter?.emit('PAYMENT.SUCCESS',{paymentId:session.id,orderId:session.orderId,merchantId:session.merchantId,amountPaise:session.amountPaise,observationId:obs.id,verificationLevel:result.level,verificationTag:result.tag,sources:result.sources});
 return true;
}
