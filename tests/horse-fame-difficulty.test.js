import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareHorseGraph,generateRandomHorseStage,replayHorseStage,
 FAME_HORSE_GENERATOR_VERSION,HORSE_GENERATOR_VERSION} from '../src/random-horse-stage.js';
import {prepareHorseFame,HORSE_DIFFICULTIES} from '../src/horse-fame.js';
import {generateRandomHorseSession,restoreRandomHorseSession} from '../src/random-horse-session.js';

const pedigree=JSON.parse(readFileSync(new URL('../data/horse-pedigree.v1.json',import.meta.url),'utf8'));
const named=pedigree.horses.filter(h=>h.named);
const synthetic={
 version:'horse-fame-v1',pedigreeVersion:pedigree.version,
 period:{from:'2025-11-01',through:'2026-10-31'},
 horses:named.map((h,i)=>({
  id:h.id, views12m:100+((i*1367)%100003),sitelinks:1+(i%15),jraHall:i%59===0,
  articleUrl:'https://ja.wikipedia.org/wiki/TEST',article:'TEST',project:'ja.wikipedia.org',
 })),
};

test('Fame snapshot covers the precise QID set, has explicit unknowns and stable tiers',()=>{
 const graph=prepareHorseGraph(pedigree),fame=prepareHorseFame(pedigree,synthetic,graph);
 assert.equal(fame.byId.size,872);
 assert.equal(fame.coverage.measured,872);
 assert.equal([...fame.byId.values()].filter(x=>x.tier==='high').length,Math.ceil(872*.35));
 const missing=structuredClone(synthetic);
 missing.horses[0].views12m=null;
 const result=prepareHorseFame(pedigree,missing,graph);
 assert.equal(result.coverage.missing,1);
 assert.equal(result.byId.get(missing.horses[0].id).viewsObserved,false);
 const corrupt=structuredClone(synthetic);corrupt.horses.pop();
 assert.throws(()=>prepareHorseFame(pedigree,corrupt,graph),/cover every named QID/);
});

test('v3 deterministic modes stay playable without dotted sibling networks or overlap',()=>{
 assert.equal(FAME_HORSE_GENERATOR_VERSION,'horse-stage-v3');
 for(const difficulty of Object.keys(HORSE_DIFFICULTIES)){
  for(let seed=1;seed<=8;seed++){
   const options={seed,version:FAME_HORSE_GENERATOR_VERSION,fameSnapshot:synthetic,difficulty,attempts:48};
   const a=generateRandomHorseStage(pedigree,options);
   const b=generateRandomHorseStage(pedigree,options);
   assert.deepEqual(a,b);
   assert.equal(a.stage.people.length,18);
   assert.equal(a.metrics.difficulty,difficulty);
   assert.equal(a.metrics.highCount+a.metrics.mediumCount+a.metrics.lowCount,18);
   assert.equal(a.metrics.dottedSiblingLinks,0);
   assert.equal(a.metrics.rowOverlap,false);
   assert.ok(a.metrics.parentEdges>=17);
   assert.ok(replayHorseStage(a.stage,seed).ok);
   assert.ok(a.stage.id.includes(':2026-10-31:'+difficulty+':'));
  }
 }
});

test('v1/v2 sessions keep IDs; v3 restores with pinned period and exact card IDs',()=>{
 const v2=generateRandomHorseSession(pedigree,'compat-seed');
 assert.equal(v2.descriptor.generatorVersion,HORSE_GENERATOR_VERSION);
 assert.ok(!('difficulty' in v2.descriptor));
 assert.deepEqual(restoreRandomHorseSession(pedigree,v2.descriptor).descriptor,v2.descriptor);
 const v3=generateRandomHorseSession(pedigree,'fame-seed',{
  version:FAME_HORSE_GENERATOR_VERSION,fameSnapshot:synthetic,difficulty:'hard',
 });
 assert.deepEqual(restoreRandomHorseSession(pedigree,v3.descriptor,{fameSnapshot:synthetic}).stage,v3.stage);
 assert.equal(restoreRandomHorseSession(pedigree,v3.descriptor),null);
 const revised=structuredClone(synthetic);revised.period.through='2026-11-30';
 assert.equal(restoreRandomHorseSession(pedigree,v3.descriptor,{fameSnapshot:revised}),null);
});
