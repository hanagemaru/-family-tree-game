import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateRandomHorseStage,CURRENT_HORSE_GENERATOR_VERSION,PREVIOUS_HORSE_GENERATOR_VERSION,prepareHorseGraph} from '../src/random-horse-stage.js';
import {HORSE_V6_DIFFICULTIES,EASY_V6_POOL_SHARE,prepareHorseFame} from '../src/horse-fame.js';
import {generateRandomHorseSession,restoreRandomHorseSession} from '../src/random-horse-session.js';
const pedigree=JSON.parse(readFileSync(new URL('../data/horse-pedigree.v1.json',import.meta.url),'utf8'));
const fameSnapshot=JSON.parse(readFileSync(new URL('../data/horse-fame-2026-10.v1.json',import.meta.url),'utf8'));
const fame=prepareHorseFame(pedigree,fameSnapshot,prepareHorseGraph(pedigree));
const easyLimit=Math.ceil(fame.byId.size*EASY_V6_POOL_SHARE);
test('v6: 12 horses, 3-4 generations, no dotted siblings or overlap across levels',()=>{
 const distinct=new Set();
 for(const difficulty of ['easy','normal','hard']){
  const signatures=new Set();
  for(let seed=1;seed<=12;seed++){
   const stage=generateRandomHorseStage(pedigree,{seed,difficulty,version:CURRENT_HORSE_GENERATOR_VERSION,fameSnapshot,attempts:96});
   assert.equal(stage.stage.people.length,12);
   assert.ok(stage.stage.id.includes(':horse-stage-v6:'));
   assert.ok(stage.metrics.generations>=3&&stage.metrics.generations<=4);
   assert.ok(stage.metrics.ok);
   assert.equal(stage.metrics.rowOverlap,false);
   assert.equal(stage.metrics.dottedSiblingLinks,0);
   assert.ok(stage.metrics.parentEdges>=11);
   const high=stage.stage.people.filter(p=>fame.byId.get(p.id).tier==='high').length;
   if(difficulty==='easy'){
    assert.equal(high,12);
    for(const horse of stage.stage.people)assert.ok(fame.byId.get(horse.id).rank<=easyLimit,horse.name);
   }else assert.ok(high>=1&&high<=12);
   signatures.add(stage.stage.people.map(p=>p.id).sort().join(','));
   distinct.add(stage.stage.id);
  }
  assert.ok(signatures.size>=9,difficulty+' must create varied problems');
 }
 assert.equal(distinct.size,36);
});
test('v6 saves round-trip and are different from v5 for the same seed',()=>{
 for(const difficulty of ['easy','normal','hard']){
  const seed='v6-save-'+difficulty;
  const next=generateRandomHorseSession(pedigree,seed,{version:CURRENT_HORSE_GENERATOR_VERSION,difficulty,fameSnapshot});
  const previous=generateRandomHorseSession(pedigree,seed,{version:PREVIOUS_HORSE_GENERATOR_VERSION,difficulty,fameSnapshot});
  assert.equal(next.descriptor.cardIds.length,12);
  assert.equal(previous.descriptor.cardIds.length,12);
  assert.notEqual(next.stage.id,previous.stage.id);
  assert.deepEqual(restoreRandomHorseSession(pedigree,next.descriptor,{fameSnapshot}).stage,next.stage);
  assert.deepEqual(restoreRandomHorseSession(pedigree,previous.descriptor,{fameSnapshot}).stage,previous.stage);
 }
});
test('v6 quota targets are defined separately so old saved seeds keep their v5 rule',()=>{
 assert.equal(easyLimit,88);
 assert.equal(HORSE_V6_DIFFICULTIES.normal.highMin,6);
 assert.equal(HORSE_V6_DIFFICULTIES.normal.highMax,8);
 assert.equal(HORSE_V6_DIFFICULTIES.hard.highMin,3);
 assert.equal(HORSE_V6_DIFFICULTIES.hard.highMax,5);
});
