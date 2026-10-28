/* Serve the same fixtures inside Android WebView, without a network backend. */
(()=>{
 const NativeXHR=window.XMLHttpRequest;
 class PreviewXHR extends EventTarget{
  constructor(){super();this.readyState=0;this.status=0;this.statusText='';this.responseText='';this.response=null;this.responseType='';this.responseURL='';this.timeout=0;this.withCredentials=false;this.upload=new EventTarget();this.onloadend=null;this.onreadystatechange=null;this.onload=null;this.onerror=null;this.onabort=null;this.ontimeout=null;this._headers={};}
  open(method,url,async=true,user,password){
   this._method=method;this._url=String(url);this._mock=/\/api\/|\/undefined\//.test(this._url);
   if(!this._mock){this._native=new NativeXHR();for(const type of ['loadstart','progress','readystatechange','load','loadend','error','abort','timeout'])this._native.addEventListener(type,e=>{for(const k of ['readyState','status','statusText','response','responseURL'])this[k]=this._native[k];try{this.responseText=this._native.responseText}catch{}this._emit(type)});this._native.open(method,url,async,user,password);}
   this.readyState=1;this._emit('readystatechange');
  }
  setRequestHeader(k,v){this._headers[k]=v;if(this._native)this._native.setRequestHeader(k,v);}
  getAllResponseHeaders(){return this._native?this._native.getAllResponseHeaders():'content-type: application/json\r\n';}
  getResponseHeader(k){return this._native?this._native.getResponseHeader(k):k.toLowerCase()==='content-type'?'application/json':null;}
  overrideMimeType(v){if(this._native)this._native.overrideMimeType(v);}
  _emit(type){const event=new Event(type);this.dispatchEvent(event);const handler=this['on'+type];if(typeof handler==='function')handler.call(this,event);}
  send(body){
   if(this._native){this._native.timeout=this.timeout;this._native.withCredentials=this.withCredentials;this._native.responseType=this.responseType;return this._native.send(body);}
   this._emit('loadstart');this._timer=setTimeout(async()=>{if(this._aborted)return;let data={};try{data=JSON.parse(body||'{}')}catch{}try{const result=await window.COLORWIN_API.responseFor(this._url,data);this.status=200;this.statusText='OK';this.responseURL=this._url;this.responseText=JSON.stringify(result);this.response=this.responseType==='json'?result:this.responseText;this.readyState=4;this._emit('readystatechange');this._emit('load');this._emit('loadend');}catch(error){this.status=500;this.readyState=4;this._emit('error');this._emit('loadend');console.error(error);}},10);
  }
  abort(){this._aborted=true;clearTimeout(this._timer);if(this._native)this._native.abort();else{this.readyState=0;this._emit('abort');this._emit('loadend');}}
 }
 window.XMLHttpRequest=PreviewXHR;
})();
