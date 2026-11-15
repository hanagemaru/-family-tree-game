import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CURRENT_HORSE_GENERATOR_VERSION,generateRandomHorseStage,seededRandom} from '../src/random-horse-stage.js';
import {generateRandomHorseSession} from '../src/random-horse-session.js';
import {newGame,pack} from '../src/core.js';
import {loadApp} from './dom-harness.js';
const pedigree=JSON.parse(readFileSync(new URL('../data/horse-pedigree.v1.json',import.meta.url),'utf8'));
const fameSnapshot=JSON.parse(readFileSync(new URL('../data/horse-fame-2026-10.v1.json',import.meta.url),'utf8'));
const media=JSON.parse(readFileSync(new URL('../data/horse-media.v1.json',import.meta.url),'utf8'));

test('all 872 playable, named horses have a plausible birth year',()=>{
 const named=pedigree.horses.filter(h=>h.named);
 assert.equal(named.length,872);
 for(const horse of named){
  assert.ok(Number.isInteger(horse.birthYear)&&horse.birthYear>=1850&&horse.birthYear<=2026,
   horse.name+' ('+horse.id+') has no birth year');
 }
 const map=new Map(pedigree.horses.map(h=>[h.id,h]));
 for(const child of named)for(const parentId of [child.sire,child.dam].filter(Boolean)){
  const parent=map.get(parentId);
  if(parent&&parent.birthYear!==null)assert.ok(child.birthYear-parent.birthYear>=2,
   child.name+' cannot precede ancestor '+parent.name);
 }
});
test('six enriched breeding horses retain sourced birth years',()=>{
 const expected={Q127603169:2005,Q127950242:2005,Q21996489:2001,
  Q61970475:1992,Q61976466:1977,Q61994633:1959};
 const refs=JSON.parse(readFileSync(new URL('../data/source/horse-birth-enrichment-2026-11-15.json',import.meta.url),'utf8'));
 for(const [id,year] of Object.entries(expected)){
  assert.equal(pedigree.horses.find(h=>h.id===id).birthYear,year);
  const item=refs.items.find(e=>e.qid===id);
  assert.equal(item.birthYear,year);
  assert.ok(item.sources.some(source=>source.url.startsWith('https://www.jbis.')));
 }
});
test('every new 12-horse puzzle includes every birth year',()=>{
 for(const difficulty of ['easy','normal','hard']){
  const result=generateRandomHorseStage(pedigree,{
   version:CURRENT_HORSE_GENERATOR_VERSION,seed:'birth-test-'+difficulty,
   difficulty,fameSnapshot,attempts:96
  });
  assert.equal(result.stage.people.length,12);
  for(const p of result.stage.people)assert.ok(Number.isInteger(p.birthYear),p.name);
 }
});
test('card rendering displays birth year in hand and on board',async t=>{
 const app=await loadApp();t.after(()=>app.restore());
 app.$('stage-list').querySelector('[data-random-start]').click();
 const hand=app.$('hand').querySelector('.card-birth-year');
 const board=app.$('nodes').querySelector('.card-birth-year');
 assert.ok(hand);assert.ok(board);
 assert.match(hand.textContent,/^(18|19|20)\d\d年生$/);
 assert.match(board.textContent,/^(18|19|20)\d\d年生$/);
});
test('no photo with an unverified image license is published',()=>{
 assert.equal(media.version,'horse-photo-v1');
 const filenames=new Set();
 for(const [qid,p] of Object.entries(media.horses)){
  assert.ok(pedigree.horses.some(h=>h.id===qid&&h.named));
  assert.doesNotMatch(p.filename,/request.?picture|placeholder|no.?photo|not.?available/i);
  assert.equal(filenames.has(p.filename),false,'one horse photo should not represent multiple different animals');
  filenames.add(p.filename);
  assert.match(p.photoUrl,/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//);
  assert.ok(p.filePage.startsWith('https://commons.wikimedia.org/'));
  assert.match(p.license,/^(CC BY(?:-SA)? [234]\.0|CC0(?: 1\.0)?|Public domain)$/);
  assert.ok(p.artist||p.license.startsWith('CC0')||p.license==='Public domain');
 }
});

test('licensed photo is displayed on cards and its individual attribution is reachable',async t=>{
 if(!Object.keys(media.horses).length)return; // no licensed photos before collector has run
 let generated;
 for(let seed=1;seed<=5;seed++){
  const attempt=generateRandomHorseSession(pedigree,'photo-test-'+seed,{
   version:CURRENT_HORSE_GENERATOR_VERSION,difficulty:'easy',fameSnapshot
  });
  if(attempt.stage.people.some(p=>media.horses[p.id])){generated=attempt;break;}
 }
 assert.ok(generated,'the top-15% beginner mode should find at least one verified photo');
 const descriptor=generated.descriptor;
 const state=pack(newGame(generated.stage,seededRandom('deck:'+descriptor.seed)));
 const app=await loadApp({sessions:{[generated.stage.id]:state},best:{},
  randomHorseByDifficulty:{easy:descriptor},randomDifficulty:'easy'});
 t.after(()=>app.restore());
 app.$('stage-list').querySelector('[data-random-start]').click();
 const images=[
  ...app.$('hand').querySelectorAll('.horse-photo'),
  ...app.$('nodes').querySelectorAll('.horse-photo')
 ];
 assert.ok(images.length>0,'use Commons image when the selected horses are covered');
 assert.ok(images.every(img=>/^https:\/\/(?:thumb|upload)\.wikimedia\.org\//.test(img.getAttribute('src'))));
 app.$('sources-button').click();
 assert.match(app.$('modal-content').textContent,/カード写真・著作者・ライセンス/);
 assert.match(app.$('modal-content').textContent,/CC BY|CC0|Public domain/);
 assert.ok(app.$('modal-content').querySelectorAll('a').some(a=>a.getAttribute('href')?.startsWith('https://commons.wikimedia.org/')));
});
