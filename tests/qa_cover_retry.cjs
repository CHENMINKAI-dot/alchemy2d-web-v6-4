const {chromium}=require('C:/Users/Lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const page=await browser.newPage();let fail=true;
 await page.route('**/assets/potion_green.png',async route=>{if(fail){fail=false;await route.abort();}else await route.continue();});
 await page.goto('http://127.0.0.1:8780/');await page.locator('#resourceRetry').waitFor({state:'visible'});
 assert.equal(await page.locator('#resourceLoader').isVisible(),true);
 assert(Number(await page.locator('#resourceProgress').getAttribute('aria-valuenow'))<100);
 await page.locator('#resourceLoader').screenshot({path:__dirname+'/cover-retry.png'});
 await page.locator('#resourceRetry').click();await page.locator('#resourceLoader').waitFor({state:'hidden'});
 assert.equal(await page.locator('#resourceProgress').getAttribute('aria-valuenow'),'100');
 assert.equal(await page.locator('.resource-loader-mark').count(),0);
 console.log(JSON.stringify({assetFailureKeepsPanelOpen:true,failedAssetNotCountedAsLoaded:true,atlasRetryButtonWorks:true,allImagesDecodedBeforeCover:true}));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
