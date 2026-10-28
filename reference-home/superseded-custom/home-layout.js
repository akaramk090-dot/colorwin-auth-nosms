(() => {
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const data=window.ColorWinHomeSource;
  const categories=[['lottery','Lottery','◈','5afdcc050b6da6cfeb25.png'],['popular','Popular','★','214f72e89d5edb528437.png'],['flash','Mini Games','✦','ae17aebae3c97341a87e.png'],['slot','Slots','▥','a69fc53d5792707a945b.png'],['fish','Fishing','≈','d84f6cc1d34ce2a412e3.png'],['chess','PVC','♠','f53ed4bd2cdb3b003ec7.png'],['video','Casino','♣','6eab69764f21cccb7cc7.png'],['sport','Sports','⚑','ada464cacf9925904da4.png']];
  const original=()=>window.ColorWinGamesData.gamesCatalog;
  const routeFor=g=>{
    const name=g.gameNameEn||g.categoryName||g.slotsName||'';
    const fixed={'Win Go':'wingo','WinGo 30sec':'wingo','K3':'k3','5D':'5d','Trx Win Go':'trx-wingo','MotoRace':'moto-racing','Aviator':'aviator','Mines Pro':'100'};
    const id=fixed[name];if(id)return '#/games/play/'+id;
    const match=original().find(x=>x.name.toLowerCase()===name.toLowerCase());
    if(match)return match.route;
    const provider=window.ColorWinGamesData.providers.find(x=>x.name.toLowerCase()===name.toLowerCase()||x.id===String(g.vendorCode).toLowerCase());
    return provider?'#/games/provider/'+provider.id:'#/games/'+({flash:'mini-games',fish:'fishing',slot:'slots',chess:'casino',video:'casino',sport:'sports'}[g.homeCategory]||'all');
  };
  const rows=id=>id==='top'?data.popular.platformList:id==='popular'?data.popular.clicksTopList:data[id]||[];
  function cards(id,items){return items.map(g=>{
    const name=g.gameNameEn||g.categoryName||g.slotsName;const image=g.imgUrl||g.img||g.categoryImg||g.vendorImg;
    const local=original().find(x=>x.route===routeFor(g));if(local&&window.ColorWinOperations?.config?.games?.[local.id]===false)return '';
    return `<a class="source-game" href="${esc(routeFor({...g,homeCategory:id}))}" aria-label="Open ${esc(name)}"><img src="${esc(image)}" alt="${esc(name)}" loading="lazy" width="222" height="300">${id==='top'?'<span>Play Now <b>›</b></span>':''}</a>`;
  }).join('');}
  function section(id,title,symbol){const items=rows(id);return `<section class="source-section" data-source-section="${id}"><header><span aria-hidden="true">${symbol}</span><h2>${title}</h2><button class="source-all" type="button" data-source-all="${id}" aria-expanded="false">View All</button><div class="source-paging"><button type="button" data-source-step="-1" aria-label="Previous ${title}" disabled>‹</button><button type="button" data-source-step="1" aria-label="Next ${title}" ${items.length<=6?'disabled':''}>›</button></div></header><div class="source-grid ${id==='top'?'source-top':''}">${cards(id,items.slice(0,id==='top'?3:6))}</div></section>`;}
  function view(){return `<div class="catalog-home source-home">
    <div class="source-announcement"><span>◖</span><p>Color Win customer service is here to help.</p><a href="#/support">Detail</a></div>
    <div class="source-promos"><a href="#/activity/dailysignin"><strong>Your Daily Bonus Awaits</strong><small>Log in daily and claim rewards</small><img src="assets/web%20images/colorwin-attendance-banner.png" alt="" loading="lazy"></a><a href="#/activity/welcome-bonus"><strong>Welcome Bonus</strong><small>Explore your available rewards</small><img src="assets/web%20images/banner-2.png" alt="" loading="lazy"></a></div>
    ${section('top','Top Games','🏅')}
    <section class="source-section"><header><span>🎮</span><h2>Play and Win</h2></header><div class="source-categories">${categories.map(([id,name,,img],i)=>`<a class="${i<4?'source-category-large':''}" href="#source-${id}" data-source-jump="${id}"><strong>${name}</strong><small>${rows(id).length} ${['slot','chess','video','sport'].includes(id)?'providers':'games'}</small><img src="assets/home-source/${img}" alt="" loading="lazy"></a>`).join('')}</div></section>
    ${categories.map(([id,name,symbol])=>section(id,name,symbol)).join('')}
    <a class="source-jackpot" href="#/activity/super-jackpot"><span>🏆</span><div><strong>Super Jackpot</strong><p>Explore jackpots and rewards</p><b>Join Now</b></div></a>
    ${window.ColorWinCatalog.winning()}
    <footer class="source-footer"><h2>Game Providers</h2><div>${window.ColorWinGamesData.providers.filter(p=>['choice','evolution','cq9','jdb','jili','microgaming'].includes(p.id)).map(p=>`<a href="#/games/provider/${esc(p.id)}"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"></a>`).join('')}</div><p>18+ · Play responsibly</p><p>Keep control of your time and spending. Visit customer service whenever you need help.</p></footer>
    </div>`;}
  function bind(){const root=document.querySelector('.source-home');if(!root)return;const controller=new AbortController();
    root.addEventListener('click',e=>{
      const jump=e.target.closest('[data-source-jump]');if(jump){e.preventDefault();root.querySelector(`[data-source-section="${jump.dataset.sourceJump}"]`)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});return;}
      const all=e.target.closest('[data-source-all]'),step=e.target.closest('[data-source-step]');if(!all&&!step)return;
      const section=(all||step).closest('[data-source-section]'),id=section.dataset.sourceSection,items=rows(id),size=id==='top'?3:6;
      let expanded=section.dataset.expanded==='true',page=Number(section.dataset.page||0);
      if(all){expanded=!expanded;page=0;}else page=Math.max(0,Math.min(Math.ceil(items.length/size)-1,page+Number(step.dataset.sourceStep)));
      section.dataset.expanded=String(expanded);section.dataset.page=String(page);
      section.querySelector('.source-grid').innerHTML=cards(id,expanded?items:items.slice(page*size,(page+1)*size));
      const toggle=section.querySelector('[data-source-all]');toggle.textContent=expanded?'Show Less':'View All';toggle.setAttribute('aria-expanded',String(expanded));
      const buttons=section.querySelectorAll('[data-source-step]');buttons[0].disabled=expanded||page===0;buttons[1].disabled=expanded||(page+1)*size>=items.length;
    },{signal:controller.signal});
    window.addEventListener('hashchange',()=>controller.abort(),{once:true,signal:controller.signal});
  }
  window.ColorWinHomeLayout={view,bind};
})();
