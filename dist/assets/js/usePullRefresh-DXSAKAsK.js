import{j as h,C as _,a0 as g,a1 as R,a2 as P}from"./index-Cw-V9aSo.js";var t={pullStartY:null,pullMoveY:null,handlers:[],styleEl:null,events:null,dist:0,state:"pending",timeout:null,distResisted:0,supportsPassive:!1,supportsPointerEvents:typeof window<"u"&&!!window.PointerEvent};try{window.addEventListener("test",null,{get passive(){t.supportsPassive=!0}})}catch{}function w(e){if(!e.ptrElement){var n=document.createElement("div");e.mainElement!==document.body?e.mainElement.parentNode.insertBefore(n,e.mainElement):document.body.insertBefore(n,document.body.firstChild),n.classList.add(e.classPrefix+"ptr"),n.innerHTML=e.getMarkup().replace(/__PREFIX__/g,e.classPrefix),e.ptrElement=n,typeof e.onInit=="function"&&e.onInit(e),t.styleEl||(t.styleEl=document.createElement("style"),t.styleEl.setAttribute("id","pull-to-refresh-js-style"),document.head.appendChild(t.styleEl)),t.styleEl.textContent=e.getStyles().replace(/__PREFIX__/g,e.classPrefix).replace(/\s+/g," ")}return e}function x(e){e.ptrElement&&(e.ptrElement.classList.remove(e.classPrefix+"refresh"),e.ptrElement.style[e.cssProp]="0px",setTimeout(function(){e.ptrElement&&e.ptrElement.parentNode&&(e.ptrElement.parentNode.removeChild(e.ptrElement),e.ptrElement=null),t.state="pending"},e.refreshTimeout))}function T(e){var n=e.ptrElement.querySelector("."+e.classPrefix+"icon"),s=e.ptrElement.querySelector("."+e.classPrefix+"text");n&&(t.state==="refreshing"?n.innerHTML=e.iconRefreshing:n.innerHTML=e.iconArrow),s&&(t.state==="releasing"&&(s.innerHTML=e.instructionsReleaseToRefresh),(t.state==="pulling"||t.state==="pending")&&(s.innerHTML=e.instructionsPullToRefresh),t.state==="refreshing"&&(s.innerHTML=e.instructionsRefreshing))}var r={setupDOM:w,onReset:x,update:T},c,f=function(n){return t.pointerEventsEnabled&&t.supportsPointerEvents?n.screenY:n.touches[0].screenY},m=(function(){var e;function n(i){var l=t.handlers.filter(function(E){return E.contains(i.target)})[0];t.enable=!!l,l&&t.state==="pending"&&(e=r.setupDOM(l),l.shouldPullToRefresh()&&(t.pullStartY=f(i)),clearTimeout(t.timeout),r.update(l))}function s(i){if(e&&e.ptrElement&&t.enable){if(t.pullStartY?t.pullMoveY=f(i):e.shouldPullToRefresh()&&(t.pullStartY=f(i)),t.state==="refreshing"){i.cancelable&&e.shouldPullToRefresh()&&t.pullStartY<t.pullMoveY&&i.preventDefault();return}t.state==="pending"&&(e.ptrElement.classList.add(e.classPrefix+"pull"),t.state="pulling",r.update(e)),t.pullStartY&&t.pullMoveY&&(t.dist=t.pullMoveY-t.pullStartY),t.distExtra=t.dist-e.distIgnore,t.distExtra>0&&(i.cancelable&&i.preventDefault(),e.ptrElement.style[e.cssProp]=t.distResisted+"px",t.distResisted=e.resistanceFunction(t.distExtra/e.distThreshold)*Math.min(e.distMax,t.distExtra),t.state==="pulling"&&t.distResisted>e.distThreshold&&(e.ptrElement.classList.add(e.classPrefix+"release"),t.state="releasing",r.update(e)),t.state==="releasing"&&t.distResisted<e.distThreshold&&(e.ptrElement.classList.remove(e.classPrefix+"release"),t.state="pulling",r.update(e)))}}function o(){if(e&&e.ptrElement&&t.enable){if(clearTimeout(c),c=setTimeout(function(){e&&e.ptrElement&&t.state==="pending"&&r.onReset(e)},500),t.state==="releasing"&&t.distResisted>e.distThreshold)t.state="refreshing",e.ptrElement.style[e.cssProp]=e.distReload+"px",e.ptrElement.classList.add(e.classPrefix+"refresh"),t.timeout=setTimeout(function(){var i=e.onRefresh(function(){return r.onReset(e)});i&&typeof i.then=="function"&&i.then(function(){return r.onReset(e)}),!i&&!e.onRefresh.length&&r.onReset(e)},e.refreshTimeout);else{if(t.state==="refreshing")return;e.ptrElement.style[e.cssProp]="0px",t.state="pending"}r.update(e),e.ptrElement.classList.remove(e.classPrefix+"release"),e.ptrElement.classList.remove(e.classPrefix+"pull"),t.pullStartY=t.pullMoveY=null,t.dist=t.distResisted=0}}function u(){e&&e.mainElement.classList.toggle(e.classPrefix+"top",e.shouldPullToRefresh())}var a=t.supportsPassive?{passive:t.passive||!1}:void 0;return t.pointerEventsEnabled&&t.supportsPointerEvents?(window.addEventListener("pointerup",o),window.addEventListener("pointerdown",n),window.addEventListener("pointermove",s,a)):(window.addEventListener("touchend",o),window.addEventListener("touchstart",n),window.addEventListener("touchmove",s,a)),window.addEventListener("scroll",u),{onTouchEnd:o,onTouchStart:n,onTouchMove:s,onScroll:u,destroy:function(){t.pointerEventsEnabled&&t.supportsPointerEvents?(window.removeEventListener("pointerdown",n),window.removeEventListener("pointerup",o),window.removeEventListener("pointermove",s,a)):(window.removeEventListener("touchstart",n),window.removeEventListener("touchend",o),window.removeEventListener("touchmove",s,a)),window.removeEventListener("scroll",u)}}}),y=`
<div class="__PREFIX__box">
  <div class="__PREFIX__content">
    <div class="__PREFIX__icon"></div>
    <div class="__PREFIX__text"></div>
  </div>
</div>
`,L=`
.__PREFIX__ptr {
  box-shadow: inset 0 -3px 5px rgba(0, 0, 0, 0.12);
  pointer-events: none;
  font-size: 0.85em;
  font-weight: bold;
  top: 0;
  height: 0;
  transition: height 0.3s, min-height 0.3s;
  text-align: center;
  width: 100%;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  align-content: stretch;
}

.__PREFIX__box {
  padding: 10px;
  flex-basis: 100%;
}

.__PREFIX__pull {
  transition: none;
}

.__PREFIX__text {
  margin-top: .33em;
  color: rgba(0, 0, 0, 0.3);
}

.__PREFIX__icon {
  color: rgba(0, 0, 0, 0.3);
  transition: transform .3s;
}

/*
When at the top of the page, disable vertical overscroll so passive touch
listeners can take over.
*/
.__PREFIX__top {
  touch-action: pan-x pan-down pinch-zoom;
}

.__PREFIX__release .__PREFIX__icon {
  transform: rotate(180deg);
}
`,d={distThreshold:60,distMax:80,distReload:50,distIgnore:0,mainElement:"body",triggerElement:"body",ptrElement:".ptr",classPrefix:"ptr--",cssProp:"min-height",iconArrow:"&#8675;",iconRefreshing:"&hellip;",instructionsPullToRefresh:"Pull down to refresh",instructionsReleaseToRefresh:"Release to refresh",instructionsRefreshing:"Refreshing",refreshTimeout:500,getMarkup:function(){return y},getStyles:function(){return L},onInit:function(){},onRefresh:function(){return location.reload()},resistanceFunction:function(e){return Math.min(1,e/2.5)},shouldPullToRefresh:function(){return!window.scrollY}},M=["mainElement","ptrElement","triggerElement"],p=(function(e){var n={};return Object.keys(d).forEach(function(s){n[s]=e[s]||d[s]}),n.refreshTimeout=typeof e.refreshTimeout=="number"?e.refreshTimeout:d.refreshTimeout,M.forEach(function(s){typeof n[s]=="string"&&(n[s]=document.querySelector(n[s]))}),t.events||(t.events=m()),n.contains=function(s){return n.triggerElement.contains(s)},n.destroy=function(){clearTimeout(t.timeout);var s=t.handlers.indexOf(n);t.handlers.splice(s,1)},n}),v={setPassiveMode:function(n){t.passive=n},setPointerEventsMode:function(n){t.pointerEventsEnabled=n},destroyAll:function(){t.events&&(t.events.destroy(),t.events=null),t.handlers.forEach(function(n){n.destroy()})},init:function(n){n===void 0&&(n={});var s=p(n);return t.handlers.push(s),s},_:{setupHandler:p,setupEvents:m,setupDOM:r.setupDOM,onReset:r.onReset,update:r.update}};function I(e){const n=h();return _(()=>{const s="refresh"+R();n.value&&n.value.setAttribute("id",s),setTimeout(()=>{const o=P.messages();v.init({mainElement:"#"+s,triggerElement:"body",onRefresh(){e()},instructionsReleaseToRefresh:o.vanPullRefresh.loosing,instructionsPullToRefresh:o.vanPullRefresh.pulling,instructionsRefreshing:o.loading})},200)}),g(()=>{v.destroyAll()}),{elementRef:n}}export{I as u};
