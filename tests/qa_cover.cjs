const {chromium}=require('C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const URL=process.argv[2]||'http://127.0.0.1:8780/';const live=URL.includes('github.io'),prefix=live?'cover-live':'cover-local';
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce',acceptDownloads:true});
 await context.addInitScript(()=>{const original=window.setTimeout;window.setTimeout=(fn,ms,...args)=>original(fn,ms===1500?1:ms,...args);});
 const page=await context.newPage(),errors=[],nativeDialogs=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{if(d.type()!=='beforeunload')nativeDialogs.push({type:d.type(),message:d.message()});await d.accept();});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))failed.push([r.status(),r.url()]);});
 await page.route('**/assets/cauldron.png',async route=>{await new Promise(r=>setTimeout(r,900));await route.continue();});
 await page.goto(URL,{waitUntil:'domcontentloaded'});
 await page.locator('#resourceLoader').screenshot({path:path.join(__dirname,prefix+'-loading.png')});
 await page.locator('#resourceLoader').waitFor({state:'hidden',timeout:60000});await page.unroute('**/assets/cauldron.png');
 assert.equal(await page.locator('#welcome').innerText(),'开始实验\n关于实验');
 assert.equal(await page.locator('#welcome button').count(),2);
 assert.equal(await page.locator('.resource-loader-mark,#helpBtn,.welcome-copy,.setup,.welcome-rules').count(),0);
 const layouts=[];
 for(const viewport of [{width:1920,height:1080},{width:1366,height:768},{width:1280,height:720},{width:1024,height:768}]){
  await page.setViewportSize(viewport);await page.screenshot({path:path.join(__dirname,prefix+'-'+viewport.width+'.png')});
  const d=await page.evaluate(()=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}};
   return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,
           cover:rect(document.querySelector('#welcome')),buttons:[...document.querySelectorAll('.cover-actions button')].map(rect)};
  });
  assert(d.scrollWidth<=d.width);assert(d.scrollHeight<=d.height);
  assert(d.buttons.every(b=>b.y>0&&b.bottom<=d.height&&b.x>=0&&b.right<=d.width));layouts.push(d);
 }
 await page.setViewportSize({width:1366,height:768});
 await page.locator('#aboutBtn').click();await page.locator('#rulesDialog').waitFor({state:'visible'});
 assert.equal(await page.locator('#rulesDialog li').count(),8);
 assert((await page.locator('#rulesDialog').innerText()).includes('−3 分'));
 await page.locator('#rulesDialog').screenshot({path:path.join(__dirname,prefix+'-rules.png')});
 await page.keyboard.press('Escape');await page.locator('#rulesDialog').waitFor({state:'hidden'});
 await page.locator('#launchBtn').click();await page.locator('#modeDialog').waitFor({state:'visible'});
 await page.locator('#modeDialog').screenshot({path:path.join(__dirname,prefix+'-modes.png')});
 await page.locator('#formalModeBtn').click();assert.equal(await page.locator('#modeDialog').isVisible(),false);
 await page.locator('#startBtn').click();assert.equal(await page.locator('#participantError').innerText(),'请填写被试编号');
 assert.equal(await page.locator('#game').isVisible(),false);
 await page.locator('#participantDialog').screenshot({path:path.join(__dirname,prefix+'-participant.png')});
 await page.locator('#participantBackBtn').click();await page.locator('#modeDialog').waitFor({state:'visible'});
 // Practice does not ask for or depend on a participant ID.
 await page.locator('#practiceBtn').click();await page.locator('#resourceLoader').waitFor({state:'hidden'});
 let s=await page.evaluate(()=>AlchemySessionStore.load());assert.equal(s.practice,true);assert.equal(s.participantId,'PRACTICE');assert.equal(s.config.trialsPerEpisode,2);
 const finish=async count=>page.evaluate(async count=>{
  for(let i=0;i<count;i++){
   document.querySelector('#depositBtn').click();while(document.querySelector('#nextBtn').disabled)await new Promise(r=>setTimeout(r,5));
   document.querySelector('#nextBtn').click();
  }
 },count);
 await finish(2);s=await page.evaluate(()=>AlchemySessionStore.load());assert.equal(s.phase,'completed');
 await page.locator('#newSessionBtn').click();await page.locator('#noticeDialog').waitFor({state:'visible'});
 await page.locator('#noticeCancelBtn').click();assert.equal(await page.locator('#game').isVisible(),true);
 await page.locator('#newSessionBtn').click();await page.locator('#noticeConfirmBtn').click();await page.locator('#welcome').waitFor({state:'visible'});
 await page.locator('#launchBtn').click();await page.locator('#formalModeBtn').click();await page.locator('#participantId').fill('QA_COVER');await page.keyboard.press('Enter');
 await page.locator('#resourceLoader').waitFor({state:'hidden'});
 s=await page.evaluate(()=>AlchemySessionStore.load());assert.equal(s.practice,false);assert.equal(s.participantId,'QA_COVER');assert.equal(s.seed,0);assert.equal(s.config.episodes,20);assert.equal(s.config.trialsPerEpisode,10);
 const initial=s.currentTrialInitial;
 await page.locator('[data-stone-id="S1"]').click();await page.locator('[data-potion-id="P1"]').click();await page.locator('#applyBtn').click();
 await page.locator('#actionDialog').waitFor({state:'visible'});await page.locator('#continueBtn').click();
 await page.locator('#historyToggle').click();
 await page.reload();await page.locator('#resourceLoader').waitFor({state:'hidden'});
 await page.locator('#noticeDialog').waitFor({state:'visible'});
 assert((await page.locator('#noticeMessage').innerText()).includes('恢复'));
 await page.locator('#noticeDialog').screenshot({path:path.join(__dirname,prefix+'-restore.png')});
 await page.locator('#noticeConfirmBtn').click();await page.locator('#game').waitFor({state:'visible'});
 s=await page.evaluate(()=>AlchemySessionStore.load());assert.deepEqual(s.currentTrialInitial,initial);assert.equal(s.trialHistory.length,1);assert.equal(s.historyExpanded,false);
 assert.equal(await page.locator('#aboutBtn').isVisible(),false);
 await finish(200);s=await page.evaluate(()=>AlchemySessionStore.load());assert.equal(s.phase,'completed');assert.equal(s.trials.length,200);assert.equal(s.episodes.length,20);
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#finishExportBtn').click()]);
 const jsonPath=path.join(__dirname,prefix+'-export.json');await download.saveAs(jsonPath);
 const exported=JSON.parse(fs.readFileSync(jsonPath,'utf8'));assert.equal(exported.trials.length,200);assert.equal(exported.metadata.fixedEvaluationSchedule.scheduleId,'eval20-seed0-9e42a1c20a1cbeef');
 assert.equal(errors.length,0,errors.join(';'));assert.equal(nativeDialogs.length,0,JSON.stringify(nativeDialogs));assert.equal(failed.length,0,JSON.stringify(failed));
 const report={url:URL,coverOnlyTwoButtons:true,existingAtlasPanelsAndButtons:true,practiceWithoutId:true,formalIdValidationAndEnter:true,
  rulesModal:true,customRestoreAndReturnDialogs:true,noNativeAppDialogs:true,loadingPanel:true,layouts,formal200TrialCompletionAndExport:true,
  unchangedSchedule:'eval20-seed0-9e42a1c20a1cbeef',pageErrors:errors,failedRequests:failed};
 fs.writeFileSync(path.join(__dirname,prefix+'-qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
