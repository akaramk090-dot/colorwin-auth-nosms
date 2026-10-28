// Local frontend review only. No production accounts or money movement.
window.COLORWIN_PREVIEW=true;
if(new URLSearchParams(location.search).get('demo')==='1'){
  localStorage.setItem('token','colorwin-local-demo');
  localStorage.setItem('tokenHeader','Bearer ');
  localStorage.setItem('userInfo',JSON.stringify({userId:100001,userName:'Colorwin Demo',nickName:'Colorwin Demo',userPhoto:'1',amount:10000,integral:0,vipLevel:1,level:1,mobile:'9000000000',phone:'9000000000',email:'demo@example.test',inviteCode:'COLORWIN',useLanguage:'en',unRead:0,allowNoRechargeGame:'1',canDirectToGame:true,groupDataShowAuth:[],lastLoginTime:'2026-10-23 10:00:00'}));
}
localStorage.setItem('is18','1');
localStorage.setItem('language','en');
if(!sessionStorage.getItem('xosoList'))sessionStorage.setItem('xosoList',JSON.stringify({areInfos:[]}));
// Keep recovered network calls on this local fixture server.
const originalOpen=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(method,url,...args){
  try{const parsed=new URL(url,location.href);if(parsed.origin!==location.origin)url=parsed.pathname+parsed.search;}catch{}
  return originalOpen.call(this,method,url,...args);
};
const originalFetch=window.fetch.bind(window);
window.fetch=function(input,options){
  if(typeof input==='string'){try{const u=new URL(input,location.href);if(u.origin!==location.origin)input=u.pathname+u.search;}catch{}}
  return originalFetch(input,options);
};
if('serviceWorker' in navigator)navigator.serviceWorker.register=()=>Promise.resolve({});
