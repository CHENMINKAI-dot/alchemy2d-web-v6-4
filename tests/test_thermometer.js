'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../app.js','utf8');
const start=source.indexOf('function valueIndex(reward){');
const end=source.indexOf('function visibleText(a){');
assert(start>0&&end>start, 'thermometer functions not found');
const code=`const VALUE_NAMES=['最低','次低','次高','最高'];
const VALUE_CLASSES=['value-low','value-midlow','value-midhigh','value-high'];
const Core={REWARD_LEVELS:[-3,-1,1,15]};
${source.slice(start,end)}
this.makeThermometer=thermometer;`;
const ctx={};vm.runInNewContext(code,ctx);
const shades=['value-low','value-midlow','value-midhigh','value-high'];
for (let level=0; level<4;level++){
 const html=ctx.makeThermometer([-3,-1,1,15][level]);
 const cells=[...html.matchAll(/<span class="(thermo-cell[^"]*)"/g)].map(m=>m[1]);
 assert.equal(cells.length,4);
 let active=0;
 for (let pos=0;pos<4;pos++){
  const cell=cells[pos].split(' ');
  if(cell.includes('active')){
   active++;
   assert(cell.includes(shades[level]),`level ${level}, position ${pos} uses wrong color`);
  } else {
   assert.equal(cell.length,1,`inactive position ${pos} must not carry any value color`);
  }
 }
 assert.equal(active,level+1,'liquid column height should increase one equal step per reward level');
 assert(html.includes(`thermo-bulb ${shades[level]}`));
 assert(!html.includes('−3')&&!html.includes('+15'),'visible labels must not expose reward numbers');
}
console.log('PASS thermometer regression: 1/2/3/4 filled steps; exactly one consistent blue/light-blue/light-orange/orange shade per level; no scores');
