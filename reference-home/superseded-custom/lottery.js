(() => {
 const names={k3:'K3','5d':'5D','trx-wingo':'TRX Win Go'},money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const selectionLabel=s=>s.startsWith('sum:')?'Sum '+s.slice(4):s.startsWith('triple:')?'Triple '+s.slice(7):s.startsWith('pair:')?'Pair '+s.slice(5).replace(':',' + '):s.startsWith('different:')?'Different '+s.slice(10).replaceAll(',',', '):s.startsWith('two:')?'Two numbers '+s.slice(4).replace(',',', '):s.replace(':',' · ');
 const counts=[1,3,6,10,15,21,25,27,27,25,21,15,10,6,3,1];
 const dice=n=>`<img class="lottery-die" src="assets/lottery-source/dice-${n}.png" alt="${n}">`;
 function odds(g,s){if(g==='k3'){if(s.startsWith('sum:'))return Math.trunc(211.68/counts[Number(s.slice(4))-3]*100)/100;if(s.startsWith('triple:'))return 207.36;if(s==='Any triple'||s.startsWith('different:'))return 34.56;if(/^pair:\d$/.test(s))return 12.96;if(/^pair:\d:\d$/.test(s))return 69.12;if(s.startsWith('two:'))return 6.91;if(s==='Sequence')return 8.64;return 1.96;}if(g==='5d')return /^[A-E]:\d$/.test(s)?9.8:1.96;return /^\d$/.test(s)?9.8:s==='Violet'?4.41:1.96;}
 const option=(g,s,label=s,cls='')=>`<button type="button" class="lottery-option ${cls}" data-lottery-select="${s}"><strong>${label}</strong><small>${odds(g,s)}×</small></button>`;
 function options(g,position='A',mode='Sum'){
  if(g==='k3'){
    const modes=['Sum','Triple','Pair','Different'];let items=[];
    if(mode==='Sum')items=Array.from({length:16},(_,i)=>option(g,'sum:'+(i+3),i+3));
    if(mode==='Triple')items=['Any triple',...Array.from({length:6},(_,i)=>'triple:'+(i+1))].map(s=>option(g,s,s==='Any triple'?s:dice(s.slice(-1)).repeat(3)));
    if(mode==='Pair'){
      items=Array.from({length:6},(_,i)=>option(g,'pair:'+(i+1),dice(i+1).repeat(2)+' +'));
      for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)if(a!==b)items.push(option(g,`pair:${a}:${b}`,dice(a).repeat(2)+dice(b)));
    }
    if(mode==='Different'){
      items.push(option(g,'Sequence','Sequence'));
      for(let a=1;a<=6;a++)for(let b=a+1;b<=6;b++)items.push(option(g,`two:${a},${b}`,dice(a)+dice(b)));
      for(let a=1;a<=6;a++)for(let b=a+1;b<=6;b++)for(let c=b+1;c<=6;c++)items.push(option(g,`different:${a},${b},${c}`,dice(a)+dice(b)+dice(c)));
    }
    return `<div class="lottery-options four">${['Big','Small','Odd','Even'].map(s=>option(g,s)).join('')}</div><div class="lottery-mode">${modes.map(m=>`<button type="button" data-lottery-mode="${m}" aria-pressed="${mode===m}">${m}</button>`).join('')}</div><div class="lottery-options ${mode==='Sum'?'four':'three'}">${items.join('')}</div>`;
  }
  if(g==='5d')return `<div class="lottery-position">${['A','B','C','D','E','Sum'].map(p=>`<button type="button" data-lottery-position="${p}" aria-pressed="${position===p}">${p}</button>`).join('')}</div><div class="lottery-options four">${['Big','Small','Odd','Even'].map(s=>option(g,position+':'+s,s)).join('')}</div>${position==='Sum'?'':`<div class="lottery-options five">${Array.from({length:10},(_,n)=>option(g,position+':'+n,n)).join('')}</div>`}`;
  return `<div class="lottery-options three">${['Green','Violet','Red'].map(s=>option(g,s,s,s.toLowerCase())).join('')}</div><div class="lottery-options five">${Array.from({length:10},(_,n)=>option(g,String(n),n,n===0?'red-violet':n===5?'green-violet':n%2?'green':'red')).join('')}</div><div class="lottery-options two">${['Big','Small'].map(s=>option(g,s)).join('')}</div>`;
 }
 function view(g,tabbar){return `<section class="catalog-page lottery-page" data-lottery-game="${g}"><header class="lottery-header"><a href="#/home" aria-label="Back to home">‹</a><img src="assets/web%20images/color-win-logo-supplied.png" alt="Color Win"><a href="#/support" aria-label="Customer support"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13v-2a8 8 0 0 1 16 0v2M4 12H2v7h3v-7zm16 0h2v7h-3v-7zM9 21h6"/></svg></a></header><main class="lottery-content"><section class="lottery-wallet"><strong data-lottery-balance>₹—</strong><span>Color Win wallet balance</span><div><a href="#/withdraw">Withdraw</a><a href="#/deposit">Deposit</a></div></section><nav class="lottery-lanes" aria-label="Game period">${[60,180,300,600].map(l=>`<button type="button" data-lottery-lane="${l}" aria-pressed="${l===60}"><span>◷</span>${names[g]}<small>${l/60} Min</small></button>`).join('')}</nav><section class="lottery-period"><div><button type="button" data-lottery-rules>How to play</button><h1>${names[g]} <span data-lottery-lane-label>1 Min</span></h1><div data-lottery-last>Waiting for server</div></div><div><small>Time remaining</small><strong data-lottery-countdown>--:--</strong><span data-lottery-round>—</span></div></section><p class="lottery-connection" data-lottery-connection role="status">Connecting…</p><section data-lottery-options>${options(g)}</section><div class="lottery-history-tabs"><button type="button" data-lottery-tab="history" aria-pressed="true">Game history</button><button type="button" data-lottery-tab="bets" aria-pressed="false">My history</button></div><div class="lottery-history" data-lottery-history></div><p class="lottery-footnote">${g==='trx-wingo'?'Result: last numeric digit of the confirmed target block ID. Confirmation can take longer than the countdown.':'Results and payouts are processed by the Color Win server.'}</p></main>${tabbar}<div class="lottery-overlay" data-lottery-sheet hidden><form class="lottery-sheet"><h2>${names[g]}</h2><p data-lottery-selection></p><label>Amount <input name="amount" type="number" inputmode="decimal" min="1" max="10000" step="0.01" value="1" required></label><div class="lottery-presets">${[1,10,100,1000].map(a=>`<button type="button" data-lottery-amount="${a}">${a}</button>`).join('')}</div><p data-lottery-return></p><small>Payout includes the stake. ${g==='trx-wingo'?'Red on 0 and Green on 5 pay 1.47×.':''}</small><div class="lottery-sheet-actions"><button type="button" data-lottery-close>Cancel</button><button type="submit">Confirm bet</button></div></form></div><dialog class="lottery-rules"><h2>How to play ${names[g]}</h2><p>${g==='k3'?'Three dice are rolled. Small: sum 3–10; Big: sum 11–18. Odd/Even use the sum. A sum bet wins on that total; triple bets require three equal dice. Pair + wins when the shown face appears at least twice; a pair with a third die requires that exact combination. Different bets require all shown faces. Sequence means three consecutive faces in any order.':g==='5d'?'Five digits are drawn for positions A–E. Choose a digit, Big (5–9), Small (0–4), Odd or Even for one position. Sum uses all five digits: Small 0–22, Big 23–45.':'A round spans 20, 60, 100 or 200 TRON blocks. The target is the final block of that range. The last numeric digit of its solidified block ID is the result. Odd numbers are Green, even numbers Red, and 0/5 also Violet.'}</p><p>Betting closes for the final 6 seconds. Each option displays its payout multiplier. Minimum ₹1; maximum ₹10,000 per bet.</p><button type="button" data-lottery-rules-close>Close</button></dialog></section>`;}
 let cleanup=()=>{};
 function bind(){cleanup();const root=document.querySelector('.lottery-page');if(!root)return;
  const g=root.dataset.lotteryGame,owner=window.ColorWinAuth?.session?.user?.id,controller=new AbortController(),{signal}=controller;
  let lane=60,state=null,loadedAt=0,loading=false,position='A',mode='Sum',tab='history',selection='',sending=false,retry=null,sequence=0;
  const sheet=root.querySelector('[data-lottery-sheet]'),form=sheet.querySelector('form'),connection=root.querySelector('[data-lottery-connection]');
  const alert=message=>{if(typeof toast==='function')toast(message);};
  const remaining=()=>state?Math.max(0,Number(state.remaining)-(performance.now()-loadedAt)/1000):0;
  const valid=()=>root.isConnected&&owner===window.ColorWinAuth?.session?.user?.id&&!signal.aborted;
  async function request(action,data){if(!owner||owner==='preview')throw Error('Sign in to play with your Color Win wallet.');
   if(g!=='trx-wingo')return window.ColorWinOperations.rpc('colorwin_lottery',{p_game:g,p_action:action,p_data:data});
   const base=window.COLORWIN_SUPABASE_CONFIG?.url,token=window.ColorWinAuth?.session?.access_token;
   const response=await fetch(base.replace(/\/$/,'')+'/functions/v1/trx-lottery',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({game:g,action,data}),signal});
   const result=await response.json();if(!response.ok)throw Error(result.error||'TRX network unavailable');return result;
  }
  function history(){if(!state)return;const box=root.querySelector('[data-lottery-history]');
   if(tab==='bets'){box.innerHTML=state.bets.length?state.bets.map(b=>`<article class="lottery-bet-row"><div><strong>${esc(selectionLabel(b.selection))}</strong><small>${esc(b.round_index)} · ${money(b.stake)}</small></div><div class="${b.status}"><strong>${b.status==='pending'?'Pending':b.status==='won'?'Win':'Lose'}</strong><small>${b.status==='pending'?'Result pending':money(b.payout)}</small></div></article>`).join(''):'<p>No bets yet.</p>';return;}
   box.innerHTML='<div class="lottery-history-head"><span>Period</span><span>Result</span><span>Big/Small</span></div>'+state.history.map(r=>{const total=r.numbers.reduce((a,b)=>a+b,0);const big=g==='k3'?total>=11:g==='5d'?total>=23:r.numbers[0]>=5;return `<div class="lottery-history-row"><span>${esc(r.index)}${r.block_id?`<a href="https://tronscan.org/#/block/${r.block_number}" target="_blank" rel="noopener noreferrer" title="${esc(r.block_id)}">Block ${r.block_number} ↗</a>`:''}</span><strong>${g==='k3'?r.numbers.map(dice).join(''):r.numbers.map(n=>`<b class="lottery-result-digit ${g==='trx-wingo'?(n===0?'red-violet':n===5?'green-violet':n%2?'green':'red'):''}">${n}</b>`).join('')}</strong><span>${big?'Big':'Small'}</span></div>`;}).join('');
  }
  function render(){root.querySelector('[data-lottery-balance]').textContent=money(state.balance);root.querySelector('[data-lottery-round]').textContent=state.round;const last=state.history[0];root.querySelector('[data-lottery-last]').innerHTML=last?(g==='k3'?last.numbers.map(dice).join(''):last.numbers.map(n=>`<b class="lottery-last-digit">${n}</b>`).join('')):'Result pending';history();tick();}
  async function load(){if(loading||sending||!valid())return;loading=true;const current=++sequence,wanted=lane;
   try{const next=await request('load',{lane:wanted});if(!valid()||wanted!==lane||current!==sequence)return;state=next;loadedAt=performance.now();connection.textContent='';root.classList.add('lottery-ready');render();window.ColorWinAccount?.refreshBalance?.().catch(()=>{});
   }catch(e){if(valid()&&e.name!=='AbortError'){connection.textContent=e.message;root.classList.remove('lottery-ready');}}finally{loading=false;if(valid()&&wanted!==lane)load();}
  }
  function tick(){if(!state){root.querySelectorAll('[data-lottery-select]').forEach(b=>b.disabled=true);return;}const r=remaining();root.querySelector('[data-lottery-countdown]').textContent=String(Math.floor(r/60)).padStart(2,'0')+':'+String(Math.floor(r%60)).padStart(2,'0');const closed=r<=6||!root.classList.contains('lottery-ready');root.querySelectorAll('[data-lottery-select]').forEach(b=>b.disabled=closed);if(closed&&!sending)sheet.hidden=true;}
  function updateReturn(){const amount=Number(form.elements.amount.value);root.querySelector('[data-lottery-return]').textContent='Winning payout: '+money(Math.floor((amount*odds(g,selection)+Number.EPSILON)*100)/100);}
  root.addEventListener('click',async e=>{
   const b=e.target.closest('button');if(!b)return;
   if(b.hasAttribute('data-lottery-rules')){root.querySelector('dialog').showModal();return;}
   if(b.hasAttribute('data-lottery-rules-close')){root.querySelector('dialog').close();return;}
   if(b.dataset.lotteryLane){if(sending)return;lane=Number(b.dataset.lotteryLane);sequence++;state=null;sheet.hidden=true;root.classList.remove('lottery-ready');root.querySelector('[data-lottery-lane-label]').textContent=lane/60+' Min';root.querySelectorAll('[data-lottery-lane]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));await load();return;}
   if(b.dataset.lotteryPosition){position=b.dataset.lotteryPosition;root.querySelector('[data-lottery-options]').innerHTML=options(g,position,mode);tick();return;}
   if(b.dataset.lotteryMode){mode=b.dataset.lotteryMode;root.querySelector('[data-lottery-options]').innerHTML=options(g,position,mode);tick();return;}
   if(b.dataset.lotteryTab){tab=b.dataset.lotteryTab;root.querySelectorAll('[data-lottery-tab]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));history();return;}
   if(b.dataset.lotterySelect){if(!state||remaining()<=6)return alert('Betting closed. Please use the next round');selection=b.dataset.lotterySelect;retry=null;root.querySelector('[data-lottery-selection]').textContent='Select '+selectionLabel(selection);form.elements.amount.value='1';updateReturn();sheet.hidden=false;form.elements.amount.focus();return;}
   if(b.dataset.lotteryAmount){form.elements.amount.value=b.dataset.lotteryAmount;retry=null;updateReturn();}
   if(b.hasAttribute('data-lottery-close')&&!sending)sheet.hidden=true;
  },{signal});
  form.elements.amount.addEventListener('input',()=>{retry=null;updateReturn();},{signal});
  form.addEventListener('submit',async e=>{e.preventDefault();if(sending||!state)return;if(remaining()<=6)return alert('Betting closed. Please use the next round');
   sending=true;sequence++;form.querySelectorAll('button,input').forEach(b=>b.disabled=true);
   const payload=retry||{lane,round:state.round,selection,amount:Number(form.elements.amount.value),request_id:crypto.randomUUID()};retry=payload;
   try{const result=await request('bet',payload);if(!valid())return;state=result;loadedAt=performance.now();retry=null;sheet.hidden=true;render();alert('Bet Successful');window.ColorWinAccount?.refreshBalance?.().catch(()=>{});
   }catch(e){if(valid()&&e.name!=='AbortError')alert(e.message);}finally{sending=false;form.querySelectorAll('button,input').forEach(b=>b.disabled=false);}
  },{signal});
  const poll=setInterval(load,5000),clock=setInterval(tick,250);tick();load();
  cleanup=()=>{controller.abort();clearInterval(poll);clearInterval(clock);root.querySelector('dialog')?.close();};
  window.addEventListener('hashchange',cleanup,{once:true,signal});window.addEventListener('pagehide',cleanup,{once:true,signal});
 }
 window.ColorWinLottery={view,bind,odds};
})();
