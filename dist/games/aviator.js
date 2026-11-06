(() => {
'use strict';
const $=id=>document.getElementById(id), money=n=>Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}), fixed=n=>Number(n||0).toFixed(2);
const settings=[{amount:10,mode:'bet',auto:false,target:2},{amount:10,mode:'bet',auto:false,target:2}], keys=[null,null], celebrated=new Set(), observedActive=new Set();
let round=null,balance=null,multiplier=1,phase='connecting',history=[],roundHistory=[],recordView='live',clockOffset=0,serverAnchor=0,clientAnchor=0,initialized=false,lastReceived=0,lastServerTime=0,actionBusy=false,loading=false,mutation=0,crashedAt=0,soundOn=true,noticeTimer=null,nextRetry=0;
let visualSeconds=0,frameAt=0,buttonAt=0,flightPose=null,departurePose=null,lastReadout='';
const introOpenedAt=performance.now();let introProgress=0,introTarget=0,introRoundReady=false,introAssetsReady=false,introFrameAt=0,introReadyTimer=null;
function finishIntro(){introRoundReady=true;if(introAssetsReady)introTarget=100;}
function animateIntro(now){
 const dt=introFrameAt?Math.min(80,now-introFrameAt):0;introFrameAt=now;
 introProgress=Math.min(introTarget,(now-introOpenedAt)/100);
 const percent=Math.floor(introProgress);$('intro-percent').textContent=percent+'%';$('intro-progress').setAttribute('aria-valuenow',percent);$('intro-progress').querySelector('i').style.width=percent+'%';
 if(percent===100){if(!introReadyTimer)introReadyTimer=setTimeout(()=>{$('intro').classList.add('ready');$('intro').setAttribute('aria-hidden','true');},Math.max(140,10000-(performance.now()-introOpenedAt)));return;}
 if(!$('intro').classList.contains('ready'))requestAnimationFrame(animateIntro);
}
introTarget=20;
Promise.resolve(document.fonts?.ready).then(()=>{introTarget=Math.max(introTarget,40);});
Promise.all([...document.images].map(img=>img.decode().catch(()=>{}))).then(()=>{
 introAssetsReady=true;introTarget=introRoundReady?100:85;
});
requestAnimationFrame(animateIntro);
const stageBounds={width:600,height:340};
new ResizeObserver(entries=>{const box=entries[0].contentRect;stageBounds.width=box.width+2;stageBounds.height=box.height+2;$('stage').style.setProperty('--ray-size',Math.ceil(Math.hypot(stageBounds.width,stageBounds.height)*2+80)+'px');}).observe($('stage'));
const queued=[null,null];let liveBets=[],topBets=[],liveCount=0;
const active=i=>round?.bets?.find(b=>Number(b.slot)===i&&b.status!=='cancelled');
function escape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const audio=window.CWAviatorAudio;
function serverNow(){return serverAnchor?serverAnchor+(performance.now()-clientAnchor):Date.now();}
function announce(bet){
 const won=bet.status==='cashed',node=$('announcement');node.classList.toggle('loss',!won);
 node.innerHTML='<span>'+(won?'You have cashed out':'Bet lost')+'<b>'+fixed(bet.result)+'x</b></span><strong><small>'+(won?'Win INR':'Lost INR')+'</small>'+money(won?bet.payout:bet.amount)+'</strong><button aria-label="Dismiss result">×</button>';
 node.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>node.hidden=true,3500);audio?.play(won?'win':'lose');
}
function showError(message){$('intro').classList.add('ready');$('error').hidden=false;$('error').querySelector('span').textContent=message;}
function panels(){
 $('panels').innerHTML=settings.map((s,i)=>`<section class="panel" id="panel${i}" aria-label="Bet panel ${i+1}"><div class="panel-tabs" role="tablist" aria-label="Bet ${i+1} mode"><button data-mode="bet" data-slot="${i}" role="tab" aria-selected="${s.mode==='bet'}" class="${s.mode==='bet'?'selected':''}">Bet</button><button data-mode="auto" data-slot="${i}" role="tab" aria-selected="${s.mode==='auto'}" class="${s.mode==='auto'?'selected':''}">Auto</button></div><div id="queued-hint${i}" class="queued-hint" hidden>WAITING FOR NEXT ROUND</div><div class="betrow"><div class="stake-controls"><div class="amount"><button data-adjust="-10" data-slot="${i}" aria-label="Decrease bet ${i+1}">−</button><input id="amount${i}" aria-label="Bet ${i+1} amount in INR" type="number" inputmode="decimal" min="1" max="10000" step="0.01" value="${s.amount}"><button data-adjust="10" data-slot="${i}" aria-label="Increase bet ${i+1}">+</button></div><div class="quick">${[10,100,500,1000].map(n=>`<button data-amount="${n}" data-slot="${i}">${n.toLocaleString('en-IN')}</button>`).join('')}</div></div><button class="bet-action" id="action${i}" data-action="${i}" disabled><strong>BET</strong><span>${money(s.amount)} <small>INR</small></span></button></div><div class="auto-options" ${s.mode==='auto'?'':'hidden'}><label><input type="checkbox" id="auto${i}" ${s.auto?'checked':''}>Auto Cash Out</label><input class="target" id="target${i}" aria-label="Bet ${i+1} auto cash out multiplier" type="number" inputmode="decimal" min="1.01" max="50" step=".01" value="${fixed(s.target)}"></div></section>`).join('');
 for(let i=0;i<2;i++){
  $('amount'+i).onchange=e=>setAmount(i,e.target.value);
  $('auto'+i).onchange=e=>{if(!locked(i))settings[i].auto=e.target.checked;};
  $('target'+i).onchange=e=>{if(!locked(i)){settings[i].target=Math.round(Math.min(50,Math.max(1.01,Number(e.target.value)||2))*100)/100;e.target.value=fixed(settings[i].target);}};
 }
 updateButtons();
}
function locked(i){return actionBusy||!!queued[i]||active(i)?.status==='active';}
function setAmount(i,value){if(locked(i))return;const n=Number(value);settings[i].amount=Math.round(Math.min(10000,Math.max(1,Number.isFinite(n)?n:1))*100)/100;$('amount'+i).value=settings[i].amount;updateButtons();}
$('panels').onclick=e=>{
 const button=e.target.closest('button');if(!button)return;const i=Number(button.dataset.slot);
 if(button.hasAttribute('data-action'))return act(Number(button.dataset.action));
 if(locked(i))return;
 if(button.dataset.mode){settings[i].mode=button.dataset.mode;panels();}
 else if(button.hasAttribute('data-adjust'))setAmount(i,settings[i].amount+Number(button.dataset.adjust));
 else if(button.hasAttribute('data-amount'))setAmount(i,button.dataset.amount);
};
function updateButtons(){
 const stale=lastReceived&&performance.now()-lastReceived>2500;
 for(let i=0;i<2;i++){
  const bet=active(i),button=$('action'+i);if(!button)continue;
  const isActive=bet?.status==='active',isQueued=!!queued[i];
  $('panel'+i).classList.toggle('is-active',isActive);$('panel'+i).classList.toggle('is-queued',isQueued);$('queued-hint'+i).hidden=!isQueued;
  $('panel'+i).querySelectorAll('input,button:not(.bet-action)').forEach(e=>e.disabled=actionBusy||isActive||isQueued);
  let label='BET',value=money(settings[i].amount),kind='',disabled=!round||actionBusy||stale;
  if(isQueued){label='CANCEL';value=money(queued[i].amount);kind='cancel';}
  else if(phase==='waiting'&&isActive){label='CANCEL';value=money(bet.amount);kind='cancel';}
  else if(phase==='flying'&&isActive){label='CASH OUT';value=money(Math.floor(Math.round(Number(bet.amount)*100)*Math.round(multiplier*100)/100)/100);kind='cash';}
  else if(phase==='connecting'||(phase==='crashed'&&isActive)){label='WAIT';kind='wait';disabled=true;}
  if(actionBusy)label='PLEASE WAIT';
  button.className='bet-action '+kind;button.disabled=disabled;
  button.title=phase!=='waiting'&&!isActive&&!isQueued?'Place a bet for the next round':'';
  const markup='<strong>'+label+'</strong><span>'+value+' <small>INR</small></span>';
  if(button.innerHTML!==markup)button.innerHTML=markup;
 }
}
function coefficient(n){const value=Number(n)||0;return '<span class="'+(value>=10?'high':value>=2?'medium':'')+'">'+fixed(value)+'x</span>';}
function renderHistory(){
 $('history').innerHTML=roundHistory.length?roundHistory.slice(0,12).map(r=>coefficient(r.result)).join(''):'<small class="history-placeholder">Completed rounds will appear here</small>';
 $('history-grid').innerHTML=roundHistory.length?roundHistory.map(r=>coefficient(r.result)).join(''):'<p class="board-empty">No completed rounds yet.</p>';
 const social=recordView!=='all',rows=recordView==='live'?liveBets:recordView==='top'?topBets:history;
 document.querySelector('.bets-board').classList.toggle('is-social',social);
 $('record-title').textContent=recordView==='live'?'ALL BETS':recordView==='top'?'TOP CASH-OUTS · 24H':'MY BETS';$('record-count').textContent=recordView==='live'?liveCount:rows.length;
 document.querySelector('.record-head').innerHTML=social?'<span>User</span><span>Bet INR</span><span>x</span><span>Cash out INR</span>':'<span>Bet INR</span><span>Multiplier</span><span>Cash out INR</span>';
 $('records').innerHTML=rows.length?rows.map(r=>'<div class="record '+(Number(r.payout)>0?'won':r.status==='lost'?'lost':'')+(r.mine?' mine':'')+'">'+(social?'<span class="member"><i>'+escape((r.member||'M').slice(0,1))+'</i>'+escape(r.member||'You')+'</span>':'')+'<span>'+money(r.amount)+'</span><span class="coefficient">'+(r.result?fixed(r.result)+'x':'—')+'</span><span>'+(r.status==='active'?'—':money(r.payout))+'</span></div>').join(''):'<div class="board-empty"><img src="../assets/no-data.svg" alt="">'+(recordView==='live'?'Bets for this shared round will appear here.':recordView==='top'?'Today’s cash-outs will appear here.':'Your completed bets will appear here.')+'</div>';
}
function paint(data,rtt=0){
 if(!data?.round?.id||!Number.isFinite(Number(data.balance)))throw Error('Round data unavailable. Please reconnect.');
 const incoming=Date.parse(data.round.now);if(!Number.isFinite(incoming))throw Error('Round clock unavailable. Please reconnect.');
 if(incoming<lastServerTime)return;
 const previousPhase=phase,changed=round?.id!==data.round.id;
 lastServerTime=incoming;lastReceived=performance.now();serverAnchor=incoming+Math.min(Math.max(0,rtt)/2,400);clientAnchor=performance.now();clockOffset=serverAnchor-Date.now();round=data.round;balance=Number(data.balance);phase=round.phase;multiplier=Number(round.multiplier)||1;
 if(changed){keys.fill(null);crashedAt=0;visualSeconds=0;flightPose=null;departurePose=null;frameAt=0;}
 if(phase==='crashed'&&(previousPhase!=='crashed'||changed)){crashedAt=performance.now();departurePose=flightPose?{...flightPose}:null;}
 audio?.setPhase(phase);
 if(!initialized)finishIntro();$('stage').dataset.phase=phase;$('balance').textContent=money(balance);$('round-label').textContent=(round.shared?'Shared round ':'Round ')+(round.number||String(round.id).slice(0,8));$('round-meta-id').textContent='Round ID: '+(round.number||String(round.id).slice(0,8));$('ping').textContent='Ping: '+Math.round(rtt)+'ms';$('connection').className='connection';$('connection').lastChild.textContent=' Connected';$('error').hidden=true;
 history=Array.isArray(data.history)?data.history:[];
 roundHistory=(Array.isArray(data.round_history)?data.round_history:history).slice(0,50);liveBets=Array.isArray(data.live_bets)?data.live_bets:(round.bets||[]).filter(b=>b.status!=='cancelled').map(b=>({...b,member:'You',mine:true}));topBets=Array.isArray(data.top_bets)?data.top_bets:history.filter(b=>b.payout>0).sort((a,b)=>b.payout-a.payout);liveCount=Number(data.live_count??liveBets.length);
 for(const bet of round.bets||[]){
  if(bet.status==='active')observedActive.add(bet.id);
  if(bet.status!=='cancelled')keys[Number(bet.slot)]=null;
 }
 for(const bet of [...(round.bets||[]),...history]){
  if(!['cashed','lost'].includes(bet.status)||celebrated.has(bet.id))continue;
  celebrated.add(bet.id);
  if(initialized&&observedActive.has(bet.id))announce(bet);
  observedActive.delete(bet.id);
 }
 initialized=true;renderHistory();updateButtons();setTimeout(flushQueue,0);
}
async function load(){
 if(loading||actionBusy||document.hidden||performance.now()<nextRetry)return;
 loading=true;const version=mutation,started=performance.now();
 try{const data=await CWArcade('aviator','load');if(version===mutation&&!actionBusy)paint(data,performance.now()-started);nextRetry=0;}
 catch(e){nextRetry=performance.now()+3000;showError(e.message||'Connection unavailable');$('connection').classList.add('stale');$('connection').lastChild.textContent=' Reconnecting';}
 finally{loading=false;}
}
async function transact(action,data){
 if(actionBusy)return;actionBusy=true;mutation++;updateButtons();
 try{const started=performance.now();const response=await CWArcade('aviator',action,data);paint(response,performance.now()-started);if(action==='bet'){keys[data.slot]=null;audio?.play('bet');}}
 catch(e){showError(e.message||'Unable to confirm action. Reconnect to check its status.');}
 finally{actionBusy=false;updateButtons();setTimeout(flushQueue,0);}
}
function flushQueue(){
 if(actionBusy||loading||phase!=='waiting'||!round||Date.parse(round.starts_at)-serverNow()<300)return;
 const i=queued.findIndex(q=>q);if(i<0)return;
 const q=queued[i];queued[i]=null;keys[i]=q.requestId;
 transact('bet',{flight_id:round.id,slot:i,amount:q.amount,auto_target:q.autoTarget,request_id:q.requestId});
}
function act(i){
 if(actionBusy||!round||performance.now()-lastReceived>2500)return;
 if(queued[i]){queued[i]=null;updateButtons();return;}
 const bet=active(i);
 if(phase==='waiting'&&bet?.status==='active')return transact('cancel',{id:bet.id});
 if(phase==='flying'&&bet?.status==='active')return transact('cash',{id:bet.id});
 const amount=Number($('amount'+i).value);
 if(!Number.isFinite(amount)||amount<1||amount>10000||Math.abs(Math.round(amount*100)-amount*100)>.000001||amount>balance){showError('Enter a valid amount within your wallet balance (₹1–₹10,000).');return;}
 settings[i].amount=amount;keys[i]=keys[i]||CWArcade.newId();
 if(phase!=='waiting'){
  queued[i]={amount,autoTarget:settings[i].auto?settings[i].target:null,requestId:keys[i]};updateButtons();return;
 }
 return transact('bet',{flight_id:round.id,slot:i,amount,auto_target:settings[i].auto?settings[i].target:null,request_id:keys[i]});
}
function animate(now){
 const dt=frameAt?Math.min(64,now-frameAt):16;frameAt=now;
 if(round){
  const rate=Number(round.growth_rate)||.18,age=now-lastReceived,elapsed=Math.max(0,(serverNow()-Date.parse(round.starts_at))/1000);
  // Continuous server time drives the flight, independently of the rounded coefficient.
  if(phase==='flying'&&age<1200)multiplier=Math.floor(Math.exp(elapsed*rate)*100)/100;
  const readout=fixed(multiplier);
  if(readout!==lastReadout){$('multiplier').innerHTML=readout+'<span>x</span>';lastReadout=readout;}
  $('stage').style.setProperty('--flight-glow',multiplier>=10?'#be229a':multiplier>=2?'#8430c1':'#159cdb');
  if(phase==='waiting'){$('countdown').textContent='WAITING FOR NEXT ROUND';const remaining=Math.max(0,Math.min(100,(Date.parse(round.starts_at)-serverNow())/100));$('progress').style.width=remaining+'%';$('waiting-progress').setAttribute('aria-valuenow',Math.round(remaining));}
  if(phase==='flying'&&age<1200){
   if(!flightPose)visualSeconds=elapsed;
   else visualSeconds+=(elapsed-visualSeconds)*(1-Math.exp(-dt/100));
  }
  const seconds=phase==='crashed'&&!flightPose?Math.log(Math.max(1,multiplier))/rate:visualSeconds;
  const t=phase==='waiting'?0:Math.min(1,seconds/8),hover=Math.max(0,seconds-8),blend=Math.min(1,hover/2),envelope=blend*blend*(3-2*blend);
  const x=12+t*455+Math.sin(hover*.7)*3*envelope,y=318-Math.pow(t,2.3)*235+Math.sin(hover*1.3)*9*envelope;
  const curve=`M12 318 C${12+(x-12)*.55} 318 ${x-(x-12)*.15} ${y+38*t} ${x} ${y}`;
  $('curve').setAttribute('d',phase==='waiting'?'':curve);$('area').setAttribute('d',phase==='waiting'?'':curve+` L${x} 318 L12 318 Z`);
  const plane=$('plane'),bounds=stageBounds;
  const pose={x:16+(x/600)*(bounds.width-40)-112*.16,y:17+(y/340)*(bounds.height-40)-77.8763*.95,angle:-Math.min(4,t*4)};
  if(phase==='flying')flightPose=pose;
  const departure=phase==='crashed'?Math.min(1,(now-crashedAt)/650):0,base=phase==='crashed'&&departurePose?departurePose:pose;
  plane.style.transform=`translate3d(${base.x+departure*(bounds.width+100)}px,${base.y-departure*bounds.height*.6}px,0) rotate(${base.angle-departure*8}deg)`;
  plane.style.opacity=departure>=1?'0':'1';
  if(age>2500){$('connection').classList.add('stale');$('connection').lastChild.textContent=' Reconnecting';audio?.setPhase('connecting');}
  if(now-buttonAt>100){updateButtons();buttonAt=now;}
 }
 requestAnimationFrame(animate);
}
function closeHistory(){$('history-popup').hidden=true;$('history-toggle').setAttribute('aria-expanded',false);}
$('history-toggle').onclick=()=>{const open=$('history-popup').hidden;$('history-popup').hidden=!open;$('history-toggle').setAttribute('aria-expanded',open);};
$('history-close').onclick=closeHistory;
$('announcement').onclick=e=>{if(e.target.closest('button')){$('announcement').hidden=true;clearTimeout(noticeTimer);}};
document.querySelectorAll('[data-record-view]').forEach(b=>b.onclick=()=>{recordView=b.dataset.recordView;document.querySelectorAll('[data-record-view]').forEach(x=>x.classList.toggle('selected',x===b));renderHistory();});
$('sound').onclick=()=>{soundOn=!soundOn;audio?.unlock();audio?.setMuted(!soundOn);$('sound').setAttribute('aria-pressed',soundOn);$('sound').setAttribute('aria-label',soundOn?'Mute sound':'Enable sound');$('sound').style.opacity=soundOn?'1':'.4';$('effects-toggle').checked=soundOn;};
$('background-music').onchange=e=>audio?.setBackground(e.target.checked);
$('audio-volume').oninput=e=>audio?.setVolume(e.target.value);
function closeMenu(){$('settings-menu').hidden=true;$('menu').setAttribute('aria-expanded',false);}
$('menu').onclick=()=>{const open=$('settings-menu').hidden;$('settings-menu').hidden=!open;$('menu').setAttribute('aria-expanded',open);};
$('help').onclick=()=>{$('info').showModal();closeMenu();};
$('limits').onclick=()=>{$('info').showModal();closeMenu();};
$('my-history').onclick=()=>{document.querySelector('[data-record-view="all"]').click();document.querySelector('.bets-board').scrollIntoView({behavior:'smooth'});closeMenu();};
$('effects-toggle').onchange=e=>audio?.setEffects(e.target.checked);
$('animation-toggle').onchange=e=>document.body.classList.toggle('no-animation',!e.target.checked);
document.addEventListener('click',e=>{if(!e.target.closest('#menu,#settings-menu'))closeMenu();if(!e.target.closest('#history-popup,#history-toggle'))closeHistory();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();closeHistory();}});
$('info-close').onclick=()=>$('info').close();$('info').onclick=e=>{if(e.target===$('info')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
$('home').onclick=e=>{e.preventDefault();if(parent!==window)parent.postMessage({type:'cw-arcade-home'},'*');else location.href='../#/home';};
$('retry').onclick=()=>{nextRetry=0;load();};document.addEventListener('visibilitychange',()=>{if(!document.hidden){nextRetry=0;load();}});
let reportedHeight=0;new ResizeObserver(()=>{const height=Math.ceil(document.body.scrollHeight);if(Math.abs(height-reportedHeight)>2){reportedHeight=height;if(parent!==window)parent.postMessage({type:'cw-arcade-height',height},'*');}}).observe(document.body);
panels();renderHistory();load();setInterval(load,500);requestAnimationFrame(animate);
})();
