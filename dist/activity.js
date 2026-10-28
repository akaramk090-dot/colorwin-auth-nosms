/* Activity UI only. Assets are existing, unmodified local files. */
(() => {
  const backSVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const activityItems = [
    { id: 'bonus-details', title: 'Bonus details' },
    { id: 'activity-award', title: 'Activity Award', icon: 'gift', group: 'quick', route: '#/activity/dailytasks' },
    { id: 'tournaments', title: 'Tournaments', icon: 'crown', group: 'quick' },
    { id: 'rebate', title: 'Betting Rebate', icon: 'wallet', group: 'quick' },
    { id: 'super-jackpot', title: 'Super Jackpot', icon: 'crown', group: 'quick', image: 'assets/web%20images/banner-4.png' },
    { id: 'gifts', title: 'Gifts', route: '#/account/gifts', group: 'feature', image: 'assets/web%20images/gift.png', description: 'Enter the redemption code to receive gift rewards' },
    { id: 'attendance-bonus', title: 'Attendance bonus', route: '#/activity/dailysignin', group: 'feature', image: 'assets/web%20images/attendance-bonus.png', description: 'The more consecutive days you sign in, the higher the reward will be.' },
    { id: 'refer-friends', title: 'Refer Friends & Earn', image: 'assets/web%20images/banner-1.png' },
    { id: 'check-in', title: 'Check In Daily Reward', route: '#/activity/dailysignin', image: 'assets/web%20images/banner-5.png' },
    { id: 'welcome-bonus', title: 'Welcome Bonus', image: 'assets/web%20images/banner-2.png' },
    { id: 'daily-weekly-rewards', title: 'Daily & Weekly Rewards', route: '#/activity/dailytasks', image: 'assets/web%20images/banner-3.png' }
    ,{ id: 'collection-record', title: 'Collection record', route: '#/activity/collection-record' },
    { id: 'rebate-history', title: 'Rebate history' },
    { id: 'jackpot-rule', title: 'Rule', route: '#/activity/super-jackpot/rule' },
    { id: 'jackpot-stars', title: 'Winning star', route: '#/activity/super-jackpot/stars' },
    { id: 'attendance-rules', title: 'Game Rules', route: '#/activity/dailysignin/rules' },
    { id: 'attendance-history', title: 'Attendance history', route: '#/activity/dailysignin/history' }
  ].map(item => ({ ...item, route: item.route || (item.id === 'tournaments' ? '#/tournaments' : `#/activity/${item.id}`) }));
  const bannerIds = ['super-jackpot', 'refer-friends', 'check-in', 'welcome-bonus', 'daily-weekly-rewards'];
  const image = item => item.image ? `<img src="${item.image}" alt="${item.title}" loading="lazy" decoding="async" width="${item.group === 'feature' ? 1534 : 1855}" height="${item.group === 'feature' ? 1025 : 848}">` : '';
  const link = (item, className, content) => `<a class="${className}" href="${item.route}">${content}</a>`;

  // Activity-specific artwork; shared account icons remain unchanged.
  function activityIcon(id) {
    if (id === 'tournaments') return '<img class="activity-trophy" src="assets/icons/golden-trophy.svg" alt="">';
    const drawings = {
      'invitation-bonus': `<circle cx="15" cy="14" r="5" fill="url(#inviteGold)"/><path d="M6 32v-4a9 9 0 0 1 18 0v4" fill="url(#invitePink)"/><circle cx="29" cy="25" r="8" fill="url(#inviteGold)"/><path d="M29 21v8m-4-4h8" stroke="#713081" stroke-width="2.5"/><path d="m28 7 1-3 1 3 3 1-3 1-1 3-1-3-3-1z" fill="#fff3ab"/>`,
      'super-jackpot': `<path d="m10 14-3-7 8 4 5-7 5 7 8-4-3 7" fill="url(#jackpotGold)" stroke="#ffe7a3"/><rect x="4" y="15" width="32" height="20" rx="5" fill="url(#jackpotPink)" stroke="#ffcc73"/><rect x="7" y="19" width="26" height="12" rx="2" fill="#261345"/><path d="M10 22h4l-3 6m7-6h4l-3 6m7-6h4l-3 6" stroke="#ffe683" stroke-width="2.4"/><path d="M10 37h20" stroke="#ffa93e" stroke-width="2"/>`,
      tournaments: `<path d="M11 5h18v11a9 9 0 0 1-18 0V5Z" fill="url(#arenaGold)"/><path d="M11 8H5v5a6 6 0 0 0 6 6m18-11h6v5a6 6 0 0 1-6 6" fill="none" stroke="#ffdb83" stroke-width="3"/><path d="M20 25v8m-8 3h16" stroke="#ffa847" stroke-width="4"/><path d="m20 9 2 4 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1z" fill="url(#arenaPink)"/>`
    };
    if (!drawings[id]) return '';
    const prefix = { 'invitation-bonus': 'invite', 'super-jackpot': 'jackpot', tournaments: 'arena' }[id];
    return `<svg class="activity-custom-icon" viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="${prefix}Gold" x2=".6" y2="1"><stop stop-color="#fff5b3"/><stop offset=".45" stop-color="#ffd258"/><stop offset="1" stop-color="#f68121"/></linearGradient><linearGradient id="${prefix}Pink" x2=".7" y2="1"><stop stop-color="#fb83ed"/><stop offset=".5" stop-color="#ca32d6"/><stop offset="1" stop-color="#6627c8"/></linearGradient></defs>${drawings[id]}</svg>`;
  }

  function taskCards(period) {
    const weekly = period === 'weekly';
    const tasks = weekly ? [[10000,25],[20000,50],[50000,200],[100000,500],[150000,700],[300000,1500]] : [[300,1500,10],[1000,5000,20],[1500,7500,25],[3000,15000,60],[5000,25000,100]];
    return tasks.map((task,index) => `<article class="daily-task-card"><header><span>${weekly ? 'Weekly tasks' : `Daily mission ${index+1}`}</span><span class="task-state">Not active</span></header><div class="task-card-body"><span class="task-gift" aria-hidden="true"><img src="assets/icons/golden-trophy.svg" alt="" width="32" height="32"></span><div class="task-requirements">${weekly ? `<h2>Weekly Slots Betting Task</h2><p>Betting target <strong>₹${task[0].toLocaleString('en-IN')}</strong></p><p class="task-description">Complete the weekly Slots betting target to receive the reward.</p>` : `<p>Deposit <strong>— / ₹${task[0].toLocaleString('en-IN')}</strong></p><div class="task-progress"></div><p>Bet <strong>— / ₹${task[1].toLocaleString('en-IN')}</strong></p><div class="task-progress"></div>`}</div></div><footer><div><span>Award amount</span><strong>₹${(weekly ? task[1] : task[2]).toFixed(2)}</strong></div><button type="button" disabled>Not active</button></footer></article>`).join('');
  }

  function dailyTasks() {
    return `<div class="task-page-heading"><a href="#/activity" aria-label="Back to Activity">‹</a><h1>Activity Award</h1><a href="#/activity/collection-record">Collection record</a></div><section class="task-intro"><h2>Complete tasks. Earn rewards.</h2><p>Complete weekly/daily tasks to receive rewards.</p><p>Daily rewards reset each day. Weekly rewards reset each week.</p></section><p class="task-notice">Rewards are not active yet. Targets shown are a preview.</p><div class="task-tabs" role="tablist" aria-label="Task period"><button type="button" id="daily-task-tab" role="tab" aria-selected="true" aria-controls="task-list" data-task-period="daily">Daily mission</button><button type="button" id="weekly-task-tab" role="tab" aria-selected="false" aria-controls="task-list" data-task-period="weekly">Weekly tasks</button></div><section id="task-list" role="tabpanel" aria-labelledby="daily-task-tab">${taskCards('daily')}</section>`;
  }

  function rebateView() {
    return rebateSummary() + rebateRates();
  }

  function rebateRates() {
    const tiers = window.ColorWinVIP?.tiers || [];
    return `<section class="rebate-rates"><header><div><span>VIP benefits</span><h2>Rebate rates</h2></div><strong>${tiers.length ? `${Math.min(...tiers.map(t=>t.rebate))}%–${Math.max(...tiers.map(t=>t.rebate))}%` : '—'}</strong></header><p>Your eligible rate depends on your VIP level.</p><div class="rebate-rate-grid">${tiers.map(t=>`<div><span>VIP${t.level}</span><strong>${t.rebate}%</strong></div>`).join('')}</div><a href="#/vip">View VIP benefits <span>›</span></a></section>`;
  }

  function rebateSummary() {
    return `<div class="task-page-heading"><a href="#/activity" aria-label="Back to Activity">‹</a><h1>Rebate</h1></div><div class="rebate-tabs" role="tablist" aria-label="Rebate game category">${['All','Lottery','Casino','Rummy','Slots'].map((name,i)=>`<button type="button" aria-pressed="${i===0}" data-rebate-category="${name}"><span aria-hidden="true">${['▦','◉','♠','♦','▥'][i]}</span>${name}</button>`).join('')}</div><section class="rebate-summary"><h2><span id="rebate-category-name">All</span>–Total betting rebate</h2><p class="rebate-live"><span></span>Real-time count</p><strong class="rebate-amount">—</strong><a class="rebate-vip" href="#/vip">Upgrade VIP level to increase rebate rate <span>›</span></a><div class="rebate-totals"><div><span>Today rebate</span><strong>—</strong></div><div><span>Total rebate</span><strong>—</strong></div></div></section><p class="task-notice">Rebate rewards are not active yet.</p><button class="rebate-claim" type="button" disabled>One-Click Rebate</button><section class="rebate-history"><header><h2>Rebate history</h2><a href="#/activity/rebate-history">All history ›</a></header><p>No rebate records yet</p></section>`;
  }

  function jackpotView(route) {
    const rules = route.endsWith('/rule'), stars = route.endsWith('/stars');
    const heading = rules ? 'Rule' : stars ? 'Winning star' : 'Super Jackpot';
    const top = `<div class="task-page-heading"><a href="${rules||stars?'#/activity/super-jackpot':'#/activity'}" aria-label="Go back">‹</a><h1>${heading}</h1></div>`;
    if (stars) return top + `<p class="task-notice">Sample records · layout preview</p><section class="jackpot-winners">${[
      ['1-Cz2mt-nl.png','Mem***NMS','Money Coming','10.1X'],
      ['10-BcpE5fen.png','Mem***ARK','Money Coming','10X'],
      ['11-DBjki8Hc.png','Mem***IAM','Crazy Hunter','13.5X'],
      ['12-DZNy4n9Y.png','Mem***AAV','Crash Goal','12.38X']
    ].map(([avatar,name,game,multiplier])=>`<article class="jackpot-winner"><header><img src="assets/avatars/${avatar}" alt="" width="36" height="36"><h2>${name}</h2></header><dl><div><dt>Game name</dt><dd>${game}</dd></div><div><dt>Number of wins</dt><dd class="winner-multiplier">${multiplier}</dd></div><div><dt>Bonus</dt><dd class="winner-bonus">₹35.00</dd></div><div><dt>Winning time</dt><dd>Sample record</dd></div></dl></article>`).join('')}</section>`;
    const hero = `<section class="jackpot-hero"><div><h2>Super Jackpot</h2><p>${rules ? 'Win a Super Jackpot in Slots to qualify for an additional platform bonus.' : 'When you get the Super Jackpot in Slots, you can get an additional bonus.'}</p><p>Rewards are valid for 1 day. Claim eligible rewards before they expire.</p></div></section>`;
    if (rules) return top + hero + `<section class="jackpot-rules"><h2><img src="assets/vip/5-C0R3LOV8.png" alt="" width="24" height="24">Bonus</h2><div class="jackpot-table-wrap"><table class="jackpot-rule-table"><thead><tr><th scope="col">Winning rate</th><th scope="col">Bet amount</th><th scope="col">Bonus</th></tr></thead><tbody>${[['10X–20X',35],['20X–30X',55],['30X–40X',135],['40X–60X',195],['60X–999999X',355]].map(([rate,bonus])=>`<tr><td>${rate}</td><td>₹30–₹999999</td><td>₹${bonus.toFixed(2)}</td></tr>`).join('')}</tbody></table></div></section><aside class="jackpot-rule-note"><span aria-hidden="true">▶</span><p>All event interpretation rights belong to the platform. If you have any questions, please contact customer service.</p></aside><a class="jackpot-contact" href="#/support">Contact customer service <span aria-hidden="true">›</span></a>`;
    return top + hero + `<button class="jackpot-batch" type="button" disabled><span aria-hidden="true">▦</span>Receive in batches</button><nav class="jackpot-links" aria-label="Jackpot information"><a href="#/activity/super-jackpot/rule"><span aria-hidden="true">☷</span>Rule</a><a href="#/activity/super-jackpot/stars"><img src="assets/icons/golden-trophy.svg" alt="">Winning star</a></nav><section class="jackpot-empty"><img src="assets/vip/1-DxIEHA2I.png" alt="" width="76" height="76"><p>You don't have a Super Jackpot reward yet.</p></section><a class="jackpot-play" href="#/home">Go bet <span aria-hidden="true">›</span></a>`;
  }

  function attendanceView(route) {
    const amounts=[5,18,100,200,400,3000,7000];
    const deposits=[300,1000,10000,50000,100000,500000,1000000];
    const rules=route.endsWith('/rules'),history=route.endsWith('/history');
    const top=`<div class="task-page-heading"><a href="${rules||history?'#/activity/dailysignin':'#/activity'}" aria-label="Go back">${backSVG}</a><h1>${rules?'Game Rules':history?'Attendance history':'Attendance'}</h1></div>`;
    if(history)return top+`<section class="attendance-history"><p class="task-notice">Loading attendance history…</p></section>`;
    if(rules)return top+`<section class="attendance-rules"><h2>Attendance bonus</h2><p>Claim rewards in order, on separate days. Only deposits approved on that day count, using India time (IST). Multiple approved deposits are added together; pending and rejected deposits do not count.</p><p>A missed day does not reset your progress. Each reward can be claimed once. After claiming, the next reward becomes available from the following day when its deposit requirement is met.</p><table><thead><tr><th>Reward day</th><th>Daily approved deposits</th><th>Bonus</th></tr></thead><tbody>${amounts.map((amount,i)=>`<tr><td>Day ${i+1}</td><td>₹${deposits[i].toLocaleString('en-IN')}</td><td>₹${amount.toLocaleString('en-IN')}</td></tr>`).join('')}</tbody></table></section>`;
    return top+`<section class="attendance-hero"><h2>Attendance bonus</h2><p>Deposit, claim and unlock your next reward</p><div class="attendance-streak">Rewards claimed <strong>0</strong> / 7</div><div class="attendance-accumulated"><span>Accumulated</span><strong>₹0.00</strong></div><nav><a href="#/activity/dailysignin/rules">Game Rules</a><a href="#/activity/dailysignin/history">Attendance history</a></nav></section><section class="attendance-days" aria-label="Seven day rewards">${amounts.map((amount,i)=>`<article data-attendance-day="${i+1}" class="attendance-day${i===6?' attendance-day-final':''}"><strong>₹${amount.toLocaleString('en-IN',{minimumFractionDigits:2})}</strong><img src="${i===6?'assets/web%20images/colorwin-attendance-gift.png':'assets/icons/attendance-coin.svg'}" alt="" width="48" height="48"><span>Day ${i+1}</span></article>`).join('')}</section><p class="task-notice attendance-status" role="status">Loading attendance…</p><button class="attendance-claim" type="button" disabled>Attendance</button>`;
  }

  async function bindAttendance(page) {
    const button=page.querySelector('.attendance-claim'), status=page.querySelector('.attendance-status'), history=page.querySelector('.attendance-history');
    if(!button&&!history)return;
    const auth=window.ColorWinAuth, owner=auth?.session?.user?.id;
    const money=value=>'₹'+Number(value||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
    const current=()=>page.isConnected&&auth?.session?.user?.id===owner;
    function paint(data) {
      if(!current())return;
      if(history){history.replaceChildren();if(!data.history.length){history.textContent='No attendance records yet';return;}data.history.forEach(record=>{const card=document.createElement('article');card.className='attendance-record';const title=document.createElement('strong');title.textContent=`Day ${record.day} · ${money(record.reward)}`;const detail=document.createElement('p');detail.textContent=`${record.date} · Approved deposits ${money(record.approved_total)}`;card.append(title,detail);history.append(card);});return;}
      page.querySelector('.attendance-streak strong').textContent=data.claimed_days;
      page.querySelector('.attendance-accumulated strong').textContent=money(data.earned);
      page.querySelectorAll('[data-attendance-day]').forEach(card=>{card.classList.toggle('is-claimed',Number(card.dataset.attendanceDay)<=data.claimed_days);card.classList.toggle('is-current',Number(card.dataset.attendanceDay)===data.next_day&&data.claimed_days<7);});
      status.textContent=data.reason==='completed'?'All seven rewards claimed.':data.reason==='claimed_today'?`Today's reward is claimed. Continue with Day ${data.next_day} from tomorrow; approved deposits of ${money(data.required)} are required that day.`:`Day ${data.next_day}: approved today ${money(data.approved_today)} / ${money(data.required)}. ${data.eligible?'Your reward is ready.':'Deposit and wait for approval to unlock this reward.'}`;
      button.disabled=!data.eligible;button.textContent=data.reason==='completed'?'Completed':data.reason==='claimed_today'?'Claimed today':`Claim Day ${data.next_day} · ${money(data.reward)}`;
    }
    if(!owner||!auth?.accountRpc){(status||history).textContent='Log in to view and claim attendance rewards.';return;}
    async function load(claim=false){try{const data=await auth.accountRpc('colorwin_attendance',{p_claim:claim});paint(data);if(claim&&current())await window.ColorWinAccount?.refreshBalance?.();}catch(error){if(current()){(status||history).textContent=error.message||'Unable to load attendance. Please try again.';if(button){button.disabled=false;button.textContent='Refresh attendance';button.dataset.retry='true';}}}}
    button?.addEventListener('click',async()=>{const claim=button.dataset.retry!=='true';delete button.dataset.retry;button.disabled=true;button.textContent=claim?'Claiming…':'Loading…';await load(claim);});
    await load();
  }

  function view(header, tabbar, icon, route) {
    header = '<header class="topbar activity-topbar"><img class="brand-logo" src="assets/web%20images/color-win-logo-supplied.png" alt="Color Win"></header>';
    if(route==='#/activity/welcome-bonus')return `<section class="activity-page">${header}<div class="activity-content"><div class="task-page-heading"><a href="#/activity" aria-label="Go back">${backSVG}</a><h1>Welcome Bonus</h1></div>${window.ColorWinWelcome?.section?.()||''}</div>${tabbar}</section>`;
    if(route.startsWith('#/activity/dailysignin') || route==='#/activity/check-in' || route==='#/activity/attendance-bonus')return `<section class="activity-page attendance-page">${header}<div class="activity-content">${attendanceView(route)}</div>${tabbar}</section>`;
    if (route === '#/activity/refer-friends') return `<section class="activity-page">${header}<div class="activity-content"><div class="task-page-heading"><a href="#/activity" aria-label="Back to Activity">${backSVG}</a><h1>Activity details</h1></div><a class="referral-poster-link" href="#/promotion/link" aria-label="Open your invitation link"><img src="assets/web%20images/banner-1.png" alt="Refer Friends and Earn"><h2>Refer Friends &amp; Earn</h2><span class="referral-detail-art"><img src="assets/web%20images/colorwin-referral-details.png" alt="Color Win agent referral bonus: first recharge table, rules and conditions, and referral reward tiers. Tap to open your invitation link."><span class="referral-cell-correction" aria-label="75 invited users bonus: ₹4,500">₹4,500</span></span></a></div>${tabbar}</section>`;
    if (route === '#/activity/super-jackpot' || route.startsWith('#/activity/super-jackpot/')) return `<section class="activity-page jackpot-page">${header}<div class="activity-content">${jackpotView(route)}</div>${tabbar}</section>`;
    if (route === '#/activity/rebate' || route === '#/activity/rebate-history') {
      const body = route.endsWith('rebate-history') ? `<div class="task-page-heading"><a href="#/activity/rebate" aria-label="Back to Rebate">‹</a><h1>Rebate history</h1></div><section class="task-empty"><h2>No rebate records yet</h2><p>Your credited rebates will appear here.</p></section>` : rebateView();
      return `<section class="activity-page">${header}<div class="activity-content">${body}</div>${tabbar}</section>`;
    }
    const detail = activityItems.find(item => item.route === route);
    const content = route === '#/activity/dailytasks' || route === '#/activity/activity-award' ? dailyTasks() : route === '#/activity/collection-record' ? `<div class="task-page-heading"><a href="#/activity/dailytasks" aria-label="Back to Activity Award">‹</a><h1>Collection record</h1></div><section class="task-empty"><img class="cw-no-data-art" src="assets/no-data.svg" alt="" aria-hidden="true"><h2>No rewards collected yet</h2><p>Your collected daily and weekly rewards will appear here.</p></section>` : detail
      ? `<article class="activity-detail"><p class="activity-eyebrow">Color Win</p><h1>${detail.title}</h1><p>Detailed interface coming next.</p><a class="activity-back" href="#/activity">Back to Activity</a></article>`
      : `<h1 class="activity-heading">Activity</h1>
        <section class="activity-bonus" aria-label="Bonus summary">
          <div class="activity-balances"><div><span>Today's bonus</span><strong>₹0.00</strong></div><div><span>Total bonus</span><strong>₹0.00</strong></div></div>
          <a href="#/activity/bonus-details" class="activity-bonus-link">Bonus details <span aria-hidden="true">›</span></a>
        </section>
        <nav class="activity-quick" aria-label="Quick activities">${activityItems.filter(item => item.group === 'quick').map(item => link(item, 'activity-quick-item', `<span class="activity-icon" aria-hidden="true">${activityIcon(item.id) || icon(item.icon)}</span><span>${item.title}</span>`)).join('')}</nav>
        <section class="activity-features" aria-label="Gifts and attendance">${activityItems.filter(item => item.group === 'feature').map(item => link(item, 'activity-feature', `${image(item)}<div><h2>${item.title}</h2><p>${item.description}</p></div>`)).join('')}</section>
        <section class="activity-banners" aria-label="Activity offers">${bannerIds.map(id => activityItems.find(item => item.id === id)).map(item => link(item, 'activity-banner', `${image(item)}<h2>${item.title}<span aria-hidden="true">›</span></h2>`)).join('')}</section>
        <p class="activity-end">No more</p>`;
    return `<section class="activity-page">${header}<div class="activity-content">${content}</div>${tabbar}</section>`;
  }

  function bind() {
    const page = document.querySelector('.activity-page');
    window.ColorWinWelcome?.bindSection?.(page);
    if(page.classList.contains('attendance-page'))void bindAttendance(page);
    page.querySelectorAll('.task-page-heading>a:first-child').forEach(link => { if (link.textContent.trim() === '‹') link.innerHTML = backSVG; });
    page.querySelectorAll('[data-rebate-category]').forEach(button => button.addEventListener('click', () => {
      page.querySelectorAll('[data-rebate-category]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      page.querySelector('#rebate-category-name').textContent = button.dataset.rebateCategory;
    }));
    page.querySelectorAll('[data-task-period]').forEach(button => button.addEventListener('click', () => {
      page.querySelectorAll('[data-task-period]').forEach(tab => tab.setAttribute('aria-selected', String(tab === button)));
      const list = page.querySelector('#task-list');
      list.innerHTML = taskCards(button.dataset.taskPeriod);
      list.setAttribute('aria-labelledby', button.id);
    }));
    // Use native hash links for every card: keyboard and browser navigation work too.
    page.querySelector('#backBtn')?.addEventListener('click', event => {
      event.stopImmediatePropagation();
      location.hash = location.hash === '#/activity' ? '#/home' : '#/activity';
    }, true);
    page.querySelectorAll('.activity-content img').forEach(img => {
      const hideFailedImage = () => { img.hidden = true; };
      img.addEventListener('error', hideFailedImage, { once: true });
      if (img.complete && !img.naturalWidth) hideFailedImage();
    });
  }
  window.ColorWinActivity = { view, bind, activityItems };
})();
