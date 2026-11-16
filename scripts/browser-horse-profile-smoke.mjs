import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const port=5198,base='http://127.0.0.1:'+port+'/';
const server=spawn(process.execPath,['scripts/dev.mjs','--port',String(port)],{stdio:'pipe'});
let browser;
try{
 let ready=false;
 for(let i=0;i<140;i++){
  try{const r=await fetch(base);if(r.ok){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,180));
 }
 assert.ok(ready,'local game server did not start');
 await mkdir('artifacts/horse-profiles',{recursive:true});
 for(const [engine,driver] of [['chromium',chromium],['webkit',webkit]]){
  browser=await driver.launch({headless:true});
  for(const width of [375,390]){
   const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!document.querySelector('[data-random-start]')?.disabled,{timeout:30000});
   await page.locator('[data-random-level="easy"]').click();
   await page.locator('[data-random-start]').click();
   await page.waitForFunction(()=>document.body.classList.contains('playing'));
   const node=page.locator('#nodes [data-node]').first();
   await node.click();
   await page.locator('.horse-profile').waitFor({state:'visible'});
   assert.ok(await page.locator('.horse-profile-heading h2').textContent());
   assert.equal(await page.locator('.horse-profile-sources').count(),0,'per-card bibliography should not be shown');
   assert.equal(await page.locator('.horse-profile [data-place-relation]').count(),0);
   const meta=await page.locator('.horse-profile-meta').textContent();
   assert.match(meta,/\d{4}年生/);
   const dialog=page.locator('#modal');
   assert.equal(await dialog.evaluate(x=>x.open),true);
   const rect=await dialog.boundingBox();
   assert.ok(rect&&rect.x>=0&&rect.x+rect.width<=width+2&&rect.height<844,engine+' dialog overflow');
   await page.screenshot({path:'artifacts/horse-profiles/'+engine+'-'+width+'-profile.png',fullPage:true});
   await page.locator('#modal-close').click();
   assert.equal(await dialog.evaluate(x=>x.open),false);
   await page.locator('#menu-button').click();
   await page.locator('[data-action="sources"]').click();
   assert.ok(await page.locator('.profile-credits').count(),'profile evidence must be available in centralized credits');
   assert.match(await page.locator('#modal-content').textContent(),/題材・出典/);
   await page.locator('#modal-close').click();
   await page.locator('#hand [data-card]').first().click();
   await page.locator('#nodes [data-node]').first().click();
   assert.equal(await dialog.evaluate(x=>x.open),true,'selected card must open relation picker');
   assert.equal(await page.locator('#modal .horse-profile').count(),0,'profile must not replace relation picker');
   assert.ok(await page.locator('[data-place-relation]').count()>=2);
   await page.locator('#modal-close').click();
   assert.equal(await page.locator('#penalty-count').textContent(),'+0秒','free card info must not add penalties');
   assert.deepEqual(errors,[],engine+' '+width+' uncaught page errors');
   await page.close();
  }
  await browser.close();browser=null;
  console.log('HORSE_PROFILE_MOBILE_BROWSER_SUCCESS '+engine);
 }
}finally{
 await browser?.close();
 server.kill('SIGTERM');
}
