const {chromium}=require('C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const url=process.argv[2]||'http://127.0.0.1:8786/',out=path.resolve('alchemy_image_ui_design_20261025/replacement_qa');
(async()=>{
 const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-gpu']});const p=await b.newPage({viewport:{width:1366,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(url);await p.locator('#resourceLoader').waitFor({state:'hidden',timeout:90000});await p.locator('#launchBtn').click();await p.locator('#practiceBtn').click();await p.locator('#resourceLoader').waitFor({state:'hidden'});await p.locator('#game').waitFor({state:'visible'});await p.evaluate(()=>AlchemyImageUI.flush());
 const initial=await p.locator('#totalValue').evaluate(e=>e.parentElement.querySelector('.image-ui-layer').src);
 const first=p.locator('.potion-tile').first(),normal=await first.locator('.image-ui-layer').getAttribute('src');await first.click();await p.evaluate(()=>AlchemyImageUI.flush());assert.notEqual(await first.locator('.image-ui-layer').getAttribute('src'),normal);
 assert.equal(await first.evaluate(e=>getComputedStyle(e,'::before').display),'none');
 for(const [width,height] of [[1366,900],[1920,1080],[1280,720]]){await p.setViewportSize({width,height});await p.evaluate(()=>AlchemyImageUI.flush());await p.waitForTimeout(400);await p.screenshot({path:path.join(out,`integrated-cards-${width}-${url.includes('github.io')?'live':'local'}.png`)});assert.equal(await p.locator('.stat>.image-ui-layer').count(),3);assert.equal(await p.locator('.potion-tile>.image-ui-layer').count(),12);assert.equal(await first.evaluate(e=>e.scrollWidth>e.clientWidth+1),false);}
 await p.locator('#depositBtn').click();await p.waitForFunction(()=>!document.querySelector('#nextBtn').disabled);await p.evaluate(()=>AlchemyImageUI.flush());
 const current=await p.locator('#totalValue').evaluate(e=>({text:e.textContent,src:e.parentElement.querySelector('.image-ui-layer').src}));if(current.text!=='0')assert.notEqual(current.src,initial);
 assert.equal(errors.length,0,JSON.stringify(errors));fs.writeFileSync(path.join(out,'status-potions-'+(url.includes('github.io')?'live':'local')+'.json'),JSON.stringify({passed:true,url,sizes:[1366,1920,1280],oldFramesRemoved:true,selectedImageChanges:true,scoreImageUpdates:true,score:current.text,errors},null,2));console.log(JSON.stringify({passed:true,score:current.text,errors}));await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
