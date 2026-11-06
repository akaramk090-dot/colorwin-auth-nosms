const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {parseHTML}=require('linkedom');

test('Unknown customer routes render 404 before unauthenticated redirects',()=>{
 for(const hash of ['#/accounts','#/account/unknown','#/activity/unknown']){
  const {window,document}=parseHTML('<html><body><main id="app"></main><div id="toast"></div></body></html>');
  let redirects=0;
  const location={hash,replace:()=>redirects++};
  window.ColorWinAccount={matches:()=>false};
  window.ColorWinAuth={ready:true,session:null,init:render=>render()};
  window.ColorWinLoader={ready:()=>{}};
  const context={window,document,location,ColorWinAuth:window.ColorWinAuth,localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},clearTimeout:()=>{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/app.js'),'utf8'),context);
  assert.match(document.querySelector('#app').textContent,/404Page Not Found/);
  assert.equal(document.querySelector('.route-not-found')!==null,true);
  assert.equal(redirects,0);
 }
 const {window,document}=parseHTML('<html><body><main id="app"></main><div id="toast"></div></body></html>');
 let redirect;
 const location={hash:'#/account',replace:to=>redirect=to};
 window.ColorWinAccount={matches:()=>false};
 window.ColorWinAuth={ready:true,session:null,init:render=>render()};
 window.ColorWinLoader={ready:()=>{}};
 const context={window,document,location,ColorWinAuth:window.ColorWinAuth,localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},clearTimeout:()=>{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/app.js'),'utf8'),context);
 assert.equal(redirect,'#/login');
 assert.equal(document.querySelector('.route-not-found'),null);
});
