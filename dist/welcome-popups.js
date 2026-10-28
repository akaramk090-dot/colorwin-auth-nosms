(() => {
 'use strict';
 const auth=window.ColorWinAuth,offers=[[300,28],[500,58],[1000,88],[2000,108],[5000,288]];
 let owner='',sessionKey='',host=null,previousFocus=null,lastRoute='',skipRoute='',routeVersion=0;
 const read=(store,key)=>{try{return store.getItem(key);}catch{return null;}};
 const write=(store,key,value)=>{try{store.setItem(key,value);}catch{}};
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const closeSVG='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
 function close(){host?.remove();host=null;document.body.classList.remove('cw-popup-open');const app=document.querySelector('#app');if(app)app.inert=false;previousFocus?.focus?.();}
 function shell(title,body,footer){close();previousFocus=document.activeElement;host=document.createElement('div');host.className='cw-popup-backdrop';host.innerHTML=`<section class="cw-popup" role="dialog" aria-modal="true" aria-labelledby="cw-popup-title"><header><span class="cw-popup-eyebrow">COLOR WIN</span><h2 id="cw-popup-title">${title}</h2></header>${body}${footer}</section>`;document.body.append(host);document.body.classList.add('cw-popup-open');const app=document.querySelector('#app');if(app)app.inert=true;host.querySelector('button')?.focus();host.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const focusable=[...host.querySelectorAll('button,a,input')].filter(el=>!el.disabled);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});}
 function welcome(){shell('Welcome to Color Win',`<div class="cw-welcome-body"><p class="cw-welcome-intro">Your Color Win journey starts here.</p><p>Discover games, explore rewards and enjoy your favourite entertainment in one place.</p><img src="assets/web%20images/colorwin-welcome-banner.png" alt="Color Win — Welcome to the club" width="900" height="600"><small>Play responsibly. Enjoy every moment.</small></div>`,`<footer><button type="button" class="cw-popup-primary" id="cw-welcome-confirm">Confirm</button></footer>`);host.querySelector('#cw-welcome-confirm').onclick=()=>{write(sessionStorage,'cw_welcome_login_'+sessionKey,'1');close();void bonus(true);};}
 async function bonus(afterWelcome=false){
  if(!owner||host||(!afterWelcome&&read(sessionStorage,'cw_bonus_muted_login_'+sessionKey)===today()))return;
  shell('Extra first deposit bonus',`<p class="cw-bonus-subtitle" data-first-deposit-status role="status">Checking your first approved deposit…</p><div class="cw-bonus-list">${offers.map(([amount,reward])=>`<article class="cw-bonus-card" data-offer-amount="${amount}"><div class="cw-bonus-title"><h3>First deposit <b>${amount.toLocaleString('en-IN')}</b></h3><strong>+ ₹${reward.toFixed(2)}</strong></div><p>Your first approved deposit must be exactly ₹${amount.toLocaleString('en-IN')}.</p><div class="cw-bonus-card-bottom"><div class="cw-bonus-progress">Checking…</div><button type="button" data-first-deposit="${amount}" disabled>Deposit</button></div></article>`).join('')}</div>`,`<footer class="cw-bonus-footer"><label><input type="checkbox" id="cw-bonus-mute"><span>No more reminders today</span></label><button type="button" class="cw-popup-primary" id="cw-bonus-activity">Activity</button></footer><button type="button" class="cw-popup-close" aria-label="Close bonus popup">${closeSVG}</button>`);
  const dismiss=()=>{if(host?.querySelector('#cw-bonus-mute')?.checked)write(sessionStorage,'cw_bonus_muted_login_'+sessionKey,today());close();};
  host.querySelector('.cw-popup-close').onclick=dismiss;
  // Checkbox only selects the preference; the close button commits it.
  host.querySelector('#cw-bonus-activity').onclick=()=>{dismiss();skipRoute='#/activity/welcome-bonus';location.hash=skipRoute;};
  host.querySelectorAll('[data-first-deposit]').forEach(button=>button.onclick=()=>{if(button.disabled)return;if(button.dataset.offerClaim==='true'){void claimBonus(host,button);return;}write(sessionStorage,'cw_deposit_prefill_'+owner,button.dataset.firstDeposit);dismiss();location.hash='#/deposit';});
  host.addEventListener('keydown',event=>{if(event.key==='Escape')dismiss();});
  void loadStatus(host,owner);
 }
 async function loadStatus(target,user){
  const notice=target.querySelector('[data-first-deposit-status]');
  const current=()=>target.isConnected&&auth.session?.user?.id===user;
  try{
   const data=user==='preview'?{status:'awaiting_first_deposit',first_amount:null,reward:0}:await auth.accountRpc('colorwin_first_deposit_status');
   if(!current())return;
   const awaiting=data.status==='awaiting_first_deposit',claimed=data.status==='claimed',matched=data.status==='matched'||claimed;
   notice.textContent=awaiting?'Only your first approved deposit counts. Exact amount required; deposits cannot be added together.':claimed?`₹${data.reward} bonus claimed and credited to your wallet.`:matched?`Your first approved deposit of ₹${Number(data.first_amount).toLocaleString('en-IN')} matches the ₹${data.reward} offer. Tap Claim to receive it.`:`Your first approved deposit was ₹${Number(data.first_amount).toLocaleString('en-IN')}. It did not match an offer; later deposits cannot unlock this bonus.`;
   target.querySelectorAll('[data-offer-amount]').forEach(card=>{const amount=Number(card.dataset.offerAmount),isMatch=matched&&amount===Number(data.first_amount);const button=card.querySelector('[data-first-deposit],[data-welcome-deposit]');button.dataset.offerClaim=String(isMatch&&!claimed);button.disabled=!(awaiting||(isMatch&&!claimed));button.textContent=awaiting?'Deposit':isMatch?(claimed?'Claimed':`Claim ₹${data.reward}`):'Unavailable';const progress=card.querySelector('.cw-bonus-progress');if(progress)progress.textContent=awaiting?`0 / ${amount.toLocaleString('en-IN')}`:isMatch?(claimed?'Bonus claimed':'Ready to claim'):'Not eligible';card.classList.toggle('cw-offer-matched',isMatch);});
  }catch{
   if(!current())return;
   notice.textContent='Could not check your first deposit. ';
   const retry=document.createElement('button');retry.type='button';retry.className='cw-offer-retry';retry.textContent='Retry';retry.onclick=()=>{notice.textContent='Checking your first approved deposit…';void loadStatus(target,user);};notice.append(retry);
  }
 }
 async function claimBonus(target,button){
  const user=auth.session?.user?.id;if(!user||button.disabled||button.dataset.offerClaim!=='true')return;
  target.querySelectorAll('[data-first-deposit],[data-welcome-deposit]').forEach(item=>item.disabled=true);button.textContent='Claiming…';
  try{await auth.accountRpc('colorwin_claim_first_deposit');if(!target.isConnected||auth.session?.user?.id!==user)return;await loadStatus(target,user);try{await window.ColorWinAccount?.refreshBalance?.();}catch{}}
  catch(error){if(!target.isConnected||auth.session?.user?.id!==user)return;await loadStatus(target,user);const notice=target.querySelector('[data-first-deposit-status]');notice.textContent=error.message||'Unable to claim. Please try again.';}
 }
 function update(fromTab=false){const next=auth.session?.user?.id||'';const key=next+':'+(auth.session?.user?.last_sign_in_at||'session');if(next!==owner||key!==sessionKey){close();owner=next;sessionKey=key;lastRoute='';skipRoute='';}const route=location.hash;const changed=lastRoute!==route||fromTab;if(changed)routeVersion++;lastRoute=route;if(!next||auth.profile?.is_blocked){close();return;}if(changed)close();if(!['#/home','#/activity','#/tournaments','#/promotion','#/account'].includes(route)){close();return;}if(host)return;if(!read(sessionStorage,'cw_welcome_login_'+sessionKey)){if(document.querySelector('#app')?.firstElementChild)welcome();return;}if(changed&&route!==skipRoute)void bonus();skipRoute='';}
 function section(){return `<section class="cw-welcome-offers"><h2>Extra first deposit bonus</h2><p data-first-deposit-status role="status">Checking your first approved deposit…</p>${offers.map(([amount,reward])=>`<article class="cw-bonus-card" data-offer-amount="${amount}"><div class="cw-bonus-title"><h3>First deposit <b>₹${amount.toLocaleString('en-IN')}</b></h3><strong>+ ₹${reward.toFixed(2)}</strong></div><p>Your first approved deposit must be exactly ₹${amount.toLocaleString('en-IN')}.</p><button type="button" class="cw-popup-primary" data-welcome-deposit="${amount}" disabled>Deposit ₹${amount.toLocaleString('en-IN')}</button></article>`).join('')}</section>`;}
 function bindSection(page){const buttons=page.querySelectorAll('[data-welcome-deposit]');if(!buttons.length)return;buttons.forEach(button=>button.onclick=()=>{const user=auth.session?.user?.id;if(!user||button.disabled)return;if(button.dataset.offerClaim==='true'){void claimBonus(page,button);return;}write(sessionStorage,'cw_deposit_prefill_'+user,button.dataset.welcomeDeposit);location.hash='#/deposit';});void loadStatus(page,auth.session?.user?.id);}
 auth.init(()=>setTimeout(update,0));window.addEventListener('hashchange',()=>setTimeout(update,0));
 document.addEventListener('click',event=>{if(event.target.closest?.('[data-tab-action]'))setTimeout(()=>update(true),0);});
 window.ColorWinWelcome={update,section,bindSection};
})();
