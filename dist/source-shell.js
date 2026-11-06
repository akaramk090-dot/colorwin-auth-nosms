(() => {
 const mounted=new WeakMap();let cachedHome=null;
 const ownerId=()=>window.ColorWinAuth?.session?.user?.id;
 const gameAliases={'win go':'wingo','wingo':'wingo','wingo 30sec':'wingo','k3':'k3','5d':'5d','trx win go':'trx-wingo','motorace':'moto-racing','mines pro':'100'};
 const playableGameRoutes={mines:'#/games/play/mines'};
 const playableGameIds=new Set(['wingo','k3','5d','trx-wingo','fortune-gems','100']);
 const isPlayableGame=game=>playableGameIds.has(game.id)||['aviator','limbo','mines','boom'].includes(game.name.toLowerCase());
 function cacheValid(){if(cachedHome&&(!cachedHome.root.isConnected||cachedHome.owner!==ownerId())){cachedHome.root.remove();cachedHome=null;}return cachedHome;}
 function renderPage(app,markup,isHome){const cache=cacheValid();if(cache&&!cache.root.classList.contains("source-internal-page")){cache.root.hidden=true;for(const child of [...app.childNodes])if(child!==cache.root)child.remove();app.insertAdjacentHTML("beforeend",markup);}else{app.innerHTML=markup;cachedHome=null;}if(isHome){const root=app.querySelector(".source-frame-page:not([hidden])");if(root)cachedHome={root,owner:ownerId()};}}
 function restoreHome(app){const cache=cacheValid();if(!cache||cache.root.classList.contains("source-internal-page"))return false;for(const child of [...app.childNodes])if(child!==cache.root)child.remove();cache.root.hidden=false;cache.root.querySelector("iframe")?.contentWindow.postMessage({type:"cw-source-resume"},location.origin);return true;}
 const gamePaths={k3:'/home/AllLotteryGames/K3','5d':'/home/AllLotteryGames/5D','trx-wingo':'/home/AllLotteryGames/WinTrx'};
 function view(game='home',tabbar=''){return `<section class="source-frame-page${tabbar?' source-with-tabbar':''}${game!=='home'?' source-internal-page':''}"><iframe title="Color Win" src="source-home/index.html?embedded=1#${gamePaths[game]||'/'}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"></iframe>${tabbar}</section>`;}
 function bind(){const frame=document.querySelector('.source-frame-page:not([hidden]) iframe');if(!frame)return;const controller=new AbortController(),owner=window.ColorWinAuth?.session?.user?.id;
  mounted.set(frame,{owner,route:location.hash.toLowerCase()});
  const root=frame.closest('.source-frame-page');
  const valid=()=>frame.isConnected&&owner===window.ColorWinAuth?.session?.user?.id;
  async function gameRequest(game,action,data){if(!['k3','5d','trx-wingo'].includes(game))throw Error('Invalid game');if(!owner||owner==='preview')throw Error('Sign in to play with your Color Win wallet');
   return window.ColorWinOperations.rpc(action==='bet-batch'?'colorwin_lottery_batch':'colorwin_lottery',action==='bet-batch'?{p_game:game,p_data:data}:{p_game:game,p_action:'load',p_data:data});
  }
  window.addEventListener('message',async e=>{const req=e.data;if(e.source!==frame.contentWindow||e.origin!==location.origin||req?.type!=='cw-source-request'||typeof req.key!=='string'||!valid())return;
   try{let result;
    if(req.action==='init'||req.action==='balance'){
     if(owner&&owner!=='preview')await window.ColorWinAccount?.refreshBalance?.();
     const profile=window.ColorWinAuth?.profile||{};result={balance:owner==='preview'?0:Number(window.ColorWinAccount?.balance?.()||0),uid:profile.public_uid||'',nickname:profile.nickname||'Color Win',signedIn:!!owner&&owner!=='preview'};
    }else if(req.action==='home-ready'){frame.dataset.cwReady='true';result={ok:true};
    }else if(req.action==='layout'){frame.closest('.source-frame-page').classList.toggle('source-internal-page',req.home!==true);result={ok:true};
    }else if(req.action==='banners'){const defaults=[['banner-1.png','/#/main/InvitationBonus'],['banner-2.png','/#/activity/FirstRecharge'],['banner-3.png','/#/activity/DailyTasks'],['banner-4.png','/#/main/SuperJackpot'],['banner-5.png','/#/activity/DailySignIn']];const campaigns=(window.ColorWinOperations?.config?.campaigns||[]).filter(c=>c.banner);result=campaigns.length?campaigns.map(c=>({image:c.banner.startsWith('assets/')?'/'+c.banner:c.banner,url:defaults.find(([name])=>c.banner.endsWith(name))?.[1]||'/#/activity'})):defaults.map(([name,url])=>({image:'/assets/web%20images/'+name,url}));
    }else if(req.action==='feed'){const rows=[{game:'WinGo',amount:196},{game:'Aviator',amount:2480},{game:'K3',amount:392},{game:'5D',amount:980},{game:'Mines',amount:735},{game:'Limbo',amount:1250}].map((w,i)=>({...w,member:'Member'+[787386,624915,938472,516803,842697,379154][i],demo:true}));const key=name=>String(name).toLowerCase().replace(/[^a-z0-9]/g,'');const art={wingo:'wingo.png',wingo30sec:'wingo.png',trxwingo:'trx-wingo.png',k3:'k3.png','5d':'5d.png'};const covers={aviator:'aviator.png',limbo:'Limbo.png',mines:'mines.png'};const groups=new Map();for(const w of rows){const k=key(w.game);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(w);}const mixed=[];while([...groups.values()].some(g=>g.length))for(const g of groups.values())if(g.length)mixed.push(g.shift());result=mixed.map(w=>{const k=key(w.game),catalog=window.ColorWinGamesData.gamesCatalog;const game=catalog.find(g=>key(g.name)===k);const file=art[k]||(/^wingo/.test(k)?'wingo.png':null);return {...w,image:file?'/assets/colorwin-home/'+file:covers[k]?'/assets/games images/'+covers[k]:game?.image?'/'+game.image.replace(/^\//,''):''};});}
    else if(req.action==='game')result=await gameRequest(req.game,req.operation,req.data||{});
    else if(req.action==='navigate'){
     if(root.hidden)throw Error('Home is inactive');const route=req.route;if(typeof route!=='string'||!/^#\/(home|activity|promotion|account|deposit|withdraw|support|tournaments|games)(\/|$)/.test(route))throw Error('Invalid route');result={handled:true};location.hash=route;
    }else if(req.action==='catalog-game'){
     if(root.hidden)throw Error('Home is inactive');
     const name=String(req.name).trim().toLowerCase(),id=gameAliases[name],match=window.ColorWinGamesData.gamesCatalog.find(g=>id?g.id===id:g.name.toLowerCase()===name);
     const route=playableGameRoutes[name]||(match&&isPlayableGame(match)?match.route:null);
     if(!route){window.toast?.('Coming soon');result={handled:true};}
     else{result={handled:true};location.hash=route;}
    }else throw Error('Unsupported request');
    if(valid())frame.contentWindow.postMessage({type:'cw-source-response',key:req.key,result},location.origin);
   }catch(error){if(valid())frame.contentWindow.postMessage({type:'cw-source-response',key:req.key,error:error.message},location.origin);}
  },{signal:controller.signal});
  window.addEventListener('hashchange',()=>{if(!valid())controller.abort();},{signal:controller.signal});window.addEventListener('pagehide',()=>controller.abort(),{once:true,signal:controller.signal});
 }
 function retainHome(){const frame=document.querySelector('.source-frame-page:not([hidden]) iframe'),state=frame&&mounted.get(frame);return !!state&&state.route==='#/home'&&state.owner===window.ColorWinAuth?.session?.user?.id&&frame.isConnected;}
 window.ColorWinSourceHome={view,bind,retainHome,renderPage,restoreHome};window.ColorWinHome={view:tabbar=>view('home',tabbar),bind};
})();
