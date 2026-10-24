const {chromium}=require('C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const SID='eval20-blocks-seed0-802b34f2bf11d484';
const URL=process.argv[2]||'http://127.0.0.1:8780/';
const OUTPUT=process.argv[3]||__dirname;
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce',acceptDownloads:true});
 await context.addInitScript(()=>{const timer=window.setTimeout;window.setTimeout=(f,ms,...args)=>timer(f,ms===1500?1:ms,...args);});
 const page=await context.newPage(),errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))failed.push([r.status(),r.url()]);});
 await page.goto(URL);await page.locator('#resourceLoader').waitFor({state:'hidden',timeout:60000});
 const guide=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/instructions_source.json'),'utf8'));
 const old=require('../docs/protocol_archive/oracle_balanced20_grouped/evaluation_schedule.js');
 const layoutChecks=[];
 for(const size of [{width:1366,height:768},{width:1280,height:600},{width:1920,height:1080}]){
  await page.setViewportSize(size);await page.locator('#aboutBtn').click();
  assert.deepEqual(await page.locator('#rulesDialog h2,#rulesContent h3,#rulesContent p').allTextContents(),guide.paragraphs);
  const before=await page.evaluate(()=>{const d=document.querySelector('#rulesDialog'),b=document.querySelector('#rulesContent'),f=document.querySelector('#rulesCloseBtn');return {footer:f.getBoundingClientRect().toJSON(),dialog:d.getBoundingClientRect().toJSON(),scrollHeight:b.scrollHeight,clientHeight:b.clientHeight};});
  assert(before.scrollHeight>before.clientHeight);
  assert(before.footer.bottom<=size.height&&before.footer.top>=0);
  await page.locator('#rulesContent').hover();await page.mouse.wheel(0,2000);
  await page.waitForFunction(()=>document.querySelector('#rulesContent').scrollTop>0);
  const after=await page.evaluate(()=>({footer:document.querySelector('#rulesCloseBtn').getBoundingClientRect().toJSON(),dialogTop:document.querySelector('#rulesDialog').scrollTop,bodyTop:document.querySelector('#rulesContent').scrollTop}));
  assert.deepEqual(after.footer,before.footer);assert.equal(after.dialogTop,0);assert(after.bodyTop>0);
  await page.screenshot({path:path.join(OUTPUT,'blocks20-rules-'+size.width+'-'+size.height+'.png')});
  layoutChecks.push({size,footerFixed:true,textScrollOnly:true});
  await page.locator('#rulesCloseBtn').click();await page.locator('#aboutBtn').click();
  assert.equal(await page.locator('#rulesContent').evaluate(e=>e.scrollTop),0);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#rulesDialog').evaluate(e=>e.open),false);
 }
 await page.setViewportSize({width:1366,height:768});
 const schedule=await page.evaluate(()=>AlchemyEvaluationSchedule);assert.equal(schedule.scheduleId,SID);
 assert.equal(await page.evaluate(()=>AlchemyFixedProtocol.validate()),true);
 assert.deepEqual(schedule.episodes.map(e=>e.source.num_preconditions),[0,1,2,3,1,3,0,2,2,0,3,1,3,2,1,0,1,0,3,2]);
 for(const e of schedule.episodes){const restored=structuredClone(e);delete restored.originalEpisode;delete restored.block;delete restored.positionInBlock;restored.episode=e.originalEpisode;assert.deepEqual(restored,old.episodes[e.originalEpisode-1]);}

 await page.evaluate(async()=>{
  await new Promise((resolve,reject)=>{const r=indexedDB.open('alchemy_human_experiment_v6_6_fixed_eval20_eval20-oracle-balanced-seed0-2d7620305076e66b',1);
   r.onupgradeneeded=()=>{for(const n of ['session','events','trials','episodes'])r.result.createObjectStore(n);};
   r.onsuccess=()=>{const db=r.result,tx=db.transaction('session','readwrite');tx.objectStore('session').put({archivedOldDataMarker:'KEEP_OLD_DATA'},'active');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};
   r.onerror=()=>reject(r.error);});
 });
 await page.locator('#launchBtn').click();await page.locator('#formalModeBtn').click();
 await page.locator('#participantId').fill('QA_BLOCKS20');await page.locator('#startBtn').click();
 await page.locator('#game').waitFor({state:'visible'});await page.locator('#resourceLoader').waitFor({state:'hidden'});
 let s=await page.evaluate(()=>AlchemySessionStore.load());assert.equal(s.config.scheduleId,SID);assert.equal(s.seed,0);
 assert.equal(s.config.episodes,20);assert.equal(s.config.trialsPerEpisode,10);
 await page.locator('[data-stone-id="S1"]').click();await page.locator('[data-potion-id="P1"]').click();
 await page.locator('#historyToggle').click();await page.locator('#applyBtn').click();
 await page.locator('#actionDialog').waitFor({state:'visible'});await page.locator('#continueBtn').click();
 assert.equal(await page.locator('#historyToggle').getAttribute('aria-expanded'),'false');
 await page.reload();await page.locator('#resourceLoader').waitFor({state:'hidden'});
 await page.locator('#noticeDialog').waitFor({state:'visible'});await page.locator('#noticeConfirmBtn').click();
 await page.locator('#game').waitFor({state:'visible'});
 s=await page.evaluate(()=>AlchemySessionStore.load());assert.equal(s.config.scheduleId,SID);assert.equal(s.trialHistory.length,1);
 assert.equal(s.events.find(e=>e.type==='apply_potion').historyClickedBeforeAction,true);
 await page.evaluate(async()=>{for(let i=0;i<200;i++){
  document.querySelector('#depositBtn').click();
  while(document.querySelector('#nextBtn').disabled)await new Promise(r=>setTimeout(r,5));
  document.querySelector('#nextBtn').click();
 }});
 s=await page.evaluate(()=>AlchemySessionStore.load());assert.equal(s.phase,'completed');assert.equal(s.trials.length,200);
 for(const trial of s.trials){
  const e=schedule.episodes[trial.episode-1];
  assert.deepEqual(trial.initial.stones.map(x=>x.hidden),e.initialLatentStones[trial.trial-1]);
  assert.equal(trial.originalEpisode,e.originalEpisode);assert.equal(trial.block,e.block);assert.equal(trial.positionInBlock,e.positionInBlock);
  assert.equal(trial.sourceChemistryId,e.source.chemistry_id);assert.equal(trial.scheduleId,SID);
  assert.equal(trial.evaluationEpisodeSeed,e.source.evaluation_episode_seed);
  assert.equal(trial.score,trial.final.stones.reduce((sum,x)=>sum+x.reward,0));
 }
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#finishExportBtn').click()]);
 const downloaded=path.join(OUTPUT,'blocks20-'+(URL.includes('github.io')?'live':'local')+'-export.json');
 await download.saveAs(downloaded);const exported=JSON.parse(fs.readFileSync(downloaded));
 assert.deepEqual(exported.metadata.fixedEvaluationSchedule.ordering,schedule.ordering);assert.equal(exported.metadata.fixedEvaluationSchedule.scheduleId,SID);assert.equal(exported.trials.length,200);
 const [csvDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#finishCsvBtn').click()]);
 const csvPath=path.join(OUTPUT,'blocks20-'+(URL.includes('github.io')?'live':'local')+'-export.csv');await csvDownload.saveAs(csvPath);
 const csvHeader=fs.readFileSync(csvPath,'utf8').split('\n')[0];
 for(const key of ['originalEpisode','block','positionInBlock','historyClickedBeforeAction'])assert(csvHeader.includes(key));
 const preserved=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('alchemy_human_experiment_v6_6_fixed_eval20_eval20-oracle-balanced-seed0-2d7620305076e66b',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('session').objectStore('session').get('active');q.onsuccess=()=>{db.close();resolve(q.result);};q.onerror=()=>reject(q.error);};r.onerror=()=>reject(r.error);}));
 assert.equal(preserved.archivedOldDataMarker,'KEEP_OLD_DATA');
 const distributions=[];
 for(let g=0;g<4;g++)for(let t=0;t<10;t++){
  const values=schedule.episodes.filter(e=>e.source.num_preconditions===g).map(e=>e.oracleTrialScores[t]).sort((a,b)=>a-b);
  assert.deepEqual(values,[31,45,45,45,45]);distributions.push(values);
 }
 await page.screenshot({path:path.join(OUTPUT,'blocks20-'+(URL.includes('github.io')?'live':'local')+'.png'),fullPage:true});
 assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(failed.length,0,JSON.stringify(failed));
 const report={url:URL,scheduleId:SID,layoutChecks,exactGuidanceText:true,allOriginalEpisodePayloadsPreserved:true,blocks:schedule.ordering.blocks,all200InitialConditionsVerified:true,all200TrialsCompletedAndExported:true,
  historyDecisionTrackingAndAutoCollapse:true,refreshRestore:true,oldDatabasePreserved:true,
  oracleAll40ClassTrialMeansExactly42_2:true,web960TransitionsAnd160ValuesValidated:true,pageErrors:errors,failedRequests:failed};
 fs.writeFileSync(path.join(OUTPUT,'blocks20-'+(URL.includes('github.io')?'live':'local')+'-qa.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
