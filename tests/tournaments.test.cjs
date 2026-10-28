const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dist=path.resolve(__dirname,'../dist');
test('Main status tabs separate registered matches from all live matches',async()=>{
 const {parseHTML}=require('linkedom'),{document}=parseHTML('<html><body><section class="tn-page"><main class="tn-content"></main></section></body></html>');
 const tournaments=['open','live','completed','live','open'].map((status,i)=>({id:'m'+i,title:'Match '+i,status,game:'ff',mode:'Solo',banner:'assets/tournaments/free-fire-10x-green-prizes.png',starts_at:new Date().toISOString(),capacity:48}));
 const entries=[0,1,2,4].map(i=>({tournament_id:'m'+i,status:i===4?'cancelled':'joined',player_id:'1234567'}));
 const ctx={document,window:{ColorWinAuth:{session:{user:{id:'player'}}},ColorWinOperations:{preview:()=>false,rpc:async()=>({tournaments,entries})},dispatchEvent:()=>{}},Event:class{},setInterval:()=>1,clearInterval:()=>{}};
 vm.runInNewContext(fs.readFileSync(path.join(dist,'tournaments.js'),'utf8'),ctx);const api=ctx.window.ColorWinTournaments;await api.bind();document.body.innerHTML=api.view('#/tournaments');await api.bind();
 assert.equal(document.querySelector('.tn-owned-panel'),null);
 assert.deepEqual([...document.querySelectorAll('[data-tn-status]')].map(x=>x.textContent),['Upcoming','Registered','Live','Completed']);
 document.querySelector('[data-tn-status="registered"]').onclick();let text=document.querySelector('#tn-list').textContent;for(const i of [0,1,2])assert.match(text,new RegExp('Match '+i));assert.doesNotMatch(text,/Match 3|Match 4/);
 document.querySelector('[data-tn-status="live"]').onclick();text=document.querySelector('#tn-list').textContent;assert.match(text,/Match 1/);assert.match(text,/Match 3/);assert.doesNotMatch(text,/Match 0|Match 2/);
 assert.match(api.view('#/tournaments/m0'),/You are registered/);
});
test('Live joining count closes an open registration form when the last slot fills',async()=>{
 const {parseHTML}=require('linkedom');const {document}=parseHTML('<section class="tn-page" data-tn-route="#/tournaments/m"><main class="tn-content"></main></section>');let tick;
 const match={id:'m',game:'ff',title:'Fullness test',mode:'Solo',status:'open',banner:'assets/tournaments/free-fire-red.png',entry_fee:0,prize_pool:500,starts_at:'2020-10-07T13:00:00Z',capacity:48,joined_count:1};let alerts=[];
 const ctx={document,window:{ColorWinAuth:{session:{user:{id:'member'}},profile:{public_uid:654321}},ColorWinOperations:{preview:()=>false,rpc:async()=>({tournaments:[{...match}],entries:[]})},ColorWinAccount:{load:async()=>{},balance:()=>0},dispatchEvent:()=>{},toast:x=>alerts.push(x)},Event:class{},setInterval:f=>{tick=f;return 1;},clearInterval:()=>{}};
 vm.runInNewContext(fs.readFileSync(path.join(dist,'tournaments.js'),'utf8'),ctx);await ctx.window.ColorWinTournaments.bind();
 const body=ctx.window.ColorWinTournaments.view('#/tournaments/m');document.body.innerHTML=body;await ctx.window.ColorWinTournaments.bind();assert.ok(document.querySelector('#tn-join'));assert.match(document.querySelector('[data-joining]').textContent,/1\/48/);
 match.joined_count=48;await tick();assert.equal(document.querySelector('#tn-join'),null);assert.match(document.querySelector('[data-joining]').textContent,/48\/48/);assert.deepEqual(alerts,['Registration closed']);
});
test('Published and newly created cards share timing, registration and verified account UID layout',async()=>{
 const {parseHTML}=require('linkedom');const {document}=parseHTML('<section class="tn-page"><main class="tn-content"></main></section>');
 const tournaments=[1,2].map(n=>({id:'match-'+n,game:'ff',title:'Admin match '+n,mode:'Solo',status:'open',banner:'assets/tournaments/free-fire-red.png',entry_fee:50,prize_pool:500,starts_at:'2026-10-07T13:00:00Z',capacity:48,rules:'Match rules text'}));
 const ctx={document,window:{ColorWinAuth:{session:{user:{id:'member'}},profile:{public_uid:654321}},ColorWinOperations:{preview:()=>false,rpc:async()=>({tournaments,entries:[]})},dispatchEvent:()=>{}},Event:class{}};
 vm.runInNewContext(fs.readFileSync(path.join(dist,'tournaments.js'),'utf8'),ctx);await ctx.window.ColorWinTournaments.bind();
 const api=ctx.window.ColorWinTournaments;const listDoc=parseHTML(api.view('#/tournaments')).document;
 assert.equal(listDoc.querySelectorAll('.tn-card').length,2);
 for(const card of listDoc.querySelectorAll('.tn-card')){assert.match(card.querySelector('.tn-timing').textContent,/Timing.*7 Oct 6:30 pm/);assert.equal(card.querySelector('.tn-details').textContent.trim(),'Register now');assert.ok(card.querySelector('img.cw-trophy'));}
 const detail=parseHTML(api.view('#/tournaments/match-2')).document;
 const form=detail.querySelector('#tn-join');assert.equal(form.querySelector('[name=colorwin_uid]').value,'654321');assert.ok(form.querySelector('[name=colorwin_uid]').hasAttribute('readonly'));
 assert.equal(form.querySelector('[name=player_name]'),null);
 assert.ok(detail.querySelector('.tn-content').innerHTML.indexOf('id="tn-join"')<detail.querySelector('.tn-content').innerHTML.indexOf('Match rules'));
});
test('Account balance refresh updates Home and tournament headers and rejects stale account responses',async()=>{
 const home={textContent:'₹—'},tournament={textContent:'₹—'};let resolve;
 const ctx={window:{ColorWinAuth:{session:{user:{id:'a'}},accountRpc:async()=>({balance:750})}},document:{querySelectorAll:s=>s.includes('.home-balance-value')?[home,tournament]:[]},localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null}};
 vm.runInNewContext(fs.readFileSync(path.join(dist,'account-pages.js'),'utf8'),ctx);
 await ctx.window.ColorWinAccount.refreshBalance();assert.match(home.textContent,/750/);assert.equal(home.textContent,tournament.textContent);
 ctx.window.ColorWinAuth.accountRpc=()=>new Promise(r=>resolve=r);const pending=ctx.window.ColorWinAccount.refreshBalance();ctx.window.ColorWinAuth.session.user.id='b';home.textContent='₹—';resolve({balance:999});await pending;assert.equal(home.textContent,'₹—');
});
function load(){const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(dist,'tournaments.js'),'utf8'),ctx);return ctx.window.ColorWinTournaments;}
test('Both game filters show only the selected game and empty statuses show no fake running matches',()=>{const api=load();for(const game of ['ff','pubg']){const html=api.list(game);assert.equal((html.match(/class="tn-card tn-/g)||[]).length,api.events.filter(m=>m.game===game).length);assert.ok(!html.includes('class="tn-card tn-'+(game==='ff'?'pubg':'ff')+'"'));}assert.match(api.list('all','live'),/No live matches yet/);assert.match(api.list('ff','completed'),/No completed matches yet/);});
test('Every match has reachable details and registration remains unavailable in this UI-only release',()=>{const api=load();for(const m of api.events){const route='#/tournaments/'+m.id;assert.ok(api.matches(route));const html=api.view(route);assert.ok(html.includes(m.title));assert.match(html,/disabled>Registration opens soon/);assert.match(html,/To be announced/);assert.match(html,/Available after registration/);}assert.match(api.view('#/tournaments/my-matches'),/Your next match is waiting/);});
test('Navigation uses the new PNG and Tournaments route; all UI assets are bundled',()=>{const api=load(),app=fs.readFileSync(path.join(dist,'app.js'),'utf8'),index=fs.readFileSync(path.join(dist,'index.html'),'utf8');assert.match(app,/data-tab-action="tournaments"/);assert.match(app,/tournaments: '#\/tournaments'/);assert.doesNotMatch(app,/Get ₹500|ColorWinTurntable/);assert.doesNotMatch(index,/turntable\.js|turntable\.css/);assert.match(index,/tournaments\.js/);for(const route of ['#/tournaments','#/tournaments/my-matches',...api.events.map(m=>'#/tournaments/'+m.id)])for(const [,asset]of api.view(route).matchAll(/src="(assets\/[^\"]+)"/g))assert.ok(fs.existsSync(path.join(dist,decodeURIComponent(asset))),asset);const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(dist,'activity.js'),'utf8'),ctx);assert.equal(ctx.window.ColorWinActivity.activityItems.find(i=>i.id==='tournaments').route,'#/tournaments');});

test('Tournament wallet loads the account balance and rejects late data after an account switch',async()=>{
 const ctx={window:{ColorWinAuth:{session:{user:{id:'owner-a'}}},ColorWinAccount:{load:async()=>{},balance:()=>1234.5}}};
 const target={textContent:'₹—',closest:()=>({title:''})};const page={isConnected:true,querySelector:s=>s==='[data-tn-wallet-value]'?target:null,querySelectorAll:()=>[]};ctx.document={querySelector:()=>page};
 vm.runInNewContext(fs.readFileSync(path.join(dist,'tournaments.js'),'utf8'),ctx);
 await ctx.window.ColorWinTournaments.bind();assert.equal(target.textContent,'₹1,234.50');assert.match(ctx.window.ColorWinTournaments.view('#/tournaments'),/href="#\/deposit"/);
 let resolve;ctx.window.ColorWinAccount.load=()=>new Promise(r=>resolve=r);target.textContent='₹—';const pending=ctx.window.ColorWinTournaments.bind();ctx.window.ColorWinAuth.session.user.id='owner-b';resolve();await pending;assert.equal(target.textContent,'₹—');
});
test('An unavailable wallet is displayed as unknown instead of a made-up zero balance',async()=>{
 const link={title:''},target={textContent:'₹—',closest:()=>link};const page={isConnected:true,querySelector:s=>s==='[data-tn-wallet-value]'?target:null,querySelectorAll:()=>[]};
 const ctx={document:{querySelector:()=>page},window:{ColorWinAuth:{session:{user:{id:'real'}}},ColorWinAccount:{load:async()=>{throw Error('Unavailable');},balance:()=>0}}};vm.runInNewContext(fs.readFileSync(path.join(dist,'tournaments.js'),'utf8'),ctx);await ctx.window.ColorWinTournaments.bind();assert.equal(target.textContent,'₹—');assert.match(link.title,/unavailable/);
});

test('Registered live players open room invite links; live polling enables Join room',async()=>{
 const {parseHTML}=require('linkedom'),{document}=parseHTML('<html><body><section class="tn-page"><main class="tn-content"></main></section></body></html>');let tick,opened;
 const m={id:'match-room',game:'ff',title:'Room link match',mode:'Solo',status:'open',banner:'assets/tournaments/free-fire-red.png',entry_fee:10,prize_pool:100,capacity:48,starts_at:new Date().toISOString()};
 const link='https://ffshare.garena.com/?region=IND&action=qrcode_room_invite_link&room_id=123';
 const ctx={document,URL,window:{location:{assign:v=>opened=v},ColorWinAuth:{session:{user:{id:'registered'}}},ColorWinAccount:{load:async()=>{},balance:()=>100},ColorWinOperations:{preview:()=>false,rpc:async(name,args)=>args.p_action==='room'?{room_link:link}:{tournaments:[m],entries:[{tournament_id:m.id}]}},dispatchEvent:()=>{}},Event:class{},setInterval:fn=>{tick=fn;return 1;},clearInterval:()=>{}};
 vm.runInNewContext(fs.readFileSync(path.join(dist,'tournaments.js'),'utf8'),ctx);const api=ctx.window.ColorWinTournaments;await api.bind();document.body.innerHTML=api.view('#/tournaments/'+m.id);await api.bind();const b=document.querySelector('[data-tn-room]');assert.equal(b.textContent,'JOIN MATCH');assert.equal(b.disabled,true);m.status='live';await tick();assert.equal(b.disabled,false);await b.onclick();assert.equal(opened,link);m.status='completed';await tick();assert.equal(b.disabled,true);
});
test('Registration confirms on the same match, prevents double submit and keeps errors in the form',async()=>{
 for(const fail of [false,true]){
 const {parseHTML}=require('linkedom'),{document,window}=parseHTML('<html><body><section class="tn-page"><main class="tn-content"></main></section></body></html>');const id='registered-match',route='#/tournaments/'+id,m={id,game:'ff',title:'Registration test',mode:'Solo',status:'open',banner:'assets/tournaments/free-fire-red.png',entry_fee:10,prize_pool:100,capacity:48,joined_count:0,starts_at:new Date().toISOString()};let finish,requests=0,rerenders=0;const alerts=[],location={hash:route};
 const ctx={document,location,window:{ColorWinAuth:{session:{user:{id:'player'}},profile:{public_uid:123456}},ColorWinAccount:{load:async()=>{},balance:()=>100},ColorWinOperations:{preview:()=>false,rpc:async(name,args)=>{if(args.p_action==='join'){requests++;return new Promise((resolve,reject)=>finish=()=>fail?reject(Error('Registration closed')):resolve({id:'entry',tournament_id:id,status:'joined'}));}return {tournaments:[m],entries:[]};}},toast:(...args)=>alerts.push(args),dispatchEvent:()=>{rerenders++;alerts.length=0;}},Event:class{}};
 vm.runInNewContext(fs.readFileSync(path.join(dist,'tournaments.js'),'utf8'),ctx);const api=ctx.window.ColorWinTournaments;await api.bind();document.body.innerHTML=api.view(route);await api.bind();const form=document.querySelector('#tn-join');Object.defineProperty(form,'elements',{value:{player_id:{value:'12345678'}}});form.dispatchEvent(new window.Event('submit',{cancelable:true}));form.dispatchEvent(new window.Event('submit',{cancelable:true}));assert.equal(requests,1);finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(location.hash,route);
 if(fail){assert.equal(form.querySelector('button').disabled,false);assert.match(form.querySelector('[role=alert]').textContent,/Registration closed/);assert.equal(alerts[0][1],true);}else{assert.deepEqual(alerts,[['Registration confirmed',false,4500]]);assert.match(api.view(route),/You are registered/);assert.doesNotMatch(api.view(route),/id="tn-join"/);assert.equal(rerenders,2);}
 }
});
