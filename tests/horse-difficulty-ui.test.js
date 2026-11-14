import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadApp} from './dom-harness.js';
import {newGame,pack} from '../src/core.js';
import {generateRandomHorseSession} from '../src/random-horse-session.js';
import {seededRandom,HORSE_GENERATOR_VERSION,FAME_HORSE_GENERATOR_VERSION,EASIER_HORSE_GENERATOR_VERSION} from '../src/random-horse-stage.js';

const pedigree=JSON.parse(readFileSync(new URL('../data/horse-pedigree.v1.json',import.meta.url),'utf8'));
const levels=['easy','normal','hard'];

test('difficulty selector starts all three versions and saves them independently',async t=>{
 const app=await loadApp();t.after(()=>app.restore());
 const buttons=app.$('stage-list').querySelectorAll('[data-random-level]');
 assert.deepEqual(buttons.map(x=>x.dataset.randomLevel),levels);
 assert.equal(buttons.filter(x=>x.getAttribute('aria-pressed')==='true').length,1);
 assert.equal(app.$('stage-list').querySelector('[data-random-start]').disabled,false);
 const generated={};
 for(const level of levels){
  app.$('stage-list').querySelector('[data-random-level="'+level+'"]').click();
  assert.equal(app.$('stage-list').querySelector('[data-random-level="'+level+'"]').getAttribute('aria-pressed'),'true');
  app.$('stage-list').querySelector('[data-random-start]').click();
  const saved=app.storage(),descriptor=saved.randomHorseByDifficulty[level];
  assert.ok(descriptor,level);
  assert.equal(descriptor.generatorVersion,level==='easy'?EASIER_HORSE_GENERATOR_VERSION:FAME_HORSE_GENERATOR_VERSION);
  assert.equal(descriptor.difficulty,level);
  assert.equal(descriptor.cardIds.length,18);
  assert.ok(saved.sessions[descriptor.stageId],level);
  assert.match(app.$('stage-title').textContent,level==='easy'?/初級/:level==='normal'?/中級/:/上級/);
  generated[level]=descriptor;
  app.$('menu-button').click();
  app.$('modal-content').querySelector('[data-action="home"]').click();
 }
 const storage=app.storage();
 assert.equal(Object.keys(storage.randomHorseByDifficulty).length,3);
 assert.deepEqual(levels.map(k=>storage.randomHorseByDifficulty[k].stageId),levels.map(k=>generated[k].stageId));
 app.$('stage-list').querySelector('[data-random-level="easy"]').click();
 assert.match(app.$('stage-list').querySelector('[data-random-start]').textContent,/つづきから/);
 app.$('stage-list').querySelector('[data-random-start]').click();
 assert.equal(app.storage().randomHorseByDifficulty.easy.stageId,generated.easy.stageId);
 assert.equal(app.storage().sessions[generated.easy.stageId].placed.length,1);
 app.$('menu-button').click();
 app.$('modal-content').querySelector('[data-action="random-retry-confirm"]').click();
 app.$('modal-content').querySelector('[data-action="random-retry"]').click();
 assert.equal(app.storage().randomHorseByDifficulty.easy.difficulty,'easy');
 assert.notEqual(app.storage().randomHorseByDifficulty.easy.seed,generated.easy.seed);
 assert.equal(app.storage().randomHorseByDifficulty.hard.stageId,generated.hard.stageId);
});

test('difficulty selection survives reload and resumes correct question per difficulty',async t=>{
 const app=await loadApp();let stored;
 try{
  app.$('stage-list').querySelector('[data-random-level="hard"]').click();
  app.$('stage-list').querySelector('[data-random-start]').click();
  stored=structuredClone(app.storage());
 }finally{app.restore();}
 const reopened=await loadApp(stored);t.after(()=>reopened.restore());
 assert.equal(reopened.$('stage-list').querySelector('[data-random-level="hard"]').getAttribute('aria-pressed'),'true');
 assert.match(reopened.$('stage-list').querySelector('[data-random-start]').textContent,/つづきから/);
 reopened.$('stage-list').querySelector('[data-random-start]').click();
 const descriptor=stored.randomHorseByDifficulty.hard;
 assert.deepEqual(reopened.storage().sessions[descriptor.stageId],stored.sessions[descriptor.stageId]);
});

test('legacy v2 saved horse session remains resumeable after new difficulty UI',async t=>{
 const old=generateRandomHorseSession(pedigree,'saved-before-difficulties',{
  version:HORSE_GENERATOR_VERSION});
 const save=pack(newGame(old.stage,seededRandom('deck:saved-before-difficulties')));
 const app=await loadApp({sessions:{[old.stage.id]:save},best:{},randomHorse:old.descriptor});
 t.after(()=>app.restore());
 const legacy=app.$('stage-list').querySelector('[data-legacy-random-start]');
 assert.ok(legacy);
 legacy.click();
 assert.equal(app.$('stage-title').textContent,old.stage.title);
 assert.deepEqual(app.storage().sessions[old.stage.id],save);
});

test('old v3 beginner save remains accessible after the beginner difficulty reduction',async t=>{
 const fameSnapshot=JSON.parse(readFileSync(new URL('../data/horse-fame-2026-10.v1.json',import.meta.url),'utf8'));
 const old=generateRandomHorseSession(pedigree,'early-easy-2026',{version:FAME_HORSE_GENERATOR_VERSION,difficulty:'easy',fameSnapshot});
 const oldState=pack(newGame(old.stage,seededRandom('deck:early-easy-2026')));
 const app=await loadApp({sessions:{[old.stage.id]:oldState},best:{},randomHorseByDifficulty:{easy:old.descriptor},randomDifficulty:'easy'});
 t.after(()=>app.restore());
 assert.ok(app.$('stage-list').querySelector('[data-old-easy-start]'));
 app.$('stage-list').querySelector('[data-random-start]').click();
 const saved=app.storage();
 assert.equal(saved.randomHorseByDifficulty.easy.generatorVersion,EASIER_HORSE_GENERATOR_VERSION);
 assert.deepEqual(saved.randomHorseLegacyEasy,old.descriptor);
 assert.deepEqual(saved.sessions[old.stage.id],oldState);
 app.$('menu-button').click();
 app.$('modal-content').querySelector('[data-action="home"]').click();
 app.$('stage-list').querySelector('[data-old-easy-start]').click();
 assert.equal(app.$('stage-title').textContent,old.stage.title);
 assert.deepEqual(app.storage().sessions[old.stage.id],oldState);
});
