/* Isolated practice mathematics; never used by wallet or payout APIs. */
(()=>{'use strict';
 const lines=[[0,1,2],[3,4,5],[6,7,8],[0,4,8],[2,4,6]],pays=[5,2,1,.5],multipliers=[5,15,10];
 function int(max){const v=new Uint32Array(1),limit=Math.floor(4294967296/max)*max;do{crypto.getRandomValues(v);}while(v[0]>=limit);return v[0]%max;}
 function evaluate(board,bet,multiplier){
  if(!Array.isArray(board)||board.length!==9||board.some(n=>!Number.isInteger(n)||n<0||n>3)||!Number.isSafeInteger(bet)||bet<1||!multipliers.includes(multiplier))throw Error('Invalid practice spin');
  const wins=lines.flatMap((line,index)=>line.every(i=>board[i]===board[line[0]])?[{index,cells:line,payout:Math.round(bet*pays[board[line[0]]]*multiplier)}]:[]);
  return {wins,payout:wins.reduce((n,w)=>n+w.payout,0)};
 }
 function spin(bet,hitRate,rng=int){
  if(!Number.isFinite(hitRate)||hitRate<0||hitRate>100)throw Error('Invalid practice hit rate');
  const wantWin=rng(10000)<hitRate*100,multiplier=multipliers[rng(3)];let board,result;
  for(let tries=0;tries<150;tries++){board=Array.from({length:9},()=>rng(4));result=evaluate(board,bet,multiplier);if(Boolean(result.wins.length)===wantWin)return {board,multiplier,...result};}
  board=wantWin?[1,1,1,2,3,2,3,2,3]:[0,1,2,1,3,0,2,0,1];result=evaluate(board,bet,multiplier);return {board,multiplier,...result};
 }
 const api={lines,pays,multipliers,evaluate,spin,int};if(typeof module==='object'&&module.exports)module.exports=api;else window.FortunePractice=Object.freeze(api);
})();
