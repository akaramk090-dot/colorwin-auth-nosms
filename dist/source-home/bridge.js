(() => {
 'use strict';
 const uuid=()=>{if(crypto.randomUUID)return crypto.randomUUID();const a=crypto.getRandomValues(new Uint8Array(16));a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;const h=[...a].map(n=>n.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);};
 let serial=0;const pending=new Map();
 function call(action,data={}){return new Promise((resolve,reject)=>{const key='source-'+(++serial);const timer=setTimeout(()=>{pending.delete(key);reject(Error('Connection timed out. Please retry.'));},30000);pending.set(key,{resolve,reject,timer});parent.postMessage({type:'cw-source-request',key,action,...data},location.origin);});}
 window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data?.type!=='cw-source-response')return;const item=pending.get(e.data.key);if(!item)return;pending.delete(e.data.key);clearTimeout(item.timer);e.data.error?item.reject(Error(e.data.error)):item.resolve(e.data.result);});
 let profile={balance:0,uid:'',nickname:'Color Win',signedIn:false};
 const ready=call('init').then(p=>{profile=p;localStorage.setItem('userInfo',JSON.stringify(user()));return p;});
 const user=()=>({userId:profile.uid||0,userName:profile.nickname,nickName:profile.nickname,userPhoto:'1',amount:profile.balance,integral:0,vipLevel:0,level:0,useLanguage:'en',unRead:0,allowNoRechargeGame:'1',canDirectToGame:true,groupDataShowAuth:[]});
 // This marker only satisfies the supplied UI's local navigation guard; it is never a wallet credential.
 localStorage.setItem('token','colorwin-embedded');localStorage.setItem('tokenHeader','Bearer ');localStorage.setItem('userInfo',JSON.stringify(user()));localStorage.setItem('is18','1');localStorage.setItem('language','en');
 if(!sessionStorage.getItem('xosoList'))sessionStorage.setItem('xosoList',JSON.stringify({areInfos:[]}));
 if('serviceWorker' in navigator)navigator.serviceWorker.register=()=>Promise.resolve({});
 const navigate=route=>call('navigate',{route}).catch(()=>{});
 function targetRoute(to){const p=String(to.path||'').toLowerCase();
  if(/wingo$/.test(p)&&!p.includes('trx'))return '#/games/play/wingo';
  if(p.includes('customer')||p.includes('servicecollection'))return '#/support';
  if(p.includes('messages'))return '#/account/notifications';
  if(p.includes('withdraw'))return '#/withdraw';if(p.includes('recharge'))return '#/deposit';
  if(p.startsWith('/wallet'))return '#/account';
  if(p==='/activity/dailysignin')return '#/activity/dailysignin';
  if(p==='/activity/dailytasks')return '#/activity/dailytasks';
  if(p==='/activity/firstrecharge')return '#/activity/welcome-bonus';
  if(p.startsWith('/activity'))return '#/activity';
  if(p.startsWith('/promotion'))return '#/promotion';
  if(p.startsWith('/main/invitation'))return '#/activity/refer-friends';
  if(p.startsWith('/main/superjackpot'))return '#/activity/super-jackpot';
  if(p.startsWith('/main'))return '#/account';
  if(p.startsWith('/login')||p.startsWith('/register'))return '#/account';
  if(p.includes('motorace'))return '#/games/play/moto-racing';
  return null;
 }
 const navStyle=document.createElement('style');document.documentElement.classList.add('cw-embedded');navStyle.textContent='html.cw-embedded .start-page{display:none!important}html.cw-embedded .tabbar{display:none!important}html.cw-native-home body:after{content:"";display:block;height:45px}';document.head.append(navStyle);
 const updateLayout=to=>{const home=to.path==='/'||to.path==='/home';document.documentElement.classList.toggle('cw-native-home',home);document.documentElement.classList.toggle('cw-source-lottery',/\/(K3|5D|WinTrx)$/.test(to.path));call('layout',{home}).catch(()=>{});};
 const walletHooks=new WeakSet();
 const onHome=()=>['','/','/home'].includes(location.hash.slice(1).split('?')[0]);
 function quietHomeWallet(app){
  const wallet=app.config.globalProperties.$pinia?._s?.get('walletStore');
  if(!wallet){requestAnimationFrame(()=>quietHomeWallet(app));return;}
  if(walletHooks.has(wallet))return;walletHooks.add(wallet);
  const reset=wallet.resetData.bind(wallet);wallet.resetData=(silent,remote)=>reset(onHome()?true:silent,remote);
  for(const name of ['GetARGameAndPlatWallets','getAllwalletsBalance']){const action=wallet[name].bind(wallet);wallet[name]=(notify,...args)=>action(onHome()?false:notify,...args);}
 }
 function attachRouter(){const app=document.getElementById('app')?.__vue_app__,router=app?.config?.globalProperties?.$router;if(!router){requestAnimationFrame(attachRouter);return;}
  quietHomeWallet(app);updateLayout(router.currentRoute.value);router.afterEach(to=>updateLayout(to));
  router.beforeEach(to=>{const route=targetRoute(to);if(route){navigate(route);return false;}return true;});
 }
 requestAnimationFrame(attachRouter);
 window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data?.type!=='cw-source-resume'||!onHome())return;const wallet=document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('walletStore');wallet?.resetData(true,false)?.catch(()=>{});});
 const fmt=ms=>{const d=new Date(ms),pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;};
 const gameOf=name=>/K3/i.test(name)?'k3':/5D|D5/i.test(name)?'5d':/TRX|Trx/i.test(name)?'trx-wingo':null;
 const lanes=[60,180,300,600],offset=g=>g==='k3'?9:g==='5d'?5:13;
 const laneOf=(g,d)=>{const period=String(d.issueNumber??d.issuenumber??'');return d.typeId!=null||d.typeID!=null?lanes[Number(d.typeId??d.typeID)-offset(g)]||60:/^\d{17}$/.test(period)?lanes[Number(period[12])-1]||60:60;};
 // Public K3 period labels map losslessly to the existing server round IDs.
 const k3PeriodAnchor={round:29880343,period:20261024101010344n};
 const k3ThreeMinuteAnchor={round:9960115,period:20261024101020116n};
 const k3FiveMinuteAnchor={round:5976069,period:20261024101030070n};
 const k3TenMinuteAnchor={round:2988035,period:20261024101040036n};
 const fiveDOneMinuteAnchor={round:29880408,period:20261024102010409n};
 const fiveDThreeMinuteAnchor={round:9960136,period:20261024102020137n};
 const fiveDFiveMinuteAnchor={round:5976082,period:20261024102030083n};
 const fiveDTenMinuteAnchor={round:2988041,period:20261024102040042n};
 const trxPeriodAnchors={60:{round:4370998,period:20261025103010779n},180:{round:1456405,period:20261024103020146n},300:{round:873842,period:20261024103030087n},600:{round:436921,period:20261024103040044n}};
 const periodAnchor=(g,lane)=>g==='k3'?(lane===60?k3PeriodAnchor:lane===180?k3ThreeMinuteAnchor:lane===300?k3FiveMinuteAnchor:lane===600?k3TenMinuteAnchor:null):g==='5d'?(lane===60?fiveDOneMinuteAnchor:lane===180?fiveDThreeMinuteAnchor:lane===300?fiveDFiveMinuteAnchor:lane===600?fiveDTenMinuteAnchor:null):g==='trx-wingo'?(trxPeriodAnchors[lane]||null):null;
 const dailyPeriod=(g,lane,round)=>{const date=new Date(Number(round)*lane*1000).toISOString().slice(0,10).replace(/-/g,'');const sequence=Number(round)%(86400/lane)+1;return date+(g==='k3'?'1010':g==='5d'?'1020':'1030')+String(lanes.indexOf(lane)+1)+String(sequence).padStart(4,'0');};
 const trxRoundOffset=lane=>{const a=trxPeriodAnchors[lane],p=String(a.period);return Date.UTC(Number(p.slice(0,4)),Number(p.slice(4,6))-1,Number(p.slice(6,8)))/1000/lane+Number(p.slice(13))-1-a.round;};
 const periodFor=(g,lane,round)=>dailyPeriod(g,lane,Number(round)+(g==='trx-wingo'&&Number(round)*lane<1000000000?trxRoundOffset(lane):0));
 const roundFor=(g,lane,period)=>{const p=String(period);if(!/^\d{17}$/.test(p))throw Error('Invalid period');const start=Date.UTC(Number(p.slice(0,4)),Number(p.slice(4,6))-1,Number(p.slice(6,8)))/1000/lane;const round=start+Number(p.slice(13))-1;if(periodFor(g,lane,round)!==p)throw Error('Invalid period');return round;};
 const states=new Map();
 async function state(g,lane,force=false){const key=g+':'+lane,entry=states.get(key);if(!force&&entry&&Date.now()-entry.at<1800)return entry.promise;
  const at=Date.now(),promise=call('game',{game:g,operation:'load',data:{lane}}).then(s=>{window.ColorWinLotteryUI?.receive(g,lane,s.bets||[],s.server_ms);return {...s,game:g,lane,loadedAt:Date.now()};});states.set(key,{at,promise});try{return await promise;}catch(e){states.delete(key);throw e;}}
 const issue=s=>{const now=s.server_ms+Math.max(0,Date.now()-s.loadedAt),remaining=Math.max(0,s.remaining-(Date.now()-s.loadedAt)/1000);return {issueNumber:periodFor(s.game,s.lane,s.round),serviceTime:fmt(now),startTime:fmt(now-(s.lane-remaining)*1000),endTime:fmt(now+remaining*1000),intervalM:s.lane/60};};
 function row(g,r,lane){const numbers=r.numbers||[],sum=numbers.reduce((a,b)=>a+b,0),n=numbers[0]??0;return {issueNumber:periodFor(g,lane,r.index),premium:numbers.join(''),number:String(g==='k3'?sum:n),sumCount:sum,gameType:numbers.every(v=>v===n)?0:new Set(numbers).size===2?1:2,colour:n===0?'red,violet':n===5?'green,violet':n%2?'green':'red',blockID:r.block_id||'',blockNumber:r.block_number||'',blockHeight:r.block_number||'',blockTime:r.block_ms?fmt(r.block_ms):'',size:n>=5?'big':'small'};}
 function page(list,d){const size=Math.max(1,Math.min(50,Number(d.pageSize)||10)),p=Math.max(1,Number(d.pageNo)||1);return {list:list.slice((p-1)*size,p*size),dataList:list.slice((p-1)*size,p*size),pageNo:p,pageSize:size,totalCount:list.length,totalPage:Math.ceil(list.length/size),data:{date:{serviceTime:fmt(Date.now())},gameslist:list.slice((p-1)*size,p*size)}};}
 const ids={Green:11,Violet:12,Red:10,Big:13,Small:14};
 function myRow(g,b){const sel=b.selection;let originalType=1,originalSelection=sel;const letter={Big:'H',Small:'L',Odd:'O',Even:'E'};
  if(g==='k3'){if(letter[sel]){originalType=['Big','Small'].includes(sel)?2:3;originalSelection=letter[sel];}else if(sel.startsWith('sum:'))originalSelection=sel.slice(4);else if(/^pair:[1-6]$/.test(sel)){originalType=6;originalSelection='|'+sel.slice(5).repeat(2)+'|';}else if(sel.startsWith('pair:')){originalType=5;const parts=sel.split(':');originalSelection=':'+parts[1].repeat(2)+':,:'+parts[2]+':';}else if(sel.startsWith('triple:')){originalType=7;originalSelection='|'+sel.slice(7).repeat(3)+'|';}else if(sel==='Any triple'){originalType=8;originalSelection='|AAA|';}else if(sel.startsWith('different:')){originalType=9;originalSelection=sel.slice(10).split(',').map(n=>'|'+n+'|').join(',');}else if(sel.startsWith('two:')){originalType=4;originalSelection=sel.slice(4).split(',').map(n=>'.'+n+'.').join(',');}else if(sel==='Sequence'){originalType=10;originalSelection='|ABC|';}}
  if(g==='5d'){const parts=sel.split(':');originalType=parts[0]==='Sum'?6:'ABCDE'.indexOf(parts[0])+1;originalSelection=letter[parts[1]]||parts[1];}
  const round=periodFor(g,b.lane,b.round_index),num=b.result||[],amount=Number(b.stake),payout=Number(b.payout);return {id:b.id,orderNumber:b.id,orderId:b.id,issueNumber:round,addTime:fmt(new Date(b.created_at).getTime()),createTime:fmt(new Date(b.created_at).getTime()),typeID:offset(g)+lanes.indexOf(b.lane),typeId:offset(g)+lanes.indexOf(b.lane),typeName:(g==='k3'?'K3':g==='5d'?'5D':'Trx WinGo')+' '+b.lane/60+'Min',amount,betAmount:amount,realAmount:amount-Math.round(amount*2)/100,serviceCharge:Math.round(amount*2)/100,fee:Math.round(amount*2)/100,betCount:Number(b.quantity)||1,profitAmount:b.status==='pending'?0:b.status==='won'?payout:amount,gameType:String(g==='5d'||g==='k3'?originalType:/^\d$/.test(sel)?1:sel==='Big'||sel==='Small'?2:0),selectType:String(g==='trx-wingo'?(ids[sel]??sel):originalSelection),selecttype:String(g==='trx-wingo'?(ids[sel]??sel):originalSelection),state:b.status==='pending'?2:b.status==='won'?1:0,status:b.status,winAmount:payout,winLoss:payout-amount,profit:payout-amount,premium:num.join(''),number:String(num[0]??''),sumCount:num.reduce((a,b)=>a+b,0),odds:b.odds};}
 const choose=(a,n)=>n===0?[[]]:a.flatMap((x,i)=>choose(a.slice(i+1),n-1).map(c=>[x,...c]));
 function selections(g,d){const text=String(d.selectType??d.selecttype??''),kind=String(d.gameType??d.gametype??''),map={H:'Big',L:'Small',O:'Odd',E:'Even'};let out=[];
  if(g==='5d'){const pos=['A','B','C','D','E','Sum'][Number(kind)-1];if(!pos)throw Error('Invalid position');out=text.split('|').map(s=>pos+':'+(map[s]||s));}
  else if(g==='trx-wingo'){out=[({10:'Red',11:'Green',12:'Violet',13:'Big',14:'Small'})[text]||text];}
  else{
   const types=kind.split(',').map(Number);
   if(types.some(t=>t<=3))out.push(...text.split(',').filter(s=>map[s]||/^([3-9]|1[0-8])$/.test(s)).map(s=>map[s]||'sum:'+s));
   if(types.includes(6))out.push(...[...text.matchAll(/\|([1-6])\1\|/g)].map(m=>'pair:'+m[1]));
   if(types.includes(5)){const a=[...text.matchAll(/:([1-6])\1:/g)].map(m=>m[1]),b=[...text.matchAll(/:([1-6]):/g)].map(m=>m[1]);for(const x of a)for(const y of b)if(x!==y)out.push(`pair:${x}:${y}`);}
   if(types.includes(7))out.push(...[...text.matchAll(/\|([1-6])\1\1\|/g)].map(m=>'triple:'+m[1]));
   if(types.includes(8)&&text.includes('AAA'))out.push('Any triple');
   if(types.includes(9))out.push(...choose([...text.matchAll(/\|([1-6])\|/g)].map(m=>m[1]).sort(),3).map(a=>'different:'+a.join(',')));
   if(types.includes(10)&&text.includes('ABC'))out.push('Sequence');
   if(types.includes(4))out.push(...choose([...text.matchAll(/\.([1-6])\./g)].map(m=>m[1]).sort(),2).map(a=>'two:'+a.join(',')));
  }
  out=[...new Set(out)];if(!out.length||out.length>64)throw Error('Select a valid bet');return out;
 }
 const counts=[1,3,6,10,15,21,25,27,27,25,21,15,10,6,3,1];
 const odds=g=>(g==='k3'?[...counts.map(n=>Math.trunc(211.68/n*100)/100),1.96,1.96,6.91,69.12,12.96,207.36,34.56,34.56,8.64]:[9.8,1.96,1.96,1.96,1.96]).map((rate,i)=>({id:i+1,playType:i+1,playTypeID:i+1,playRate:rate,playRate_Original:rate}));
 document.addEventListener('click',event=>{const card=event.target.closest('.top-games__item');if(!card)return;const cover=card.querySelector('.cover>img');if((cover?.getAttribute('data-origin')||cover?.getAttribute('src')||'').includes('defc0b055a03aaa9e348.jpg')){event.preventDefault();event.stopImmediatePropagation();navigate('#/games/play/wingo');}},true);
 const original=window.COLORWIN_API.responseFor.bind(window.COLORWIN_API);
 const homeLoaded=new Set();let homeReady=false,readinessScheduled=false;
 function tryHomeReady(){readinessScheduled=false;if(homeReady||!onHome()||!homeLoaded.has('banners')||!homeLoaded.has('catalog'))return;const hero=document.querySelector('.pchome .swiper-slide-active img');if(!hero||!hero.complete||!hero.naturalWidth||!document.querySelector('.pchome .b-item'))return;homeReady=true;readinessObserver.disconnect();document.removeEventListener('load',scheduleReadiness,true);call('home-ready').catch(()=>{});}
 function scheduleReadiness(){if(homeReady||readinessScheduled)return;readinessScheduled=true;requestAnimationFrame(tryHomeReady);}
 const readinessObserver=new MutationObserver(scheduleReadiness);readinessObserver.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});document.addEventListener('load',scheduleReadiness,true);
 let winningCache=null,winningAt=0;window.ColorWinWinningState='loading';
 function winningFeed(){if(winningCache&&Date.now()-winningAt<5000)return winningCache;winningAt=Date.now();winningCache=call('feed').then(rows=>{window.ColorWinWinningState=rows.length?'ready':'empty';document.dispatchEvent(new Event('cw-winning-state'));return rows;}).catch(error=>{window.ColorWinWinningState='error';winningCache=null;document.dispatchEvent(new Event('cw-winning-state'));throw error;});return winningCache;}

 const retries=new Map();
 const ok=data=>({code:0,msg:'Success',msgCode:0,data,serviceNowTime:fmt(Date.now())});
 window.COLORWIN_API.responseFor=async(url,d={})=>{
  const name=String(url).split('?')[0].split('/').pop(),g=gameOf(name);
  try{
   if(name==='GetBannerList'){const banners=await call('banners');homeLoaded.add('banners');scheduleReadiness();return ok(banners.map(b=>({bannerUrl:b.image,url:b.url.replace(/^\/#/,'#'),categoryType:0,jumpLinkType:0,vendorCode:'',gameCode:'',gameNameEn:'',accessAuthType:0})));}
   if(name==='GetAllGameList'){const response=original(url,d);const games=response.data;const artwork={1:'wingo',2:'k3',3:'5d',4:'trx-wingo',9:'moto-racing'};games.lottery.forEach(g=>{if(artwork[g.id])g.categoryImg='/assets/colorwin-home/'+artwork[g.id]+'.png';});games.awardRecordList=[];homeLoaded.add('catalog');scheduleReadiness();return response;}
   if(name==='GetDailyProfitRank'){const rows=await winningFeed();return ok({dataList:rows.map(w=>({gameNameEn:w.game,typeName:w.game,nickName:w.member,userPhoto:'1',amount:Number(w.amount),imgUrl:w.image||'/assets/web%20images/color-win-logo-supplied.png',entryType:'information'})),penarikanList:[]});}
   if(name==='GetUserInfo'){await ready;return ok(user());}
   if(['GetBalance','RecoverBalance','RecoverSaasBalance','GetAllwallets','GetSaasAllwallets','GetARGameAndPlatWallets'].includes(name)){await ready;profile=await call('balance');return ok({amount:profile.balance,totalAmount:profile.balance,thidGameBalanceList:[{vendorCode:'Lottery',balance:profile.balance,vendorName:'Color Win'}]});}
   if(name==='GetGameUrl'){const catalog=original('/api/webapi/GetAllGameList',{}).data;const candidates=[...catalog.popular.platformList,...catalog.popular.clicksTopList,...catalog.flash,...catalog.fish];const found=candidates.find(g=>String(g.gameCode||g.gameID)===String(d.gameCode||d.gameID||d.gameId)&&(!d.vendorCode||g.vendorCode===d.vendorCode));await call('catalog-game',{name:d.gameNameEn||d.gameName||found?.gameNameEn||''});return {...ok(null),cwNativeHandled:true};}
   if(g){
    if(/typeList|TypeList/.test(name))return ok(lanes.map((lane,i)=>({typeID:offset(g)+i,typeName:(g==='k3'?'K3':g==='5d'?'5D':'Trx WinGo')+'<br />'+lane/60+'Min',tabName:lane/60+'Min',intervalM:lane/60,scope:'1|10|100|1000',sort:i+1,betMultiple:'1|5|10|20|50|100',gamePresentation:''})));
    if(/OddsList/.test(name))return ok(odds(g));
    if(/RuleByTypeId/.test(name))return ok({rule:g==='trx-wingo'?'Rounds follow fixed server-clock intervals. Results are generated randomly on the ColorWin server after each round closes. This game does not use TRON blockchain results. Odd is Green; even is Red; 0 and 5 also Violet.':'Place a bet before the final six seconds. Payout multipliers shown on each selection include your stake. Results and wallet settlement are verified by Color Win.'});
    const lane=laneOf(g,d);if(/Game(?:K3|5D)?Issue|My.*EmerdList/.test(name))window.ColorWinLotteryUI?.select(g,lane);
    if(/Betting$|Bet$/.test(name)){
     const amount=Number(d.amount)*Number(d.betCount),picked=selections(g,d),round=roundFor(g,lane,d.issuenumber??d.issueNumber);const signature=JSON.stringify([g,lane,round,Number(d.amount),Number(d.betCount),amount,picked]);let requestId=retries.get(signature);if(!requestId){requestId=uuid();retries.set(signature,requestId);}
     const result=await call('game',{game:g,operation:'bet-batch',data:{lane,round,amount,unit_amount:Number(d.amount),quantity:Number(d.betCount),selections:picked,request_id:requestId}});retries.delete(signature);states.delete(g+':'+lane);profile.balance=Number(result.balance);window.ColorWinLotteryUI?.receive(g,lane,result.bets||[],result.server_ms);return ok({});
    }
    const s=await state(g,lane,/Game(?:K3|5D)?Issue|OneEmerd/.test(name));
    if(/Game(?:K3|5D)?Issue/.test(name)){const current=issue(s);return ok(g==='trx-wingo'?{predraw:current,settled:s.history[0]?row(g,s.history[0],lane):{issueNumber:'',number:'',premium:'',blockID:'',blockTime:''}}:current);}
    if(/OneEmerd/.test(name))return ok(s.history[0]?row(g,s.history[0],lane):{premium:g==='k3'?'':'',issueNumber:'',number:'',sumCount:0});
    if(/TheLotteryResult/.test(name)){
     const bets=s.bets.filter(b=>Number(b.lane)===lane&&String(b.round_index)===String(roundFor(g,lane,d.issueNumber)));const b=bets[0];return ok({state:!b||bets.some(b=>b.status==='pending')?2:bets.some(b=>b.status==='won')?1:0,premium:(b?.result||[]).join(''),number:String(b?.result?.[0]??''),winAmount:bets.reduce((a,b)=>a+Number(b.payout),0),issueNumber:String(d.issueNumber),typeName:(g==='k3'?'K3':g==='5d'?'5D':'Trx WinGo')+' '+(b?.lane||lane)/60+'Min'});
    }
    if(/My.*EmerdList|TRXMyEmerdList/.test(name))return ok(page(s.bets.filter(b=>b.lane===lane).map(b=>myRow(g,b)),d));
    if(/EmerdList/.test(name))return ok(page(s.history.map(r=>row(g,r,lane)),d));
    throw Error('Unsupported game request');
   }
   // All transaction endpoints outside the integrated games remain blocked; their real screens live in the parent app.
   if(/Betting|\/Lottery\/.*Bet|^(Login|Register|RefreshToken|Recharge|Withdraw|Submit|Apply|Add|Receive)/i.test(name))throw Error('Use the Color Win account page for this action');
   return original(url,d);
  }catch(error){return {code:-1,msg:error.message,msgCode:-1,data:null,serviceNowTime:fmt(Date.now())};}
 };
 window.ColorWinSourceAdapter={selections,odds,periodFor,roundFor,k3PeriodAnchor,refreshHistory:(g,lane)=>state(g,lane,true)};
})();
