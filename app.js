/* Alchemy 2D v6.5: one-click signed settlement of all three stones. */
(() => {
'use strict';
const Core=window.AlchemyCore;
if(!Core) throw Error('alchemy_core.js 未正确载入');
const VERSION='6.5.0-signed-batch';
const STORAGE_KEY='alchemy_human_experiment_v6_5_signed_batch_session';
const POTIONS={
 red:['红色','potion_red.png'], green:['绿色','potion_green.png'],
 yellow:['黄色','potion_yellow.png'], orange:['橙色','potion_orange.png'],
 pink:['粉色','potion_pink.png'], teal:['青绿色','potion_teal.png']
};
const SHAPES={'-1':['圆润','round'],'0':['多面','faceted'],'1':['尖晶','spire']};
const COLORS={'-1':['蓝色','blue'],'0':['紫色','purple'],'1':['玫红','rose']};
const SIZES={'-1':['小型','small'],'0':['中型','medium'],'1':['大型','large']};
const VALUE_NAMES=['最低','次低','次高','最高'];
const VALUE_CLASSES=['value-low','value-midlow','value-midhigh','value-high'];
const IDs=['welcome','game','participantId','episodeCount','trialCount','seed',
 'helpBtn','helpDialog','closeHelpBtn','startBtn','practiceBtn',
 'episodeValue','trialValue','totalValue','mode',
 'stonesList','potionsList','applyBtn','depositBtn','cauldronScene','fxLayer',
 'transitionPane','nextBtn','completePane','completeSummary',
 'finishExportBtn','finishCsvBtn','newSessionBtn','history','historyCount','historyPotion','srFeedback',
 'actionDialog','actionSub','actionDetails','continueBtn'];
const dom={};
let s=null, rng=null, perfZero=performance.now(), elapsedBase=0, historyRenderToken='', animationBusy=false;
function get(id){return dom[id];}
function copy(x){return JSON.parse(JSON.stringify(x));}
function escapeHtml(v){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');}
function numberInput(id,lo,hi){
 const n=Number(get(id).value);
 if(!Number.isInteger(n)||n<lo||n>hi)throw Error(`请输入 ${lo} 至 ${hi} 的整数`);
 return n;
}
function localIso(){
 const d=new Date(), offset=-d.getTimezoneOffset();
 const f=n=>String(n).padStart(2,'0');
 return `${d.getFullYear()}-${f(d.getMonth()+1)}-${f(d.getDate())}T${f(d.getHours())}:${f(d.getMinutes())}:${f(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3,'0')}${offset>=0?'+':'-'}${f(Math.floor(Math.abs(offset)/60))}:${f(Math.abs(offset)%60)}`;
}
function elapsedMs(){return Math.round((elapsedBase+performance.now()-perfZero)*1000)/1000;}
function trialElapsed(){return s?.trialStartedElapsedMs==null?null:Math.round((elapsedMs()-s.trialStartedElapsedMs)*1000)/1000;}
function sessionId(){
 const bytes=(window.crypto&&window.crypto.getRandomValues)?Array.from(window.crypto.getRandomValues(new Uint8Array(6))).map(x=>x.toString(16).padStart(2,'0')).join(''):Math.floor(Math.random()*1e12).toString(16);
 return `ALC-${Date.now()}-${bytes}`;
}
function stoneState(st){return {id:st.id,hidden:[...st.latent],visible:Core.visibleAttributes(st.latent,s.chemistry),reward:Core.reward(st.latent),submitted:st.submitted};}
function notice(text){get('srFeedback').textContent=text;}
function writeSave(){
 if(!s)return;
 try {
  const snapshot={...s,elapsedSavedMs:elapsedMs(),savedAtUTC:new Date().toISOString(),rngState:rng.state()};
  localStorage.setItem(STORAGE_KEY,JSON.stringify(snapshot));
 } catch(error){
  console.warn('Alchemy local backup failed',error);
  if(!s.storageWarningShown){
   s.storageWarningShown=true;
   window.alert('浏览器无法保存自动备份。请保持当前页面打开，完成实验后立即下载数据。');
  }
 }
}
function record(type,more={}){
 if(!s)return;
 const ms=elapsedMs();
 s.events.push({seq:s.events.length+1,type,sessionId:s.sessionId,participantId:s.participantId,practice:s.practice,
  utc:new Date().toISOString(),localTime:localIso(),elapsedMs:ms,
  episode:s.episodeIndex+1,trial:s.trialIndex+1,
  trialElapsedMs:s.trialStartedElapsedMs==null?null:Math.round((ms-s.trialStartedElapsedMs)*1000)/1000,
  actionNumber:s.actionsThisTrial,...copy(more)});
 writeSave();
}
function makeSession(practice){
 let config;
 try{config={episodes:practice?1:numberInput('episodeCount',1,24),
    trialsPerEpisode:practice?2:numberInput('trialCount',1,20),
    stonesPerTrial:3,potionsPerTrial:12,potionsPerColor:2,
    potionAllocation:'six_adjacent_same_color_pairs_randomized_once_per_session',actionLimit:null,
    allowEndTrial:false,settlementPolicy:'all_stones_signed_sum',autoSettleWhenPotionsExhausted:true,
    perceptualRotation:false,perceptualReflection:true,
    historyScope:'last_potion_in_episode',feedbackAfterPotion:true,
    episodeChemistryPolicy:'unique_full_session_and_all_three_components_change_between_adjacent_episodes',
    effectAnimation:true,depositScorePopup:true};
 }catch(error){window.alert(error.message);return;}
 const typed=get('seed').value.trim();
 if(typed&&(!/^\d+$/.test(typed)||Number(typed)>4294967295)){
  window.alert('随机种子只能是 0 至 4294967295 的整数，或留空。');return;
 }
 const seed=typed?Number(typed)>>>0:Core.normalizeSeed('');
 const participantId=get('participantId').value.trim();
 if(!participantId){window.alert('请填写被试编号。');return;}
 if(s && s.phase!=='completed'&&!window.confirm('开始新实验将覆盖当前 v6.5 会话的自动备份。确定继续吗？'))return;
 rng=Core.makeRng(seed);
 s={version:VERSION,sessionId:sessionId(),participantId,practice,config,seed,
  potionLayout:Core.makePotionLayout(rng),
  startedAtUTC:new Date().toISOString(),startedAtLocal:localIso(),
  phase:'playing',episodeIndex:-1,trialIndex:-1,chemistry:null,
  stones:[],potions:[],selectedStone:null,selectedPotion:null,
  actionsThisTrial:0,trialScore:0,episodeScore:0,totalScore:0,
  trialStartedElapsedMs:null,trialStartedUTC:null,episodeStartedElapsedMs:null,
  currentTrialInitial:null,episodeHistory:[],pendingFeedback:null,pendingSettlementReveal:null,
  trials:[],episodes:[],events:[],chemistryKeys:[],storageWarningShown:false,elapsedSavedMs:0};
 perfZero=performance.now();elapsedBase=0;historyRenderToken='';animationBusy=false;
 record('session_start',{config:copy(config),seed,potionLayout:copy(s.potionLayout)});
 beginEpisode();
 notice(practice?'练习开始':'正式实验开始');
 if(typeof window.alchemyWaitForGameImages==='function')void window.alchemyWaitForGameImages();
}
function beginEpisode(){
 // Snapshot the previous Episode before constructing the next one. A session
 // always uses one fixed Chemistry throughout all Trials in that Episode.
 const previousChemistry=s.chemistry;
 const next=Core.sampleUniqueEpisodeChemistry(rng,previousChemistry,s.chemistryKeys);
 if(next.rotation!==0)throw Error('The human adaptation must not sample a rotation');
 const signature=Core.chemistryFingerprint(next);
 const flags=Core.chemistryChangeFlags(next,previousChemistry);
 if(s.chemistryKeys.includes(signature) ||
    (previousChemistry&&Object.values(flags).some(changed=>!changed))) {
  throw Error('Experiment integrity violation: repeating Episode rules');
 }
 // Only after successful validation can the session state advance.
 s.episodeIndex++;s.trialIndex=-1;s.episodeScore=0;s.episodeHistory=[];s.pendingFeedback=null;
 s.chemistry=next;s.chemistryKeys.push(signature);
 s.episodeStartedElapsedMs=elapsedMs();
 historyRenderToken='';
 record('episode_start',{chemistry:copy(s.chemistry),chemistryFingerprint:signature,
  changedFromPrevious:previousChemistry?flags:null,uniqueInSession:true,rngState:rng.state()});
 beginTrial();
}
function beginTrial(){
 s.trialIndex++;
 const items=Core.sampleTrialItems(rng,3,12,s.potionLayout);
 s.stones=items.stones;s.potions=items.potions;
 s.selectedStone=null;s.selectedPotion=null;s.actionsThisTrial=0;s.trialScore=0;
 s.pendingFeedback=null;s.pendingSettlementReveal=null;
 s.currentTrialInitial={stones:s.stones.map(stoneState),potions:copy(s.potions)};
 s.trialStartedElapsedMs=elapsedMs();s.trialStartedUTC=new Date().toISOString();s.phase='playing';
 record('trial_start',{initial:copy(s.currentTrialInitial),rngState:rng.state()});
 render();
}
function selectStone(id){
 if(!s||s.phase!=='playing'||s.pendingFeedback||animationBusy)return;
 const st=s.stones.find(x=>x.id===id&&!x.submitted);
 if(!st)return;
 s.selectedStone=id;
 record('select_stone',{stoneId:id,visible:Core.visibleAttributes(st.latent,s.chemistry)});
 render();
}
function selectPotion(id){
 if(!s||s.phase!=='playing'||s.pendingFeedback||animationBusy)return;
 const p=s.potions.find(x=>x.id===id&&!x.used);
 if(!p)return;
 s.selectedPotion=id;
 record('select_potion',{potionId:id,color:p.color});
 render();
}
function executePotion(){
 if(!s||s.phase!=='playing'||s.pendingFeedback||animationBusy)return;
 const st=s.stones.find(x=>x.id===s.selectedStone&&!x.submitted);
 const p=s.potions.find(x=>x.id===s.selectedPotion&&!x.used);
 if(!st||!p)return;
 const before=stoneState(st);
 const result=Core.transition(st.latent,p.color,s.chemistry);
 st.latent=[...result.after];p.used=true;s.actionsThisTrial++;s.selectedPotion=null;
 const after=stoneState(st);
 // This snapshot contains only participant-visible stone attributes. Latent coordinates
 // and the failed-action reason exist solely in the researcher data export.
 const row={episode:s.episodeIndex+1,trial:s.trialIndex+1,actionNumber:s.actionsThisTrial,
  stoneId:st.id,potionId:p.id,color:p.color,
  before:{visible:copy(before.visible),reward:before.reward},
  after:{visible:copy(after.visible),reward:after.reward},
  changed:result.changed,localTime:localIso(),elapsedMs:elapsedMs()};
 s.episodeHistory=[row];
 s.pendingFeedback=copy(row);
 record('apply_potion',{stoneId:st.id,potionId:p.id,color:p.color,
  latentBefore:before.hidden,latentAfter:after.hidden,
  visibleBefore:before.visible,visibleAfter:after.visible,
  rewardBefore:before.reward,rewardAfter:after.reward,
  changed:result.changed,internalReason:result.reason});
 if(s.potions.every(x=>x.used))settleAllStones('potions_exhausted',false);
 animationBusy=true;
 setActionButtonsDisabled();
 playActionEffect('potion',st.id,p.id,p.color,before.visible)
  .catch(error=>console.warn('用药动画异常，继续显示反馈',error))
  .finally(()=>{animationBusy=false;render();notice('已完成用药，可查看前后变化');});
}
function executeDeposit(){
 if(!s||s.phase!=='playing'||s.pendingFeedback||animationBusy)return;
 if(!settleAllStones('all_stones_deposited',true))return;
 void revealSettlement();
}
function settleAllStones(reason,manual){
 if(!s||s.phase!=='playing'||s.stones.every(x=>x.submitted))return null;
 const stones=s.stones.map(stoneState);
 const values=stones.map(x=>x.reward);
 const total=values.reduce((sum,value)=>sum+value,0);
 for(const stone of s.stones)stone.submitted=true;
 s.selectedStone=null;s.selectedPotion=null;
 if(manual)s.actionsThisTrial++;
 s.trialScore=total;s.episodeScore+=total;s.totalScore+=total;
 s.pendingSettlementReveal={total,values,stones,reason};
 record('deposit_all_stones',{stoneIds:stones.map(x=>x.id),stoneValues:values,stones,
  reward:total,automatic:!manual,endReason:reason,
  trialScore:total,episodeScore:s.episodeScore,totalScore:s.totalScore});
 finishTrial(reason);
 return s.pendingSettlementReveal;
}
async function revealSettlement(){
 if(!s?.pendingSettlementReveal||s.pendingFeedback||animationBusy)return;
 const snapshot=copy(s.pendingSettlementReveal);
 animationBusy=true;setActionButtonsDisabled();render();
 try{await playBatchDepositEffect(snapshot);}
 catch(error){console.warn('统一投入动画异常，结算已保存',error);}
 finally{
  s.pendingSettlementReveal=null;animationBusy=false;writeSave();render();
  notice(`三块石头已统一结算，本轮 ${snapshot.total>=0?'+':''}${snapshot.total} 分`);
 }
}
function setActionButtonsDisabled(){
 get('applyBtn').disabled=true;
 get('depositBtn').disabled=true;
}
function centerOf(element){
 if(!element||typeof element.getBoundingClientRect!=='function')return null;
 const r=element.getBoundingClientRect();
 if(!Number.isFinite(r.left)||r.width===0||r.height===0)return null;
 return {x:r.left+r.width/2,y:r.top+r.height/2};
}
function showDepositScore(reward,stoneId){
 // Compose any signed total from the user's atlas, including totals such as -5/+13/+45.
 const signed=(reward>0?'+':'')+String(reward);
 const stage=get('fxLayer');
 const boxes={
  '0':[65,0,290,318],'1':[356,0,240,330],'2':[592,0,260,322],
  '3':[854,0,275,325],'4':[1130,0,294,322],
  '5':[55,320,295,301],'6':[353,322,246,300],'7':[601,322,245,298],
  '8':[849,320,278,301],'9':[1130,319,280,301],
  '+':[158,620,239,207],'-':[402,644,252,149]
 };
 const glyphs=[...signed].map(char=>{
  const [x,y,w,h]=boxes[char];
  return `<span class="score-atlas-glyph" data-glyph="${char}" style="--glyph-x:${-x}px;--glyph-y:${-y}px;--glyph-w:${w}px;--glyph-h:${h}px"></span>`;
 }).join('');
 stage.innerHTML=`<div class="fx-score-number" data-score="${signed}" role="presentation">${glyphs}</div>`;
 record('deposit_score_shown',{stoneIds:stoneId,reward,displayedScore:signed,durationPlannedMs:1500});
 notice(`本轮三块石头合计 ${signed} 分`);
 return new Promise(resolve=>window.setTimeout(()=>{stage.replaceChildren();resolve();},1500));
}
function playBatchDepositEffect(snapshot){
 const reduceMotion=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(typeof document.querySelector!=='function')return Promise.resolve();
 const dest=get('cauldronScene'),b=centerOf(dest),stage=get('fxLayer');
 if(reduceMotion||!b)return showDepositScore(snapshot.total,snapshot.stones.map(x=>x.id));
 const travelers=snapshot.stones.map(stone=>{
  const a=centerOf(document.querySelector(`#stonesList [data-stone-id="${stone.id}"]`));
  if(!a)return '';
  return `<div class="fx-traveler fx-deposit" style="left:${a.x}px;top:${a.y}px;--travel-x:${b.x-a.x}px;--travel-y:${b.y-a.y}px">${stoneImage(stone.visible)}<span class="fx-trail"></span></div>`;
 }).join('');
 stage.innerHTML=travelers;dest.classList.add('fx-cauldron-active');
 return new Promise(resolve=>window.setTimeout(()=>{
  stage.replaceChildren();dest.classList.remove('fx-cauldron-active');resolve();
 },1120)).then(()=>showDepositScore(snapshot.total,snapshot.stones.map(x=>x.id)));
}
function playActionEffect(kind,stoneId,potionId,color,visibleBefore,reward=null){
 // Model state and local backup are committed before animation starts; a refresh
 // can safely recover the pending feedback or submitted stone without replaying an action.
 const reduceMotion=typeof window.matchMedia==='function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(typeof document.querySelector!=='function')return Promise.resolve();
 if(reduceMotion)return kind==='deposit'?showDepositScore(reward,stoneId):Promise.resolve();
 const source=kind==='potion'?
  document.querySelector(`#potionsList [data-potion-id="${potionId}"]`):
  document.querySelector(`#stonesList [data-stone-id="${stoneId}"]`);
 const dest=kind==='potion'?
  document.querySelector(`#stonesList [data-stone-id="${stoneId}"]`):get('cauldronScene');
 const a=centerOf(source),b=centerOf(dest);
 if(!a||!b)return kind==='deposit'?showDepositScore(reward,stoneId):Promise.resolve();
 const stage=get('fxLayer');
 const sourceEffectClass=kind==='potion'?'fx-potion-source':'fx-deposit-source';
 source.classList.add(sourceEffectClass);
 const image=kind==='potion'?potionArt(color,'fx-potion-picture'):stoneImage(visibleBefore);
 stage.innerHTML=`<div class="fx-traveler ${kind==='potion'?'fx-potion':'fx-deposit'}"
    style="left:${a.x}px;top:${a.y}px;--travel-x:${b.x-a.x}px;--travel-y:${b.y-a.y}px">
    ${image}<span class="fx-trail"></span></div>
   <div class="fx-impact ${kind==='potion'?'fx-magic':'fx-cauldron-impact'}" style="left:${b.x}px;top:${b.y}px">
    <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>`;
 dest.classList.add('fx-target-pulse');
 if(kind==='deposit')get('cauldronScene').classList.add('fx-cauldron-active');
 return new Promise(resolve=>{
  window.setTimeout(()=>{
   stage.replaceChildren();source.classList.remove(sourceEffectClass);dest.classList.remove('fx-target-pulse');
   get('cauldronScene').classList.remove('fx-cauldron-active');
   resolve();
  },kind==='potion'?1040:1120);
 }).then(()=>kind==='deposit'?showDepositScore(reward,stoneId):undefined);
}
function finishTrial(reason){
 if(s.phase!=='playing')return;
 const summary={sessionId:s.sessionId,participantId:s.participantId,practice:s.practice,
  episode:s.episodeIndex+1,trial:s.trialIndex+1,
  startUTC:s.trialStartedUTC,endUTC:new Date().toISOString(),durationMs:trialElapsed(),
  endReason:reason,actionsPerformed:s.actionsThisTrial,
  score:s.trialScore,cumulativeEpisodeScore:s.episodeScore,cumulativeSessionScore:s.totalScore,
  stoneValues:s.stones.map(x=>Core.reward(x.latent)),
  potionsUsed:s.potions.filter(x=>x.used).length,
  rawValueDelta:s.trialScore-s.currentTrialInitial.stones.reduce((sum,x)=>sum+x.reward,0),
  initial:copy(s.currentTrialInitial),final:{stones:s.stones.map(stoneState),potions:copy(s.potions)},
  chemistry:copy(s.chemistry)};
 s.trials.push(summary);s.phase='between';
 record('trial_end',{endReason:reason,trialScore:s.trialScore});
}
function proceed(){
 if(!s||s.phase!=='between'||s.pendingFeedback||animationBusy||s.pendingSettlementReveal)return;
 if(s.trialIndex+1<s.config.trialsPerEpisode){beginTrial();return;}
 s.episodes.push({participantId:s.participantId,episode:s.episodeIndex+1,
  episodeScore:s.episodeScore,chemistry:copy(s.chemistry),durationMs:elapsedMs()-s.episodeStartedElapsedMs});
 record('episode_end',{episode:s.episodeIndex+1,score:s.episodeScore});
 if(s.episodeIndex+1<s.config.episodes){beginEpisode();return;}
 s.phase='completed';
 record('session_end',{finalScore:s.totalScore,episodes:s.config.episodes,trials:s.trials.length});
 render();
 notice('实验完成。请下载 JSON 或 CSV 数据。');
}
function valueIndex(reward){
 const index=Core.REWARD_LEVELS.indexOf(reward);
 if(index===-1)throw Error('Unknown reward category');
 return index;
}
function thermometer(reward){
 const level=valueIndex(reward);
 // Each stone has ONE value color. Higher levels fill more of the same-color column.
 // Never paint all four value colors in a single thermometer.
 const shade=VALUE_CLASSES[level];
 const cells=[3,2,1,0].map(i=>`<span class="thermo-cell${i<=level?' active '+shade:''}"></span>`).join('');
 return `<span class="thermometer" role="img" aria-label="石头价值等级：${VALUE_NAMES[level]}">
  <span class="thermo-tube">${cells}</span><span class="thermo-bulb ${shade}"></span></span>`;
}
function visibleText(a){return `${SIZES[a.size][0]} · ${COLORS[a.color][0]} · ${SHAPES[a.shape][0]}`;}
function stoneImage(a){
 const path=`assets/stone_${SHAPES[a.shape][1]}_${COLORS[a.color][1]}.png`;
 return `<img class="stone-image stone-size-${SIZES[a.size][1]}" src="${path}" alt="${visibleText(a)}石头" draggable="false">`;
}
function stoneArt(a,reward){
 return `<span class="stone-visual">${thermometer(reward)}<span class="stone-image-box">${stoneImage(a)}</span></span>`;
}
function stoneDescription(a){return `<span class="appearance">${visibleText(a)}</span>`;}
function potionArt(color,className='potion-image'){
 const [label,file]=POTIONS[color];
 return `<img class="${className}" src="assets/${file}" alt="${label}药水" draggable="false">`;
}
function renderStone(stone){
 const a=Core.visibleAttributes(stone.latent,s.chemistry);
 const btn=document.createElement('button');btn.type='button';
 btn.className='stone-tile'+(s.selectedStone===stone.id?' selected':'')+(stone.submitted?' submitted':'');
 btn.disabled=stone.submitted||s.phase!=='playing'||!!s.pendingFeedback;
 btn.setAttribute('data-stone-id',stone.id);
 btn.setAttribute('aria-pressed',s.selectedStone===stone.id?'true':'false');
 btn.setAttribute('aria-label',`原石${stone.id.slice(1)} ${visibleText(a)}${stone.submitted?' 已投入坩埚':''}`);
 btn.innerHTML=`${stoneArt(a,Core.reward(stone.latent))}<span class="stone-copy"><strong>原石 ${escapeHtml(stone.id.slice(1))}</strong>${stoneDescription(a)}${stone.submitted?'<span class="submitted-label">已投入</span>':''}</span>`;
 btn.addEventListener('click',()=>selectStone(stone.id));
 get('stonesList').appendChild(btn);
}
function renderPotion(p){
 const btn=document.createElement('button');btn.type='button';
 btn.className='potion-tile'+(s.selectedPotion===p.id?' selected':'')+(p.used?' used':'');
 btn.disabled=p.used||s.phase!=='playing'||!!s.pendingFeedback;
 btn.setAttribute('data-potion-id',p.id);
 btn.setAttribute('aria-pressed',s.selectedPotion===p.id?'true':'false');
 btn.setAttribute('aria-label',`${POTIONS[p.color][0]}药水 ${p.id}${p.used?' 已用':''}`);
 btn.innerHTML=`${potionArt(p.color)}<span>${POTIONS[p.color][0]}</span>`;
 btn.addEventListener('click',()=>selectPotion(p.id));
 get('potionsList').appendChild(btn);
}
function stateComparisonCard(title,snapshot){
 return `<div class="comparison-state"><span class="compare-label">${title}</span>
  ${stoneArt(snapshot.visible,snapshot.reward)}
  <span class="comparison-text">${visibleText(snapshot.visible)}</span></div>`;
}
function feedbackMarkup(row){
 return `<div class="feedback-potion">${potionArt(row.color,'feedback-potion-img')}
  <div><span class="detail-label">本次药水</span><strong>${POTIONS[row.color][0]}药水</strong></div></div>
  <div class="comparison-grid">${stateComparisonCard('用药前',row.before)}
  <span class="comparison-arrow" aria-hidden="true">→</span>
  ${stateComparisonCard('用药后',row.after)}</div>`;
}
function historyMarkup(row){
 return `<div class="history-card-body">
    ${stateComparisonCard('用药前',row.before)}
    <span class="history-arrow" aria-hidden="true">→</span>
    ${stateComparisonCard('用药后',row.after)}
  </div>`;
}
function renderHistory(){
 const row=s.episodeHistory.at(-1);
 const token=`${s.episodeIndex}:${s.trialIndex}:${row?.trial}:${row?.actionNumber}:${row?.elapsedMs}`;
 get('historyCount').textContent=row?`Trial ${row.trial}\n原石 ${row.stoneId.slice(1)}\n第 ${row.actionNumber} 次`:'等待首次用药';
 if(historyRenderToken===token)return;
 historyRenderToken=token;
 get('historyPotion').innerHTML=row?`<div class="history-potion"><span class="history-potion-label">药水</span>${potionArt(row.color,'history-potion-img')}<span class="history-potion-color">${POTIONS[row.color][0]}</span></div>`:'';
 const root=get('history');root.replaceChildren();
 if(!row){const empty=document.createElement('div');empty.className='history-empty';empty.textContent='使用药水后，这里显示最近一次用药的前后变化。';root.appendChild(empty);return;}
 const card=document.createElement('article');card.className='history-card';
 card.innerHTML=historyMarkup(row);root.appendChild(card);
}
function showFeedbackIfNeeded(){
 if(!s||!s.pendingFeedback)return;
 const dlg=get('actionDialog');
 if(dlg.open)return;
 const row=s.pendingFeedback;
 get('actionSub').textContent=`Episode ${row.episode} · Trial ${row.trial} · 第 ${row.actionNumber} 次行动`;
 get('actionDetails').innerHTML=feedbackMarkup(row);
 dlg.showModal();
 s.pendingFeedback.shownAtElapsedMs=elapsedMs();
 record('feedback_modal_open',{stoneId:row.stoneId,potionId:row.potionId,color:row.color});
}
function continueAfterFeedback(){
 if(!s||!s.pendingFeedback)return;
 const row=s.pendingFeedback;
 const shown=Number(row.shownAtElapsedMs);
 const durationMs=Number.isFinite(shown)?Math.max(0,Math.round((elapsedMs()-shown)*1000)/1000):null;
 get('actionDialog').close();
 s.pendingFeedback=null;
 record('feedback_continue',{stoneId:row.stoneId,potionId:row.potionId,color:row.color,feedbackViewingMs:durationMs});
 if(s.pendingSettlementReveal)void revealSettlement();else render();
}
function render(){
 if(!s){get('welcome').classList.remove('hidden');get('game').classList.add('hidden');return;}
 get('welcome').classList.add('hidden');get('game').classList.remove('hidden');
 get('game').setAttribute('data-phase',s.phase);
 get('episodeValue').textContent=`${s.episodeIndex+1} / ${s.config.episodes}`;
 get('trialValue').textContent=`${s.trialIndex+1} / ${s.config.trialsPerEpisode}`;
 get('totalValue').textContent=s.totalScore;
 get('mode').textContent=s.practice?'练习':'正式实验';
 get('stonesList').replaceChildren();get('potionsList').replaceChildren();
 for(const stone of s.stones)renderStone(stone);
 for(const p of s.potions)renderPotion(p);
 const active=s.phase==='playing'&&!s.pendingFeedback&&!animationBusy;
 const stone=s.stones.find(x=>x.id===s.selectedStone&&!x.submitted);
 const potion=s.potions.find(x=>x.id===s.selectedPotion&&!x.used);
 get('applyBtn').disabled=!(active&&stone&&potion);
 get('depositBtn').disabled=!(active&&s.stones.some(x=>!x.submitted));
 get('nextBtn').disabled=animationBusy||!!s.pendingFeedback||!!s.pendingSettlementReveal;
 get('transitionPane').classList.toggle('hidden',s.phase!=='between'||animationBusy||!!s.pendingFeedback);
 get('completePane').classList.toggle('hidden',s.phase!=='completed');
 if(s.phase==='between'){
  get('nextBtn').textContent=s.trialIndex+1<s.config.trialsPerEpisode?'进入下一 Trial':
   (s.episodeIndex+1<s.config.episodes?'进入下一 Episode':'完成实验');
 }else if(s.phase==='completed'){
  get('completeSummary').textContent=`全部完成 · ${s.trials.length} 个 Trial · 累计 ${s.totalScore} 分。请下载实验数据。`;
 }
 renderHistory();
 showFeedbackIfNeeded();
}
function payload(){
 return {metadata:{app:'Alchemy 2D Human Study',version:VERSION,
  reference:'Wang et al. (2021), Alchemy, NeurIPS',
  sourceCodeReference:'https://github.com/google-deepmind/dm_alchemy',
  note:'Independent human-interface adaptation. v6.5 settles all three stones together, including negative values, and composes their signed total from the Gothic numeral atlas.',
  participantId:s.participantId,sessionId:s.sessionId,practice:s.practice,
  sessionStartUTC:s.startedAtUTC,sessionStartLocal:s.startedAtLocal,
  exportedAtUTC:new Date().toISOString(),phase:s.phase,seed:s.seed,config:s.config,
  cumulativeScore:s.totalScore,
  timeMetric:'performance.now milliseconds (session clock includes wall time after page reload; inspect session_restored events)',
  visibleValue:'Thermometer value colors are explicitly disclosed: blue=-3, light blue=-1, light orange=+1, orange=+15',
  stoneMapping:'perEpisode reflections only: size/colour/shape = reflect * latent; rotation=0',
  potionPresentation:'six randomized same-color two-bottle groups; each row has two groups that are not opposite colors; fixed 4-column by 3-row slots across Trials; used slots remain in place',
  potionSlotLayout:copy(s.potionLayout),
  actionsPolicy:'apply potion or settle ALL three stones immediately; signed sum includes -3 and -1; exhausting all potions auto-settles; no separate End Trial button',
  animationPolicy:'~1s potion flight; simultaneous three-stone flight followed by ~1.5s combined signed total; reduced motion keeps a static total overlay',
  eventLog:'internalReason and latent states appear ONLY in exported researcher data',
  historyScope:'UI shows only the latest potion application within the current Episode; complete actions remain in exported events',
  chemistryNonrepeatPolicy:'every full Chemistry unique throughout a session; graph, potion mapping, and reflection all change versus previous Episode',
  episodeChemistryFingerprints:copy(s.chemistryKeys)},
  episodes:copy(s.episodes),trials:copy(s.trials),events:copy(s.events),
  currentProgress:{episode:s.episodeIndex+1,trial:s.trialIndex+1,phase:s.phase,
   actionsThisTrial:s.actionsThisTrial,trialScore:s.trialScore,
   chemistry:copy(s.chemistry),stones:copy(s.stones),potions:copy(s.potions),
   episodeHistory:copy(s.episodeHistory),pendingFeedback:copy(s.pendingFeedback)}};
}
function downloadFile(name,mime,data){
 const url=URL.createObjectURL(new Blob([data],{type:mime}));
 const a=document.createElement('a');a.href=url;a.download=name;
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),8000);
}
function downloadName(ext){
 const participant=s.participantId.replace(/[^A-Za-z0-9_-]/g,'_').slice(0,36)||'participant';
 return `Alchemy_v6_5_signed_${participant}_${s.practice?'practice':'formal'}_${s.sessionId.slice(-10)}.${ext}`;
}
function downloadJSON(){
 if(!s||s.phase!=='completed')return;
 downloadFile(downloadName('json'),'application/json;charset=utf-8',JSON.stringify(payload(),null,2));
 notice('JSON 数据下载已开始');
}
function csvField(v){
 const text=v==null?'':typeof v==='object'?JSON.stringify(v):String(v);
 return /[,"\r\n]/.test(text)?'"'+text.replaceAll('"','""')+'"':text;
}
function downloadCSV(){
 if(!s||s.phase!=='completed')return;
 const keys=['seq','type','sessionId','participantId','practice','episode','trial','utc','localTime','elapsedMs','trialElapsedMs',
  'actionNumber','stoneId','potionId','color','changed','internalReason','latentBefore','latentAfter',
  'visibleBefore','visibleAfter','rewardBefore','rewardAfter','reward','feedbackViewingMs',
  'trialScore','episodeScore','totalScore','endReason','seed','config','stoneIds','stoneValues','automatic','displayedScore'];
 const lines=[keys.join(',')];
 for(const e of s.events)lines.push(keys.map(k=>csvField(e[k])).join(','));
 downloadFile(downloadName('csv'),'text/csv;charset=utf-8','\ufeff'+lines.join('\r\n'));
 notice('CSV 数据下载已开始');
}
function clearAndSetup(){
 if(s&&!window.confirm('返回设置将清除当前 v6.5 会话的本地恢复备份。请先确认数据已经下载。'))return;
 s=null;rng=null;historyRenderToken='';animationBusy=false;
 try{localStorage.removeItem(STORAGE_KEY);}catch(error){console.warn(error);}
 get('actionDialog').open&&get('actionDialog').close();
 render();get('welcome').scrollIntoView({behavior:'smooth',block:'start'});
}
function restore(){
 let saved;
 try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');}catch(error){return;}
 if(!saved||saved.version!==VERSION||!Array.isArray(saved.events))return;
 const message=saved.phase==='completed'?'检测到已完成的 v6.5 实验。是否恢复，以便导出数据？':
   '检测到 v6.5 实验备份。是否恢复目前的进度和操作记录？';
 if(!window.confirm(message))return;
 s=saved;rng=Core.makeRng(s.seed);rng.restore(saved.rngState>>>0);
 s.episodeHistory=(s.episodeHistory||[]).slice(-1);
 s.config.historyScope='last_potion_in_episode';
 elapsedBase=Math.max(Number(saved.elapsedSavedMs)||0,Date.now()-Date.parse(s.startedAtUTC));
 perfZero=performance.now();historyRenderToken='';animationBusy=false;
 if(s.phase==='playing'&&s.pendingSettlementReveal&&s.stones.every(x=>x.submitted))finishTrial(s.pendingSettlementReveal.reason);
 record('session_restored',{resumeAfterUTC:saved.savedAtUTC,priorElapsedMs:saved.elapsedSavedMs,
  note:'Page reload: reaction times spanning reload need separate treatment'});
 render();if(s.pendingSettlementReveal&&!s.pendingFeedback)void revealSettlement();
 notice('实验已恢复。请注意页面重新加载可能影响反应时连续性。');
}
function bind(){
 for(const id of IDs){const e=document.getElementById(id);if(!e)throw Error('Missing UI element #'+id);dom[id]=e;}
 get('startBtn').addEventListener('click',()=>makeSession(false));
 get('practiceBtn').addEventListener('click',()=>makeSession(true));
 get('applyBtn').addEventListener('click',executePotion);
 get('depositBtn').addEventListener('click',executeDeposit);
 get('nextBtn').addEventListener('click',proceed);
 get('continueBtn').addEventListener('click',continueAfterFeedback);
 get('actionDialog').addEventListener('cancel',e=>e.preventDefault());
 get('finishExportBtn').addEventListener('click',downloadJSON);
 get('finishCsvBtn').addEventListener('click',downloadCSV);
 get('newSessionBtn').addEventListener('click',clearAndSetup);
 get('helpBtn').addEventListener('click',()=>get('helpDialog').showModal());
 get('closeHelpBtn').addEventListener('click',()=>get('helpDialog').close());
 document.addEventListener('visibilitychange',()=>{if(s&&s.phase==='playing')record('visibility_change',{hidden:document.hidden});});
 window.addEventListener('beforeunload',event=>{if(s&&s.phase==='playing'){writeSave();event.preventDefault();event.returnValue='';}});
 render();restore();
}
document.addEventListener('DOMContentLoaded',bind);
})();
