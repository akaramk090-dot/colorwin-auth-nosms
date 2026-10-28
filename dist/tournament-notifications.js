(() => {
 'use strict';
 const auth=window.ColorWinAuth;let owner='',busy=false,active=null,queue=[],seen=new Set();
 const storageKey=()=> 'cw_live_match_seen_'+owner;
 function reset(user){document.querySelector('#cw-match-live')?.remove();active=null;queue=[];owner=user;try{seen=new Set(JSON.parse(localStorage.getItem(storageKey())||'[]'));}catch{seen=new Set();}}
 function dismiss(){document.querySelector('#cw-match-live')?.remove();active=null;show();}
 function show(){if(active||!queue.length||document.hidden||document.querySelector('.cw-popup-backdrop,dialog[open]'))return;const notice=queue.shift();active=notice;seen.add(notice.id);try{localStorage.setItem(storageKey(),JSON.stringify([...seen].slice(-200)));}catch{}
  const banner=document.createElement('section');banner.id='cw-match-live';banner.className='cw-match-live';banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');
  banner.innerHTML='<div class="cw-match-live-emblem" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 3h8v5a4 4 0 0 1-8 0V3Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 1v6m-4 3h8m-6-3h4"/></svg></div><div class="cw-match-live-copy"><small>COLOR WIN <span>● MATCH LIVE</span></small><strong></strong><p>Your registered match has started. Open your match to join the room.</p><a class="cw-match-live-join">JOIN MATCH</a></div><button class="cw-match-live-close" type="button" aria-label="Dismiss match notification">×</button>';
  banner.querySelector('strong').textContent=notice.title;const join=banner.querySelector('a');join.href='#/tournaments/'+notice.tournament_id;join.onclick=()=>{document.querySelector('#cw-match-live')?.remove();active=null;};banner.querySelector('button').onclick=dismiss;document.body.append(banner);
 }
 async function poll(){const user=auth.session?.user?.id||'';if(user!==owner)reset(user);if(!owner||owner==='preview'||document.hidden||busy||!window.ColorWinOperations)return;const expected=owner;busy=true;try{const notices=await window.ColorWinOperations.rpc('colorwin_live_match_notices',{});if(expected!==auth.session?.user?.id)return;const ids=new Set(notices.map(n=>n.id));queue=queue.filter(n=>ids.has(n.id));if(active&&!ids.has(active.id)){document.querySelector('#cw-match-live')?.remove();active=null;}for(const notice of [...notices].reverse())if(!seen.has(notice.id)&&!queue.some(n=>n.id===notice.id))queue.push(notice);show();}catch{/* Persistent notices remain in Account notifications; retry on next poll. */}finally{busy=false;}}
 auth.init(()=>{if(auth.ready)poll();});setInterval(poll,5000);window.addEventListener('focus',poll);window.addEventListener('hashchange',poll);document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
})();
