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
  await page.screenshot({path:`artifacts/browser-drag/${name}-armed.png`,fullPage:true});
  await page.mouse.up();
  assert.equal(await count(),2,name+' held frame should place');
  assert.equal(await page.locator('#modal').evaluate(e=>e.open),false);
  // The board uses a 300ms CSS pan transition. Checking immediately after
  // mouseup would capture an in-between frame, particularly in WebKit.
  await page.waitForTimeout(480);
  const view=await page.evaluate(()=>{
   const b=document.querySelector('#board').getBoundingClientRect();
   const c=document.querySelector('[data-node="iemitsu"]').getBoundingClientRect();
   const overlap=Math.max(0,Math.min(b.right,c.right)-Math.max(b.left,c.left))*
    Math.max(0,Math.min(b.bottom,c.bottom)-Math.max(b.top,c.top));
   return {ratio:overlap/(c.width*c.height),card:{top:c.top,bottom:c.bottom},
    board:{top:b.top,bottom:b.bottom},zoom:document.querySelector('#world').style.transform};
  });
  console.log('BROWSER_PLACEMENT_VISIBILITY',name,JSON.stringify(view));
  assert.ok(view.ratio>.78,name+' placed child must be mostly visible after the pan');
  await page.screenshot({path:`artifacts/browser-drag/${name}-placed.png`,fullPage:true});
  assert.equal(errors.length,0,name+' page errors: '+errors.join('; '));
  console.log('BROWSER_GESTURES_PASS',name,'casual=no-placement, instant=no-placement, held=placed');

  // Independent UX checks: no redundant buttons, keyboard/touch selection
  // toggles, text-only hints and an empty-board tap to deselect.
  assert.equal(await page.locator('#clear-selection-button').count(),0);
  assert.equal(await page.locator('#choose-anchor-button').count(),0);
  const handGo=page.locator('[data-card="go"]');
  await handGo.click();
  assert.match(await page.locator('#selection-summary').textContent(),/お江|江|go/);
  assert.equal(await page.locator('#hint-button').evaluate(e=>e.hidden),false);
  const hintPlacement=await page.evaluate(()=>{
   const card=document.querySelector('[data-card="go"]').getBoundingClientRect();
   const hint=document.querySelector('#hint-button').getBoundingClientRect();
   return {cardTop:card.top,cardLeft:card.left,cardRight:card.right,
    buttonBottom:hint.bottom,buttonLeft:hint.left,buttonRight:hint.right,
    buttonWidth:hint.width,buttonHeight:hint.height};
  });
  assert.ok(hintPlacement.buttonHeight>=44&&hintPlacement.buttonWidth>=90,
   name+' contextual hint must be touch-friendly');
  assert.ok(Math.abs(hintPlacement.buttonBottom-hintPlacement.cardTop)<34,
   name+' hint must sit close to the selected card');
  assert.ok(hintPlacement.buttonRight>hintPlacement.cardLeft&&
   hintPlacement.buttonLeft<hintPlacement.cardRight,
   name+' hint must align with its card');
  await page.screenshot({path:`artifacts/browser-drag/${name}-hint-near-card.png`,fullPage:true});
  await handGo.click();
  assert.equal(await page.locator('#selection-summary').textContent(),'');
  await handGo.click();
  await page.locator('#hint-button').click();
  assert.equal(await page.locator('#hint-box button').count(),0);
  assert.equal(await page.locator('#hint-box').evaluate(e=>e.hidden),false);
  const hintVisible=await page.evaluate(()=>{
   const popup=document.querySelector('#hint-box');
   const rect=popup.getBoundingClientRect();
   const top=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
   return popup.contains(top)||popup===top;
  });
  assert.equal(hintVisible,true,name+' hint must not be hidden behind any board card or zoom control');
  await page.screenshot({path:`artifacts/browser-drag/${name}-hint-open.png`,fullPage:true});
  await page.locator('#board').click({position:{x:14,y:25}});
  assert.equal(await page.locator('#selection-summary').textContent(),'');
  console.log('BROWSER_UI_PASS',name,'toggle/deselect/hint-only');

  // Real horse cards must have visibly different body colors as well as sex
  // labels. The palette must work for cards on the board, not only in hand.
  await page.locator('#menu-button').click();
  await page.locator('[data-action="home"]').click();
  await page.locator('[data-start="thoroughbred"]').click();
  assert.equal(await page.locator('[data-node="deep"]').getAttribute('class')
   .then(c=>c.includes('sex-male')),true);
  await page.screenshot({path:`artifacts/browser-drag/${name}-horse-hand.png`,fullPage:true});
  assert.ok(await page.locator('#hand [data-card]').count()>=3,'hand cards must remain on screen');
  await page.locator('#hand [data-card]').first().click();
  await page.screenshot({path:`artifacts/browser-drag/${name}-horse-selected.png`,fullPage:true});
  await page.locator('#menu-button').click();
  await page.locator('[data-action="give-up-confirm"]').click();
  await page.locator('[data-action="give-up"]').click();
  const colors=await page.evaluate(()=>{
   const male=document.querySelector('#nodes .sex-male');
   const female=document.querySelector('#nodes .sex-female');
   return {male:male&&getComputedStyle(male).borderTopColor,
    female:female&&getComputedStyle(female).borderTopColor,
    femaleLabel:female?.querySelector('.card-sex')?.textContent};
  });
  assert.ok(colors.male&&colors.female&&colors.male!==colors.female,
   name+' horse sex card accents must differ');
  assert.equal(colors.femaleLabel,'牝');
  assert.equal(errors.length,0,name+' page errors: '+errors.join('; '));
  console.log('BROWSER_COLORS_PASS',name,'male/female distinct');

  // A freshly generated v2 horse puzzle must end with a single strong pedigree
  // graph, no permanent dotted-only sibling edges. The final camera must fit
  // all 18 cards even on a 390px-wide mobile viewport.
  await page.locator('[data-action="home"]').click();
  await page.locator('[data-random-start]').click();
  await page.locator('#menu-button').click();
  await page.locator('[data-action="give-up-confirm"]').click();
  await page.locator('[data-action="give-up"]').click();
  await page.locator('#modal-close').click();
  await page.waitForTimeout(500);
  const completeGraph=await page.evaluate(()=>{
   const board=document.querySelector('#board').getBoundingClientRect();
   const cards=[...document.querySelectorAll('#nodes [data-node]')];
   const out=cards.filter(card=>{
    const rect=card.getBoundingClientRect();
    return rect.left<board.left-2||rect.right>board.right+2||
      rect.top<board.top-2||rect.bottom>board.bottom+2;
   });
   return {cards:cards.length,dotted:document.querySelectorAll('#edges .sibling').length,
    outside:out.length,scale:document.querySelector('#world').style.transform};
  });
  assert.equal(completeGraph.cards,18,name+' generated question must show 18 cards');
  assert.equal(completeGraph.dotted,0,name+' v2 should have no unresolved sibling-only links');
  assert.equal(completeGraph.outside,0,name+' whole final pedigree must fit the board');
  await page.screenshot({path:`artifacts/browser-drag/${name}-v2-complete.png`,fullPage:true});
  console.log('BROWSER_V2_GRAPH_PASS',name,JSON.stringify(completeGraph));

  await page.close();await browser.close();browser=null;
 }
}finally{
 await browser?.close();
 server.kill('SIGTERM');
}
