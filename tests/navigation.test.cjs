const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function setup(length){
 let click,backs=0;
 const context={window:{},document:{addEventListener:(name,fn)=>{click=fn;}},history:{length,back:()=>backs++}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/navigation.js'),'utf8'),context);
 return {context,click,backs:()=>backs};
}
test('Back returns to previous history entry instead of the Settings fallback link',()=>{
 const nav=setup(3);let prevented=false,stopped=false;
 nav.click({target:{closest:()=>({href:'#/account/settings'})},button:0,preventDefault:()=>prevented=true,stopImmediatePropagation:()=>stopped=true});
 assert.equal(nav.backs(),1);assert.equal(prevented,true);assert.equal(stopped,true);
});
test('Direct entry preserves the original fallback and modified clicks preserve normal link behavior',()=>{
 for(const [length,ctrlKey] of [[1,false],[3,true]]){
  const nav=setup(length);
  nav.click({target:{closest:()=>({})},button:0,ctrlKey,preventDefault:()=>assert.fail('Default link should remain active'),stopImmediatePropagation:()=>assert.fail('Original handler should remain active')});
  assert.equal(nav.backs(),0);
 }
});
test('Header back controls receive the same accessible SVG',()=>{
 const nav=setup(1),classes=[],attributes={};
 const button={innerHTML:'‹',classList:{add:value=>classes.push(value)},dataset:{},hasAttribute:()=>false,setAttribute:(name,value)=>attributes[name]=value};
 nav.context.window.ColorWinNavigation.bind({querySelectorAll:()=>[button]});
 assert.match(button.innerHTML,/<svg.*aria-hidden="true"/);assert.doesNotMatch(button.innerHTML,/‹/);
 assert.equal(attributes['aria-label'],'Go back');assert.ok(classes.includes('cw-back-button'));
});
