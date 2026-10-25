const {chromium}=require('C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const url=process.argv[2]||'http://127.0.0.1:8786/',baseline=process.argv.includes('--baseline');
const out=path.resolve('alchemy_image_ui_design_20261025/replacement_qa');
(async()=>{
 const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-gpu']});
 try{
 const p=await b.newPage({viewport:{width:1366,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(url);await p.locator('#resourceLoader').waitFor({state:'hidden',timeout:90000});await p.locator('#launchBtn').click();await p.locator('#practiceBtn').click();await p.locator('#game').waitFor({state:'visible'});await p.locator('#resourceLoader').waitFor({state:'hidden'});await p.evaluate(()=>AlchemyImageUI.flush());
 const session=await p.context().newCDPSession(p);await session.send('Emulation.setCPUThrottlingRate',{rate:4});
 const selections=await p.evaluate(async()=>{
  const results=[];const usable=e=>{const im=e.querySelector(':scope>.image-ui-layer');return !!im&&im.complete&&im.naturalWidth>0;};
  for(const selector of ['[data-stone-id=S1]','[data-potion-id=P1]','[data-stone-id=S2]','[data-potion-id=P2]']){
   const old=[...document.querySelectorAll('.potion-tile,.stone-tile')],clicked=document.querySelector(selector);clicked.focus();
   const start=performance.now();clicked.click();const immediate=old.filter(e=>!e.isConnected).length;
   const frames=[];for(let n=0;n<10;n++){await new Promise(requestAnimationFrame);frames.push([...document.querySelectorAll('.potion-tile')].filter(e=>!usable(e)).length);}
   await AlchemyImageUI.flush();results.push({selector,removedCards:immediate,blankPotionFrames:frames.filter(x=>x>0).length,maxMissing:Math.max(...frames),focusRetained:document.activeElement===clicked,duration:performance.now()-start});
  }return results;
 });
 await p.evaluate(()=>AlchemyImageUI.flush());const closed=await p.locator('#historyToggle>.image-ui-layer').getAttribute('src');await p.locator('#historyToggle').click();await p.evaluate(()=>AlchemyImageUI.flush());const expanded=await p.locator('#historyToggle>.image-ui-layer').getAttribute('src');await p.locator('#historyToggle').click();await p.evaluate(()=>AlchemyImageUI.flush());
 let motion=null;
 if(!baseline){
  assert(selections.every(x=>x.removedCards===0&&x.blankPotionFrames===0&&x.focusRetained),JSON.stringify(selections));assert.notEqual(expanded,closed,'Disclosure arrow image must reflect expanded state');
  await p.locator('[data-stone-id=S1]').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('[data-stone-id=S1]').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('[data-stone-id=S1]').evaluate(e=>document.activeElement===e),true);await p.keyboard.press('Tab');assert.equal(await p.locator('[data-stone-id=S2]').evaluate(e=>document.activeElement===e),true);
  await p.locator('[data-potion-id=P1]').click();await p.locator('#historyToggle').click();
  await p.evaluate(()=>{document.querySelector('#applyBtn').click();document.querySelector('#applyBtn').click();});
  assert.equal(await p.locator('#stonesList button:not(:disabled),#potionsList button:not(:disabled)').count(),0);
  await p.locator('#actionDialog').waitFor({state:'visible'});await p.evaluate(()=>AlchemyImageUI.flush());await p.locator('#continueBtn').click();await p.evaluate(()=>AlchemyImageUI.flush());assert.equal(await p.locator('#historyToggle').getAttribute('aria-expanded'),'false');assert.equal(await p.locator('[data-potion-id=P1]').isDisabled(),true);
  assert.equal(await p.evaluate(async()=>(await AlchemySessionStore.load()).events.filter(e=>e.type==='apply_potion').length),1);
  await p.locator('#historyToggle').click();await p.evaluate(()=>AlchemyImageUI.flush());assert.equal(await p.locator('.history-card>.image-ui-layer').count(),1);
  await p.emulateMedia({reducedMotion:'reduce'});await p.locator('.potion-tile:not(:disabled)').first().hover();motion=await p.locator('.potion-tile:not(:disabled)').first().evaluate(e=>({transition:getComputedStyle(e).transitionDuration,transform:getComputedStyle(e).transform}));assert.equal(motion.transition,'0s');assert.equal(motion.transform,'none');
  await p.screenshot({path:path.join(out,'interaction-stability-'+(url.includes('github.io')?'live':'local')+'.png')});
 }
 assert.equal(errors.length,0,JSON.stringify(errors));const report={url,baseline,selections,disclosureImageChanges:expanded!==closed,reducedMotion:motion,errors};fs.writeFileSync(path.join(out,'interaction-'+(baseline?'baseline':url.includes('github.io')?'live':'local')+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
