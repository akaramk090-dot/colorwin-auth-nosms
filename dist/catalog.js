(() => {
  const { gamesCatalog, providers } = window.ColorWinGamesData;
  const categories = [
    ['lottery', 'Lottery', '◈'], ['popular', 'Popular', '★'], ['mini-games', 'Mini Games', '✦'],
    ['slots', 'Slots', '▥'], ['fishing', 'Fishing', '≈'],
    ['casino', 'Casino', '♠'], ['sports', 'Sports', '⚑'], ['other', 'More Games', '⊞']
  ];
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const chevron = direction => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${direction < 0 ? 'm15 5-7 7 7 7' : 'm9 5 7 7-7 7'}"/></svg>`;
  const select = id => id === 'all' ? gamesCatalog.filter(g=>window.ColorWinOperations?.config?.games?.[g.id]!==false) : id === 'top-games' ? gamesCatalog.filter(g => g.topGame).sort((a,b)=>(a.topOrder ?? 99)-(b.topOrder ?? 99)) : id === 'popular' ? gamesCatalog.filter(g => g.popular) : gamesCatalog.filter(g => g.category === id).sort((a,b)=>id==='lottery'?['wingo','k3','5d','trx-wingo','moto-racing'].indexOf(a.id)-['wingo','k3','5d','trx-wingo','moto-racing'].indexOf(b.id):0);
  const label = id => categories.find(c => c[0] === id)?.[1] || (id === 'top-games' ? 'Top Games' : 'All');
  function card(game, eager = false) {
    return `<a class="catalog-card" href="${game.route}" aria-label="Open ${esc(game.name)}"><img src="${esc(game.image)}" alt="${esc(game.name)}" width="${game.width}" height="${game.height}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"><span class="catalog-play">Play Now ${chevron(1)}</span></a>`;
  }
  function section(id, title, symbol) {
    const games = select(id).filter(g=>window.ColorWinOperations?.config?.games?.[g.id]!==false).slice(0, 9);
    return `<section class="catalog-section"><header class="catalog-section-head"><span class="catalog-symbol" aria-hidden="true">${symbol}</span><h2>${title}</h2><a class="catalog-view-all" href="#/games/${id}">View All ${chevron(1)}</a><button type="button" data-carousel-step="-1" aria-label="Previous ${title} games" disabled>${chevron(-1)}</button><button type="button" data-carousel-step="1" aria-label="Next ${title} games" ${games.length <= 3 ? 'disabled' : ''}>${chevron(1)}</button></header>${games.length ? `<div class="game-carousel" tabindex="0" aria-label="${title} games">${games.map((g,i) => card(g,id === 'top-games' && i < 3)).join('')}</div>` : '<p class="catalog-empty">No local games identified for this category yet.</p>'}</section>`;
  }
  function categoryCard([id,title,symbol],index) {
    if(id==='tournaments')return `<a class="catalog-category catalog-category-large" href="#/tournaments"><div><strong>Tournaments</strong><small>Join &amp; compete</small></div><img src="assets/tournaments/master-banner.png" alt="" loading="lazy"></a>`;
    const preferred = {lottery:'wingo',popular:'aviator-2','mini-games':'chiken-road',slots:'49'};
    const game = gamesCatalog.find(g => g.id === preferred[id]) || select(id)[0];
    return `<a class="catalog-category ${index < 4 ? 'catalog-category-large' : ''}" href="#/games/${id}"><div><strong>${title}</strong>${index < 4 ? `<small>${select(id).length} games</small>` : ''}</div>${game ? `<img src="${esc(game.image)}" alt="" loading="lazy" decoding="async">` : `<span aria-hidden="true">${symbol}</span>`}</a>`;
  }
  let wins=[];
  function winnerCards(){return wins.map(w=>{const g=gamesCatalog.find(g=>g.name.toLowerCase()===String(w.game).toLowerCase())||gamesCatalog.find(g=>g.id==='100');return `<article class="catalog-winner"><img src="${esc(g.image)}" alt="" loading="lazy"><div><strong>${esc(w.game)}</strong><span>${esc(w.member)}</span><small>Won ₹${Number(w.amount).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</small></div></article>`;}).join('');}
  function winning(){const cards=winnerCards();return `<section class="catalog-section catalog-winning-section"><header class="catalog-section-head"><span class="catalog-symbol" aria-hidden="true">✧</span><h2>Winning Information</h2></header><div class="catalog-ticker" aria-label="Recent winnings"><div class="catalog-ticker-track"><div class="catalog-ticker-group">${cards||'<p class="catalog-empty">Loading recent winnings…</p>'}</div><div class="catalog-ticker-group" aria-hidden="true">${cards}</div></div></div></section>`;}
  function home() {
    return `<div class="catalog-home">${section('top-games','Top Games','★')}${section('lottery','Lottery','◈')}<section class="catalog-section"><header class="catalog-section-head"><span class="catalog-symbol" aria-hidden="true">✦</span><h2>Play and Win</h2></header><div class="catalog-categories">${[categories[0],categories[1],categories[2],['tournaments','Tournaments','♛'],categories.find(c=>c[0]==='fishing'),categories.find(c=>c[0]==='casino'),categories.find(c=>c[0]==='sports'),categories.find(c=>c[0]==='slots')].map(categoryCard).join('')}</div></section>${categories.filter(c=>c[0]!=='lottery').map(c=>section(...c)).join('')}<section class="catalog-section"><header class="catalog-section-head"><span class="catalog-symbol" aria-hidden="true">♛</span><h2>Super Jackpot</h2></header><a class="catalog-jackpot" href="#/activity/super-jackpot"><img src="assets/web%20images/banner-4.png" alt="Super Jackpot" width="1855" height="848" loading="lazy" decoding="async"></a></section>${winning()}<section class="catalog-section"><header class="catalog-section-head"><span class="catalog-symbol" aria-hidden="true">◈</span><h2>Game Providers</h2></header><div class="catalog-providers">${providers.filter(p=>['choice','evolution','cq9','jdb','jili','microgaming'].includes(p.id)).map(p => `<div class="catalog-provider" aria-label="${esc(p.name)}"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async"></div>`).join('')}</div></section></div>`;
  }
  function view(route, tabbar) {
    const parts = route.split('/');
    const isGame = parts[2] === 'play';
    if(isGame && ['k3','5d','trx-wingo'].includes(parts[3]) && window.ColorWinOperations?.config?.games?.[parts[3]]!==false)return window.ColorWinSourceHome.view(parts[3],tabbar);
    const provider = parts[2] === 'provider' ? providers.find(p => p.id === parts[3]) : null;
    const game = isGame ? gamesCatalog.find(g => (g.id === parts[3] || (['aviator','limbo'].includes(parts[3]) && g.name.toLowerCase()===parts[3])) && window.ColorWinOperations?.config?.games?.[g.id]!==false) : null;
    const id = parts[2] || 'all';
    const providerDirectory=parts[2]==='providers';
    const title = providerDirectory?'Game Providers':isGame ? (game?.name || 'Game unavailable') : provider ? provider.name : label(id);
    const games = (provider ? gamesCatalog.filter(g => g.provider === provider.id) : select(id)).filter(g=>window.ColorWinOperations?.config?.games?.[g.id]!==false);
    const tabs = ['popular','mini-games','slots','lottery','fishing','casino','sports','all'];
    const boom = game?.id === '100';
    const mines = boom || game?.name === 'Mines' || (isGame && parts[3] === 'mines');
    const wingo = game?.id === 'wingo';
    if(game?.id==='fortune-gems')return `<section class="catalog-page catalog-fortune-page"><div class="catalog-fortune"><iframe src="games/fortune-gems.html?v=practice-2" title="ColorWin Fortune Gems practice" sandbox="allow-scripts"></iframe></div></section>`;
    const arcade = ['Aviator','Limbo'].includes(game?.name) ? game.name.toLowerCase() : null;
    const content = providerDirectory ? `<div class="catalog-list-content"><h1>Game Providers</h1><div class="catalog-providers">${providers.filter(p=>['choice','evolution','cq9','jdb','jili','microgaming'].includes(p.id)).map(p=>`<div class="catalog-provider" aria-label="${esc(p.name)}"><img src="${esc(p.image)}" alt="${esc(p.name)}"></div>`).join('')}</div><p>Game providers</p></div>` : wingo ? `<div class="catalog-wingo"><iframe src="games/wingo.html?v=bet-uuid-retry-52" title="Color Win Wingo demo" sandbox="allow-scripts"></iframe></div>` : arcade ? `<div class="catalog-arcade"><iframe src="games/${arcade}.html?v=aviator-live-bar-11" title="${esc(game.name)}" sandbox="allow-scripts"></iframe></div>` : mines ? `<div class="catalog-mines"><iframe src="games/${boom?'boom.html?v=1':'mines-demo.html?v=real-3'}" title="Color Win ${boom?'BOOM':'Mines'}" sandbox="allow-scripts"></iframe></div>` : isGame ? `<article class="catalog-detail">${game ? `<img src="${esc(game.image)}" alt="${esc(game.name)}">` : ''}<h1>${esc(title)}</h1><p>Detailed game interface coming next.</p><a href="#/games/${game?.category || 'all'}">Browse ${label(game?.category || 'all')}</a></article>` : `<nav class="catalog-tabs" aria-label="Game categories">${tabs.map(t=>`<a href="#/games/${t}" ${!provider && t===id ? 'aria-current="page"' : ''}>${label(t)}</a>`).join('')}</nav><div class="catalog-list-content"><div class="catalog-list-heading"><h1>${esc(title)}</h1><span>${games.length} games</span></div>${id === 'all' ? '<input class="catalog-search" type="search" placeholder="Search games" aria-label="Search games">' : ''}<div class="catalog-grid">${games.map(g=>card(g)).join('')}</div><p class="catalog-empty catalog-no-results" ${games.length ? 'hidden' : ''}>${provider ? esc(provider.name)+' games are not available yet. Choose another provider or browse All games.' : 'No games available in this category yet.'}</p></div>`;
    return `<section class="catalog-page ${wingo?'catalog-wingo-page':arcade==='aviator'?'catalog-aviator-page':''}">${arcade==='aviator'?`<header class="aviator-backbar"><a href="${esc(location.pathname)}#/home" aria-label="Return to Home">${chevron(-1)}</a></header>`:`<header class="catalog-list-topbar"><button type="button" data-catalog-back aria-label="Back">${chevron(-1)}</button><strong>${esc(title)}</strong><a href="#/home" aria-label="Color Win home">Color Win</a></header>`}${content}${arcade==='aviator'?'':tabbar}</section>`;
  }
  let cleanup = () => {};
  function bind() {
    cleanup();
    const root = document.querySelector('.catalog-home, .catalog-page');
    if(document.querySelector('.source-frame-page:not([hidden])')){window.ColorWinSourceHome.bind();return;}
    if (!root) return;
    const controller = new AbortController();
    const { signal } = controller;
    const wingoFrame=root.querySelector('.catalog-wingo iframe');
    if(wingoFrame){const owner=window.ColorWinAuth?.session?.user?.id;window.addEventListener('message',async event=>{if(event.source!==wingoFrame.contentWindow)return;const req=event.data;if(req?.type==='cw-wingo-alert'&&typeof req.message==='string'){if(typeof toast==='function')toast(req.message.slice(0,250));return;}if(req?.type==='cw-wingo-request'&&['load','bet'].includes(req.action)&&typeof req.key==='string'){try{if(!owner||owner==='preview'||owner!==window.ColorWinAuth?.session?.user?.id)throw Error('Sign in to play with your Color Win wallet.');const result=await window.ColorWinOperations.rpc('colorwin_wingo',{p_action:req.action,p_data:req.data||{}});if(!wingoFrame.isConnected||owner!==window.ColorWinAuth?.session?.user?.id)return;wingoFrame.contentWindow.postMessage({type:'cw-wingo-response',key:req.key,result},'*');window.ColorWinAccount.refreshBalance().catch(()=>{});}catch(error){if(wingoFrame.isConnected)wingoFrame.contentWindow.postMessage({type:'cw-wingo-response',key:req.key,error:error.message},'*');}return;}if(req?.type!=='cw-wingo-ui')return;const action=req.action;if(['home','support','deposit','withdraw'].includes(action)){location.hash='#/'+action;return;}if(action!=='balance')return;try{if(!owner||owner==='preview')throw Error('Sign in');await window.ColorWinAccount.refreshBalance();if(!wingoFrame.isConnected||owner!==window.ColorWinAuth?.session?.user?.id)return;wingoFrame.contentWindow.postMessage({type:'cw-wingo-balance',balance:window.ColorWinAccount.balance()},'*');}catch{if(wingoFrame.isConnected)wingoFrame.contentWindow.postMessage({type:'cw-wingo-balance',error:true},'*');}},{signal});}
    const arcadeFrame=root.querySelector('.catalog-arcade iframe');
    const fortuneFrame=root.querySelector('.catalog-fortune iframe');
    if(fortuneFrame)window.addEventListener('message',e=>{const req=e.data;if(e.source===fortuneFrame.contentWindow&&req?.type==='cw-fortune-height'&&Number.isFinite(req.height)&&req.height>=600&&req.height<=2400)fortuneFrame.style.height=Math.ceil(req.height)+'px';},{signal});
    if(arcadeFrame){let lastArcadeBalance=null;const owner=window.ColorWinAuth?.session?.user?.id;const gameName=arcadeFrame.getAttribute('src').includes('limbo.html')?'limbo':'aviator';window.addEventListener('message',async e=>{const req=e.data;if(e.source===arcadeFrame.contentWindow&&req?.type==='cw-arcade-height'&&Number.isFinite(req.height)&&req.height>=400&&req.height<=20000){arcadeFrame.style.height=Math.ceil(req.height)+'px';return;}if(e.source===arcadeFrame.contentWindow&&req?.type==='cw-arcade-home'){location.hash='#/home';return;}if(e.source!==arcadeFrame.contentWindow||req?.type!=='cw-arcade-request'||req.game!==gameName||!['load','bet','cash','cancel'].includes(req.action)||typeof req.key!=='string')return;try{if(!owner||owner==='preview'||owner!==window.ColorWinAuth?.session?.user?.id)throw Error('Sign in with a real account to play.');const result=await window.ColorWinOperations.rpc('colorwin_arcade',{p_game:gameName,p_action:req.action,p_data:req.data||{}});if(!arcadeFrame.isConnected||owner!==window.ColorWinAuth?.session?.user?.id)return;arcadeFrame.contentWindow.postMessage({type:'cw-arcade-response',key:req.key,result},'*');if(lastArcadeBalance!==result.balance){lastArcadeBalance=result.balance;window.ColorWinAccount?.refreshBalance?.().catch(()=>{});}}catch(error){if(arcadeFrame.isConnected)arcadeFrame.contentWindow.postMessage({type:'cw-arcade-response',key:req.key,error:error.message},'*');}},{signal});}
    const frame=root.querySelector('.catalog-mines iframe');
    if(frame){const owner=window.ColorWinAuth?.session?.user?.id;window.addEventListener('message',async event=>{const request=event.data;if(event.source!==frame.contentWindow||request?.type!=='cw-mines-request'||!['load','start','pick','cash'].includes(request.action)||typeof request.key!=='string')return;try{if(!owner||owner==='preview'||owner!==window.ColorWinAuth?.session?.user?.id)throw Error('Sign in to play with your Color Win wallet.');const result=await window.ColorWinOperations.rpc('colorwin_mines',{p_action:request.action,p_data:request.data||{}});if(!frame.isConnected||owner!==window.ColorWinAuth?.session?.user?.id)return;frame.contentWindow.postMessage({type:'cw-mines-response',key:request.key,result},'*');if(request.action!=='load')window.ColorWinAccount?.refreshBalance?.().catch(()=>{});}catch(error){if(frame.isConnected)frame.contentWindow.postMessage({type:'cw-mines-response',key:request.key,error:error.message},'*');}},{signal});}

    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const updates = [];
    root.querySelectorAll('.game-carousel').forEach(row => {
      const buttons = row.parentElement.querySelectorAll('[data-carousel-step]');
      const update = () => { buttons[0].disabled = row.scrollLeft < 2; buttons[1].disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 2; };
      row.addEventListener('scroll',update,{passive:true,signal}); updates.push(update); update();
    });
    const resize = new ResizeObserver(()=>updates.forEach(update=>update())); resize.observe(root);
    root.addEventListener('click', event => {
      const arrow = event.target.closest('[data-carousel-step]');
      if (arrow) { const row=arrow.closest('.catalog-section').querySelector('.game-carousel'); row?.scrollBy({left:row.clientWidth*.87*Number(arrow.dataset.carouselStep),behavior:reduced.matches?'instant':'smooth'}); }
      if (event.target.closest('[data-catalog-back]')) { if(root.classList.contains('catalog-aviator-page'))location.hash='#/home';else if (history.length>1 && sessionStorage.getItem('cw_catalog_internal')==='1') history.back(); else location.hash='#/home'; }
      if (event.target.closest('a[href^="#/games/"]')) sessionStorage.setItem('cw_catalog_internal','1');
    },{signal});
    root.querySelectorAll('img').forEach(img=>{
      const failed=()=>{ const card=img.closest('.catalog-card,.catalog-provider,.catalog-winner'); if(card) { card.hidden=true; card.dataset.imageFailed='true'; } else img.hidden=true; updates.forEach(update=>update()); };
      img.addEventListener('error',failed,{once:true,signal}); if(img.complete&&!img.naturalWidth) failed();
    });
    const search=root.querySelector('.catalog-search');
    search?.addEventListener('input',()=>{let count=0;root.querySelectorAll('.catalog-grid .catalog-card').forEach(card=>{const match=!card.dataset.imageFailed&&card.getAttribute('aria-label').toLowerCase().includes(search.value.trim().toLowerCase());card.hidden=!match;if(match)count++;});root.querySelector('.catalog-no-results').hidden=count>0;root.querySelector('.catalog-no-results').textContent='No games match your search.';root.querySelector('.catalog-list-heading span').textContent=`${count} games`;},{signal});
    root.querySelector('.catalog-tabs [aria-current]')?.scrollIntoView({inline:'center',block:'nearest'});
    const track=root.querySelector('.catalog-ticker-track');let feedBusy=false,lastFeed='';const owner=window.ColorWinAuth?.session?.user?.id;
    async function refreshWins(){if(!track||feedBusy||document.hidden)return;feedBusy=true;try{const rows=await window.ColorWinOperations.rpc('colorwin_winning_feed',{});if(!root.isConnected||owner!==window.ColorWinAuth?.session?.user?.id)return;const next=JSON.stringify(rows);if(next===lastFeed)return;lastFeed=next;wins=rows;const cards=winnerCards();track.innerHTML='<div class="catalog-ticker-group">'+(cards||'<p class="catalog-empty">No recent winnings</p>')+'</div><div class="catalog-ticker-group" aria-hidden="true">'+cards+'</div>';}catch{if(track&&root.isConnected&&!wins.length)track.innerHTML='<p class="catalog-empty">Recent winnings unavailable</p>';}finally{feedBusy=false;}}
    refreshWins();const feedTimer=setInterval(refreshWins,10000);
    const updateTicker=()=>{if(track)track.style.animationPlayState=document.hidden?'paused':'running';};document.addEventListener('visibilitychange',()=>{updateTicker();refreshWins();},{signal});updateTicker();
    cleanup=()=>{controller.abort();resize.disconnect();clearInterval(feedTimer);};
    window.addEventListener('hashchange',cleanup,{once:true,signal});
    window.addEventListener('pagehide',cleanup,{once:true,signal});
  }
  window.ColorWinCatalog={home,view,bind,winning};
})();
