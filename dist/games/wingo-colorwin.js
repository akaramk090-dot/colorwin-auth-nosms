(() => {
  const svg=path=>`<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
  const iconImage=file=>`<img class="cw-header-icon" src="../assets/png/${file}" alt="" aria-hidden="true" draggable="false">`;
  const back=svg('<path d="m14 5-7 7 7 7"/>'),support=iconImage('kefu-CWn8Xwlr.png'),music=iconImage('voice-B3roEJIA.png'),muted=iconImage('voice-off-Bu6YwZ1J.png');
  function send(action){if(parent!==window)parent.postMessage({type:'cw-wingo-ui',action},'*');else if(action!=='balance')location.href='../#/'+action;}
  const backBtn=document.querySelector('#backBtn');backBtn.innerHTML=back;backBtn.onclick=()=>send('home');
  const actions=document.createElement('div');actions.className='header-actions';actions.innerHTML=`<button type="button" class="head-icon" id="cwSupport" aria-label="Support">${support}</button><button type="button" class="head-icon" id="cwMusic" aria-label="Toggle music" aria-pressed="true">${music}</button>`;document.querySelector('.header').append(actions);document.querySelector('#cwSupport').onclick=()=>send('support');
  let soundOn=window.ColorWinWingoSound!==false;const musicBtn=document.querySelector('#cwMusic');function paintSound(){musicBtn.innerHTML=soundOn?music:muted;musicBtn.setAttribute('aria-pressed',String(soundOn));}paintSound();musicBtn.onclick=()=>{document.querySelector('#soundBtn').click();soundOn=window.ColorWinWingoSound!==false;paintSound();};
  document.querySelector('#content').addEventListener('click',async event=>{const button=event.target.closest('.cw-copy-order');if(!button)return;try{await navigator.clipboard.writeText(button.dataset.order);if(parent!==window)parent.postMessage({type:'cw-wingo-alert',message:'Order number copied'},'*');else window.dispatchEvent(new CustomEvent('cw-default-alert',{detail:{message:'Order number copied'}}));}catch{if(parent!==window)parent.postMessage({type:'cw-wingo-alert',message:'Copy unavailable in this browser'},'*');}});
  let defaultAlertTimer;
  window.addEventListener('cw-default-alert',event=>{const alert=document.querySelector('#toast');clearTimeout(defaultAlertTimer);alert.replaceChildren();const icon=document.createElement('span');icon.className='toast-icon';icon.textContent='i';icon.setAttribute('aria-hidden','true');const text=document.createElement('span');text.textContent=String(event.detail.message);alert.append(icon,text);alert.classList.add('cw-default-toast','show');defaultAlertTimer=setTimeout(()=>alert.classList.remove('show'),3000);});
  const card=document.createElement('section');card.className='cw-real-wallet';card.setAttribute('aria-label','Color Win wallet');card.innerHTML=`<div class="cw-wallet-value"><strong id="cwRealBalance">—</strong><button type="button" id="cwWalletRefresh" aria-label="Refresh wallet">${svg('<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>')}</button></div><p class="cw-wallet-caption">${svg('<path d="M4 5h15v3H5a2 2 0 0 0 0 4h16v8H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm12 9v3h5v-3Z"/>')}Color Win wallet balance</p><div class="cw-wallet-actions"><button type="button" data-cw-nav="withdraw">Withdraw</button><button type="button" data-cw-nav="deposit">Deposit</button></div><p class="cw-wallet-error" hidden></p><p class="cw-demo-caption">Wingo bets currently use separate demo credits.</p>`;document.querySelector('.header').after(card);card.querySelectorAll('[data-cw-nav]').forEach(b=>b.onclick=()=>send(b.dataset.cwNav));
  const error=card.querySelector('.cw-wallet-error');function refresh(){if(parent===window){error.hidden=false;error.textContent='Open Wingo inside your signed-in Color Win account to load balance.';return;}send('balance');}document.querySelector('#cwWalletRefresh').onclick=refresh;
  window.addEventListener('message',event=>{if(event.source!==parent||event.data?.type!=='cw-wingo-balance')return;const value=event.data.balance;if(event.data.error||typeof value!=='number'||!Number.isFinite(value)){error.hidden=false;error.textContent='Wallet unavailable. Sign in and refresh.';document.querySelector('#cwRealBalance').textContent='—';return;}error.hidden=true;document.querySelector('#cwRealBalance').textContent='₹'+value.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});});refresh();
  document.querySelector('#helpBtnMini').innerHTML=svg('<path d="M7 3h10v18H7zM9 7h6M9 11h6M9 15h4M5 3h2M5 21h2"/>')+'<span>How to play</span>';
  const countdown=document.createElement('div');countdown.className='cw-countdown';countdown.hidden=true;countdown.setAttribute('aria-label','Betting closes countdown');countdown.innerHTML='<div><span>0</span><span>5</span></div>';const bettingArea=document.createElement('div');bettingArea.className='cw-betting-area';const firstControl=document.querySelector('.colors'),lastControl=document.querySelector('.size-actions');firstControl.before(bettingArea);let control=firstControl;while(control){const next=control.nextElementSibling;bettingArea.append(control);if(control===lastControl)break;control=next;}bettingArea.append(countdown);
  const betOverlay=document.querySelector('#betOverlay');
  window.addEventListener('cw-wingo-selection',event=>{const selection=String(event.detail.selection);let theme=selection.toLowerCase();if(/^\d$/.test(selection)){const n=Number(selection);theme=n===0?'red-violet':n===5?'green-violet':n%2===0?'red':'green';}betOverlay.dataset.theme=theme;});
  const success=document.createElement('div');success.className='cw-bet-success';success.setAttribute('role','status');success.hidden=true;document.body.append(success);let successTimer;
  window.addEventListener('cw-wingo-bet-success',()=>{clearTimeout(successTimer);success.textContent='Bet Successful';success.hidden=false;successTimer=setTimeout(()=>{success.hidden=true;},1800);});
  window.addEventListener('cw-wingo-wallet',event=>{error.hidden=true;document.querySelector('#cwRealBalance').textContent='₹'+Number(event.detail.balance).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});});
  let audioContext=null,audioBuffer=null,audioLoading=null,source=null,roundKey='',lastTick=null,latestClock=null;
  function haltAudio(){if(source){try{source.stop();}catch{}source=null;}}
  async function prepareAudio(){
    const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
    audioContext=audioContext||new Context();
    // Resume synchronously from a user gesture before awaiting asset loading.
    const resume=audioContext.resume();
    if(!audioLoading)audioLoading=Promise.resolve().then(()=>{if(!window.ColorWinCountdownAudio)throw Error('Countdown audio unavailable');const raw=atob(window.ColorWinCountdownAudio);const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));return audioContext.decodeAudioData(bytes.buffer);}).then(buffer=>{audioBuffer=buffer;}).catch(()=>{audioLoading=null;});
    await resume;await audioLoading;playCountdown();
  }
  function playCountdown(){
    const t=latestClock;if(!soundOn||document.hidden||!t||t.remaining>5||!audioBuffer||audioContext?.state!=='running')return;
    const key=t.lane+':'+t.index;if(roundKey===key)return;
    haltAudio();const elapsed=(Date.now()-t.received)/1000;const left=t.leftMs/1000-elapsed;if(left<=0)return;
    source=audioContext.createBufferSource();source.buffer=audioBuffer;source.connect(audioContext.destination);
    // The supplied full sequence starts with five; seek by elapsed countdown time.
    const offset=Math.max(0,5-left);if(offset>=audioBuffer.duration)return;
    source.start(0,offset,Math.min(left,audioBuffer.duration-offset));roundKey=key;
  }
  document.addEventListener('pointerdown',()=>{if(soundOn)prepareAudio().catch(()=>{});},{passive:true});
  document.addEventListener('keydown',()=>{if(soundOn)prepareAudio().catch(()=>{});});
  function stop(){haltAudio();for(const el of bettingArea.children)if(el!==countdown)el.inert=false;countdown.hidden=true;lastTick=null;roundKey='';}
  window.addEventListener('cw-wingo-clock',event=>{const t=event.detail;latestClock={...t,received:Date.now()};if(t.remaining>5||document.hidden){stop();return;}betOverlay.classList.remove('open');for(const el of bettingArea.children)if(el!==countdown)el.inert=true;countdown.hidden=false;countdown.querySelector('span:last-child').textContent=String(t.remaining);if(lastTick!==t.remaining){lastTick=t.remaining;countdown.dataset.second=String(t.remaining);}playCountdown();});
  musicBtn.addEventListener('click',()=>{if(!soundOn){haltAudio();roundKey='';}else prepareAudio().catch(()=>{});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',()=>{stop();audioContext?.close().catch(()=>{});});
  card.querySelector('.cw-demo-caption').remove();
})();
