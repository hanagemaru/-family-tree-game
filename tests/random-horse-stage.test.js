import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stages} from '../src/data.js';
import {pack,restore,relations,newGame} from '../src/core.js';
import {prepareHorseGraph,generateRandomHorseStage,replayHorseStage,seededRandom} from '../src/random-horse-stage.js';
const snapshot=JSON.parse(readFileSync(new URL('../data/horse-pedigree.v1.json',import.meta.url),'utf8'));
const graph=prepareHorseGraph(snapshot);

test('Frozen Wikidata snapshot: unique QIDs, parent references, safe names and distinct sources',()=>{
 assert.ok(snapshot.horses.length>=280);
 assert.equal(graph.all.size,snapshot.horses.length);
 assert.ok([...graph.named.values()].length>=200);
 for(const horse of snapshot.horses){
  for(const p of [horse.sire,horse.dam])if(p){assert.ok(graph.all.has(p));assert.notEqual(p,horse.id);}
  assert.ok(horse.source.endsWith(horse.id));
 }
});
test('Same seed and snapshot gives byte-for-byte identical problem and order',()=>{
 for(const seed of [1,2,17,99,'sunday:week1']){
  const a=generateRandomHorseStage(snapshot,{seed,attempts:8});
  const b=generateRandomHorseStage(snapshot,{seed,attempts:8});
  assert.deepEqual(a,b);
 }
});
test('One hundred independent 18-card games have a complete legal core+diagram replay',()=>{
 const distinct=new Set();
 for(let seed=1;seed<=100;seed++){
  const {stage,metrics}=generateRandomHorseStage(snapshot,{seed,attempts:8});
  assert.equal(stage.people.length,18);assert.equal(new Set(stage.people.map(p=>p.id)).size,18);
  assert.ok(stage.people.every(p=>p.name&&!/^Q\d+$/.test(p.name)));
  assert.ok(stage.people.every(p=>p.generation>=0));
  assert.ok(metrics.ok);assert.equal(metrics.steps,17);
  assert.equal(metrics.rowOverlap,false);
  for(const child of stage.people)for(const pid of child.parents){
   const parent=stage.people.find(p=>p.id===pid);
   if(parent)assert.equal(child.generation,parent.generation+1);
  }
  const again=replayHorseStage(stage,seed);assert.ok(again.ok);
  distinct.add(stage.people.map(p=>p.id).sort().join(','));
 }
 assert.ok(distinct.size>20,'seed variation must produce diverse card sets');
});
test('Legacy fixed stages and session restoration are unchanged',()=>{
 assert.deepEqual(stages.map(stage=>[stage.id,stage.people.length]),[['tokugawa',18],['thoroughbred',24]]);
 for(const stage of stages){const state=newGame(stage,seededRandom(2));const save=JSON.parse(JSON.stringify(pack(state)));assert.deepEqual(pack(restore(save,stage)),save);}
});
test('Malformed data / unavailable components fail explicitly',()=>{
 assert.throws(()=>prepareHorseGraph({version:'v',horses:[{id:'Q1',name:'A',named:true},{id:'Q1',name:'B',named:true}]}),/Duplicate/);
 assert.throws(()=>generateRandomHorseStage({version:'tiny',horses:[{id:'Q1',name:'A',named:true,sire:null,dam:null}],roots:{}},{seed:1}),/insufficient_connected_named_records/);
});
