import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadApp} from './dom-harness.js';

test('home is a minimal start menu without decorative horse cards or duplicated copy',async t=>{
 const app=await loadApp();t.after(()=>app.restore());
 assert.equal(app.$('home-screen').querySelector('.home-preview-board'),null);
 assert.equal(app.$('home-screen').querySelectorAll('.home-preview-card').length,0);
 assert.ok(app.$('home-screen').querySelector('.home-launch'));
 assert.match(app.$('home-screen').textContent,/12頭の血統を完成させよう/);
 assert.doesNotMatch(app.$('home-screen').textContent,/名馬の血統を、つなぐ。/);
 assert.ok(app.$('home-screen').querySelector('.home-primary-button'));
 assert.equal(app.$('home-screen').querySelector('.home-best-row'),null,'no empty best-score widget on a new visit');
 assert.equal(app.$('stage-list').querySelectorAll('[data-random-level]').length,3);
 assert.equal(app.$('home-menu-button').getAttribute('aria-haspopup'),'dialog');
 const markup=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(markup.includes('href="./home-screen.css"'));
 const built=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 assert.ok(built.includes("'home-screen.css'"));
 const css=readFileSync(new URL('../home-screen.css',import.meta.url),'utf8');
 assert.match(css,/body:not\(\.playing\)/);
 assert.match(css,/#F48B5B/);
});
test('difficulty selection updates compact text, remains accessible, and starts v6 unchanged',async t=>{
 const app=await loadApp();t.after(()=>app.restore());
 const labels={easy:'有名な馬が中心',normal:'名馬とその血統',hard:'血統まで知っている人向け'};
 for(const [level,explanation] of Object.entries(labels)){
  const control=app.$('stage-list').querySelector('[data-random-level="'+level+'"]');
  control.click();
  assert.equal(control.getAttribute('aria-pressed'),"false", 'rendered control has been replaced');
  const current=app.$('stage-list').querySelector('[data-random-level="'+level+'"]');
  assert.equal(current.getAttribute('aria-pressed'),'true');
  assert.match(app.$('stage-list').querySelector('.difficulty-description').textContent,new RegExp(explanation));
  assert.match(app.$('stage-list').querySelector('[data-random-start]').textContent,/を始める/);
 }
 app.$('stage-list').querySelector('[data-random-start]').click();
 const saved=app.storage();
 assert.equal(saved.randomHorseByDifficulty.hard.generatorVersion,'horse-stage-v6');
 assert.equal(saved.randomHorseByDifficulty.hard.cardIds.length,12);
 assert.equal(app.$('game-screen').hidden,false);
});
test('in-progress game offers resume and a confirmed new puzzle without wiping best score',async t=>{
 const app=await loadApp();t.after(()=>app.restore());
 app.$('stage-list').querySelector('[data-random-level="easy"]').click();
 app.$('stage-list').querySelector('[data-random-start]').click();
 const first=app.storage().randomHorseByDifficulty.easy;
 app.$('menu-button').click();
 app.$('modal-content').querySelector('[data-action="home"]').click();
 assert.match(app.$('stage-list').querySelector('[data-random-start]').textContent,/つづきから/);
 assert.ok(app.$('stage-list').querySelector('[data-new-random-start]'));
 app.$('stage-list').querySelector('[data-new-random-start]').click();
 assert.equal(app.$('modal').open,true);
 assert.match(app.$('modal-content').textContent,/再開できなくなります/);
 app.$('modal-close').click();
 assert.equal(app.storage().randomHorseByDifficulty.easy.stageId,first.stageId);
 app.$('stage-list').querySelector('[data-new-random-start]').click();
 app.$('modal-content').querySelector('[data-action="new-random-home-confirm"]').click();
 assert.equal(app.$('modal').open,false);
 assert.notEqual(app.storage().randomHorseByDifficulty.easy.stageId,first.stageId);
 assert.equal(app.storage().sessions[first.stageId].placed.length,1);
});
test('home menu keeps site return link and attribution, help remains available',async t=>{
 const app=await loadApp();t.after(()=>app.restore());
 app.$('home-menu-button').click();
 assert.equal(app.$('modal').open,true);
 assert.equal(app.$('modal-content').querySelector('a').getAttribute('href'),'https://hanage.app/games/horse-pedigree/');
 app.$('modal-content').querySelector('[data-action="sources"]').click();
 assert.match(app.$('modal-content').textContent,/題材・出典/);
 app.$('modal-close').click();
 app.$('help-button').click();
 assert.match(app.$('modal-content').textContent,/手札を場につなぐ/);
});
