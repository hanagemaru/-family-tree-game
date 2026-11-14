/** Real Chromium + iPhone-sized WebKit smoke for all three live selectors. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const port=5189;
const server=spawn(process.execPath,['scripts/dev.mjs','--port',String(port)],{stdio:'pipe'});
let browser;
try{
 let ready=false;
 for(let n=0;n<100;n++){
  try{const res=await fetch('http://127.0.0.1:'+port+'/');if(res.ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 assert.ok(ready,'development server did not start');
 await mkdir('artifacts/browser-difficulty',{recursive:true});
 for(const [engine,driver] of [['chromium',chromium],['webkit',webkit]]){
  browser=await driver.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  page.on('response',res=>{if(res.status()>=400)errors.push('HTTP '+res.status()+' '+res.url());});
  await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'networkidle'});
  await page.locator('[data-random-start]').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('[data-random-start]').disabled,{timeout:30000});
  assert.equal(await page.locator('[data-random-level]').count(),3);
  await page.screenshot({path:'artifacts/browser-difficulty/'+engine+'-home.png',fullPage:true});
  const stages={};
  for(const [difficulty,label] of [['easy','初級'],['normal','中級'],['hard','上級']]){
   await page.locator('[data-random-level="'+difficulty+'"]').click();
   assert.equal(await page.locator('[data-random-level="'+difficulty+'"]').getAttribute('aria-pressed'),'true');
   await page.locator('[data-random-start]').click();
   await page.waitForFunction(()=>document.body.classList.contains('playing'),{timeout:40000});
   assert.match(await page.locator('#stage-title').textContent(),new RegExp(label));
   assert.equal(await page.locator('#hand [data-card]').count(),5);
   assert.equal(await page.locator('#nodes [data-node]').count(),1);
   const descriptor=await page.evaluate(level=>JSON.parse(localStorage.getItem('family-tree-game:v1')).randomHorseByDifficulty[level],difficulty);
   assert.equal(descriptor.difficulty,difficulty);
   assert.equal(descriptor.generatorVersion,difficulty==='easy'?'horse-stage-v4':'horse-stage-v3');
   assert.equal(descriptor.cardIds.length,18);
   stages[difficulty]=descriptor.stageId;
   await page.screenshot({path:'artifacts/browser-difficulty/'+engine+'-'+difficulty+'.png',fullPage:true});
   await page.locator('#menu-button').click();
   await page.locator('[data-action="home"]').click();
  }
  await page.locator('[data-random-level="easy"]').click();
  assert.match(await page.locator('[data-random-start]').textContent(),/つづきから/);
  await page.locator('[data-random-start]').click();
  const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('family-tree-game:v1')).randomHorseByDifficulty.easy.stageId);
  assert.equal(restored,stages.easy);
  assert.deepEqual(errors,[],'browser errors for '+engine);
  console.log(engine+' difficulty smoke succeeded: '+JSON.stringify(stages));
  await page.close();await browser.close();browser=null;
 }
}finally{
 await browser?.close();
 server.kill('SIGTERM');
}
