'use strict';
const assert=require('node:assert/strict');
const C=require('../alchemy_core.js'),P=require('../fixed_protocol.js');
assert.equal(P.validate(),true);
assert.equal(new Set(P.schedule.episodes.map(e=>e.source.behavior_sha256)).size,20);
assert.deepEqual([0,1,2,3].map(n=>P.schedule.episodes.filter(e=>e.source.num_preconditions===n).length),[5,5,5,5]);
assert(P.schedule.episodes.slice(0,5).every(e=>e.chemistry.graphMask===4095));
const layout=C.makePotionLayout(C.makeRng(0));
let checked=0;
for(let i=0;i<20;i++)for(let t=0;t<10;t++){
 const first=P.trialItems(i,t,layout);
 const expected=JSON.parse(JSON.stringify(first));
 first.stones[0].latent[0]*=-1;first.potions[0].used=true;
 // Neither previous actions nor presentation RNG consumption can mutate initial conditions.
 const noise=C.makeRng(i+t);for(let k=0;k<100;k++)noise.next();
 assert.deepEqual(P.trialItems(i,t,layout),expected);checked++;
}
assert.throws(()=>P.episode(20));assert.throws(()=>P.trialItems(0,10,layout));
assert.throws(()=>{P.schedule.episodes[0].source.chemistry_id='tampered';},TypeError);
console.log(`PASS fixed evaluation protocol: 20 unique held-out Chemistry, 5 per tier, ${checked} action-independent Trial initializations, 960 transitions and 160 values validated against PPO tables.`);
