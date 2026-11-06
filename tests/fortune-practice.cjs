const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/games/fortune-gems-engine.js');
test('five paylines and fixed illustrative payout table',()=>{
 const jackpot=E.evaluate(Array(9).fill(0),1000,15);assert.equal(jackpot.wins.length,5);assert.equal(jackpot.payout,375000);
 const single=E.evaluate([1,1,1,2,3,2,3,2,3],1000,5);assert.equal(single.wins.length,1);assert.equal(single.payout,10000);
 assert.throws(()=>E.evaluate(Array(9).fill(0),-1,5));assert.throws(()=>E.evaluate(Array(9).fill(9),1000,5));
});
test('0 and 100 percent practice outcomes, including bounded fallback',()=>{
 for(let i=0;i<100;i++){assert.equal(E.spin(1000,0).payout,0);assert.ok(E.spin(1000,100).payout>0);}
 assert.equal(E.spin(1000,0,()=>0).payout,0);assert.ok(E.spin(1000,100,()=>0).payout>0);
 assert.throws(()=>E.spin(1000,101));
});
test('seeded synthetic frequency follows the configured probability',()=>{
 let state=123456789;const rng=max=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return Math.floor(state/4294967296*max);};
 let hits=0;for(let i=0;i<3000;i++)hits+=E.spin(1000,30,rng).wins.length>0;
 assert.ok(hits>800&&hits<1000,`Unexpected hit count ${hits}`);
});
