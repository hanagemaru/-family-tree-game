/** Cross-browser visual and interaction smoke of the compact 2026 game home. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const port=5192,base='http://127.0.0.1:'+port+'/';
const server=spawn(process.execPath,['scripts/dev.mjs','--port',String(port)],{stdio:'pipe'});
let browser;
try{
 let ready=false;
 for(let i=0;i<120;i++){
  try{const r=await fetch(base);if(r.ok){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,150));
 }
 assert.ok(ready,'local game server did not become ready');
 await mkdir('artifacts/home-preview',{recursive:true});
 for(const [engine,driver] of [['chromium',chromium],['webkit',webkit]]){
  browser=await driver.launch({headless:true});
  for(const width of [320,375,390,430]){
   const page=await browser.newPage({viewport:{width,height:width===320?667:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
   const errors=[];
   page.on('pageerror',e=>errors.push('JS '+e));
   page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
   await page.goto(base,{waitUntil:'networkidle'});
   await page.locator('[data-random-start]').waitFor({state:'visible'});
   await page.waitForFunction(()=>!document.querySelector('[data-random-start]').disabled,{timeout:30000});
   assert.equal(await page.locator('.home-preview-card').count(),0,'no decorative landing cards');
   // Computed colors and real element rectangles catch CSS cascade conflicts that
   // ordinary DOM tests missed (the dark title and duplicated Help icons).
   const visual=await page.evaluate(()=>{
    const $=selector=>document.querySelector(selector);
    const rect=element=>element.getBoundingClientRect();
    const rgb=color=>(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
    const luminance=color=>{
      const [r,g,b]=rgb(color).map(v=>{
       const x=v/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
      });
      return .2126*r+.7152*g+.0722*b;
    };
    const contrast=(a,b)=>{
      const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
    };
    const body=getComputedStyle(document.body).backgroundColor;
    const colors={};
    for(const selector of ['.brand>span:last-child','.home-rule','.home-picker-label',
      '.difficulty-description','.home-ranking-button']){
      const el=$(selector);
      colors[selector]={color:getComputedStyle(el).color,contrast:contrast(getComputedStyle(el).color,body)};
    }
    const cta=$('.home-primary-button'),ctaCss=getComputedStyle(cta);
    colors.cta={color:ctaCss.color,contrast:contrast(ctaCss.color,ctaCss.backgroundColor)};
    const title=rect($('.brand>span:last-child')),menu=rect($('#home-menu-button'));
    const header=rect($('.app-header'));
    const targets={};
    for(const selector of ['#home-menu-button','.home-primary-button',
      '.home-ranking-button',...['easy','normal','hard'].map(key=>'[data-random-level="'+key+'"]')]){
     const el=$(selector),r=rect(el);targets[selector]={width:r.width,height:r.height,left:r.left,right:r.right};
    }
    return {colors,header:{titleRight:title.right,menuLeft:menu.left,
      menuRight:menu.right,headerRight:header.right},targets,
      visibleNavButtons:document.querySelectorAll('.home-header-actions button:not([hidden])').length,
      helpHidden:$('#help-button').hidden};
   });
   for(const [name,row] of Object.entries(visual.colors))
    assert.ok(row.contrast>=4.5,engine+' '+width+' low-contrast '+name+': '+JSON.stringify(row));
   assert.ok(visual.header.titleRight+8<=visual.header.menuLeft,
    engine+' '+width+' title/menu overlap: '+JSON.stringify(visual.header));
   assert.ok(visual.header.menuRight<=width+1,engine+' '+width+' clipped menu');
   assert.equal(visual.visibleNavButtons,1,'only one upper-right button');
   assert.equal(visual.helpHidden,true,'help must live inside the menu');
   for(const [name,target] of Object.entries(visual.targets)){
    assert.ok(target.width>=44&&target.height>=44,
     engine+' '+width+' small touch target '+name+': '+JSON.stringify(target));
    assert.ok(target.left>=-1&&target.right<=width+1,
     engine+' '+width+' clipped control '+name+': '+JSON.stringify(target));
   }
   console.log('HOME_ACCESSIBILITY_AUDIT_'+engine+'_'+width+' '+JSON.stringify(visual));
   // Recreate the twelve horses in the screenshot, with their actual QIDs
   // and sire/dam data, in both Chromium and WebKit. This tests the rendering
   // topology rather than only a synthetic unit-test drawing.
   const crossings=await page.evaluate(async()=>{
    const [layout,horseJson]=await Promise.all([
     import('./src/diagram.js'),
     fetch('./data/horse-pedigree.v1.json').then(r=>r.json())
    ]);
    const byId=new Map(horseJson.horses.map(h=>[h.id,h]));
    const entries=[
     ['Q11284092',2],['Q20047186',3],['Q11289428',1],
     ['Q180387',1],['Q7514393',2],['Q5643313',0],
     ['Q4309360',2],['Q7821904',0],['Q11325871',1],
     ['Q730381',2],['Q11352062',3],['Q11288432',1]
    ];
    const selected=new Set(entries.map(([id])=>id));
    const people=entries.map(([id,generation])=>{
     const horse=byId.get(id);
     return {id,name:horse.name,generation,parents:[horse.sire,horse.dam].filter(id=>selected.has(id)),spouses:[]};
    });
    const state={stage:{id:'review-photo',anchor:entries[0][0],people},placed:entries.map(([id])=>id)};
    const run=opt=>{
     const start=performance.now();
     const positions=layout.layoutFamily(state,{minimizeCrossings:opt});
     const actual=layout.renderGeometry(layout.buildDiagram({...state,positions})).crossings.length;
     return {positions,actual,ms:performance.now()-start};
    };
    const before=run(false),after=run(true);
    return {before:before.actual,after:after.actual,ms:after.ms,
     topBefore:[before.positions['Q5643313'].x,before.positions['Q7821904'].x],
     topAfter:[after.positions['Q5643313'].x,after.positions['Q7821904'].x]};
   });
   assert.ok(crossings.after<crossings.before,engine+' must reduce the screenshot crossings: '+JSON.stringify(crossings));
   assert.ok(crossings.topBefore[0]<crossings.topBefore[1]&&
    crossings.topAfter[1]<crossings.topAfter[0],
    engine+' must exchange Halo and Tony Bin: '+JSON.stringify(crossings));
   assert.ok(crossings.ms<2500,engine+' row optimization too slow: '+JSON.stringify(crossings));
   console.log('HORSE_CROSSING_BROWSER_'+engine+'_'+width+' '+JSON.stringify(crossings));

   const dims=await page.evaluate(()=>{
    const button=document.querySelector('[data-random-start]').getBoundingClientRect();
    return {viewport:innerHeight,scrollWidth:document.documentElement.scrollWidth,
      innerWidth,buttonBottom:button.bottom,buttonTop:button.top};
   });
   assert.ok(dims.scrollWidth<=dims.innerWidth+2,engine+' has horizontal overflow: '+JSON.stringify(dims));
   assert.ok(dims.buttonBottom<=dims.viewport,engine+' CTA must fit without scrolling: '+JSON.stringify(dims));
   await page.screenshot({path:'artifacts/home-preview/'+engine+'-'+width+'-home.png',fullPage:true});
   await page.locator('#home-menu-button').click();
   assert.equal(await page.locator('#modal').evaluate(x=>x.open),true);
   assert.equal(await page.locator('.home-menu-actions a').getAttribute('href'),'https://hanage.app/games/horse-pedigree/');
   await page.locator('[data-action="help"]').click();
   assert.match(await page.locator('#modal-content').textContent(),/手札を場につなぐ/);
   await page.locator('#modal-close').click();
   await page.locator('#home-menu-button').click();
   assert.ok(await page.locator('[data-action="sources"]').isVisible());
   await page.locator('#modal-close').click();
   for(const difficulty of ['normal','hard','easy']){
    await page.locator('[data-random-level="'+difficulty+'"]').click();
    assert.equal(await page.locator('[data-random-level="'+difficulty+'"]').getAttribute('aria-pressed'),'true');
   }
   await page.locator('[data-random-start]').click();
   await page.waitForFunction(()=>document.body.classList.contains('playing'));
   assert.equal(await page.locator('#hand [data-card]').count(),5);
   await page.screenshot({path:'artifacts/home-preview/'+engine+'-'+width+'-game.png',fullPage:true});
   await page.locator('#menu-button').click();
   await page.locator('[data-action="home"]').click();
   assert.match(await page.locator('[data-random-start]').textContent(),/つづきから/);
   await page.locator('[data-new-random-start]').click();
   assert.equal(await page.locator('#modal').evaluate(x=>x.open),true);
   await page.locator('#modal-close').click();
   assert.match(await page.locator('[data-random-start]').textContent(),/つづきから/);
   assert.deepEqual(errors,[],engine+' '+width+' errors');
   await page.close();
  }
  await browser.close();browser=null;
  console.log('HOME_PREVIEW_BROWSER_PASS '+engine);
 }
}finally{
 await browser?.close();
 server.kill('SIGTERM');
}
