(() => {
 'use strict';
 const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const games=[['wingo','WinGo','W'],['k3','K3','K3'],['5d','5D','5D'],['trx-wingo','TRX','T']];
 const duration=n=>n===30?'30 sec':n/60+' min',number=n=>Number(n||0).toLocaleString('en-IN'),money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2,minimumFractionDigits:2});
 const pct=n=>(Number(n)||0).toFixed(1).replace(/\.0$/,'')+'%';
 const storage='cw_lottery_status_session_v1';
 let session='',game='wingo',lane=30,selectedRound=null,basis='amount',snapshot=null,busy=false,requestVersion=0,controller=null,lastUpdated=0,clockAnchor=0,timeAnchor=0;
 try{session=sessionStorage.getItem(storage)||'';}catch{}
 function remember(token){session=token;try{token?sessionStorage.setItem(storage,token):sessionStorage.removeItem(storage);}catch{}}
 function errorAt(id,message){$(id).textContent=message||'';$(id).hidden=!message;}
 function showLogin(message=''){
  controller?.abort();requestVersion++;busy=false;snapshot=null;remember('');$('login').hidden=false;$('dashboard').hidden=true;$('logout').hidden=true;errorAt('login-error',message);$('access-key').value='';$('access-key').type='password';$('show-key').textContent='Show';
 }
 function showDashboard(){$('login').hidden=true;$('dashboard').hidden=false;$('logout').hidden=false;renderFilters();renderLoading();}
 async function rpc(action,data={},signal){
  const cfg=window.COLORWIN_SUPABASE_CONFIG;
  const response=await fetch(cfg.url+'/functions/v1/lottery-status',{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.key},body:JSON.stringify({action,...data}),signal:signal||AbortSignal.timeout(15000),cache:'no-store'});
  let result;try{result=await response.json();}catch{throw Error('Game status is unavailable. Please retry.');}
  if(!response.ok||result.ok!==true){const error=Error(result.error||'Unable to load game status.');error.code=result.code;throw error;}
  return result;
 }
 function renderFilters(){
  $('game-tabs').innerHTML=games.map(([id,label,icon])=>`<button class="game-tab" data-game="${id}" aria-pressed="${id===game}"><span>${icon}</span>${label}</button>`).join('');
  const overview=new Map((snapshot?.overview||[]).map(v=>[Number(v.lane),v]));
  $('duration-tabs').innerHTML=(game==='wingo'?[30,60,180,300]:[60,180,300,600]).map(n=>{const row=overview.get(n);return `<button class="duration-tab" data-lane="${n}" aria-pressed="${n===lane}"><strong>${duration(n)}</strong><b>${row?number(row.bets):'—'}</b><small>Bets this round</small><em>${row?money(row.amount):'—'}</em></button>`;}).join('');
 }
 function renderLoading(){
  $('round-status').textContent='Loading round';$('round-status').className='round-status';$('round-select').innerHTML='<option value="current">Loading period…</option>';$('round-duration').textContent=(games.find(g=>g[0]===game)?.[1]||'')+' · '+duration(lane);$('countdown').textContent='—';$('round-progress').style.width='0%';
  $('metrics').innerHTML=['Total bets','Bet amount','Players','Orders'].map(label=>`<article class="metric"><span>${label}</span><b>—</b><small>Selected round</small></article>`).join('');$('insights').innerHTML='';$('breakdown').innerHTML='<p class="empty">Loading selection breakdown…</p>';
 }
 const rowColor=(g,s)=>s==='Green'?'green':s==='Red'?'red':s==='Violet'?'violet':s==='Big'?'gold':s==='Small'?'blue':/^\d+$/.test(s)?g!=='k3'&&s==='0'?'dual-red':g!=='k3'&&s==='5'?'dual-green':Number(s)%2?'green':'red':'violet';
 function groups(){
  const rows=new Map((snapshot?.selections||[]).map(r=>[r.selection,{...r,bets:Number(r.bets),amount:Number(r.amount)}]));
  const result=[];
  function add(title,keys,label=s=>s,color=s=>rowColor(game,s)){
   const list=keys.map(s=>({...rows.get(s),selection:s,label:label(s),color:color(s),bets:rows.get(s)?.bets||0,amount:rows.get(s)?.amount||0}));keys.forEach(s=>rows.delete(s));result.push({title,rows:list});
  }
  if(game==='wingo'||game==='trx-wingo'){
   add('Big / Small',['Big','Small']);add('Colors',['Green','Violet','Red']);add('Numbers',Array.from({length:10},(_,i)=>String(i)));
  }else if(game==='k3'){
   add('Big / Small',['Big','Small']);add('Odd / Even',['Odd','Even']);add('Total',Array.from({length:16},(_,i)=>'sum:'+(i+3)),s=>s.slice(4),s=>Number(s.slice(4))%2?'green':'red');
   for(const[k,label]of[['pair:','Two same'],['triple:','Three same'],['different:','Three different'],['two:','Two different']]){const keys=[...rows.keys()].filter(s=>s.startsWith(k));if(keys.length)add(label,keys,s=>s.slice(k.length).replaceAll(':',' + '));}
   if(rows.has('Any triple'))add('Any triple',['Any triple']);if(rows.has('Sequence'))add('Sequence',['Sequence']);
  }else{
   for(const pos of ['A','B','C','D','E','Sum'])add(pos==='Sum'?'SUM':'Position '+pos,['Big','Small','Odd','Even',...(pos==='Sum'?[]:Array.from({length:10},(_,i)=>String(i)))].map(v=>pos+':'+v),s=>s.split(':')[1],s=>rowColor(game,s.split(':')[1]));
  }
  if(rows.size)add('Other selections',[...rows.keys()]);
  return result;
 }
 function renderBreakdown(){
  if(!snapshot)return;const denominator=Number(snapshot.totals[basis])||0,sections=groups(),all=sections.flatMap(s=>s.rows),sorted=[...all].sort((a,b)=>b[basis]-a[basis]),highest=sorted[0],lowest=sorted.at(-1);
  $('basis-help').textContent=basis==='amount'?'Percentage of the total bet amount':'Percentage of all selection bets';
  document.querySelectorAll('[data-basis]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.basis===basis)));
  $('insights').innerHTML=denominator>0?[['Most placed',highest],['Least placed',lowest]].map(([label,row])=>`<article class="insight"><span>${label}</span><strong><b>${pct(row[basis]/denominator*100)}</b>${esc(game==='5d'?row.selection.replace(':',': '):row.label)}</strong></article>`).join(''):'<div class="insight"><span>Selected round</span><strong>No bets placed yet</strong></div>';
  $('breakdown').innerHTML=sections.map(section=>{const subtotal=section.rows.reduce((sum,r)=>sum+r[basis],0);return `<section class="group"><div class="group-head"><h3>${esc(section.title)}</h3><span>${basis==='amount'?money(subtotal):number(subtotal)+' bets'} · ${pct(denominator?subtotal/denominator*100:0)}</span></div><div class="selection-list">${section.rows.map(row=>{const percentage=denominator?row[basis]/denominator*100:0,leading=denominator>0&&row[basis]===highest[basis];return `<article class="selection${leading?' leader':''}" data-selection="${esc(row.selection)}"><div class="selection-top"><span class="selection-name"><i class="${row.color}">${esc(/^\d+$/.test(row.label)?row.label:row.label.slice(0,1))}</i>${/^\d+$/.test(row.label)?'Number '+esc(row.label):esc(row.label)}</span><b>${pct(percentage)}</b></div><div class="selection-track"><i data-percentage="${percentage}"></i></div><div class="selection-meta"><span>${number(row.bets)} bets</span><strong>${money(row.amount)}</strong></div></article>`;}).join('')}</div></section>`;}).join('');
  document.querySelectorAll('[data-percentage]').forEach(el=>el.style.width=Math.max(0,Math.min(100,Number(el.dataset.percentage)))+'%');
 }
 function render(){
  renderFilters();const d=snapshot,t=d.totals;
  $('round-status').textContent=d.round!==d.current_round?'PAST ROUND':d.betting_open?'BETTING OPEN':'BETTING CLOSED';$('round-status').classList.toggle('closed',!d.betting_open);
  const rounds=[...(d.rounds||[])];if(!rounds.some(r=>Number(r.round)===Number(d.round)))rounds.unshift({round:d.round,period:d.period});
  $('round-select').innerHTML=rounds.map(r=>`<option value="${Number(r.round)===Number(d.current_round)?'current':Number(r.round)}" ${Number(r.round)===Number(d.round)?'selected':''}>${Number(r.round)===Number(d.current_round)?'Live · ':''}${esc(r.period)}</option>`).join('');
  $('metrics').innerHTML=[['Total bets',number(t.bets),number(t.pending)+' pending'],['Bet amount',money(t.amount),'All selections combined'],['Players',number(t.players),'Unique users'],['Orders',number(t.orders),'Multi-bets grouped']].map(([label,value,note])=>`<article class="metric"><span>${label}</span><b>${value}</b><small>${note}</small></article>`).join('');
  $('last-update').textContent='Updated '+new Intl.DateTimeFormat('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(lastUpdated));
  renderBreakdown();tick();
 }
 function connection(stale,label){$('connection').classList.toggle('stale',stale);$('connection').lastElementChild.textContent=label;}
 async function load(force=false){
  if(!session||document.hidden||busy&&!force)return;
  if(force)controller?.abort();controller=new AbortController();const currentController=controller,version=++requestVersion;busy=true;$('refresh').classList.add('busy');
  const timeout=setTimeout(()=>currentController.abort('timeout'),15000);
  try{
   const data=await rpc('status',{session,game,lane,...(selectedRound===null?{}:{round:selectedRound})},currentController.signal);
   if(version!==requestVersion)return;snapshot=data;clockAnchor=Number(data.server_ms);timeAnchor=performance.now();lastUpdated=Date.now();connection(false,'Live');errorAt('data-error','');render();
  }catch(e){if(version!==requestVersion)return;if(e.code==='unauthorized'){showLogin(e.message);return;}if(currentController.signal.aborted&&currentController.signal.reason!=='timeout')return;connection(true,'Connection delayed');errorAt('data-error',currentController.signal.aborted?'Connection timed out. Tap refresh to retry.':e.message);}
  finally{clearTimeout(timeout);if(version===requestVersion){busy=false;$('refresh').classList.remove('busy');}}
 }
 function tick(){
  if(!snapshot)return;const now=clockAnchor+performance.now()-timeAnchor,remaining=Math.max(0,(Number(snapshot.round)+1)*lane-now/1000),historical=Number(snapshot.round)!==Number(snapshot.current_round);
  $('countdown').textContent=historical?'Completed round':String(Math.floor(Math.ceil(remaining)/60)).padStart(2,'0')+':'+String(Math.ceil(remaining)%60).padStart(2,'0')+' remaining';$('round-progress').style.width=(historical?0:Math.min(100,remaining/lane*100))+'%';
  if(Date.now()-lastUpdated>15000)connection(true,'Data delayed');
  if(!historical&&remaining===0&&!busy)load();
 }
 function filter(nextGame,nextLane){game=nextGame;lane=nextLane;selectedRound=null;snapshot=null;errorAt('data-error','');renderFilters();renderLoading();load(true);}
 $('login-form').onsubmit=async e=>{e.preventDefault();const key=$('access-key').value;if(key.length<16)return;const button=$('sign-in');button.disabled=true;button.textContent='Checking access…';errorAt('login-error','');
  try{const result=await rpc('login',{key});$('access-key').value='';remember(result.session);showDashboard();await load(true);}catch(e){errorAt('login-error',e.message);}finally{button.disabled=false;button.innerHTML='Open dashboard <span aria-hidden="true">→</span>';}
 };
 $('show-key').onclick=()=>{const show=$('access-key').type==='password';$('access-key').type=show?'text':'password';$('show-key').textContent=show?'Hide':'Show';$('show-key').setAttribute('aria-label',show?'Hide access key':'Show access key');};
 $('logout').onclick=async()=>{const old=session;showLogin();try{await rpc('logout',{session:old});}catch{errorAt('login-error','Signed out on this device. Server session expires automatically.');}};
 $('game-tabs').onclick=e=>{const button=e.target.closest('[data-game]');if(button&&button.dataset.game!==game)filter(button.dataset.game,button.dataset.game==='wingo'?30:60);};
 $('duration-tabs').onclick=e=>{const button=e.target.closest('[data-lane]');if(button&&Number(button.dataset.lane)!==lane)filter(game,Number(button.dataset.lane));};
 document.querySelectorAll('[data-basis]').forEach(button=>button.onclick=()=>{basis=button.dataset.basis;renderBreakdown();});
 $('round-select').onchange=e=>{selectedRound=e.target.value==='current'?null:Number(e.target.value);snapshot=null;renderLoading();load(true);};
 $('refresh').onclick=()=>load(true);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session)load(true);});
 setInterval(()=>load(),5000);setInterval(tick,250);
 if(session){showDashboard();load(true);}
})();
