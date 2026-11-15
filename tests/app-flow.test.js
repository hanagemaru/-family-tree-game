import test from 'node:test';
import assert from 'node:assert/strict';
import {loadApp} from './dom-harness.js';
import {restoreRandomHorseSession} from '../src/random-horse-session.js';
import {newGame,pack,relations} from '../src/core.js';
import {findPlayablePlacement} from '../src/game-assistance.js';
import {horseScore} from '../src/horse-score.js';
import {readFileSync} from 'node:fs';
const pedigree=JSON.parse(readFileSync(new URL('../data/horse-pedigree.v1.json',import.meta.url),'utf8'));
const fameSnapshot=JSON.parse(readFileSync(new URL('../data/horse-fame-2026-10.v1.json',import.meta.url),'utf8'));
const descriptor=app=>{const s=app.storage();return s.randomHorseByDifficulty[s.randomDifficulty||'normal'];};
const session=app=>app.storage().sessions[descriptor(app).stageId];
const stage=app=>restoreRandomHorseSession(pedigree,descriptor(app),{fameSnapshot}).stage;
async function setup(t){
 const app=await loadApp();t.after(()=>app.restore());
 app.$('stage-list').querySelector('[data-random-start]').click();
 assert.ok(descriptor(app));
 return app;
}
function select(app,id){const card=app.$('hand').querySelector('[data-card="'+id+'"]');assert.ok(card);card.click({detail:0});}
function move(app){const saved={...session(app),stage:stage(app)};const m=findPlayablePlacement(saved);assert.ok(m);return m;}
function tryMove(app,m,relation=m.relation){
 select(app,m.cardId);const node=app.$('nodes').querySelector('[data-node="'+m.anchorId+'"]');assert.ok(node);node.click({detail:0});
 const button=app.$('modal-content').querySelector('[data-place-relation="'+relation+'"]');assert.ok(button);button.click();
}
test('single horse game entrance has no Tokugawa/fixed stages and loads 3 difficulties',async t=>{
 const app=await loadApp();t.after(()=>app.restore());
 assert.equal(app.$('stage-list').querySelectorAll('[data-random-level]').length,3);
 assert.equal(app.$('stage-list').querySelector('[data-start]'),null);
 assert.doesNotMatch(app.$('home-screen').textContent,/徳川|将軍|歴史と名馬/);
 assert.ok(app.$('home-screen').textContent.includes('12頭'));
 assert.ok(app.$('stage-list').querySelector('[data-random-start]'));
});
test('a correct placement grows a real 12-horse game and leaves score at zero penalty',async t=>{
 const app=await setup(t),m=move(app);tryMove(app,m);
 assert.equal(app.$('placed-count').textContent,'2');
 assert.equal(app.$('mistake-count').textContent,'0');
 assert.equal(app.$('penalty-count').textContent,'+0秒');
 assert.ok(app.$('nodes').querySelector('[data-node="'+m.cardId+'"]'));
});
test('wrong relation costs 15 seconds; one hint costs 10 once; then correct answer works',async t=>{
 const app=await setup(t),m=move(app);select(app,m.cardId);
 app.$('hint-button').click();
 assert.equal(app.$('penalty-count').textContent,'+10秒');
 assert.ok(app.$('hint-button').hidden);
 const node=app.$('nodes').querySelector('[data-node="'+m.anchorId+'"]');node.click({detail:0});
 const wrong=['parent','child','sibling'].find(r=>r!==m.relation);
 app.$('modal-content').querySelector('[data-place-relation="'+wrong+'"]').click();
 assert.equal(app.$('penalty-count').textContent,'+25秒');
 assert.equal(app.$('mistake-count').textContent,'1');
 app.$('modal-content').querySelector('[data-place-relation="'+m.relation+'"]').click();
 assert.equal(app.$('placed-count').textContent,'2');
 assert.equal(horseScore({...session(app),stage:stage(app)}).penaltyMs,25_000);
});
test('automatic placement costs 45 seconds total, not 45+10 after hint',async t=>{
 const app=await setup(t),m=move(app);select(app,m.cardId);
 app.$('hint-button').click();
 assert.equal(app.$('penalty-count').textContent,'+10秒');
 const auto=app.$('auto-place-button');assert.equal(auto.disabled,false);auto.click();
 assert.equal(app.$('placed-count').textContent,'1');
 const confirm=app.$('modal-content').querySelector('[data-action="auto-place-confirm"]');assert.ok(confirm);confirm.click();
 assert.equal(app.$('placed-count').textContent,'2');
 assert.equal(app.$('penalty-count').textContent,'+45秒');
 assert.ok(session(app).autoPlacedIds.includes(m.cardId));
});
test('an unconnectable hand card is not automatically placed',async t=>{
 const app=await setup(t);
 const saved={...session(app),stage:stage(app)};
 const blocked=saved.hand.find(id=>!saved.placed.some(anchor=>relations(saved.stage.people.find(x=>x.id===id),saved.stage.people.find(x=>x.id===anchor)).length));
 if(blocked){select(app,blocked);assert.equal(app.$('auto-place-button').disabled,true);}
});
test('timer pauses in menu and accrues while choosing a relation',async t=>{
 const app=await setup(t),m=move(app);select(app,m.cardId);
 app.$('nodes').querySelector('[data-node="'+m.anchorId+'"]').click({detail:0});
 app.advance(1000);assert.equal(app.$('timer').textContent,'0:01');
 app.$('modal-close').click();app.$('menu-button').click();app.advance(1000);
 assert.equal(app.$('timer').textContent,'0:01');
});
test('all 12 horses can be completed via the real game UI and a score breakdown appears',async t=>{
 const app=await setup(t);let turns=0;
 while(!session(app).complete&&turns++<15)tryMove(app,move(app));
 assert.equal(session(app).complete,true);
 assert.equal(app.$('nodes').querySelectorAll('[data-node]').length,12);
 assert.match(app.$('modal-content').textContent,/補正タイム/);
 assert.ok(app.$('modal-content').querySelector('[data-action="ranking-submit"]'));
 assert.equal(app.$('penalty-count').textContent,'+0秒');
 const best=app.storage().best['v5:normal'];assert.ok(best);assert.equal(best.totalMs,horseScore(session(app)).totalMs);
});
test('full surrender never grants ranked win or a personal best',async t=>{
 const app=await setup(t),d=descriptor(app);
 app.$('menu-button').click();
 app.$('modal-content').querySelector('[data-action="give-up-confirm"]').click();
 app.$('modal-content').querySelector('[data-action="give-up"]').click();
 assert.equal(session(app).gaveUp,true);
 assert.equal(app.storage().best['v5:normal'],undefined);
 assert.equal(app.$('modal-content').querySelector('[data-action="ranking-submit"]'),null);
 assert.equal(app.$('nodes').querySelectorAll('[data-node]').length,12);
});
test('reloading resumes the original seed and cards; next puzzle uses a different seed',async t=>{
 const initial=await loadApp();let saved;
 try{initial.$('stage-list').querySelector('[data-random-start]').click();saved=structuredClone(initial.storage());}
 finally{initial.restore();}
 const app=await loadApp(saved);t.after(()=>app.restore());
 const before=descriptor(app);app.$('stage-list').querySelector('[data-random-start]').click();
 assert.deepEqual(session(app),saved.sessions[before.stageId]);
 app.$('menu-button').click();app.$('modal-content').querySelector('[data-action="random-retry-confirm"]').click();app.$('modal-content').querySelector('[data-action="random-retry"]').click();
 assert.notEqual(descriptor(app).seed,before.seed);
});
test('leaderboard in direct static preview is transparent about being unavailable',async t=>{
 const app=await loadApp();t.after(()=>app.restore());
 app.$('stage-list').querySelector('[data-rank-view]').click();
 assert.match(app.$('modal-content').textContent,/本番公開後/);
});
