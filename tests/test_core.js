'use strict';
const assert=require('node:assert/strict');
const C=require('../alchemy_core.js');
const suites=[];
function test(name,fn){fn();suites.push(name);console.log('PASS',name);}
function eq(x,y){assert.deepEqual(x,y);}
test('Graph grammar: 109 connected cases, tiers 1/12/48/48',()=>{
 eq(C.GRAPH_COUNTS,[1,12,48,48]);
 eq(C.ALL_VALID_MASKS.size,109);
 for(const tier of C.GRAPH_TIERS)for(const g of tier)assert(C.isConnected(g.mask));
});
test('V5 chemistry cardinality 109 x 48 x 8 = 41856',()=>{
 eq(C.POSSIBLE_CHEMISTRIES,41856);
 eq(C.ORIGINAL_POSSIBLE_CHEMISTRIES,167424);
});
test('No sampled chemistry can have a rotated perceptual map',()=>{
 const rng=C.makeRng(304);const tiers=new Set();const signs=new Set();
 for(let i=0;i<3000;i++){
  const c=C.sampleChemistry(rng);eq(c.rotation,0);tiers.add(c.constraintCount);signs.add(c.reflect.join(','));
  assert(C.GRAPH_TIERS[c.constraintCount].some(g=>g.mask===c.graphMask));
  for(const v of c.reflect)assert(v===1||v===-1);
 }
 eq(tiers.size,4);eq(signs.size,8);
});
test('Potion colors maintain three mutually distinct opposite pairs',()=>{
 const rng=C.makeRng(89);
 for(let i=0;i<1500;i++){
  const chem=C.sampleChemistry(rng);
  const axes=new Set();
  for(const [a,b] of C.COLOR_PAIRS){
   const d=chem.potionDirections[a],e=chem.potionDirections[b];
   eq(d.axis,e.axis);eq(d.direction,-e.direction);axes.add(d.axis);
  }
  eq(axes.size,3);
 }
 eq(C.COLOR_PAIRS,[['red','green'],['yellow','orange'],['pink','teal']]);
});
test('Reflections independently flip signs but keep unique 8 perceptual states',()=>{
 const rng=C.makeRng(19);
 for(let k=0;k<200;k++){
  const chem=C.sampleChemistry(rng);
  const seen=new Set();
  for(let i=0;i<8;i++){
   const v=C.idToVector(i),a=C.visibleAttributes(v,chem);
   eq([a.size,a.color,a.shape],v.map((x,j)=>x*chem.reflect[j]));
   for(const val of Object.values(a))assert(val===1||val===-1);
   seen.add(JSON.stringify(a));
  }
  eq(seen.size,8);
 }
});
test('Only one visible attribute can change per successful potion in v5',()=>{
 const rng=C.makeRng(88);let changed=0;
 for(let k=0;k<220;k++){
  const c=C.sampleChemistry(rng);
  for(let v=0;v<8;v++)for(const p of C.COLORS){
   const state=C.idToVector(v),t=C.transition(state,p,c);
   const x=C.visibleAttributes(t.before,c),y=C.visibleAttributes(t.after,c);
   const diff=Object.keys(x).filter(key=>x[key]!==y[key]).length;
   eq(diff,t.changed?1:0);if(t.changed)changed++;
  }
 }
 assert(changed>500);
});
test('Four reward categories remain -3,-1,+1,+15',()=>{
 const rewards=Array.from({length:8},(_,i)=>C.reward(C.idToVector(i)));
 eq(rewards.sort((a,b)=>a-b),[-3,-1,-1,-1,1,1,1,15]);
});
test('Potion transitions only across present edges or no change',()=>{
 const r=C.makeRng(123);
 for(let n=0;n<210;n++){
  const c=C.sampleChemistry(r);
  for(let v=0;v<8;v++)for(const color of C.COLORS){
   const before=C.idToVector(v),t=C.transition(before,color,c);
   eq(t.before,before);eq(t.changed,t.reason==='changed');
   const delta=t.after.filter((x,j)=>x!==before[j]).length;
   eq(delta,t.changed?1:0);
   if(t.changed){
    const a=C.vectorToId(t.before),b=C.vectorToId(t.after);
    const idx=C.EDGES.findIndex(e=>C.canonicalEdgeKey(e.from,e.to)===C.canonicalEdgeKey(a,b));
    assert(idx>=0&&(c.graphMask&(1<<idx)));
   }
  }
 }
});
test('Seed reproducibility through 10 Trials and multiple Episodes',()=>{
 const a=C.makeRng(20261020),b=C.makeRng(20261020);
 for(let e=0;e<10;e++){
  eq(C.sampleChemistry(a),C.sampleChemistry(b));
  for(let t=0;t<10;t++)eq(C.sampleTrialItems(a),C.sampleTrialItems(b));
 }
});
test('Episode Chemistry signature stable and complete',()=>{
 const r=C.makeRng(15);
 for(let i=0;i<150;i++){
  const c=C.sampleChemistry(r);
  const sig=C.chemistryFingerprint(c);
  eq(C.chemistryFingerprint(JSON.parse(JSON.stringify(c))),sig);
  assert(sig.includes(String(c.graphMask)));
 }
});
test('24 Episodes: every complete Chemistry unique; all three components differ from predecessor',()=>{
 for(let seed=0;seed<100;seed++){
  const r=C.makeRng(seed*9901+7),used=[],signatures=new Set();
  let previous=null;
  for(let episode=0;episode<24;episode++){
   const c=C.sampleUniqueEpisodeChemistry(r,previous,used);
   const sig=C.chemistryFingerprint(c);
   assert(!signatures.has(sig),'Session-level rule repetition');
   if(previous){
    const changed=C.chemistryChangeFlags(c,previous);
    eq(changed,{graphChanged:true,potionMappingChanged:true,reflectionChanged:true});
   }
   signatures.add(sig);used.push(sig);previous=c;
  }
  eq(signatures.size,24);
 }
});
test('Forced rejection of identical Chemistry is deterministic and safe',()=>{
 const seed=812731;
 const r=C.makeRng(seed),first=C.sampleChemistry(r);
 const r2=C.makeRng(seed);
 const next=C.sampleUniqueEpisodeChemistry(r2,first,[C.chemistryFingerprint(first)]);
 assert.notEqual(C.chemistryFingerprint(next),C.chemistryFingerprint(first));
 eq(C.chemistryChangeFlags(next,first),{graphChanged:true,potionMappingChanged:true,reflectionChanged:true});
 eq(next,C.sampleUniqueEpisodeChemistry(C.makeRng(seed),first,[C.chemistryFingerprint(first)]));
});
test('V5.2 randomized groups: adjacent identical bottles, non-opposite rows, session-stable',()=>{
 const opposite=Object.fromEntries(C.COLOR_PAIRS.flatMap(([a,b])=>[[a,b],[b,a]]));
 const variants=new Set();
 for(let seed=0;seed<250;seed++){
  const r=C.makeRng(seed+17),layout=C.makePotionLayout(r);
  C.checkPotionLayout(layout);
  eq(layout.length,12);
  for(let i=0;i<12;i+=2)eq(layout[i],layout[i+1]);
  for(let i=0;i<12;i+=4)assert.notEqual(layout[i+2],opposite[layout[i]],'Cannot place a genuine opposite pair in one row');
  for(const color of C.COLORS)eq(layout.filter(c=>c===color).length,2);
  variants.add(layout.join('|'));
  for(let t=0;t<8;t++){
   const items=C.sampleTrialItems(r,3,12,layout);
   eq(items.stones.length,3);eq(items.potions.length,12);
   eq(items.potions.map(x=>x.color),layout);
   eq(items.potions.map(x=>x.id),Array.from({length:12},(_,i)=>`P${i+1}`));
   assert(items.potions.every(x=>!x.used));
  }
 }
 assert(variants.size>60,'Randomization must produce meaningfully varied pair-group layouts');
 eq(C.makePotionLayout(C.makeRng(2026)),C.makePotionLayout(C.makeRng(2026)));
 assert.throws(()=>C.sampleTrialItems(C.makeRng(8),3,11),/exactly 12/);
 assert.throws(()=>C.checkPotionLayout(C.COLORS.flatMap(c=>[c,c])),/Opposite-color/);
 const invalid=C.makePotionLayout(C.makeRng(61));
 [invalid[0],invalid[1]]=[invalid[1],invalid[0]]; // unchanged if colors same
 invalid[1]='teal';
 assert.throws(()=>C.checkPotionLayout(invalid),/two |adjacent/);
});
console.log(`\n${suites.length} core suites passed.`);
