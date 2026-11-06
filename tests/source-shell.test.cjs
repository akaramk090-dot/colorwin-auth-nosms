const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function setup(games){
 const listeners={};const responses=[];const notices=[];
 const frame={isConnected:true,contentWindow:{postMessage:message=>responses.push(message)},closest:()=>root};
 const root={hidden:false,classList:{toggle(){}}};
 const location={hash:'#/home',origin:'http://127.0.0.1:5173'};
 const window={
  ColorWinAuth:{session:{user:{id:'user-1'}}},
  ColorWinGamesData:{gamesCatalog:games},
  toast:message=>notices.push(message),
  addEventListener:(name,handler)=>{listeners[name]=handler;}
 };
 const document={querySelector:()=>frame};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/source-shell.js'),'utf8'),{window,document,location,AbortController,WeakMap});
 window.ColorWinSourceHome.bind();
 return {frame,listeners,location,responses,notices};
}

function request(app,name){
 app.listeners.message({source:app.frame.contentWindow,origin:app.location.origin,data:{type:'cw-source-request',key:'test-key',action:'catalog-game',name}});
}

test('Home opens implemented games using their existing routes',()=>{
 const app=setup([{id:'wingo',name:'Win Go',route:'#/games/play/wingo'}]);
 request(app,'Win Go');
 assert.equal(app.location.hash,'#/games/play/wingo');
 assert.deepEqual(app.notices,[]);
 assert.equal(app.responses[0].result.handled,true);
});

test('Home opens the locally implemented Mines demo even without a catalog entry',()=>{
 const app=setup([]);
 request(app,'Mines');
 assert.equal(app.location.hash,'#/games/play/mines');
 assert.deepEqual(app.notices,[]);
});

test('Home shows Coming soon for games without a playable implementation',()=>{
 const app=setup([{id:'royal-fishing',name:'Royal Fishing',route:'#/games/play/royal-fishing'}]);
 request(app,'Royal Fishing');
 assert.equal(app.location.hash,'#/home');
 assert.deepEqual(app.notices,['Coming soon']);
 assert.equal(app.responses[0].result.handled,true);
});

test('Unmatched Home games also show Coming soon without navigating',()=>{
 const app=setup([]);
 request(app,'Not in the local catalog');
 assert.equal(app.location.hash,'#/home');
 assert.deepEqual(app.notices,['Coming soon']);
 assert.equal(app.responses[0].result.handled,true);
});
