import test from 'node:test';import assert from 'node:assert/strict';
import {loadApp} from './dom-harness.js';import {newGame,pack,relations,fitCamera} from '../src/core.js';import {stages} from '../src/data.js';
import {readFileSync} from 'node:fs';import {restoreRandomHorseSession} from '../src/random-horse-session.js';
import {findPlayablePlacement} from '../src/game-assistance.js';
const horseSnapshot=JSON.parse(readFileSync(new URL('../data/horse-pedigree.v1.json',import.meta.url),'utf8'));
function fixture(){const state=newGame(stages[0]);state.hand=['ieyasu','go','iemitsu','tadanaga','sen'];state.deck=['yoshinao','yorinobu','yorifusa'];return {sessions:{tokugawa:pack(state)},best:{}};}
// Legacy Tokugawa regression tests exercise the retained engine without
// exposing a history-mode button in the public horse-only release.
function openLegacyForTest(app,id='tokugawa'){
 const element=app.$('stage-list');
 element.innerHTML+=`<button data-start="${id}">internal test stage</button>`;
 element.querySelector(`[data-start="${id}"]`).click();
}
async function setup(t){const app=await loadApp(fixture());t.after(()=>app.restore());openLegacyForTest(app);return app;}
function select(app,id='iemitsu'){app.$('hand').querySelector(`[data-card="${id}"]`).click({detail:0});}
function target(app,id='hidetada'){app.$('nodes').querySelector(`[data-node="${id}"]`).click({detail:0});}
function commitRelation(app,relation){const button=app.$('modal-content').querySelector(`[data-place-relation="${relation}"]`);assert.ok(button);button.click();}
test('actual app: tap hand and opponent, then choose a relation and complete placement',async t=>{
 const app=await setup(t);select(app);assert.match(app.$('selection-summary').textContent,/家光/);target(app);assert.equal(app.$('modal').open,true);assert.equal(app.$('modal-content').querySelectorAll('[data-place-relation]').length,4);assert.match(app.$('modal-content').textContent,/家光.*秀忠/s);commitRelation(app,'child');assert.equal(app.$('modal').open,false);assert.ok(app.$('nodes').querySelector('[data-node="iemitsu"]'));assert.equal(app.$('placed-count').textContent,'2');
});
test('actual app: cancel keeps the chosen hand card and offers a reliable opponent list',async t=>{
 const app=await setup(t);select(app);target(app);app.$('modal-close').click();assert.match(app.$('selection-summary').textContent,/家光/);app.$('menu-button').click();app.$('modal-content').querySelector('[data-action="anchor-list"]').click();app.$('modal-content').querySelector('[data-pick-anchor="hidetada"]').click();assert.ok(app.$('modal-content').querySelector('[data-place-relation="child"]'));
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
test('actual app: dropping on empty board does not force an opponent dialog',async t=>{
 const app=await setup(t),hand=app.$('hand').querySelector('[data-card="iemitsu"]');hand.fire('pointerdown',{clientX:100,clientY:620});app.window.fire('pointermove',{clientX:40,clientY:250});app.window.fire('pointerup',{clientX:40,clientY:250});assert.equal(app.$('modal').open,false);assert.match(app.$('selection-summary').textContent,/家光/);
});
test('actual app: pointer cancellation clears the ghost but preserves an actionable selection',async t=>{
 const app=await setup(t),hand=app.$('hand').querySelector('[data-card="iemitsu"]');hand.fire('pointerdown',{clientX:100,clientY:620});app.window.fire('pointermove',{clientX:196,clientY:366});app.window.fire('pointercancel');assert.equal(app.$('drag-ghost').hidden,true);assert.equal(app.$('app').hasPointerCapture(1),false);assert.equal(app.$('hint-button').hidden,false);
});
test('actual app: panning with a hand card selected does not accidentally open a placement sheet',async t=>{
 const app=await setup(t);select(app);const node=app.$('nodes').querySelector('[data-node="hidetada"]');node.fire('pointerdown',{clientX:196,clientY:330});app.window.fire('pointermove',{clientX:240,clientY:350});app.window.fire('pointerup',{clientX:240,clientY:350});assert.equal(app.$('modal').open,false);assert.match(app.$('selection-summary').textContent,/家光/);
});
test('actual app: same hand card toggles selection, then a new card can be placed',async t=>{
 const app=await setup(t);
 select(app);assert.match(app.$('selection-summary').textContent,/家光/);
 assert.equal(app.$('hint-button').hidden,false);
 select(app);assert.equal(app.$('selection-summary').textContent,'');
 assert.equal(app.$('hint-button').hidden,true);
 select(app,'go');target(app);commitRelation(app,'spouse');
 assert.ok(app.$('nodes').querySelector('[data-node="go"]'));
});
test('actual app: board blank tap cancels selection but board pan does not',async t=>{
 const app=await setup(t);select(app);
 app.$('board').fire('pointerdown',{clientX:20,clientY:180});
 app.window.fire('pointerup',{clientX:20,clientY:180});
 assert.equal(app.$('selection-summary').textContent,'');
 assert.equal(app.$('hint-button').hidden,true);
 select(app);
 const node=app.$('nodes').querySelector('[data-node="hidetada"]');
 node.fire('pointerdown',{clientX:196,clientY:330});
 app.window.fire('pointermove',{clientX:240,clientY:350});
 app.window.fire('pointerup',{clientX:240,clientY:350});
 assert.match(app.$('selection-summary').textContent,/家光/);
});
test('actual app: both themes can be completed through real hand, picker and relation handlers',async t=>{
 for(const stage of stages){
  const app=await loadApp({sessions:{[stage.id]:pack(newGame(stage))},best:{}});
  try{openLegacyForTest(app,stage.id);let turns=0;
   while(turns++<100){const state=app.storage().sessions[stage.id];if(state.complete)break;const byId=id=>stage.people.find(p=>p.id===id);const move=state.hand.flatMap(card=>state.placed.flatMap(anchor=>relations(byId(card),byId(anchor)).map(relation=>({card,anchor,relation}))))[0];
    assert.ok(move,`${stage.id}: draw should always be playable`);select(app,move.card);target(app,move.anchor);commitRelation(app,move.relation);
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
  assert.ok(move,'random UI should always offer a legal move');select(resumed,move.card);target(resumed,move.anchor);commitRelation(resumed,move.relation);
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
 app.$('hint-button').click();
 assert.ok(app.$('hint-box').textContent.includes(anchor.name));
 assert.match(app.$('hint-box').textContent,/産駒|父または母|きょうだい/);
 assert.equal(app.$('modal').open,false);
 assert.equal(app.$('hint-box').querySelectorAll('button').length,0);
 target(app,move.anchorId);
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

test('fixed stage keeps text-only hints and offers surrender in menu',async t=>{
 const app=await setup(t);
 select(app,'iemitsu');app.$('hint-button').click();
 assert.match(app.$('hint-box').textContent,/将軍/);
 app.$('hint-button').click();
 assert.equal(app.$('hint-box').querySelectorAll('button').length,0);
 assert.equal(app.$('hint-button').hidden,true);
 app.$('menu-button').click();app.$('modal-content').querySelector('[data-action="give-up-confirm"]').click();
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
 // The frame is screen-sized and visible regardless of the board zoom.
 const previewY=Number(app.$('drag-preview').style.top.slice(0,-2));
 assert.ok(previewY>=27&&previewY<=273,`dotted frame should stay inside board: ${previewY}`);
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

test('casually releasing anywhere in the child quadrant does not place a card',async t=>{
 const app=await setup(t);
 const hand=app.$('hand').querySelector('[data-card="iemitsu"]');
 hand.fire('pointerdown',{clientX:100,clientY:620});
 app.window.fire('pointermove',{clientX:196,clientY:420});
 assert.equal(app.$('drag-preview').dataset.relation,'child');
 assert.equal(app.$('drag-preview').classList.contains('armed'),false);
 app.window.fire('pointerup',{clientX:196,clientY:420});
 assert.equal(app.$('modal').open,true,'an ordinary release still requires a deliberate relation selection');
 assert.equal(app.$('placed-count').textContent,'1');
 assert.equal(app.$('mistake-count').textContent,'0');
 assert.equal(app.$('drag-preview').hidden,true);
 commitRelation(app,'child');
 assert.equal(app.$('placed-count').textContent,'2');
});

test('only a stable release INSIDE the outlined slot can place directly',async t=>{
 const app=await setup(t);
 const hand=app.$('hand').querySelector('[data-card="iemitsu"]');
 hand.fire('pointerdown',{clientX:100,clientY:620});
 app.window.fire('pointermove',{clientX:196,clientY:420});
 assert.equal(app.$('drag-preview').dataset.relation,'child');
 const rect=app.$('board').getBoundingClientRect();
 const x=rect.left+Number(app.$('drag-preview').style.left.slice(0,-2));
 const y=rect.top+Number(app.$('drag-preview').style.top.slice(0,-2))+36;
 app.window.fire('pointermove',{clientX:x,clientY:y});
 assert.equal(app.$('drag-preview').classList.contains('over-slot'),true);
 assert.equal(app.$('drag-preview').classList.contains('armed'),false);
 app.advance(300);
 app.window.fire('pointermove',{clientX:x,clientY:y});
 assert.equal(app.$('drag-preview').classList.contains('armed'),true);
 app.window.fire('pointerup',{clientX:x,clientY:y});
 assert.equal(app.$('modal').open,false);
 assert.equal(app.$('placed-count').textContent,'2');
 assert.equal(app.$('drag-preview').hidden,true);
 assert.equal(app.$('mistake-count').textContent,'0');
});

test('reaching the precise slot but immediately releasing still requires a deliberate choice',async t=>{
 const app=await setup(t);
 const hand=app.$('hand').querySelector('[data-card="iemitsu"]');
 hand.fire('pointerdown',{clientX:100,clientY:620});
 app.window.fire('pointermove',{clientX:196,clientY:420});
 const rect=app.$('board').getBoundingClientRect();
 const x=rect.left+Number(app.$('drag-preview').style.left.slice(0,-2));
 const y=rect.top+Number(app.$('drag-preview').style.top.slice(0,-2))+36;
 app.window.fire('pointermove',{clientX:x,clientY:y});
 app.window.fire('pointerup',{clientX:x,clientY:y});
 assert.equal(app.$('modal').open,true);
 assert.equal(app.$('placed-count').textContent,'1');
 assert.equal(app.$('mistake-count').textContent,'0');
});

test('dragging at low zoom preserves an explicitly targeted opponent',async t=>{
 const app=await setup(t);
 for(let i=0;i<5;i++)app.$('zoom-out').click();
 const hand=app.$('hand').querySelector('[data-card="iemitsu"]');
 hand.fire('pointerdown',{clientX:100,clientY:620});
 app.window.fire('pointermove',{clientX:196,clientY:366});
 assert.equal(app.$('drag-ghost').classList.contains('in-board'),true);
 app.window.fire('pointerup',{clientX:196,clientY:366});
 assert.equal(app.$('drag-ghost').classList.contains('in-board'),false);
 assert.equal(app.$('modal').open,true);
 assert.match(app.$('modal-content').textContent,/家光.*秀忠/s);
 assert.ok(app.$('modal-content').querySelector('[data-place-relation="child"]'));
});

test('arming a slot is cancelled by leaving it; a quick re-entry cannot auto-place',async t=>{
 const app=await setup(t),hand=app.$('hand').querySelector('[data-card="iemitsu"]');
 hand.fire('pointerdown',{clientX:100,clientY:620});
 app.window.fire('pointermove',{clientX:196,clientY:420});
 const rect=app.$('board').getBoundingClientRect();
 const x=rect.left+Number(app.$('drag-preview').style.left.slice(0,-2));
 const y=rect.top+Number(app.$('drag-preview').style.top.slice(0,-2))+36;
 app.window.fire('pointermove',{clientX:x,clientY:y});
 app.advance(300);
 app.window.fire('pointermove',{clientX:x,clientY:y});
 assert.equal(app.$('drag-preview').classList.contains('armed'),true);
 app.window.fire('pointermove',{clientX:196,clientY:420});
 assert.equal(app.$('drag-preview').classList.contains('armed'),false);
 app.window.fire('pointermove',{clientX:x,clientY:y});
 assert.equal(app.$('drag-preview').classList.contains('armed'),false);
 app.window.fire('pointerup',{clientX:x,clientY:y});
 assert.equal(app.$('placed-count').textContent,'1');
 assert.equal(app.$('modal').open,true);
});

test('holding a dotted slot at low zoom does not auto-place but retains a clear opponent',async t=>{
 const app=await setup(t);
 for(let i=0;i<5;i++)app.$('zoom-out').click();
 const hand=app.$('hand').querySelector('[data-card="iemitsu"]');
 hand.fire('pointerdown',{clientX:100,clientY:620});
 app.window.fire('pointermove',{clientX:196,clientY:420});
 const outline=app.$('drag-preview');
 if(!outline.hidden){
  assert.equal(outline.classList.contains('disabled'),true);
  const rect=app.$('board').getBoundingClientRect();
  const x=rect.left+Number(outline.style.left.slice(0,-2));
  const y=rect.top+Number(outline.style.top.slice(0,-2))+36;
  app.window.fire('pointermove',{clientX:x,clientY:y});
  app.advance(300);
  app.window.fire('pointermove',{clientX:x,clientY:y});
  assert.equal(outline.classList.contains('armed'),false);
  app.window.fire('pointerup',{clientX:x,clientY:y});
 }else app.window.fire('pointerup',{clientX:196,clientY:420});
 assert.equal(app.$('placed-count').textContent,'1');
 assert.equal(app.$('modal').open,true);
 assert.ok(app.$('modal-content').querySelector('[data-place-relation="child"]'));
});

test('successful placement fits the entire currently placed pedigree, not just the new card',async t=>{
 const app=await setup(t);
 select(app);target(app);commitRelation(app,'child');
 const saved=app.storage().sessions.tokugawa;
 const expected=fitCamera(saved.positions,app.$('board').clientWidth,app.$('board').clientHeight);
 const transform=app.$('world').style.transform;
 const values=transform.match(/[-+]?[0-9]*\.?[0-9]+/g)?.map(Number);
 assert.ok(values&&values.length>=3,transform);
 for(let i=0;i<3;i++)assert.ok(Math.abs(values[i]-[expected.x,expected.y,expected.scale][i])<.001,
  'the full pedigree fit must update after every placed card: '+transform);
});

test('future-connected hand cards can consume both hints without being auto-selected away',async t=>{
 const app=await loadApp(fixture());t.after(()=>app.restore());
 app.$('stage-list').querySelector('[data-random-start]').click();
 let candidate=app.$('hand').querySelector('[data-card]');
 const stage=app.storage().randomHorse;
 assert.ok(stage);
 // Every hand card can reveal at least its first clue. Keep its selection stable.
 const id=candidate.dataset.card;
 candidate.click({detail:0});
 app.$('hint-button').click();
 assert.equal(app.$('hint-box').hidden,false);
 assert.match(app.$('hint-box').textContent,/ヒント 1/);
 assert.match(app.$('selection-summary').textContent,/.+/);
 app.$('hint-button').click();
 assert.match(app.$('hint-box').textContent,/ヒント 2/);
 assert.equal(app.$('hint-button').hidden,true);
 assert.equal(app.$('hand').querySelector(`[data-card="${id}"]`).classList.contains('selected'),true);
});

test('public home offers exactly two horse modes; historical cards stay out of the release UI',async t=>{
 const app=await loadApp(fixture());t.after(()=>app.restore());
 const cards=app.$('stage-list');
 assert.equal(cards.querySelectorAll('.stage-card').length,2);
 assert.equal(cards.querySelector('[data-start="tokugawa"]'),null);
 assert.ok(cards.querySelector('[data-start="thoroughbred"]'));
 assert.ok(cards.querySelector('[data-random-start]'));
 assert.doesNotMatch(app.$('home-screen').textContent,/徳川|歴史人物/);
 assert.match(app.$('home-screen').textContent,/名馬の血統/);
 app.$('sources-button').click();
 assert.doesNotMatch(app.$('modal-content').textContent,/徳川/);
 assert.match(app.$('modal-content').textContent,/Wikidata|Wikipedia/);
});
