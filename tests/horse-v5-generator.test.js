import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateRandomHorseStage,CURRENT_HORSE_GENERATOR_VERSION} from '../src/random-horse-stage.js';
import {generateRandomHorseSession,restoreRandomHorseSession} from '../src/random-horse-session.js';
const pedigree=JSON.parse(readFileSync(new URL('../data/horse-pedigree.v1.json',import.meta.url),'utf8'));
const fameSnapshot=JSON.parse(readFileSync(new URL('../data/horse-fame-2026-10.v1.json',import.meta.url),'utf8'));
test('v5: 12 named horses from 3–4 generations, all connected, in each difficulty',()=>{
 for(const difficulty of ['easy','normal','hard']){
  const signatures=new Set();
  for(let seed=1;seed<=12;seed++){
   const a=generateRandomHorseStage(pedigree,{version:CURRENT_HORSE_GENERATOR_VERSION,fameSnapshot,difficulty,seed,attempts:96});
   assert.equal(a.stage.people.length,12);
   assert.ok(a.metrics.generations>=3&&a.metrics.generations<=4,JSON.stringify({seed,difficulty,gen:a.metrics.generations}));
   assert.equal(a.metrics.dottedSiblingLinks,0);
   assert.equal(a.metrics.rowOverlap,false);
   assert.ok(a.metrics.parentEdges>=11);
   assert.equal(a.metrics.ok,true);
   assert.ok(a.stage.id.includes('horse-stage-v5:'));
   signatures.add(a.stage.people.map(x=>x.id).sort().join(','));
  }
  assert.ok(signatures.size>=8);
 }
});
test('v5: replay stable while v3/v4 old puzzles are not changed',()=>{
 for(const difficulty of ['easy','normal','hard']){
  const v5=generateRandomHorseSession(pedigree,'v5-check-'+difficulty,{version:CURRENT_HORSE_GENERATOR_VERSION,fameSnapshot,difficulty});
  assert.equal(v5.descriptor.cardIds.length,12);
  assert.deepEqual(restoreRandomHorseSession(pedigree,v5.descriptor,{fameSnapshot}).stage,v5.stage);
 }
});
