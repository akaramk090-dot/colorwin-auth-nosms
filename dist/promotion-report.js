/* APK-referenced presentation. Real data comes only from ColorWin's authenticated RPC. */
(()=>{'use strict';
 const pages=window.ColorWinPromotionPages,original=pages.mount,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=v=>v==null?'—':Number(v).toLocaleString('en-IN',{maximumFractionDigits:2}),dateOf=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
 const percent=v=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('en-US',{maximumFractionDigits:10,useGrouping:false})+'%';
 const today=()=>dateOf(Date.now()),icon=name=>`<img src="assets/promotion-icons/apk-${name}.svg" alt="" aria-hidden="true">`;
 // Approved rebate schedule. The same matrix is intentionally shown for every
 // game category until a category-specific schedule is supplied.
 const rebateLevels=Object.freeze([
  Object.freeze({level:0,rates:Object.freeze(['0.6','0.18','0.054','0.0162','0.00486','0.001458'])}),
  Object.freeze({level:1,rates:Object.freeze(['0.7','0.245','0.08575','0.030012','0.010504','0.003677'])}),
  Object.freeze({level:2,rates:Object.freeze(['0.75','0.28125','0.105469','0.039551','0.014832','0.005562'])}),
  Object.freeze({level:3,rates:Object.freeze(['0.8','0.32','0.128','0.0512','0.02048','0.008192'])}),
  Object.freeze({level:4,rates:Object.freeze(['0.85','0.36125','0.153531','0.065251','0.027732','0.011786'])}),
  Object.freeze({level:5,rates:Object.freeze(['0.9','0.405','0.18225','0.082013','0.036906','0.016608'])}),
  Object.freeze({level:6,rates:Object.freeze(['0.95','0.45125','0.214344','0.101813','0.048362','0.022972'])})
 ]);
 const chevron='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5"/></svg>',search='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>';
 const noData=()=>'<div class="agency-empty"><img class="cw-no-data-art" src="assets/no-data.svg" alt=""><p>No data</p></div>';
 function summary(s={}){return '<div class="agency-summary apk-summary">'+[[s.deposit_count,'Deposit number'],[s.deposit_amount,'Deposit amount'],[s.bettors,'Number of bettors'],[s.bet_amount,'Total bet'],[s.first_deposits,'Number of people making first deposit'],[s.first_deposit_amount,'First deposit amount']].map(([v,k])=>`<div><strong>${num(v)}</strong><span>${k}</span></div>`).join('')+'</div>';}
 function subordinates(panel,data,{copy}){
  let tier=0,date=today(),uid='',page=1,serial=0,members=[];
  panel.classList.add('agency-layout','apk-subordinates');
  panel.innerHTML=`<div class="apk-report-filters"><form class="agency-search" novalidate><input id="agency-uid" inputmode="numeric" maxlength="20" autocomplete="off" placeholder="Search subordinate UID" aria-label="Search subordinate UID"><button type="submit" aria-label="Search">${search}</button></form><div class="agency-filter-row"><button type="button" id="agency-tier">All ${chevron}</button><button type="button" id="agency-date">${date} ${chevron}</button></div></div><p class="apk-report-error" role="alert" hidden></p><div id="agency-results" aria-live="polite"></div><button id="agency-more" type="button" hidden>Load more</button>`;
  const results=panel.querySelector('#agency-results'),more=panel.querySelector('#agency-more'),error=panel.querySelector('.apk-report-error');
  function cards(rows){return rows.map(m=>`<article class="agency-member-detail apk-member"><h2><span>UID:${esc(m.uid)}</span><button type="button" data-copy-uid="${esc(m.uid)}" aria-label="Copy UID ${esc(m.uid)}">${icon('copy')}</button></h2><dl>${[['Level',m.tier],['Deposit amount',num(m.deposit_amount)],['Bet amount',num(m.bet_amount)],['Commission amount',num(m.commission)],['Time',m.report_day||date]].map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></article>`).join('');}
  async function load(append=false){const ticket=++serial;error.hidden=true;more.disabled=true;results.setAttribute('aria-busy','true');if(!append){members=[];page=1;results.innerHTML='<div class="apk-report-loading" role="status">Loading subordinate data…</div>';more.hidden=true;}
   try{
    let report;
    if(typeof window.ColorWinAuth?.promotionReport==='function')report=await window.ColorWinAuth.promotionReport({date,tier,uid,page});
    else if(data?.report)report=data.report;
    else throw Error('Subordinate reporting is unavailable. Please retry.');
    if(!panel.isConnected||ticket!==serial)return;
    if(!report||!Array.isArray(report.members)||!report.summary)throw Error('Invalid subordinate report. Please retry.');
    members=append?[...members,...report.members]:report.members;
    results.innerHTML=summary(report.summary)+(members.length?cards(members)+(report.has_more?'':'<p class="agency-no-more">No more</p>'):noData());
    more.hidden=!report.has_more;more.disabled=false;
    results.querySelectorAll('[data-copy-uid]').forEach(button=>button.onclick=()=>copy(button.dataset.copyUid));
   }catch(e){if(!panel.isConnected||ticket!==serial)return;if(append)page=Math.max(1,page-1);error.textContent=e.message||'Unable to load subordinate data.';error.hidden=false;const retry=document.createElement('button');retry.type='button';retry.textContent='Retry';retry.onclick=()=>{page=1;load();};error.append(' ',retry);if(!append)results.innerHTML='';}
   finally{if(ticket===serial){results.setAttribute('aria-busy','false');more.disabled=false;}}
  }
  panel.querySelector('form').onsubmit=e=>{e.preventDefault();const value=panel.querySelector('#agency-uid').value.trim();if(value&&!/^\d{1,20}$/.test(value)){error.textContent='Enter a numeric subordinate UID.';error.hidden=false;return;}uid=value;load();};
  panel.querySelector('#agency-tier').onclick=()=>pages.picker(panel,{kind:'tier',value:tier,onConfirm:value=>{tier=Number(value);panel.querySelector('#agency-tier').innerHTML=(tier?'Tier '+tier:'All')+chevron;load();}});
  panel.querySelector('#agency-date').onclick=()=>pages.picker(panel,{kind:'date',value:date,onConfirm:value=>{if(value>today()){error.textContent='Choose today or an earlier date.';error.hidden=false;return;}date=value;panel.querySelector('#agency-date').innerHTML=esc(date)+chevron;load();}});
  more.onclick=()=>{page++;load(true);};load();
 }
 function rebate(panel,data){
  const categories=[['lottery','Lottery'],['casino','Live casino'],['sports','Sports'],['pvc','Chess & cards'],['slots','Slots']];
  panel.classList.add('agency-layout','apk-rebate');panel.innerHTML='<nav class="agency-categories apk-categories" aria-label="Game category">'+categories.map(([id,label],i)=>`<button type="button" data-category="${id}" aria-pressed="${i===0}" class="${i===0?'active':''}">${icon(id)}<span>${label}</span></button>`).join('')+'</nav><div id="rebate-levels"></div>';
  const draw=category=>{void category;panel.querySelector('#rebate-levels').innerHTML=rebateLevels.map(row=>`<section class="agency-rebate-card apk-rebate-card"><h2>Rebate level <em>L${esc(row.level)}</em></h2><ol>${Array.from({length:6},(_,i)=>`<li>${icon('round')}<span>${i+1} level lower level commission rebate</span><strong>${esc(percent(row.rates[i]))}</strong></li>`).join('')}</ol></section>`).join('');};
  panel.querySelectorAll('[data-category]').forEach(button=>button.onclick=()=>{panel.querySelectorAll('[data-category]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});draw(button.dataset.category);});draw('lottery');
 }
 pages.mount=(action,panel,data,options)=>{if(action==='subordinates')return subordinates(panel,data,options);if(action==='rebate')return rebate(panel,data);return original(action,panel,data,options);};
})();
