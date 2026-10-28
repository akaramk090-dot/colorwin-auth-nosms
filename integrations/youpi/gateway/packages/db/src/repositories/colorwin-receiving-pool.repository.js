import {ReceivingAccountRepository} from './receiving-account.repository.js';
export class ColorwinReceivingPool {
 constructor(db){this.db=db;this.accounts=new ReceivingAccountRepository(db);}
 list(merchantId){return this.db.query(`SELECT a.id,a.upi_id AS upiId,a.payee_name AS payeeName,p.position,p.enabled,p.last_assignment AS lastAssignment,
  (SELECT count(*) FROM payment_sessions s WHERE s.receiving_account_id=a.id AND ((s.status='ACTIVE' AND s.expires_at>?) OR (s.status='PROCESSING' AND s.processing_expires_at>?))) AS activeOrders
  FROM colorwin_receiving_pool p JOIN payment_receiving_accounts a ON a.id=p.account_id WHERE p.merchant_id=? AND p.enabled=1 ORDER BY p.position`,[new Date().toISOString(),new Date().toISOString(),merchantId]);}
 configure(merchantId,receivers){
  if(!Array.isArray(receivers)||receivers.length<1||receivers.length>10)throw Error('Enter between 1 and 10 receiving UPIs');
  const ids=receivers.map(r=>String(r.upiId||'').trim().toLowerCase());
  if(new Set(ids).size!==ids.length||ids.some(id=>!/^[-a-z0-9._]{2,100}@[-a-z0-9.]{2,64}$/.test(id)))throw Error('Use valid, unique UPI IDs');
  // Account creation uses its own transaction; all pool membership updates commit together below.
  const accounts=ids.map((id,i)=>this.accounts.findByMerchantId(merchantId).find(a=>a.upiId.toLowerCase()===id)||this.accounts.create({merchantId,upiId:id,payeeName:String(receivers[i].payeeName||'Color Win').slice(0,100),isActive:false}));
  this.db.transaction(()=>{this.db.execute('UPDATE colorwin_receiving_pool SET enabled=0 WHERE merchant_id=?',[merchantId]);
   accounts.forEach((a,i)=>this.db.execute(`INSERT INTO colorwin_receiving_pool(account_id,merchant_id,position,enabled) VALUES(?,?,?,1)
    ON CONFLICT(account_id) DO UPDATE SET position=excluded.position,enabled=1`,[a.id,merchantId,i]));
  });return this.list(merchantId);
 }
 restorePinnedSessions(){return this.db.transaction(()=>{
  const repaired=[];
  const rows=this.db.query("SELECT * FROM payment_sessions WHERE json_extract(metadata,'$.colorwinTrusted')=1 AND status<>'SUCCESS'");
  for(const row of rows){const snapshot=JSON.parse(row.metadata).receivingAccountSnapshot;if(!snapshot?.id||snapshot.id===row.receiving_account_id)continue;
   const account=this.accounts.findById(snapshot.id);
   if(!account||account.merchantId!==row.merchant_id||account.upiId!==snapshot.upiId)continue;
   this.db.execute('UPDATE payment_sessions SET receiving_account_id=? WHERE id=?',[account.id,row.id]);
   repaired.push({paymentId:row.id,oldReceiver:row.receiving_account_id,pinnedReceiver:account.id});
  }return repaired;
 });}
 allocate(merchantId,create){return this.db.transaction(()=>{
  const options=this.list(merchantId).sort((a,b)=>a.activeOrders-b.activeOrders||a.lastAssignment-b.lastAssignment||a.position-b.position);
  const selected=options[0];if(!selected)throw Error('No receiving UPI configured');
  const sequence=Number(this.db.queryOne('SELECT coalesce(max(last_assignment),0)+1 AS n FROM colorwin_receiving_pool').n);
  const payment=create(this.accounts.findById(selected.id));
  this.db.execute('UPDATE colorwin_receiving_pool SET last_assignment=? WHERE account_id=?',[sequence,selected.id]);return payment;
 });}
}
