import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareHorseGraph,generateRandomHorseStage,replayHorseStage,
 EASIER_HORSE_GENERATOR_VERSION,FAME_HORSE_GENERATOR_VERSION} from '../src/random-horse-stage.js';
import {prepareHorseFame,EASY_V4_POOL_SHARE} from '../src/horse-fame.js';
import {generateRandomHorseSession,restoreRandomHorseSession} from '../src/random-horse-session.js';

const pedigree=JSON.parse(readFileSync(new URL('../data/horse-pedigree.v1.json',import.meta.url),'utf8'));
const fameSnapshot=JSON.parse(readFileSync(new URL('../data/horse-fame-2026-10.v1.json',import.meta.url),'utf8'));
const fame=prepareHorseFame(pedigree,fameSnapshot,prepareHorseGraph(pedigree));
const maxRank=Math.ceil(fame.byId.size*EASY_V4_POOL_SHARE);

test('v4 beginner uses only top 15% of scored horses and still makes 18-card valid puzzles',()=>{
 assert.equal(maxRank,131);
 const starts=new Set(),used=new Set();
 for(let seed=1;seed<=15;seed++){
  const options={seed,difficulty:'easy',version:EASIER_HORSE_GENERATOR_VERSION,fameSnapshot,attempts:96};
  const a=generateRandomHorseStage(pedigree,options);
  const b=generateRandomHorseStage(pedigree,options);
  assert.deepEqual(a,b);
  assert.equal(a.stage.people.length,18);
  assert.ok(a.stage.id.includes(':horse-stage-v4:'));
  assert.ok(a.metrics.ok);
  assert.equal(a.metrics.dottedSiblingLinks,0);
  assert.equal(a.metrics.rowOverlap,false);
  assert.equal(a.metrics.difficultyTargetMet,true);
  assert.equal(a.metrics.recognizableCount,18);
  assert.equal(a.metrics.highCount,18);
  for(const horse of a.stage.people){
   assert.ok(fame.byId.get(horse.id).rank<=maxRank,horse.name+' must be top 15%');
   used.add(horse.id);
  }
  starts.add(a.stage.anchor);
  assert.ok(replayHorseStage(a.stage,seed).ok);
 }
 assert.ok(starts.size>=3,'vary start horse');
 assert.ok(used.size>=25,'vary horse set');
});
test('v4 requires easy difficulty; v3 choices and legacy seeded saves remain exactly stable',()=>{
 assert.throws(()=>generateRandomHorseStage(pedigree,{seed:1,difficulty:'normal',
  version:EASIER_HORSE_GENERATOR_VERSION,fameSnapshot}),/v4 supports only beginner/);
 const prior=generateRandomHorseSession(pedigree,'prior-easy',{version:FAME_HORSE_GENERATOR_VERSION,difficulty:'easy',fameSnapshot});
 const again=restoreRandomHorseSession(pedigree,prior.descriptor,{fameSnapshot});
 assert.deepEqual(again.stage,prior.stage);
 const updated=generateRandomHorseSession(pedigree,'prior-easy',{version:EASIER_HORSE_GENERATOR_VERSION,difficulty:'easy',fameSnapshot});
 assert.notEqual(updated.descriptor.stageId,prior.descriptor.stageId);
 assert.equal(restoreRandomHorseSession(pedigree,updated.descriptor,{fameSnapshot}).stage.id,updated.stage.id);
});
