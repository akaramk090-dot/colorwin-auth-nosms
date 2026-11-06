(() => {
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const format=n=>Number(n).toLocaleString('en-IN');
  const tiers=[
    [3000,60,3,.04],[30000,180,9,.04],[400000,690,29,.1],
    [4000000,1690,690,.1],[20000000,6900,1690,.1],[80000000,16900,6900,.15],
    [300000000,69000,16900,.15],[1000000000,169000,69000,.15],
    [5000000000,690000,169000,.2],[10000000000,1690000,690000,.3]
  ].map(([experience,upgrade,monthly,rebate],i)=>({level:i+1,experience,upgrade,monthly,rebate}));
  const rules=[
    ['Upgrade standard','Qualifying bets earn experience at ₹1 = 1 EXP. Your experience determines the VIP levels you can unlock.'],
    ['Upgrade order','Levels advance in order. Meet the experience requirement for the next level to progress.'],
    ['Level maintenance','The reference programme uses a 30-day maintenance period following a level change.'],
    ['Downgrade standard','If maintenance requirements are not met, experience and membership benefits may be adjusted.'],
    ['Level up rewards','Each level-up reward is available once per account after that level is unlocked.'],
    ['Monthly reward','Monthly benefits depend on your eligible level. Rewards do not accumulate across settlement periods.'],
    ['Real-time rebate','Eligible play receives the rebate rate associated with the relevant VIP level.'],
    ['Safe','Additional safe benefits depend on membership eligibility and the platform programme.']
  ];
  const badgeFiles=['vip1-badge.png','2-nuTgsQAe.png','3-Dmm90Z3M.png','4-D0LcUTfO.png','5-DEnp90_4.png','6-BDYnJS_O.png','7-CyClOlek.png','8-DbW9oFTd.png','9-BajteX48.png','10-Bt9VCtue.png'];
  const badge=level=>'assets/vip/'+badgeFiles[level-1];
  const rewardIcon=(file)=>'<img src="assets/vip/'+file+'" alt="" width="40" height="40">';
  const crown='<img src="assets/vip/10-Bt9VCtue.png" alt="">';
  function payoutDays(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Kolkata',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));return Math.round((Date.UTC(p.year,p.month,1)-Date.UTC(p.year,p.month-1,p.day))/86400000);}
  function initial(){return {experience:window.ColorWinAuth.session?.user?.id==='preview'?0:null,claimed_levels:[],history:[]};}
  const empty=()=>'<div class="vip-empty"><img class="cw-no-data-art" src="assets/no-data.svg" alt="" aria-hidden="true"><p>No data</p></div>';
  function cards(data){return tiers.map(t=>{const known=Number.isFinite(data.experience),unlocked=known&&data.experience>=t.experience,claimed=(data.claimed_levels||[]).includes(t.level),progress=known?Math.min(100,data.experience/t.experience*100):0;return `<article class="vip-tier" data-level="${t.level}" aria-label="VIP${t.level}"><div class="vip-tier-top"><strong>VIP${t.level}</strong><span>${claimed?'Reward claimed':known?(unlocked?'Unlocked':'Not open yet'):'Level overview'}</span></div><img class="vip-tier-crown" src="${badge(t.level)}" alt="VIP${t.level} badge"><p>Upgrading VIP${t.level} requires<br><b>${known?format(Math.max(0,t.experience-data.experience)):format(t.experience)} EXP</b></p><small class="vip-bet">Bet ₹1 = 1 EXP</small><div class="vip-tier-progress"><span>VIP${t.level}</span><div class="vip-progress-track" role="progressbar" aria-label="Progress to VIP${t.level}" ${known?`aria-valuenow="${Math.min(data.experience,t.experience)}"`:''} aria-valuemin="0" aria-valuemax="${t.experience}"><i style="width:${progress}%"></i></div><div><b>${known?format(data.experience):'0'} / ${format(t.experience)}</b><small>${format(t.experience)} EXP to level up</small></div></div></article>`;}).join('');}
  function benefits(level,data){const t=tiers[level-1],known=Number.isFinite(data.experience),claimed=(data.claimed_levels||[]).includes(level),unlocked=known&&data.experience>=t.experience;return `<h2><img src="${badge(level)}" alt="">VIP${level} Benefits</h2><article class="vip-benefit vip-level-reward"><span class="vip-benefit-icon" aria-hidden="true">${rewardIcon('1-DxIEHA2I.png')}</span><div><h3>Level up rewards</h3><p>Each account can receive once</p></div><strong>₹${format(t.upgrade)}<small>Bonus 0</small></strong><button class="vip-claim" type="button" data-vip-claim="${level}" ${!unlocked||claimed?'disabled':''}>${claimed?'Reward claimed':unlocked?'Claim reward':known?`Need ${format(t.experience)} EXP to unlock`:'Checking eligibility…'}</button></article><article class="vip-benefit"><span class="vip-benefit-icon" aria-hidden="true">${rewardIcon('2-DmJHHAN0.png')}</span><div><h3>Monthly reward</h3><p>Once per account, per month</p></div><strong>₹${format(t.monthly)}<small>Bonus 0</small></strong></article><article class="vip-benefit"><span class="vip-benefit-icon" aria-hidden="true">${rewardIcon('5-C0R3LOV8.png')}</span><div><h3>Rebate rate</h3><p>Rewards on qualifying play</p></div><strong>${t.rebate}%</strong></article>`;}
  function view(route){const history=route==='#/vip/history',data=initial();return `<section class="vip-page"><header class="vip-header"><a href="${history?'#/vip':'#/account'}" aria-label="Go back">‹</a><h1>${history?'VIP History':'VIP'}</h1><span></span></header>${history?'<main class="vip-content"><div id="vip-history-list" role="status">'+empty()+'</div></main>':`<section class="vip-hero"><div class="vip-member"><img class="vip-user-avatar" src="assets/avatars/${esc(window.ColorWinAccount.avatar?.()||'1-Cz2mt-nl.png')}" alt="Your avatar"><div><h2>${esc(window.ColorWinAccount.nickname())}</h2><span>Color Win VIP Club</span></div></div><div class="vip-summary"><div><strong id="vip-experience">${data.experience===null?'0':format(data.experience)} <small>EXP</small></strong><span>My experience</span></div><div><strong>${payoutDays()} <small>Days</small></strong><span>Payout time</span></div></div></section><main class="vip-content"><p class="vip-settlement">◷ Monthly rewards settle at 2:00 AM IST on the 1st.</p><div id="vip-carousel" class="vip-carousel" tabindex="0" aria-label="VIP levels. Swipe or use arrow keys">${cards(data)}</div><p class="vip-swipe-hint">Swipe to explore VIP levels</p><section id="vip-benefits" class="vip-benefits" aria-live="polite">${benefits(1,data)}</section><div class="vip-tabs" role="tablist"><button type="button" role="tab" data-vip-tab="history" aria-selected="true">History</button><button type="button" role="tab" data-vip-tab="rules" aria-selected="false">Rules</button></div><section id="vip-tab-content">${empty()}</section><a class="vip-view-all" id="vip-view-all" href="#/vip/history">View All <span>›</span></a></main>`}</section>`;}
  function historyView(rows){return rows.length?rows.map(r=>`<article class="vip-history-row"><div><strong>${esc(r.title)}</strong><time>${esc(new Date(r.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}))}</time></div><b>₹${format(r.amount)}</b></article>`).join(''):empty();}
  async function bind(route,toast){const page=document.querySelector('.vip-page');let data=initial(),level=1,tab='history';const allHistory=route==='#/vip/history';
    const paintHistory=()=>{const target=page.querySelector(allHistory?'#vip-history-list':'#vip-tab-content');if(allHistory||tab==='history')target.innerHTML=historyView(allHistory?data.history:data.history.slice(0,5));};
    const validate=result=>{if(!result||!Number.isFinite(Number(result.experience))||Number(result.experience)<0||!Array.isArray(result.claimed_levels)||!Array.isArray(result.history))throw Error('VIP data is invalid. Please retry.');return {experience:Number(result.experience),claimed_levels:result.claimed_levels.map(Number),history:result.history};};
    const paint=()=>{if(!page.isConnected)return;if(!allHistory){page.querySelector('#vip-experience').innerHTML=format(data.experience)+' <small>EXP</small>';page.querySelector('#vip-carousel').innerHTML=cards(data);page.querySelector('#vip-benefits').innerHTML=benefits(level,data);}paintHistory();};
    if(!allHistory){const carousel=page.querySelector('#vip-carousel');
      const select=(next,scroll=true)=>{level=Math.min(10,Math.max(1,next));page.querySelector('#vip-benefits').innerHTML=benefits(level,data);page.querySelectorAll('[data-vip-level]').forEach(b=>b.setAttribute('aria-selected',String(Number(b.dataset.vipLevel)===level)));if(scroll){const card=carousel.querySelector(`[data-level="${level}"]`);carousel.scrollTo({left:card.offsetLeft-carousel.querySelector('[data-level]').offsetLeft,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}};
      let frame;carousel.onscroll=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const first=carousel.querySelector('[data-level]');const nearest=[...carousel.querySelectorAll('[data-level]')].reduce((best,c)=>Math.abs(c.offsetLeft-first.offsetLeft-carousel.scrollLeft)<Math.abs(best.offsetLeft-first.offsetLeft-carousel.scrollLeft)?c:best,first);const n=Number(nearest.dataset.level);if(n!==level)select(n,false);});};
      page.querySelectorAll('[data-vip-level]').forEach(b=>b.onclick=()=>select(Number(b.dataset.vipLevel)));carousel.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();select(level+(e.key==='ArrowRight'?1:-1));}};
      page.querySelectorAll('[data-vip-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.vipTab;page.querySelectorAll('[data-vip-tab]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));page.querySelector('#vip-view-all').hidden=tab!=='history';if(tab==='rules')page.querySelector('#vip-tab-content').innerHTML='<section class="vip-rules"><h2>VIP privileges</h2><p>VIP rule description</p>'+rules.map(([title,text],i)=>`<article><span>${i+1}</span><div><h3>${title}</h3><p>${text}</p></div></article>`).join('')+'</section>';else paintHistory();});select(1,false);
    }
    const auth=window.ColorWinAuth,user=auth.session?.user;
    if(user?.id==='preview'){paint();return;}
    try{data=validate(await auth.accountRpc('colorwin_vip_data'));paint();}catch(error){if(page.isConnected)toast(error.message||'VIP progress could not be loaded.',true);return;}
    if(allHistory)return;
    page.addEventListener('click',async event=>{
      const button=event.target.closest('[data-vip-claim]');
      if(!button||button.disabled)return;
      const claimedLevel=Number(button.dataset.vipClaim),reward=tiers[claimedLevel-1].upgrade;
      button.disabled=true;button.textContent='Claim reward';
      try{
        data=validate(await auth.accountRpc('colorwin_vip_claim',{p_level:claimedLevel}));
        paint();
        toast(`VIP${claimedLevel} reward ₹${format(reward)} claimed.`);
        try{await window.ColorWinAccount?.refreshBalance?.();}catch(error){toast(error.message||'Reward claimed, but wallet display could not refresh.',true);}
      }catch(error){
        if(page.isConnected){
          let message=error.message||'VIP reward could not be claimed. Please retry.';
          try{data=validate(await auth.accountRpc('colorwin_vip_data'));paint();}catch(refreshError){message+=' VIP status refresh failed: '+(refreshError.message||'Please reopen the page.');}
          toast(message,true);
        }
      }
    });
  }
  window.ColorWinVIP={matches:r=>r==='#/vip'||r==='#/vip/history',view,bind,tiers};
})();
