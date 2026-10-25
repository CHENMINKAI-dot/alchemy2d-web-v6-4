const {chromium}=require('C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const URL=process.argv[2]||'http://127.0.0.1:8786/';const out=path.resolve(process.argv[3]||path.join(__dirname,'image_ui_results'));fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-gpu']});
 const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage(),errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))failed.push(r.url())});
 await page.goto(URL);await page.locator('#resourceLoader').waitFor({state:'hidden',timeout:90000});await page.evaluate(()=>AlchemyImageUI.flush());
 assert.equal(await page.locator('#resourceProgress').getAttribute('aria-valuenow'),'100');
 assert.equal(await page.locator('button.button:not(.image-ui-button)').count(),0);
 assert(await page.locator('#launchBtn').evaluate(e=>getComputedStyle(e).backgroundImage.includes('button_start.png')));
 await page.mouse.move(0,0);const before=await page.locator('#launchBtn').boundingBox();await page.locator('#launchBtn').hover();await page.waitForTimeout(200);const after=await page.locator('#launchBtn').boundingBox();assert(Math.abs(after.y-before.y+2)<.2);
 await page.locator('#launchBtn').focus();await page.keyboard.press('Enter');await page.locator('#modeDialog').waitFor({state:'visible'});await page.locator('#practiceBtn').click();await page.locator('#game').waitFor({state:'visible'});await page.locator('#resourceLoader').waitFor({state:'hidden'});await page.evaluate(()=>AlchemyImageUI.flush());
 assert.equal(await page.locator('.stone-tile>.image-ui-layer').count(),3);assert.equal(await page.locator('.potion-tile>.image-ui-layer').count(),12);
 const data=await page.evaluate(()=>[...document.querySelectorAll('.stone-tile,.potion-tile,.stat')].map(e=>({image:e.querySelector(':scope>.image-ui-layer')?.src,visibleChildren:[...e.children].filter(n=>!n.classList.contains('image-ui-layer')).every(n=>getComputedStyle(n).visibility==='hidden')})));
 assert(data.every(x=>x.image?.startsWith('data:image/png;base64,')&&x.visibleChildren));
 for(let i=0;i<2;i++){
  await page.locator('[data-stone-id=S1]').click();await page.locator('.potion-tile:not(:disabled)').first().click();await page.locator('#historyToggle').click();await page.locator('#applyBtn').click();await page.locator('#actionDialog').waitFor({state:'visible'});await page.evaluate(()=>AlchemyImageUI.flush());await page.locator('#continueBtn').click();assert.equal(await page.locator('#historyToggle').getAttribute('aria-expanded'),'false');
 }
 await page.locator('#historyToggle').click();await page.evaluate(()=>AlchemyImageUI.flush());assert.equal(await page.locator('.history-card>.image-ui-layer').count(),2);assert.equal(await page.locator('#history').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),2);assert((await page.locator('#historyToggle').getAttribute('aria-label')).includes('2 次用药'));
 const s=await page.evaluate(()=>AlchemySessionStore.load());assert(s.events.filter(e=>e.type==='apply_potion').every(e=>e.historyClickedBeforeAction===true));
 await page.locator('#history').scrollIntoViewIfNeeded();await page.waitForTimeout(400);await page.screenshot({path:path.join(out,'two-records-'+(URL.includes('github.io')?'live':'local')+'.png')});
 assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(failed.length,0,JSON.stringify(failed));
 let retryCheck='not run on live';
 if(!URL.includes('github.io')){
  const c=await browser.newContext(),p=await c.newPage();let block=true;
  await p.route('**/assets/image_ui/button_about.png',route=>block?route.fulfill({status:503,body:'Temporary QA failure'}):route.continue());
  await p.goto(URL);await p.locator('#resourceRetry').waitFor({state:'visible',timeout:60000});assert(await p.locator('#resourceLoader').isVisible());assert(Number(await p.locator('#resourceProgress').getAttribute('aria-valuenow'))<100);
  block=false;await p.locator('#resourceRetry').click();await p.locator('#resourceLoader').waitFor({state:'hidden',timeout:90000});await p.evaluate(()=>AlchemyImageUI.flush());assert.equal(await p.evaluate(()=>AlchemyImageUI.status().error),null);retryCheck='failed image blocks start; retry recovers';await c.close();
 }
 const report={passed:true,url:URL,allFixedButtonsImageOnly:true,dynamicCardsSinglePNG:true,wholeButtonHoverMotion:true,keyboardActivation:true,twoColumnHistory:true,autoCollapseAndDecisionLogging:true,loaderWaitsForFinalImages:true,retryCheck,errors,failed};
 fs.writeFileSync(path.join(out,'image-ui-'+(URL.includes('github.io')?'live':'local')+'-qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
