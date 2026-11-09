import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const server=spawn(process.execPath,['scripts/dev.mjs','--port','5179'],{stdio:'pipe'});
let browser;
try{
 for(let i=0;i<80;i++){try{const response=await fetch('http://127.0.0.1:5179/');if(response.ok)break;}catch{} await new Promise(resolve=>setTimeout(resolve,150));}
 await mkdir('artifacts',{recursive:true});
 for(const [engine,driver] of [['chromium',chromium],['webkit',webkit]]){
 browser=await driver.launch({headless:true});
 for(const stage of ['tokugawa','thoroughbred']){
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('http://127.0.0.1:5179/',{waitUntil:'networkidle'});
  await page.locator('[data-start="'+stage+'"]').click();
  await page.waitForTimeout(1000);
  const scene=await page.evaluate(()=>{
   const board=document.querySelector('#board'),anchor=document.querySelector('.person-node.anchor'),world=document.querySelector('#world'),hand=document.querySelector('#hand'),screen=document.querySelector('#game-screen');
   const round=r=>r?{x:r.x,y:r.y,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null;
   const rect=anchor?.getBoundingClientRect(),br=board?.getBoundingClientRect();
   const overlap=rect&&br?Math.max(0,Math.min(rect.right,br.right)-Math.max(rect.left,br.left))*Math.max(0,Math.min(rect.bottom,br.bottom)-Math.max(rect.top,br.top)):0;
   return {board:round(br),anchor:round(rect),worldTransform:world?.style.transform,anchorDisplay:anchor?getComputedStyle(anchor).display:'missing',anchorOpacity:anchor?getComputedStyle(anchor).opacity:'missing',screen:round(screen?.getBoundingClientRect()),hand:round(hand?.getBoundingClientRect()),overlap,placed:document.querySelector('#placed-count')?.textContent};
  });
  console.log(engine+'/'+stage+': '+JSON.stringify({scene,errors}));
  await page.screenshot({path:'artifacts/'+engine+'-'+stage+'-mobile.png',fullPage:true});
  assert.equal(errors.length,0,'page errors '+errors);
  assert.ok(scene.anchor,'anchor must exist');
  assert.ok(scene.board.height>150,'board must have actual height');
  assert.ok(scene.overlap>2000,'starting card must be visible in the board');
  await page.close();
 }
 await browser.close();browser=null;
 }
}finally{await browser?.close();server.kill('SIGTERM');}
