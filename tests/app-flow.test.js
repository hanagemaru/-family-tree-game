import test from 'node:test';import assert from 'node:assert/strict';
import {loadApp} from './dom-harness.js';import {newGame,pack,relations} from '../src/core.js';import {stages} from '../src/data.js';
import {readFileSync} from 'node:fs';import {restoreRandomHorseSession} from '../src/random-horse-session.js';
import {findPlayablePlacement} from '../src/game-assistance.js';
const horseSnapshot=JSON.parse(readFileSync(new URL('../data/horse-pedigree.v1.json',import.meta.url),'utf8'));
function fixture(){const state=newGame(stages[0]);state.hand=['ieyasu','go','iemitsu','tadanaga','sen'];state.deck=['yoshinao','yorinobu','yorifusa'];return {sessions:{tokugawa:pack(state)},best:{}};}
async function setup(t){const app=await loadApp(fixture());t.after(()=>app.restore());app.$('stage-list').querySelector('[data-start="tokugawa"]').click();return app;}
function select(app,id='iemitsu'){app.$('hand').querySelector(`[data-card="${id}"]`).click({detail:0});}
function target(app,id='hidetada'){app.$('nodes').querySelector(`[data-node="${id}"]`).click({detail:0});}
function commitRelation(app,relation){const button=app.$('modal-content').querySelector(`[data-place-relation="${relation}"]`);assert.ok(button);button.click();}
test('actual app: tap hand and opponent, then choose a relation and complete placement',async t=>{
 const app=await setup(t);select(app);assert.match(app.$('selection-summary').textContent,/家光/);target(app);assert.equal(app.$('modal').open,true);assert.equal(app.$('modal-content').querySelectorAll('[data-place-relation]').length,4);assert.match(app.$('modal-content').textContent,/家光.*秀忠/s);commitRelation(app,'child');assert.equal(app.$('modal').open,false);assert.ok(app.$('nodes').querySelector('[data-node="iemitsu"]'));assert.equal(app.$('placed-count').textContent,'2');
});
test('actual app: cancel keeps the chosen hand card and offers a reliable opponent list',async t=>{
 const app=await setup(t);select(app);target(app);app.$('modal-close').click();assert.match(app.$('selection-summary').textContent,/家光/);assert.equal(app.$('choose-anchor-button').disabled,false);app.$('choose-anchor-button').click();app.$('modal-content').querySelector('[data-pick-anchor="hidetada"]').click();assert.ok(app.$('modal-content').querySelector('[data-place-relation="child"]'));
});
test('actual app: wrong relation reports the error, preserves selection and allows correction',async t=>{
 const app=await setup(t);select(app);target(app);const wrong=app.$('modal-content').querySelector('[data-place-relation="parent"]');wrong.click();assert.equal(app.$('modal').open,true);assert.equal(app.$('mistake-count').textContent,'1');assert.ok(app.$('placement-error').textContent.length);wrong.click();assert.equal(app.$('mistake-count').textContent,'1');commitRelation(app,'child');assert.equal(app.$('placed-count').textContent,'2');
});
test('actual app: blur and return during relation selection must not lose the opponent',async t=>{
 const app=await setup(t);select(app);target(app);app.window.fire('blur');commitRelation(app,'child');assert.equal(app.$('placed-count').textContent,'2');
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
 const app=await setup(t);select(app);target(app);app.$('modal-content').querySelector('[data-action="change-anchor"]').click();assert.ok(app.$('modal-content').querySelector('[data-pick-anchor="hidetada"]'));app.$('modal-close').click();app.$('clear-selection-button').click();assert.equal(app.$('choose-anchor-button').disabled,true);select(app,'go');target(app);commitRelation(app,'spouse');assert.ok(app.$('nodes').querySelector('[data-node="go"]'));
});
test('actual app: both themes can be completed through real hand, picker and relation handlers',async t=>{
 for(const stage of stages){
  const app=await loadApp({sessions:{[stage.id]:pack(newGame(stage))},best:{}});
  try{app.$('stage-list').querySelector(`[data-start="${stage.id}"]`).click();let turns=0;
   while(turns++<100){const state=app.storage().sessions[stage.id];if(state.complete)break;const byId=id=>stage.people.find(p=>p.id===id);const move=state.hand.flatMap(card=>state.placed.flatMap(anchor=>relations(byId(card),byId(anchor)).map(relation=>({card,anchor,relation}))))[0];
    assert.ok(move,`${stage.id}: draw should always be playable`);select(app,move.card);app.$('choose-anchor-button').click();app.$('modal-content').querySelector(`[data-pick-anchor="${move.anchor}"]`).click();commitRelation(app,move.relation);
   }
   assert.ok(app.storage().sessions[stage.id].complete);assert.equal(app.$('nodes').querySelectorAll('[data-node]').length,stage.people.length);assert.match(app.$('modal-content').textContent,/系譜が、つながった/);
  }finally{app.restore();}
 }
});

test('board uses illustrated portrait cards and offers a larger inspection view',async t=>{
 const app=await setup(t),node=app.$('nodes').querySelector('[data-node="hidetada"]');
 assert.ok(node.classList.contains('table-card'));
 assert.ok(node.querySelector('.card-art'));
 assert.ok(node.querySelector('.card-corner'));
 assert.match(node.textContent,/秀忠/);
 const button=app.$('board-expand');
 button.click();assert.equal(button.attributes['aria-pressed'],'true');assert.ok(app.$('board').classList.contains('expanded'));
 button.click();assert.equal(button.attributes['aria-pressed'],'false');assert.equal(app.$('board').classList.contains('expanded'),false);
});

test('single tabletop displays a draw pile instead of an exchange button',async t=>{
 const app=await setup(t);
 assert.equal(app.$('exchange-button'),null);
 assert.ok(app.$('stock-pile').querySelector('.stock-top'));
 assert.match(app.$('stock-count').textContent,/残り/);
 assert.equal(app.document.body.classList.contains('playing'),true);
 assert.equal(app.$('game-screen').querySelector('.play-layout')!==null,true);
 assert.equal(app.$('hand').querySelectorAll('[data-card]').length,5);
 app.$('menu-button').click();app.$('modal-content').querySelector('[data-action="home"]').click();
 assert.equal(app.document.body.classList.contains('playing'),false);
});
test('board-only inspection mode keeps zoom controls accessible',async t=>{
 const app=await setup(t);
 app.$('board-expand').click();
 assert.ok(app.$('game-screen').classList.contains('inspect-mode'));
 assert.equal(app.$('board').classList.contains('expanded'),true);
 assert.ok(app.$('board').querySelector('.board-tools'));
 app.$('board-expand').click();
 assert.equal(app.$('game-screen').classList.contains('inspect-mode'),false);
});

test('random horse mode saves and restores the exact generated question, then retries with another seed',async t=>{
 const first=await loadApp(fixture());
 let saved;
 try{
  const button=first.$('stage-list').querySelector('[data-random-start]');assert.equal(button.disabled,false);button.click();
  saved=structuredClone(first.storage());assert.equal(saved.randomHorse.cardIds.length,18);assert.ok(saved.sessions[saved.randomHorse.stageId]);
  assert.match(first.$('stage-title').textContent,/自動生成/);
 }finally{first.restore();}
 const resumed=await loadApp(saved);t.after(()=>resumed.restore());
 resumed.$('stage-list').querySelector('[data-random-start]').click();
 const before=structuredClone(resumed.storage().randomHorse);assert.deepEqual(resumed.storage().sessions[before.stageId],saved.sessions[before.stageId]);
 resumed.$('menu-button').click();resumed.$('modal-content').querySelector('[data-action="random-retry-confirm"]').click();resumed.$('modal-content').querySelector('[data-action="random-retry"]').click();
 const after=resumed.storage().randomHorse;assert.notEqual(after.seed,before.seed);assert.equal(after.cardIds.length,18);assert.ok(resumed.storage().sessions[after.stageId]);
 const stage=restoreRandomHorseSession(horseSnapshot,after).stage;let turns=0;
 while(turns++<30){const session=resumed.storage().sessions[after.stageId];if(session.complete)break;const byId=id=>stage.people.find(person=>person.id===id);const move=session.hand.flatMap(card=>session.placed.flatMap(anchor=>relations(byId(card),byId(anchor)).map(relation=>({card,anchor,relation}))))[0];
  assert.ok(move,'random UI should always offer a legal move');select(resumed,move.card);resumed.$('choose-anchor-button').click();resumed.$('modal-content').querySelector(`[data-pick-anchor="${move.anchor}"]`).click();commitRelation(resumed,move.relation);
 }
 assert.equal(resumed.storage().sessions[after.stageId].complete,true);assert.equal(resumed.$('nodes').querySelectorAll('[data-node]').length,18);assert.match(resumed.$('modal-content').textContent,/系譜が、つながった/);
});

test('random horse hints identify a visible counterpart and the correct relationship',async t=>{
 const app=await loadApp(fixture());t.after(()=>app.restore());
 app.$('stage-list').querySelector('[data-random-start]').click();
 const saved=app.storage(),descriptor=saved.randomHorse;
 const stage=restoreRandomHorseSession(horseSnapshot,descriptor).stage;
 const session={...saved.sessions[descriptor.stageId],stage},move=findPlayablePlacement(session);
 assert.ok(move);
 const anchor=stage.people.find(person=>person.id===move.anchorId);
 select(app,move.cardId);
 app.$('hint-button').click();
 assert.ok(app.$('hint-box').textContent.includes(anchor.name));
 assert.doesNotMatch(app.$('hint-box').textContent,/Wikidata|Q[1-9]\\d+/);
 app.$('next-hint').click();
 assert.ok(app.$('hint-box').textContent.includes(anchor.name));
 assert.match(app.$('hint-box').textContent,/産駒|父または母|きょうだい/);
 app.$('hint-go-to-relation').click();
 assert.equal(app.$('modal').open,true);
 commitRelation(app,move.relation);
 assert.equal(app.$('placed-count').textContent,'2');
});

test('answer reveal is always available, saves the diagram and never grants a win',async t=>{
 const app=await loadApp(fixture());t.after(()=>app.restore());
 app.$('stage-list').querySelector('[data-random-start]').click();
 const descriptor=app.storage().randomHorse;
 app.$('menu-button').click();
 assert.ok(app.$('modal-content').querySelector('[data-action="give-up-confirm"]'));
 app.$('modal-content').querySelector('[data-action="give-up-confirm"]').click();
 assert.match(app.$('modal-content').textContent,/クリア記録には含まれません/);
 app.$('modal-content').querySelector('[data-action="give-up"]').click();
 const storage=app.storage(),finished=storage.sessions[descriptor.stageId];
 assert.equal(finished.gaveUp,true);
 assert.equal(finished.complete,true);
 assert.equal(finished.placed.length,18);
 assert.equal(app.$('nodes').querySelectorAll('[data-node]').length,18);
 assert.equal(storage.best[descriptor.stageId],undefined);
 assert.match(app.$('modal-content').textContent,/答えの系譜/);
 assert.match(app.$('modal-content').textContent,/クリア記録には含まれません/);
});

test('fixed stage keeps its hints and offers an exit directly from hint two',async t=>{
 const app=await setup(t);
 select(app,'iemitsu');app.$('hint-button').click();
 assert.match(app.$('hint-box').textContent,/将軍/);
 app.$('next-hint').click();
 assert.ok(app.$('hint-give-up'));
 app.$('hint-give-up').click();
 assert.match(app.$('modal-content').textContent,/答えを見て終了/);
 app.$('modal-content').querySelector('[data-action="give-up"]').click();
 assert.equal(app.storage().sessions.tokugawa.gaveUp,true);
 assert.equal(app.storage().best.tokugawa,undefined);
 assert.equal(app.$('placed-count').textContent,'18');
});

test('horse card sex labels are shown in both the hand and the field',async t=>{
 const app=await loadApp(fixture());t.after(()=>app.restore());
 app.$('stage-list').querySelector('[data-start="thoroughbred"]').click();
 const anchor=app.$('nodes').querySelector('[data-node="deep"]');
 assert.equal(anchor.querySelector('.card-sex').textContent,'牡');
 const hand=app.$('hand').querySelector('[data-card]');
 assert.ok(hand.querySelector('.card-sex'));
 assert.ok(['牡','牝','不明'].includes(hand.querySelector('.card-sex').textContent));
});

test('drag-only dotted frame follows above, sideways and below directions without committing',async t=>{
 const app=await setup(t);
 const hand=app.$('hand').querySelector('[data-card="iemitsu"]');
 hand.fire('pointerdown',{clientX:100,clientY:620});
 app.window.fire('pointermove',{clientX:196,clientY:300});
 assert.equal(app.$('drag-preview').hidden,false);
 assert.equal(app.$('drag-preview').dataset.relation,'parent');
 // The empty frame must remain visible even though the normal parent slot
 // extends beyond the initially centered 300px-tall mobile board.
 const transform=app.$('world').style.transform.match(/translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\) scale\\(([-\\d.]+)\\)/);
 assert.ok(transform);
 const previewY=Number(app.$('drag-preview').style.top.slice(0,-2))*Number(transform[3])+Number(transform[2]);
 assert.ok(previewY>50&&previewY<250,`dotted frame should stay inside board: ${previewY}`);
 assert.equal(app.$('placed-count').textContent,'1');
 assert.equal(app.$('mistake-count').textContent,'0');
 app.window.fire('pointermove',{clientX:250,clientY:366});
 assert.equal(app.$('drag-preview').dataset.relation,'sibling');
 app.window.fire('pointermove',{clientX:196,clientY:420});
 assert.equal(app.$('drag-preview').dataset.relation,'child');
 assert.equal(app.$('placed-count').textContent,'1');
 app.window.fire('pointercancel');
 assert.equal(app.$('drag-preview').hidden,true);
 assert.equal(app.$('placed-count').textContent,'1');
});

test('dropping in the child slot commits in one gesture; modal selection remains one tap',async t=>{
 const app=await setup(t);
 const hand=app.$('hand').querySelector('[data-card="iemitsu"]');
 hand.fire('pointerdown',{clientX:100,clientY:620});
 app.window.fire('pointermove',{clientX:196,clientY:420});
 assert.equal(app.$('drag-preview').dataset.relation,'child');
 app.window.fire('pointerup',{clientX:196,clientY:420});
 assert.equal(app.$('modal').open,false);
 assert.equal(app.$('placed-count').textContent,'2');
 assert.equal(app.$('drag-preview').hidden,true);
 assert.equal(app.$('mistake-count').textContent,'0');
});

test('dragging at low zoom uses a small dot and opens an unambiguous name picker',async t=>{
 const app=await setup(t);
 for(let i=0;i<5;i++)app.$('zoom-out').click();
 const hand=app.$('hand').querySelector('[data-card="iemitsu"]');
 hand.fire('pointerdown',{clientX:100,clientY:620});
 app.window.fire('pointermove',{clientX:196,clientY:366});
 assert.equal(app.$('drag-ghost').classList.contains('in-board'),true);
 app.window.fire('pointerup',{clientX:196,clientY:366});
 assert.equal(app.$('drag-ghost').classList.contains('in-board'),false);
 assert.ok(app.$('modal-content').querySelector('[data-pick-anchor="hidetada"]'));
 assert.match(app.$('modal-content').textContent,/縮小/);
});
