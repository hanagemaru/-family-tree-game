import test from 'node:test';import assert from 'node:assert/strict';
import {loadApp} from './dom-harness.js';import {newGame,pack,relations} from '../src/core.js';import {stages} from '../src/data.js';
function fixture(){const state=newGame(stages[0]);state.hand=['ieyasu','go','iemitsu','tadanaga','sen'];state.deck=['yoshinao','yorinobu','yorifusa'];return {sessions:{tokugawa:pack(state)},best:{}};}
async function setup(t){const app=await loadApp(fixture());t.after(()=>app.restore());app.$('stage-list').querySelector('[data-start="tokugawa"]').click();return app;}
function select(app,id='iemitsu'){app.$('hand').querySelector(`[data-card="${id}"]`).click({detail:0});}
function target(app,id='hidetada'){app.$('nodes').querySelector(`[data-node="${id}"]`).click({detail:0});}
test('actual app: tap hand and opponent, then choose a relation and complete placement',async t=>{
 const app=await setup(t);select(app);assert.match(app.$('selection-summary').textContent,/家光/);target(app);assert.equal(app.$('modal').open,true);assert.equal(app.$('modal-content').querySelectorAll('[data-place-relation]').length,4);assert.match(app.$('modal-content').textContent,/家光.*秀忠/s);app.$('modal-content').querySelector('[data-place-relation="child"]').click();assert.equal(app.$('modal').open,false);assert.ok(app.$('nodes').querySelector('[data-node="iemitsu"]'));assert.equal(app.$('placed-count').textContent,'2');
});
test('actual app: cancel keeps the chosen hand card and offers a reliable opponent list',async t=>{
 const app=await setup(t);select(app);target(app);app.$('modal-close').click();assert.match(app.$('selection-summary').textContent,/家光/);assert.equal(app.$('choose-anchor-button').disabled,false);app.$('choose-anchor-button').click();app.$('modal-content').querySelector('[data-pick-anchor="hidetada"]').click();assert.ok(app.$('modal-content').querySelector('[data-place-relation="child"]'));
});
test('actual app: wrong relation reports the error, preserves selection and allows correction',async t=>{
 const app=await setup(t);select(app);target(app);const wrong=app.$('modal-content').querySelector('[data-place-relation="parent"]');wrong.click();assert.equal(app.$('modal').open,true);assert.equal(app.$('mistake-count').textContent,'1');assert.ok(app.$('placement-error').textContent.length);wrong.click();assert.equal(app.$('mistake-count').textContent,'1');app.$('modal-content').querySelector('[data-place-relation="child"]').click();assert.equal(app.$('placed-count').textContent,'2');
});
test('actual app: blur and return during relation selection must not lose the opponent',async t=>{
 const app=await setup(t);select(app);target(app);app.window.fire('blur');app.$('modal-content').querySelector('[data-place-relation="child"]').click();assert.equal(app.$('placed-count').textContent,'2');
});
test('actual app: thinking time in a placement sheet counts, menu reading does not',async t=>{
 const app=await setup(t);select(app);target(app);app.advance(1000);assert.equal(app.$('timer').textContent,'0:01');app.$('modal-close').click();app.$('menu-button').click();app.advance(1000);assert.equal(app.$('timer').textContent,'0:01');
});
test('actual app: drag onto a card releases capture before showing stable relation buttons',async t=>{
 const app=await setup(t),hand=app.$('hand').querySelector('[data-card="iemitsu"]');hand.fire('pointerdown',{clientX:100,clientY:620});app.window.fire('pointermove',{clientX:196,clientY:366});app.window.fire('pointerup',{clientX:196,clientY:366});assert.equal(app.$('modal').open,true);assert.ok(app.$('modal-content').querySelector('[data-place-relation="child"]'));assert.equal(app.$('app').hasPointerCapture(1),false);assert.equal(app.$('drag-ghost').hidden,true);
});
test('actual app: dropping over empty board opens an explicit opponent list',async t=>{
 const app=await setup(t),hand=app.$('hand').querySelector('[data-card="iemitsu"]');hand.fire('pointerdown',{clientX:100,clientY:620});app.window.fire('pointermove',{clientX:40,clientY:250});app.window.fire('pointerup',{clientX:40,clientY:250});assert.ok(app.$('modal-content').querySelector('[data-pick-anchor="hidetada"]'));assert.equal(app.$('modal').open,true);
});
test('actual app: pointer cancellation clears the ghost but preserves an actionable selection',async t=>{
 const app=await setup(t),hand=app.$('hand').querySelector('[data-card="iemitsu"]');hand.fire('pointerdown',{clientX:100,clientY:620});app.window.fire('pointermove',{clientX:196,clientY:366});app.window.fire('pointercancel');assert.equal(app.$('drag-ghost').hidden,true);assert.equal(app.$('app').hasPointerCapture(1),false);assert.equal(app.$('choose-anchor-button').disabled,false);
});
test('actual app: panning with a hand card selected does not accidentally open a placement sheet',async t=>{
 const app=await setup(t);select(app);const node=app.$('nodes').querySelector('[data-node="hidetada"]');node.fire('pointerdown',{clientX:196,clientY:330});app.window.fire('pointermove',{clientX:240,clientY:350});app.window.fire('pointerup',{clientX:240,clientY:350});assert.equal(app.$('modal').open,false);assert.match(app.$('selection-summary').textContent,/家光/);
});
test('actual app: change opponent and explicit selection reset remain usable',async t=>{
 const app=await setup(t);select(app);target(app);app.$('modal-content').querySelector('[data-action="change-anchor"]').click();assert.ok(app.$('modal-content').querySelector('[data-pick-anchor="hidetada"]'));app.$('modal-close').click();app.$('clear-selection-button').click();assert.equal(app.$('choose-anchor-button').disabled,true);select(app,'go');target(app);app.$('modal-content').querySelector('[data-place-relation="spouse"]').click();assert.ok(app.$('nodes').querySelector('[data-node="go"]'));
});
test('actual app: both themes can be completed through real hand, picker and relation handlers',async t=>{
 for(const stage of stages){
  const app=await loadApp({sessions:{[stage.id]:pack(newGame(stage))},best:{}});
  try{app.$('stage-list').querySelector(`[data-start="${stage.id}"]`).click();let turns=0;
   while(turns++<100){const state=app.storage().sessions[stage.id];if(state.complete)break;const byId=id=>stage.people.find(p=>p.id===id);const move=state.hand.flatMap(card=>state.placed.flatMap(anchor=>relations(byId(card),byId(anchor)).map(relation=>({card,anchor,relation}))))[0];
    if(!move){app.$('exchange-button').click();continue;}select(app,move.card);app.$('choose-anchor-button').click();app.$('modal-content').querySelector(`[data-pick-anchor="${move.anchor}"]`).click();app.$('modal-content').querySelector(`[data-place-relation="${move.relation}"]`).click();
   }
   assert.ok(app.storage().sessions[stage.id].complete);assert.equal(app.$('nodes').querySelectorAll('[data-node]').length,stage.people.length);assert.match(app.$('modal-content').textContent,/系譜が、つながった/);
  }finally{app.restore();}
 }
});
