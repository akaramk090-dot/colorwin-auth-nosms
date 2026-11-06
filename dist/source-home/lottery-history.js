(() => {
 'use strict';
 const snapshots=new Map(),lanes=new Map(),previous=new Map(),announced=new Set(),queue=[];
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
 const activeGame=()=>/\/K3(?:\?|$)/i.test(location.hash)?'k3':/\/5D(?:\?|$)/i.test(location.hash)?'5d':/\/WinTrx(?:\?|$)/i.test(location.hash)?'trx-wingo':null;
 const title=g=>g==='k3'?'K3':g==='5d'?'5D':'TRX WinGo';
 const date=v=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(v));
 const period=o=>window.ColorWinSourceAdapter.periodFor(o.game,o.lane,o.round);
 function orders(g,bets){
  const groups=new Map();
  for(const b of bets||[]){const key=b.batch_request_id||b.id;let o=groups.get(key);if(!o){o={id:key,game:g,lane:Number(b.lane),round:b.round_index,created:b.created_at,lines:[],stake:0,payout:0,pending:false,result:[],quantity:b.quantity_known===false?null:Number(b.quantity)||1};groups.set(key,o);}o.lines.push(b);o.stake=Math.round((o.stake+Number(b.stake))*100)/100;o.payout=Math.round((o.payout+Number(b.payout))*100)/100;o.pending||=b.status==='pending';if(b.result?.length)o.result=b.result;}
  return [...groups.values()].sort((a,b)=>Date.parse(b.created)-Date.parse(a.created));
 }
 function selection(g,s){
  if(g==='5d'){const [pos,value]=s.split(':');return `${pos==='Sum'?'SUM':pos}: ${value}`;}
  if(g==='trx-wingo')return s;
  const [kind,...parts]=s.split(':');
  return ({Big:'Big Small | Big',Small:'Big Small | Small',Odd:'Even/Odd | Odd',Even:'Even/Odd | Even','Any triple':'Three same | Any','Sequence':'Three consecutive | Any'})[s]||({sum:'Total',pair:'Two same',triple:'Three same',different:'Three different',two:'Two different'}[kind]||kind)+' | '+parts.join(' + ');
 }
 function badge(o){const s=o.lines.length>1?'Multi':o.lines[0].selection.split(':').at(-1),numeric=/^\d+$/.test(s);let kind=s==='Multi'?'multi':['Green','Red','Violet','Big','Small','Odd','Even'].includes(s)?s.toLowerCase():numeric?'number '+(Number(s)%2?'green':'red'):'combo';if(numeric&&o.game==='trx-wingo'&&(s==='0'||s==='5'))kind+=' dual-'+(s==='0'?'red':'green');return `<span class="clh-badge ${esc(kind)}">${esc(s)}</span>`;}
 const diceFiles=['','n1-BwGtHT5h.png','n2-Cu_RIg4W.png','n3-meiTgeYx.png','n4-CKhZln44.png','n5-DRtuCoBO.png','n6-DfBPUfaO.png'];
 function roundOrders(g,bets){const groups=new Map();for(const b of bets||[]){const key=Number(b.lane)+':'+b.round_index;let group=groups.get(key);if(!group){group={...b,id:key,batch_request_id:key,lines:[]};groups.set(key,group);}group.lines.push(b);}return [...groups.values()].map(group=>orders(g,group.lines.map(b=>({...b,batch_request_id:group.id})))[0]);}
 function confetti(){const colors=['#fff1ad','#e8adff','#ff79a2','#ffbf5b','#7df7da'];return Array.from({length:100},()=>{const side=Math.random()<.5?-1:1;return `<i style="--c:${colors[Math.floor(Math.random()*colors.length)]};--r:${Math.random()*360}deg;--wing-start-x:${(Math.random()-.5)*46}px;--wing-start-y:${(Math.random()-.5)*35}px;--wing-x:${side*(90+Math.random()*190)}px;--wing-y:${-140+Math.random()*250}px;--wing-rotate:${(Math.random()-.5)*900}deg;--t:${3.7+Math.random()*1.8}s;--d:${Math.random()*.65}s;--w:${4+Math.random()*5}px;--h:${6+Math.random()*7}px"></i>`;}).join('');}
 function result(o){
  if(!o.result.length)return '—';
  if(o.game==='k3')return `<span class="clh-dice">${o.result.map(n=>`<img src="/assets/png/${diceFiles[Number(n)]}" alt="Dice ${Number(n)}" width="20" height="20">`).join('')}</span>`;
  if(o.game==='5d')return `<span class="clh-digits">${o.result.map((n,i)=>`<i><small>${'ABCDE'[i]}</small>${Number(n)}</i>`).join('')}</span>`;
  const n=Number(o.result[0]),color=n%2?'green':'red';return `<span class="clh-result"><b class="${n===0||n===5?'split '+color:color}">${n}</b><span class="${color}">${n%2?'Green':'Red'}</span>${n===0||n===5?'<span class="violet">Violet</span>':''}<span>${n>=5?'Big':'Small'}</span></span>`;
 }
 const status=o=>o.pending?'Unpaid':o.payout>0?'Win':'Lose';
 const signed=n=>(n>=0?'+':'−')+money(Math.abs(n));
 function details(o){
  const fee=Math.round(o.stake*2)/100,net=o.payout-o.stake,code=(o.game==='k3'?'K3':o.game==='5d'?'5D':'TWG')+o.id.replace(/-/g,'').toUpperCase();
  const rows=[['Order number',`<button class="clh-copy" data-copy="${esc(code)}">${esc(code)} <span aria-hidden="true">▣</span></button>`],['Period',esc(period(o))],['Purchase amount',money(o.stake)],['Quantity',o.quantity===null?'—':esc(o.quantity)],['Amount after tax',`<span class="clh-amount">${money(o.stake-fee)}</span>`],['Tax',money(fee)],['Result',result(o)],['Select',`<span class="clh-selections">${o.lines.map(b=>`<span>${esc(selection(o.game,b.selection))}</span>`).join('')}</span>`],['Status',`<span class="${o.pending?'pending':o.payout>0?'green':'red'}">${status(o)}</span>`],['Win/loss',o.pending?'—':`<span class="${net>=0?'green':'red'}">${signed(net)}</span>`],['Order time',esc(date(o.created))]];
  return `<div class="clh-details"><h3>Details</h3>${rows.map(([label,value])=>`<div class="clh-line"><span>${label}</span><div>${value}</div></div>`).join('')}</div>`;
 }
 let host=null,signature='',page=1,openId=null,scheduled=false;
 function render(){
  scheduled=false;const g=activeGame();document.documentElement.classList.toggle('cw-lottery-managed',!!g);
  const next=g?[...document.querySelectorAll('.MyGameRecord__C')].find(e=>e.getClientRects().length):null;
  if(!next){host=null;signature='';return;}
  if(host!==next){host=next;signature='';page=1;openId=null;}
  const lane=lanes.get(g)||60,snapshot=snapshots.get(g+':'+lane),list=orders(g,snapshot?.bets),key=JSON.stringify([g,lane,list,page,openId]);
  if(key===signature&&host.querySelector('.cw-lottery-history'))return;signature=key;
  host.classList.add('cw-has-history');let node=host.querySelector(':scope>.cw-lottery-history');if(!node){node=document.createElement('section');node.className='cw-lottery-history';node.setAttribute('aria-label','My bet history');host.append(node);}
  page=Math.min(page,Math.max(1,Math.ceil(list.length/20)));
  node.innerHTML=!snapshot?'<p class="clh-empty">Loading bet history…</p>':!list.length?'<div class="clh-empty"><img src="/assets/no-data.svg" alt="">No bets yet</div>':list.slice((page-1)*20,page*20).map(o=>`<article class="clh-order"><button class="clh-summary" data-order="${esc(o.id)}" aria-expanded="${o.id===openId}">${badge(o)}<span class="clh-meta"><strong>${esc(period(o))}</strong><small>${esc(date(o.created))}</small></span><span class="clh-outcome ${o.pending?'pending':o.payout>0?'green':'red'}"><b>${status(o)}</b><small>${o.pending?'—':o.payout>0?'+'+money(o.payout):'−'+money(o.stake)}</small></span></button>${o.id===openId?details(o):''}</article>`).join('')+`<nav class="clh-pages" aria-label="Bet history pages"><button data-page="-1" ${page===1?'disabled':''}>‹</button><span>${page} / ${Math.max(1,Math.ceil(list.length/20))}</span><button data-page="1" ${page*20>=list.length?'disabled':''}>›</button></nav>`;
  node.onclick=async e=>{const order=e.target.closest('[data-order]'),paging=e.target.closest('[data-page]'),copy=e.target.closest('[data-copy]');if(order){openId=openId===order.dataset.order?null:order.dataset.order;schedule();}if(paging){page+=Number(paging.dataset.page);openId=null;schedule();}if(copy){try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(copy.dataset.copy);else{const input=document.createElement('textarea');input.value=copy.dataset.copy;input.style.cssText='position:fixed;left:-10000px';document.body.append(input);input.select();const done=document.execCommand('copy');input.remove();if(!done)throw Error('Copy unavailable');}copy.classList.add('copied');copy.title='Copied';}catch{copy.title='Select the order number to copy';}}};
 }
 function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(render);}}
 let popup=null,timer=null,ticker=null,focusBefore=null;
 function closePopup(){clearTimeout(timer);clearInterval(ticker);popup?.remove();popup=null;focusBefore?.focus?.({preventScroll:true});if(queue.length)setTimeout(showNext,180);}
 function showNext(){
  if(popup||!queue.length)return;const o=queue.shift();if(activeGame()!==o.game){showNext();return;}
  const won=o.payout>0;focusBefore=document.activeElement;popup=document.createElement('div');popup.className='clh-popup '+(won?'won':'lost');popup.innerHTML=`<section class="clh-award" role="dialog" aria-modal="true" aria-label="${won?'Winning':'Losing'} bet result"><h2>${won?'Congratulations':'Sorry'}</h2><div class="clh-award-result"><span>Lottery results</span>${result(o)}</div><div class="clh-award-paper"><span>${won?'Bonus':'Lose'}</span>${won?`<strong>${money(o.payout)}</strong>`:''}<small>Period: ${title(o.game)} ${o.lane/60} Min<br>${esc(period(o))}</small></div><p class="clh-autoclose"><span>5</span> seconds auto close</p><button class="clh-dismiss" aria-label="Close result">×</button>${won?'<div class="clh-sparks" aria-hidden="true">'+confetti()+'</div>':''}</section>`;
  document.body.append(popup);popup.querySelector('.clh-dismiss').onclick=closePopup;popup.onclick=e=>{if(e.target===popup)closePopup();};popup.querySelector('.clh-dismiss').focus({preventScroll:true});let left=5;ticker=setInterval(()=>{left--;const el=popup?.querySelector('.clh-autoclose span');if(el)el.textContent=left;},1000);timer=setTimeout(closePopup,5000);
 }
 window.ColorWinLotteryUI={
  select(g,lane){if(lanes.get(g)!==lane){lanes.set(g,lane);signature='';openId=null;page=1;schedule();}},
  receive(g,lane,bets,serverMs=Date.now()){const key=g+':'+lane;if(serverMs<(snapshots.get(key)?.serverMs||0))return;snapshots.set(key,{bets,serverMs});for(const o of roundOrders(g,bets)){const key=g+':'+o.id,prior=previous.get(key);previous.set(key,o.pending?'pending':'settled');if(prior==='pending'&&!o.pending&&!announced.has(key)){announced.add(key);if(activeGame()===g){queue.push(o);showNext();}}}schedule();},
  orders,roundOrders,selection
 };
 let pollBusy=false;setInterval(async()=>{const g=activeGame();if(!g||document.hidden||pollBusy||!window.ColorWinSourceAdapter?.refreshHistory)return;pollBusy=true;try{await window.ColorWinSourceAdapter.refreshHistory(g,lanes.get(g)||60);}catch{}finally{pollBusy=false;}},1500);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&popup)closePopup();else if(e.key==='Tab'&&popup){e.preventDefault();popup.querySelector('.clh-dismiss').focus();}});
 window.addEventListener('hashchange',()=>{queue.length=0;closePopup();schedule();});
 new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
