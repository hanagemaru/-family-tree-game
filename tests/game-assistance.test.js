import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,place,pack,restore,relations} from '../src/core.js';
import {generateRandomHorseStage,seededRandom} from '../src/random-horse-stage.js';
import {findCorrectPlacement,findPlayablePlacement,horsePlacementHint,completedAnswer} from '../src/game-assistance.js';

const snapshot=JSON.parse(readFileSync(new URL('../data/horse-pedigree.v1.json',import.meta.url),'utf8'));
const makeState=seed=>{
 const {stage}=generateRandomHorseStage(snapshot,{seed});
 return newGame(stage,seededRandom(`deck:${seed}`));
};

test('generated clues never leak an unresolved Wikidata QID or an empty provenance hint',()=>{
 for(let seed=1;seed<=30;seed++){
  const state=makeState(seed);
  for(const person of state.stage.people){
   assert.doesNotMatch(person.clues.join(' '),/Q[1-9]\d+/);
   assert.doesNotMatch(person.clues[0],/Wikidataに登録/);
  }
 }
});

test('hints name a real placed opponent then state a legal parent-child/sibling relation',()=>{
 const state=makeState(7);
 const move=findPlayablePlacement(state);
 assert.ok(move);
 assert.deepEqual(findCorrectPlacement(state,move.cardId),move);
 const anchor=state.stage.people.find(person=>person.id===move.anchorId);
 const first=horsePlacementHint(state,move.cardId,1);
 const second=horsePlacementHint(state,move.cardId,2);
 assert.ok(first.includes(anchor.name));
 assert.ok(second.includes(anchor.name));
 assert.doesNotMatch(first+second,/Wikidata|Q[1-9]\d+/);
 const card=state.stage.people.find(person=>person.id===move.cardId);
 assert.ok(relations(card,anchor).includes(move.relation));
 assert.equal(place(state,move.cardId,move.anchorId,move.relation).ok,true);
});

test('answer reveal completes the true game without mutating play state or recording a normal win',()=>{
 for(let seed=1;seed<=25;seed++){
  const original=makeState(seed);
  const first=findPlayablePlacement(original);
  assert.ok(first);
  assert.equal(place(original,first.cardId,first.anchorId,first.relation).ok,true);
  const before=structuredClone(pack(original));
  const answer=completedAnswer(original);
  assert.ok(answer,`seed ${seed}`);
  assert.equal(answer.complete,true);
  assert.equal(answer.gaveUp,true);
  assert.equal(answer.placed.length,18);
  assert.deepEqual(pack(original),before,'giving up must not mutate the running game');
  assert.equal(restore(pack(answer),original.stage).gaveUp,true);
 }
});
