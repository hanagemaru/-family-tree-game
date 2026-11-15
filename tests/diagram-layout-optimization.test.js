import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,CARD_W,CARD_H} from '../src/core.js';
import {layoutFamily,buildDiagram,renderGeometry} from '../src/diagram.js';
import {generateRandomHorseStage,CURRENT_HORSE_GENERATOR_VERSION} from '../src/random-horse-stage.js';
const node=(id,generation,parents=[])=>({id,name:id,generation,parents,spouses:[]});
// Mirrors the twelve named horses and two-parent combinations in the user's
// completed-board screenshot (No.01 through No.12), not a generic sample.
const screenshotLike={id:'screenshot-like',anchor:'admire-groove',people:[
 node('admire-groove',2,['sunday','air-groove']),
 node('duramente',3,['admire-groove']),
 node('air-groove',1,['tony-bin']),
 node('sunday',1,['halo']),
 node('silence-suzuka',2,['sunday']),
 node('halo',0),
 node('heart-cry',2,['sunday']),
 node('tony-bin',0),
 node('north-flight',1,['tony-bin']),
 node('deep-impact',2,['sunday','wind-in-her-hair']),
 node('virsina',3,['deep-impact']),
 node('wind-in-her-hair',1)
]};
function full(stage,placed=stage.people.map(p=>p.id)){
 const state=newGame(stage,()=>0.5);state.placed=[...placed];state.positions={};return state;
}
function measured(state,minimizeCrossings){
 const positions=layoutFamily(state,{minimizeCrossings});
 const diagram=buildDiagram({...state,positions});
 const crosses=renderGeometry(diagram).crossings.length;
 const points=Object.entries(positions);
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
  const a=points[i][1],b=points[j][1];
  assert.ok(Math.abs(a.x-b.x)>=CARD_W+10||Math.abs(a.y-b.y)>=CARD_H+10,
   'cards overlap '+points[i][0]+' '+points[j][0]);
 }
 assert.deepEqual(Object.keys(positions).sort(),state.placed.slice().sort());
 return {positions,crosses};
}
test('racehorse-style ancestors can be reordered without changing generations or adding crossings',()=>{
 const permutations=[
  screenshotLike.people,
  [...screenshotLike.people].reverse(),
  [...screenshotLike.people].sort((a,b)=>a.id.localeCompare(b.id)),
  [...screenshotLike.people].sort((a,b)=>b.generation-a.generation||a.id.localeCompare(b.id))
 ];
 for(const order of permutations){
  const stage={...screenshotLike,people:order},state=full(stage);
  const before=measured(state,false),after=measured(state,true);
  if(order===permutations[0]){
   assert.ok(after.crosses<before.crosses,'the screenshot-like puzzle must eliminate avoidable crossings');
   assert.ok(before.positions.halo.x<before.positions['tony-bin'].x,'reproduce original ancestor order');
   assert.ok(after.positions['tony-bin'].x<after.positions.halo.x,'Tony Bin and Halo should reverse horizontal order');
   console.log('SCREENSHOT_ANCESTOR_CROSSING_REDUCED '+JSON.stringify({from:before.crosses,to:after.crosses,ancestorOrder:['tony-bin','halo']}));
  }
  assert.ok(after.crosses<=before.crosses,before.crosses+' -> '+after.crosses);
  assert.deepEqual(measured(state,true).positions,after.positions,'deterministic positioning');
  for(const p of stage.people)assert.equal(after.positions[p.id].y,before.positions[p.id].y,
   'reorder only within the same generation');
 }
});
test('real v6 pedigrees: optimization never adds wire crossings, preserves card slots',()=>{
 const pedigree=JSON.parse(readFileSync(new URL('../data/horse-pedigree.v1.json',import.meta.url),'utf8'));
 const fame=JSON.parse(readFileSync(new URL('../data/horse-fame-2026-10.v1.json',import.meta.url),'utf8'));
 let eliminated=0,baseline=0,optimized=0;
 for(const difficulty of ['easy','normal','hard']){
  const stage=generateRandomHorseStage(pedigree,{
   seed:'wire-review-'+difficulty,version:CURRENT_HORSE_GENERATOR_VERSION,
   difficulty,fameSnapshot:fame,attempts:64
  }).stage;
  const placed=[stage.anchor,...stage.people.map(p=>p.id).filter(id=>id!==stage.anchor)];
  for(const sample of [placed.slice(0,Math.min(8,placed.length)),placed]){
   const state=full(stage,sample);
   const before=measured(state,false),after=measured(state,true);
   baseline+=before.crosses;optimized+=after.crosses;
   assert.ok(after.crosses<=before.crosses,difficulty+': '+before.crosses+' -> '+after.crosses);
   if(after.crosses<before.crosses)eliminated++;
  }
 }
 console.log('WIRE_CROSSING_RESULT '+JSON.stringify({baseline,optimized,eliminatedCases:eliminated}));
});
