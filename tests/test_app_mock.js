'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const Core=require('../alchemy_core.js');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'Duplicate element ids');
function make(previousStore){
 class E {
  constructor(id){this.id=id;this.listeners={};this.disabled=false;this.style={};this.value='';this.checked=false;
   this.children=[];this.innerHTML='';this.textContent='';this.className='';this.attrs={};this.open=false;
   this.classList={add:k=>this.className+=(this.classList.contains(k)?'':' '+k),
     remove:k=>this.className=this.className.replace(new RegExp('\\b'+k+'\\b','g'),'').replace(/  +/g,' ').trim(),
     contains:k=>this.className.split(/\s+/).includes(k),
     toggle:(k,v)=>{const yes=v===undefined?!this.classList.contains(k):v;yes?this.classList.add(k):this.classList.remove(k);}};
  }
  addEventListener(k,cb){this.listeners[k]=cb;}
  click(){if(!this.disabled&&this.listeners.click)this.listeners.click({target:this});}
  setAttribute(k,v){this.attrs[k]=v;}
  appendChild(x){this.children.push(x);return x;}
  replaceChildren(...xs){this.children=[...xs];}
  scrollIntoView(){}
  showModal(){this.open=true;}
  close(){this.open=false;}
  remove(){}
 }
 const els=Object.fromEntries(ids.map(k=>[k,new E(k)]));
 for(const [id,v] of [['participantId','TEST01'],['episodeCount','2'],['trialCount','2'],['seed','1234']])els[id].value=v;
 const store=new Map(previousStore||[]),downloads=[];
 const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 let ready=()=>{};
 const document={getElementById:id=>els[id]||null,createElement:tag=>new E(tag),body:new E('body'),hidden:false,
  addEventListener:(type,cb)=>{if(type==='DOMContentLoaded')ready=cb;}};
 const url={createObjectURL:b=>{downloads.push(b);return 'blob:mock';},revokeObjectURL:()=>{}};
 const window={crypto:webcrypto,alert:message=>{throw Error('Unexpected alert: '+message);},confirm:()=>true,
  addEventListener:()=>{},URL:url};
 const ctx={window,document,localStorage,crypto:webcrypto,Blob,URL:url,performance,Date,console,setTimeout:()=>{}};
 window.AlchemyCore=Core;vm.runInNewContext(fs.readFileSync(__dirname+'/../app.js','utf8'),ctx);ready();
 return {els,store,downloads,click:id=>els[id].click(),state:()=>JSON.parse(store.get('alchemy_human_experiment_v6_5_signed_batch_session'))};
}
async function flush(){for(let i=0;i<8;i++) await Promise.resolve();}
(async()=>{
 let a=make();a.click('startBtn');let s=a.state();
 assert.equal(s.phase,'playing');assert.equal(s.config.allowEndTrial,false);
 assert.equal(s.historyExpanded,false);assert.equal(a.els.historyToggle.attrs['aria-expanded'],'false');
 for(let i=0;i<3;i++)a.click('historyToggle');
 assert.equal(a.state().historyExpanded,true);assert.equal(a.state().historyDecisionState.clickCount,3);
 assert.equal(a.els.endTrialBtn,undefined,'Separate end button must not exist');
 assert.equal(a.els.trialSummary,undefined,'The arithmetic settlement text is removed');
 assert.equal(a.els.depositBtn.disabled,false,'Batch settlement needs no selected stone');
 const fixed=[...s.potionLayout];Core.checkPotionLayout(fixed);
 a.els.stonesList.children[0].click();a.els.potionsList.children[0].click();a.click('applyBtn');
 assert.equal(a.state().actionsThisTrial,1);assert(a.state().pendingFeedback);
 const firstDecision=a.state().events.filter(e=>e.type==='apply_potion').at(-1);
 assert.equal(firstDecision.historyClickedBeforeAction,true);assert.equal(firstDecision.historyClickCountBeforeAction,3);assert.equal(firstDecision.historyOpenCountBeforeAction,2);assert.equal(firstDecision.historyVisibleBeforeAction,true);assert.equal(firstDecision.historyEntriesBeforeAction,0);
 assert.equal(a.state().historyExpanded,false);assert.equal(a.els.historyToggle.attrs['aria-expanded'],'false');
 assert(a.els.history.classList.contains('hidden'));assert.equal(a.state().historyDecisionState.clickCount,0);
 assert.equal(a.els.depositBtn.disabled,true);
 await flush();assert.equal(a.els.actionDialog.open,true);
 assert(a.els.actionDetails.innerHTML.includes('用药前')&&a.els.actionDetails.innerHTML.includes('用药后'));
 assert(!/blocked|saturated|阻断|极值/.test(a.els.actionDetails.innerHTML));
 a.click('depositBtn');assert.equal(a.state().phase,'playing','Feedback blocks settlement');
 a.click('continueBtn');
 const expected=a.state().stones.reduce((v,x)=>v+Core.reward(x.latent),0);
 a.click('depositBtn');s=a.state();
 assert.equal(s.phase,'between');assert.equal(s.trialScore,expected);
 const manual=s.events.find(e=>e.type==='deposit_all_stones');assert.equal(manual.isDecision,true);assert.equal(manual.historyClickedBeforeAction,false);assert.equal(manual.historyClickCountBeforeAction,0);
 assert.equal(s.stones.filter(x=>x.submitted).length,3);
 assert.equal(s.trials.length,1);assert.equal(s.trials[0].endReason,'all_stones_deposited');
 a.click('depositBtn');assert.equal(a.state().trials.length,1,'Never settle twice');
 const reload=make(a.store);await flush();
 assert.equal(reload.state().trials.length,1,'Reload during reveal never settles again');
 assert.equal(reload.state().totalScore,expected);
 await flush();a.click('nextBtn');
 assert.equal(a.state().trialIndex,1);assert.equal(a.state().trialHistory.length,0,'Entering next Trial clears visible history');
 assert.deepEqual(a.state().potions.map(p=>p.color),fixed);
 a.els.stonesList.children[0].click();
 for(let k=0;k<12;k++){
  if(k%2===0)a.click('historyToggle');
  a.els.potionsList.children[k].click();a.click('applyBtn');await flush();
  const decision=a.state().events.filter(e=>e.type==='apply_potion').at(-1);
  assert.equal(decision.historyClickedBeforeAction,k%2===0);assert.equal(decision.historyClickCountBeforeAction,k%2===0?1:0);assert.equal(decision.historyEntriesBeforeAction,k);assert.equal(a.state().historyExpanded,false);
  assert.equal(a.state().trialHistory.length,k+1,'All applications in this Trial are retained');
  assert.equal(a.state().trialHistory[k].potionId,`P${k+1}`);
  assert.equal(a.els.history.children.length,k+1);
  assert.match(a.els.history.children[0].innerHTML,/<span class="history-potion-color">(红色|橙色|黄色|绿色|青绿色|粉色)<\/span>/,'History color label has no suffix');
  assert(a.els.history.children[0].innerHTML.includes(`第 ${k+1} 次`),'Most recent application appears first');
  assert(a.els.historyCount.textContent.includes(`${k+1} 次用药`));
  assert.equal(a.els.actionDialog.open,true);
  if(k<11)assert.equal(a.state().phase,'playing');
  else{
   assert.equal(a.state().phase,'between','Exhaustion immediately commits settlement');
   assert.equal(a.state().trials.length,2);
   assert.equal(a.state().trials[1].endReason,'potions_exhausted');
   assert.equal(a.state().trialScore,a.state().stones.reduce((v,x)=>v+Core.reward(x.latent),0));
   a=make(a.store);assert.equal(a.els.actionDialog.open,true,'Final feedback survives reload');
  }
  a.click('continueBtn');await flush();
 }
 s=a.state();assert.equal(s.trialHistory.length,12);assert(s.trialHistory.every(x=>x.trial===2&&x.episode===1));assert.equal(s.actionsThisTrial,12);assert.equal(s.potions.filter(p=>p.used).length,12);
 assert.equal(s.phase,'between');assert.equal(s.pendingSettlementReveal,null);
 const automatic=s.events.filter(e=>e.type==='deposit_all_stones').at(-1);assert.equal(automatic.isDecision,false);assert.equal(automatic.historyClickedBeforeAction,null);
 // Migrate a latest-only old backup by rebuilding from full current-Trial events.
 const legacy=JSON.parse(JSON.stringify(s));legacy.episodeHistory=[legacy.trialHistory.at(-1)];delete legacy.trialHistory;delete legacy.historyDecisionState;delete legacy.historyExpanded;legacy.config.historyScope='last_potion_in_episode';
 a.store.set('alchemy_human_experiment_v6_5_signed_batch_session',JSON.stringify(legacy));
 a=make(a.store);assert.equal(a.state().trialHistory.length,12,'Legacy reload reconstructs all records in the current Trial');
 assert.equal(a.state().episodeHistory,undefined);assert.equal(a.state().config.historyScope,'current_trial');
 a.click('nextBtn');s=a.state();
 assert.equal(s.episodeIndex,1);assert.equal(s.trialHistory.length,0);
 assert.deepEqual(Core.chemistryChangeFlags(s.chemistry,s.episodes[0].chemistry),{graphChanged:true,potionMappingChanged:true,reflectionChanged:true});
 for(let i=0;i<2;i++){a.click('depositBtn');await flush();a.click('nextBtn');}
 s=a.state();assert.equal(s.phase,'completed');
 assert.equal(s.totalScore,s.trials.reduce((v,t)=>v+t.score,0));
 for(const trial of s.trials){
  assert.equal(trial.score,trial.stoneValues.reduce((v,x)=>v+x,0));
  assert.equal(trial.score,trial.final.stones.reduce((v,x)=>v+x.reward,0));
 }
 a.click('finishExportBtn');a.click('finishCsvBtn');assert.equal(a.downloads.length,2);
 const exported=JSON.parse(await a.downloads[0].text());
 assert.equal(exported.metadata.version,'6.5.0-signed-batch');
 assert.equal(exported.metadata.config.historyScope,'current_trial');
 assert.equal(exported.currentProgress.trialHistory.length,0);
 assert.equal(exported.events.filter(e=>e.type==='deposit_all_stones').length,4);
 assert.equal(exported.events.filter(e=>e.type==='deposit_stone'||e.type==='end_trial_action').length,0);
 assert.equal(exported.events.filter(e=>e.type==='apply_potion').length,13);
 assert.equal(exported.events.filter(e=>e.type==='trial_end').length,4);
 assert.equal(exported.events.filter(e=>e.type==='session_end').length,1);
 assert.equal(exported.events.filter(e=>e.type==='history_toggle').length,9);
 assert.equal(exported.events.filter(e=>e.type==='history_auto_collapse'&&e.reason==='potion_action').length,7);
 const csv=(await a.downloads[1].text()).replace(/^\uFEFF/,'').split(/\r?\n/);const header=csv[0].split(',');
 const fields=[...csv.find(x=>x.includes(',apply_potion,')).matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g)].map(x=>x[1]===undefined?x[2]:x[1].replaceAll('""','"'));
 assert.equal(fields[header.indexOf('historyClickedBeforeAction')],'true');assert.equal(fields[header.indexOf('historyClickCountBeforeAction')],'3');assert.equal(fields[header.indexOf('historyOpenCountBeforeAction')],'2');
 const restored=make(a.store);assert.equal(restored.state().phase,'completed');
 // Negative totals, arbitrary multi-digit totals, and single-write settlement.
 for(const values of [[-3,-3,1],[15,-1,-3],[15,15,15]]){
  const b=make();b.click('startBtn');const saved=b.state();
  saved.stones.forEach((x,i)=>{x.latent=Array.from({length:8},(_,n)=>Core.idToVector(n)).find(v=>Core.reward(v)===values[i]);});
  saved.currentTrialInitial.stones=saved.stones.map(x=>({id:x.id,hidden:x.latent,visible:Core.visibleAttributes(x.latent,saved.chemistry),reward:Core.reward(x.latent),submitted:false}));
  b.store.set('alchemy_human_experiment_v6_5_signed_batch_session',JSON.stringify(saved));
  const c=make(b.store);c.click('depositBtn');await flush();
  assert.equal(c.state().trialScore,values.reduce((x,y)=>x+y,0));
  assert.equal(c.state().trials[0].rawValueDelta,0,'Initial values are not rewarded again');
 }
 // Unconsumed user clicks survive reload, while programmatic closure adds no user clicks.
 const clicked=make();clicked.click('startBtn');clicked.click('historyToggle');const clickedReload=make(clicked.store);
 assert.equal(clickedReload.state().historyExpanded,false);assert.equal(clickedReload.state().historyDecisionState.clickCount,1);
 clickedReload.click('depositBtn');await flush();const clickedSettlement=clickedReload.state().events.find(e=>e.type==='deposit_all_stones');
 assert.equal(clickedSettlement.historyClickedBeforeAction,true);assert.equal(clickedSettlement.historyVisibleBeforeAction,false);assert.equal(clickedSettlement.historyClickCountBeforeAction,1);
 assert.equal(clickedReload.state().events.filter(e=>e.type==='history_toggle').length,1);
 const many=make();many.els.episodeCount.value='24';many.els.trialCount.value='2';many.click('startBtn');
 let last=null;const all=new Set();
 for(let ep=0;ep<24;ep++){
  const chem=many.state().chemistry,key=Core.chemistryFingerprint(chem);
  assert(!all.has(key));all.add(key);
  if(last)assert.deepEqual(Core.chemistryChangeFlags(chem,last),{graphChanged:true,potionMappingChanged:true,reflectionChanged:true});
  many.click('depositBtn');await flush();many.click('nextBtn');
  assert.equal(Core.chemistryFingerprint(many.state().chemistry),key);
  many.click('depositBtn');await flush();many.click('nextBtn');last=chem;
 }
 assert.equal(many.state().phase,'completed');assert.equal(all.size,24);
 console.log('PASS signed batch settlement: no selection/end button, signed totals, exhaustion, duplicate/reload safety, feedback, exports, 24-Episode rule/history invariants');
})().catch(e=>{console.error(e);process.exitCode=1;});
