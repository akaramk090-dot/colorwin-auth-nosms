const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
const source=fs.readFileSync(path.resolve(__dirname,'../dist/loading.js'),'utf8');

async function setup(){
 const {window,document}=parseHTML('<html><body><main id="app"></main></body></html>');
 vm.runInNewContext(source,{window,document,MutationObserver:window.MutationObserver});
 await new Promise(resolve=>setImmediate(resolve));
 return {window,document,app:document.querySelector('#app')};
}

test('iframe already loaded before loader readiness does not leave overlay stuck',async()=>{
 const {window,document,app}=await setup();
 const frame=document.createElement('iframe');
 frame.setAttribute('src','games/wingo.html');
 app.append(frame);
 await new Promise(resolve=>setImmediate(resolve));
 frame.dispatchEvent(new window.Event('load'));
 window.ColorWinLoader.ready(app);
 assert.equal(app.hasAttribute('aria-busy'),false);
 assert.equal(document.querySelector('#cw-live-loader').hidden,true);
});

test('loader clears when observed iframe loads after readiness',async()=>{
 const {window,document,app}=await setup();
 const frame=document.createElement('iframe');
 frame.setAttribute('src','games/wingo.html');
 app.append(frame);
 await new Promise(resolve=>setImmediate(resolve));
 window.ColorWinLoader.ready(app);
 assert.equal(app.getAttribute('aria-busy'),'true');
 frame.dispatchEvent(new window.Event('load'));
 assert.equal(app.hasAttribute('aria-busy'),false);
 assert.equal(document.querySelector('#cw-live-loader').hidden,true);
});
