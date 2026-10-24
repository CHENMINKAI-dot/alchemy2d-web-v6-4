const {chromium}=require('C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),assert=require('node:assert/strict');
const path=require('path');
const WORK=__dirname;
const KEY='alchemy_human_experiment_v6_6_fixed_eval20_session';
const URL=process.argv[2]||'http://127.0.0.1:8780/';
const live=URL.includes('github.io');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce',acceptDownloads:true});
 // Speed up only the score overlay hold in QA; production timing is unchanged.
 await context.addInitScript(()=>{const original=window.setTimeout;window.setTimeout=(fn,ms,...args)=>original(fn,ms===1500?1:ms,...args);});
 const page=await context.newPage(),errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))failed.push([r.status(),r.url()]);});
 await page.goto(URL);await page.locator('#resourceLoader').waitFor({state:'hidden',timeout:60000});
 assert.equal(await page.locator('#episodeCount,#trialCount,#seed,#helpBtn,#helpDialog').count(),0);
 await page.locator('#aboutBtn').click();assert.equal(await page.locator('#rulesDialog li').count(),8);await page.locator('#rulesCloseBtn').click();
 const welcome=[];
 for(const viewport of [{width:1366,height:768},{width:1920,height:1080}]){
  await page.setViewportSize(viewport);await page.screenshot({path:path.join(WORK,`fixed-eval-${live?'live':'local'}-welcome-${viewport.width}.png`),fullPage:true});
  const d=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,coverVisible:document.body.dataset.screen==='cover'}));
  assert(d.scrollWidth<=d.width);welcome.push(d);
 }
 await page.setViewportSize({width:1366,height:768});
 await page.locator('#launchBtn').click();await page.locator('#formalModeBtn').click();await page.locator('#participantId').fill('QA_FIXED_20');await page.locator('#startBtn').click();
 await page.locator('#resourceLoader').waitFor({state:'hidden'});
 const state=()=>page.evaluate(()=>window.AlchemySessionStore.load());
 let s=await state();assert.equal(s.seed,0);assert.equal(s.config.episodes,20);assert.equal(s.config.trialsPerEpisode,10);
 const firstInitial=s.currentTrialInitial;
 for(let p=1;p<=12;p++){
  await page.locator('[data-stone-id="S1"]').click();await page.locator(`[data-potion-id="P${p}"]`).click();
  if(p===2)await page.locator('#historyToggle').click();
  await page.locator('#applyBtn').click();await page.locator('#actionDialog').waitFor({state:'visible'});
  assert.equal(await page.locator('#historyToggle').getAttribute('aria-expanded'),'false');
  await page.locator('#continueBtn').click();
 }
 await page.waitForFunction(()=>document.querySelector('#game').dataset.phase==='between'&&!document.querySelector('#nextBtn').disabled);
 s=await state();assert.equal(s.trials.length,1);assert.equal(s.trials[0].potionsUsed,12);
 assert.equal(s.events.filter(e=>e.type==='apply_potion')[1].historyClickedBeforeAction,true);
 assert.equal(s.events.filter(e=>e.type==='apply_potion')[0].historyClickedBeforeAction,false);
 assert.equal(s.events.find(e=>e.type==='deposit_all_stones').isDecision,false);
 await page.locator('#historyToggle').click();assert.equal(await page.locator('#history .history-card').count(),12);
 await page.locator('.history-panel').screenshot({path:path.join(WORK,`fixed-eval-${live?'live':'local'}-history.png`)});
 await page.locator('#nextBtn').click();
 s=await state();const secondInitial=s.currentTrialInitial;
 await page.reload();await page.locator('#resourceLoader').waitFor({state:'hidden'});await page.locator('#noticeConfirmBtn').click();await page.locator('#game').waitFor({state:'visible'});
 s=await state();assert.deepEqual(s.currentTrialInitial,secondInitial);assert.equal(s.trialIndex,1);assert.equal(s.events.filter(e=>e.type==='session_restored').length,1);
 // Complete all remaining trials through real DOM controls and production handlers.
 await page.evaluate(async()=>{
  for(let guard=0;guard<210;guard++){
   if(document.querySelector('#game').dataset.phase==='completed')return;
   if(document.querySelector('#game').dataset.phase==='playing'){
    for(let potion=1;potion<=12;potion++){
     document.querySelector('[data-stone-id="S1"]').click();
     document.querySelector(`[data-potion-id="P${potion}"]`).click();
     document.querySelector('#applyBtn').click();
     while(!document.querySelector('#actionDialog').open)await new Promise(r=>setTimeout(r,1));
     document.querySelector('#continueBtn').click();
    }
    while(document.querySelector('#nextBtn').disabled)await new Promise(r=>setTimeout(r,1));
   }
   document.querySelector('#nextBtn').click();
  }
  throw Error('Did not reach 200 Trial completion');
 });
 s=await state();assert.equal(s.phase,'completed');assert.equal(s.trials.length,200);assert.equal(s.episodes.length,20);
 const schedule=await page.evaluate(()=>window.AlchemyEvaluationSchedule);
 assert.deepEqual(s.trials.map(t=>[t.episode,t.trial]),Array.from({length:200},(_,i)=>[1+Math.floor(i/10),1+i%10]));
 for(const t of s.trials){
  const e=schedule.episodes[t.episode-1];
  assert.deepEqual(t.initial.stones.map(x=>x.hidden),e.initialLatentStones[t.trial-1]);
  assert.equal(t.sourceChemistryId,e.source.chemistry_id);assert.equal(t.evaluationEpisodeSeed,e.source.evaluation_episode_seed);
  assert.equal(t.numPreconditions,Math.floor((t.episode-1)/5));
  assert.equal(t.score,t.final.stones.reduce((sum,stone)=>sum+stone.reward,0));
 }
 assert.equal(s.totalScore,s.trials.reduce((sum,t)=>sum+t.score,0));
 assert.equal(s.events.filter(e=>e.type==='apply_potion').length,2400);
 const serializedBackupBytes=Buffer.byteLength(JSON.stringify(s),'utf16le');assert(serializedBackupBytes>5*1024*1024);
 await page.reload();await page.locator('#resourceLoader').waitFor({state:'hidden'});await page.locator('#noticeConfirmBtn').click();await page.locator('#game').waitFor({state:'visible'});
 s=await state();assert.equal(s.trials.length,200);assert.equal(s.events.filter(e=>e.type==='apply_potion').length,2400);
 const [jsonDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#finishExportBtn').click()]);
 const jsonPath=path.join(WORK,`fixed-eval-${live?'live':'local'}-export.json`);await jsonDownload.saveAs(jsonPath);
 const exported=JSON.parse(fs.readFileSync(jsonPath,'utf8'));
 assert.equal(exported.metadata.fixedEvaluationSchedule.episodes.length,20);
 assert.equal(exported.metadata.fixedEvaluationSchedule.scheduleId,schedule.scheduleId);
 assert.equal(exported.trials.length,200);
 const [csvDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#finishCsvBtn').click()]);
 const csvPath=path.join(WORK,`fixed-eval-${live?'live':'local'}-export.csv`);await csvDownload.saveAs(csvPath);
 const csv=fs.readFileSync(csvPath,'utf8');assert(csv.startsWith('\ufeffseq,'));
 for(const key of ['sourceChemistryId','evaluationEpisodeSeed','numPreconditions','scheduleId','historyClickedBeforeAction'])assert(csv.split('\n')[0].includes(key));
 // Practice stays 1x2 and cannot consume/change the formal schedule.
 await page.locator('#newSessionBtn').click();await page.locator('#noticeConfirmBtn').click();await page.locator('#launchBtn').click();await page.locator('#practiceBtn').click();
 await page.locator('#resourceLoader').waitFor({state:'hidden'});s=await state();assert.equal(s.config.episodes,1);assert.equal(s.config.trialsPerEpisode,2);assert.equal(s.config.scheduleId,null);
 await page.evaluate(async()=>{for(let i=0;i<2;i++){
  document.querySelector('#depositBtn').click();while(document.querySelector('#nextBtn').disabled)await new Promise(r=>setTimeout(r,5));document.querySelector('#nextBtn').click();
 }});
 await page.locator('#newSessionBtn').click();await page.locator('#noticeConfirmBtn').click();await page.locator('#launchBtn').click();await page.locator('#formalModeBtn').click();await page.locator('#participantId').fill('QA_REPEAT');await page.locator('#startBtn').click();await page.locator('#resourceLoader').waitFor({state:'hidden'});
 s=await state();assert.deepEqual(s.currentTrialInitial,firstInitial);
 await page.screenshot({path:path.join(WORK,`fixed-eval-${live?'live':'local'}-game.png`),fullPage:true});
 assert.equal(errors.length,0,errors.join(';'));assert.equal(failed.length,0,JSON.stringify(failed));
 const result={url:URL,scheduleId:schedule.scheduleId,formalEpisodes:20,formalTrials:200,selectionSeed:0,
  allInitialStonesMatchPPOEvaluation:true,fullSourceProvenanceInJSONAndCSV:true,refreshRestore:true,
  historyAutoCollapseAndDecisionTracking:true,potionExhaustionSettlement:true,signedSettlement:true,
  practiceIndependent:true,newFormalSessionReproducible:true,welcome,pageErrors:errors,failedRequests:failed,
  full2400PotionActionsSavedAndRestored:true,serializedBackupBytes,incrementalIndexedDB:true,qaOnlyShortenedScoreOverlayHold:true};
 fs.writeFileSync(path.join(WORK,`fixed_evaluation_${live?'live':'local'}_qa.json`),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
