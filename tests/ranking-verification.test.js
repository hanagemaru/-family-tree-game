import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateRandomHorseSession} from '../src/random-horse-session.js';
import {CURRENT_HORSE_GENERATOR_VERSION,PREVIOUS_HORSE_GENERATOR_VERSION,seededRandom} from '../src/random-horse-stage.js';
import {newGame,place} from '../src/core.js';
import {findPlayablePlacement} from '../src/game-assistance.js';
import {horseScore,useHorseHint} from '../src/horse-score.js';
import {verifyHorseStage,verifyHorseActions} from '../src/server/ranking-verification.js';
const pedigree=JSON.parse(readFileSync(new URL('../data/horse-pedigree.v1.json',import.meta.url),'utf8'));
const fameSnapshot=JSON.parse(readFileSync(new URL('../data/horse-fame-2026-10.v1.json',import.meta.url),'utf8'));
function sample(difficulty,seed){
 const generated=generateRandomHorseSession(pedigree,seed,{version:CURRENT_HORSE_GENERATOR_VERSION,difficulty,fameSnapshot});
 const v=verifyHorseStage({...generated.descriptor,horseIds:generated.descriptor.cardIds});
 assert.equal(v.valid,true,JSON.stringify(v));
 const state=newGame(generated.stage,seededRandom('deck:'+seed));
 let elapsed=0,once=false;
 while(!state.complete){
  const move=findPlayablePlacement(state);assert.ok(move);
  state.elapsed=elapsed+=1500;
  if(!once){useHorseHint(state,move.cardId);once=true;}
  if(!state.complete)assert.equal(place(state,move.cardId,move.anchorId,move.relation).ok,true);
 }
 state.elapsed=22_000;
 return {generated,stage:v.stage,state};
}
test('server accepts replayed actual v6 games of all modes',()=>{
 for(const difficulty of ['easy','normal','hard']){
  const {generated,stage,state}=sample(difficulty,'server-'+difficulty);
  const score=horseScore(state);
  const verified=verifyHorseActions(stage,generated.descriptor.seed,state.actions,score.timeMs,score.totalMs);
  assert.equal(verified.valid,true,JSON.stringify(verified));
  assert.equal(verified.score.hintMs,10_000);
  assert.equal(verified.score.totalMs,32_000);
 }
});
test('server refuses fake stage, impossible run, inflated/hidden score',()=>{
 const {generated,stage,state}=sample('easy','security');
 const d=structuredClone(generated.descriptor);
 d.cardIds[1]=d.cardIds[0];assert.equal(verifyHorseStage({...d,horseIds:d.cardIds}).valid,false);
 const score=horseScore(state);
 assert.equal(verifyHorseActions(stage,'security',state.actions,22_000,score.totalMs-15_000).valid,false);
 assert.equal(verifyHorseActions(stage,'security',state.actions.slice(1),22_000,score.totalMs).valid,false);
 const altered=structuredClone(state.actions);altered[0].at=999999;
 assert.equal(verifyHorseActions(stage,'security',altered,22_000,score.totalMs).valid,false);
});
test('hint is one-time and auto-placement supersedes its 10s, mistakes remain separate',()=>{
 const {generated}=sample('normal','penalty');
 const state=newGame(generated.stage,seededRandom('deck:penalty'));
 const move=findPlayablePlacement(state);
 assert.ok(useHorseHint(state,move.cardId));
 assert.equal(useHorseHint(state,move.cardId),false);
 const bad=['parent','child','sibling'].find(r=>r!==move.relation);
 assert.equal(place(state,move.cardId,move.anchorId,bad).ok,false);
 assert.equal(place(state,move.cardId,move.anchorId,move.relation,{auto:true}).ok,true);
 const score=horseScore(state);assert.equal(score.penaltyMs,60_000);assert.equal(score.hints,0);
});

test('v5 stage IDs cannot be registered in the v6 leaderboard',()=>{
 const old=generateRandomHorseSession(pedigree,'server-old-v5',{version:PREVIOUS_HORSE_GENERATOR_VERSION,difficulty:'easy',fameSnapshot});
 assert.equal(verifyHorseStage({...old.descriptor,horseIds:old.descriptor.cardIds}).valid,false);
});
