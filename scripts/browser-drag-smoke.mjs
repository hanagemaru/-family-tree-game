import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {newGame,pack} from '../src/core.js';
import {stages} from '../src/data.js';

const server=spawn(process.execPath,['scripts/dev.mjs','--port','5177'],{stdio:'pipe'});
const get=async(page,selector)=>page.locator(selector).boundingBox();
const center=r=>({x:r.x+r.width/2,y:r.y+r.height/2});
let browser;
try{
 let ready=false;
 for(let i=0;i<80;i++){
  try{const resp=await fetch('http://127.0.0.1:5177/');if(resp.ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 if(!ready)throw new Error('Dev server never started');
 await mkdir('artifacts/browser-drag',{recursive:true});
 for(const [name,driver] of [['chromium',chromium],['webkit',webkit]]){
  browser=await driver.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},
   deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  const game=newGame(stages[0]);
  game.hand=['ieyasu','go','iemitsu','tadanaga','sen'];
  game.deck=['yoshinao','yorinobu','yorifusa'];
  await page.addInitScript(data=>localStorage.setItem('family-tree-game:v1',JSON.stringify(data)),
   {sessions:{tokugawa:pack(game)},best:{}});
  await page.goto('http://127.0.0.1:5177/',{waitUntil:'networkidle'});
  await page.locator('[data-start="tokugawa"]').click();
  const count=async()=>Number(await page.locator('#placed-count').textContent());
  const dragToChild=async()=>{
   const handRect=await get(page,'[data-card="iemitsu"]');
   const anchorRect=await get(page,'[data-node="hidetada"]');
   assert.ok(handRect&&anchorRect,'game cards must be visible');
   const hand=center(handRect),anchor=center(anchorRect);
   await page.mouse.move(hand.x,hand.y);
   await page.mouse.down();
   // Physical cursor is below the draggable marker by DRAG_LIFT=36px.
   await page.mouse.move(anchor.x,anchor.y+50+36,{steps:8});
   const outline=page.locator('#drag-preview');
   assert.equal(await outline.getAttribute('data-relation'),'child',name+' marker direction');
   assert.equal(await outline.evaluate(e=>e.hidden),false,name+' outline visible');
   return center((await outline.boundingBox()));
  };

  // Regression: a casual quadrant release must NOT place a correct card.
  await dragToChild();
  await page.mouse.up();
  assert.equal(await count(),1,name+' casual release must not place');
  assert.equal(await page.locator('#modal').evaluate(e=>e.open),true);
  await page.locator('#modal-close').click();

  // Regression: even a geometrically precise release is not enough without
  // a deliberate, stable hold inside the dotted frame.
  let slot=await dragToChild();
  await page.mouse.move(slot.x,slot.y+36,{steps:1});
  assert.equal(await page.locator('#drag-preview').evaluate(e=>e.classList.contains('over-slot')),true);
  await page.mouse.up();
  assert.equal(await count(),1,name+' instant precise release must not place');
  assert.equal(await page.locator('#modal').evaluate(e=>e.open),true);
  await page.locator('#modal-close').click();

  // Deliberately aim at the visible frame, wait until armed, then release.
  slot=await dragToChild();
  await page.mouse.move(slot.x,slot.y+36,{steps:1});
  await page.waitForTimeout(350);
  // WebKit can throttle an rAF without pointer movement. A stationary
  // finger release must still arm on the final event's current timestamp.
  await page.mouse.move(slot.x+1,slot.y+36,{steps:1});
  const status=await page.locator('#drag-preview').evaluate(e=>({
   hidden:e.hidden,classes:e.className,rect:(()=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})(),
   now:performance.now()
  }));
  console.log('BROWSER_ARM_STATUS',name,JSON.stringify(status));
  assert.equal(status.classes.includes('armed'),true,
   name+' held frame should arm');
  await page.mouse.up();
  assert.equal(await count(),2,name+' held frame should place');
  assert.equal(await page.locator('#modal').evaluate(e=>e.open),false);
  await page.screenshot({path:`artifacts/browser-drag/${name}-placed.png`,fullPage:true});
  assert.equal(errors.length,0,name+' page errors: '+errors.join('; '));
  console.log('BROWSER_GESTURES_PASS',name,'casual=no-placement, instant=no-placement, held=placed');
  await page.close();await browser.close();browser=null;
 }
}finally{
 await browser?.close();
 server.kill('SIGTERM');
}
