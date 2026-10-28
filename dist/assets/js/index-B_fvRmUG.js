import{a3 as k,b,l as h,r as B,C as P,A as C,aS as M,_ as x,P as m,H as o,I as a,Q as R,ac as $,T as t,U as i,af as y,ag as f}from"./index-Cw-V9aSo.js";const w=k({__name:"index",setup(g,{expose:s}){s();const{t:l}=b(),e=h(),r=B([{title:l("betAmounts"),body:[]},{title:l("rewordPercent"),body:[]}]),d=async()=>{const c=await C(M());c&&c.data.map(p=>(r[0].body.push(p.lotteryAmount+""),r[1].body.push(p.exchange_Rate*1e3*100/1e3+"%"),p))};P(()=>{d()});function _(){e.back()}const n={$t:l,router:e,pointRule:r,getProductRules:d,onClick:_,toBet:()=>{sessionStorage.setItem("clickedGameType","lottery"),e.push({path:"/"})}};return Object.defineProperty(n,"__isScriptSetup",{enumerable:!1,value:!0}),n}}),A={class:"pointMall-rule__container content"},N={class:"pointMall-rule__container-pointRule"},S={class:"pointMall-rule__container-pointRule__title"},I={class:"pointMall-rule__container-pointRule__body"},V={class:"toBet"};function j(g,s,l,e,r,d){const _=m("NavBar"),v=m("van-icon");return o(),a("div",A,[R(_,{title:e.$t("pointsRule"),"left-arrow":"",onClickLeft:e.onClick},null,8,["title"]),$(` <div class="pointMall-rule__container-claimRule">
			<div class="pointMall-rule__container-claimRule__title">1.{{ $t('claimPoints') }}</div>
			<div class="pointMall-rule__container-claimRule__body">
				<div>{{ $t('descRules1') }}</div>
				<div>
					<p>{{ $t('inviteFriends') }}</p>
					<p>{{ $t('earnPoints') }}</p>
				</div>
				<div @click="router.push({ path: '/main/InvitationBonus' })">
					<span> {{ $t('toClaim') }} </span>
					<van-icon name="upgrade" />
				</div>
			</div>
		</div> `),t("div",N,[t("div",S,i(e.$t("bonusPoints")),1),t("div",I,[t("div",null,i(e.$t("descRules2")),1),t("div",null,[(o(!0),a(y,null,f(e.pointRule,(n,c)=>(o(),a("div",{key:c},[t("p",null,i(n.title),1),(o(!0),a(y,null,f(n.body,u=>(o(),a("li",{key:u},i(u),1))),128))]))),128))]),t("div",{onClick:s[0]||(s[0]=n=>e.toBet())},[t("span",V,i(e.$t("goBetting")),1),R(v,{name:"upgrade",color:"#D23838"})])])])])}const F=x(w,[["render",j],["__scopeId","data-v-26d63714"],["__file","/home/jenkins/agent/workspace/AR102-Pages-india-Colorwin/src/views/activity/PointMall/Rules/index.vue"]]);export{F as default};
