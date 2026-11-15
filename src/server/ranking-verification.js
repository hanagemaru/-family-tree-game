/** Lightweight server replay. V1 validates a legitimate 12-card pedigree, not the generator's random seed choice. */
import pedigree from '../../data/horse-pedigree.v1.json' with {type:'json'};
import fameSnapshot from '../../data/horse-fame-2026-10.v1.json' with {type:'json'};
import {HORSE_DIFFICULTIES,prepareHorseFame} from '../horse-fame.js';
import {CURRENT_HORSE_GENERATOR_VERSION,seededRandom} from '../random-horse-stage.js';
import {newGame,place} from '../core.js';
import {findCorrectPlacement} from '../game-assistance.js';
import {horseScore,HORSE_SCORE_VERSION} from '../horse-score.js';

const named=new Map(pedigree.horses.filter(h=>h.named).map(h=>[h.id,h]));
const children=new Map;
for(const h of named.values())for(const id of [h.sire,h.dam].filter(Boolean)){
 if(!children.has(id))children.set(id,[]);
 children.get(id).push(h.id);
}
const fame=prepareHorseFame(pedigree,fameSnapshot,{named,children});
const rankLimit=Math.ceil(fame.byId.size*.15);
const allowedRelation=new Set(['parent','child','sibling']);
const validSeed=seed=>typeof seed==='string'&&seed.length>0&&seed.length<=100&&/^[a-zA-Z0-9_-]+$/.test(seed);
const error=reason=>({valid:false,reason});

export function verifyHorseStage({stageId,seed,difficulty,horseIds,generatorVersion}={}){
 if(!HORSE_DIFFICULTIES[difficulty]||generatorVersion!==CURRENT_HORSE_GENERATOR_VERSION||
  !validSeed(seed)||!Array.isArray(horseIds)||horseIds.length!==12||
  new Set(horseIds).size!==12)return error('invalid_stage_descriptor');
 const expected='horse-generated:'+pedigree.version+':'+CURRENT_HORSE_GENERATOR_VERSION+':'+fameSnapshot.period.through+':'+difficulty+':'+seed;
 if(stageId!==expected)return error('stage_id_mismatch');
 const selected=new Set(horseIds),names=new Set;
 for(const id of selected){
  const h=named.get(id);
  if(!h||names.has(h.name)||(difficulty==='easy'&&fame.byId.get(id).rank>rankLimit))return error('ineligible_horse');
  names.add(h.name);
 }
 // All twelve horses must be connected by direct known parent-child edges.
 const adjacent=new Map(horseIds.map(id=>[id,[]]));
 let parentEdges=0;
 for(const id of selected){const h=named.get(id);
  for(const parent of [h.sire,h.dam])if(parent&&selected.has(parent)){
   parentEdges++;
   adjacent.get(id).push({id:parent,step:-1});
   adjacent.get(parent).push({id,step:1});
  }
 }
 if(parentEdges<11)return error('not_connected');
 const generations=new Map([[horseIds[0],0]]),stack=[horseIds[0]];
 while(stack.length){
  const id=stack.pop(),gen=generations.get(id);
  for(const next of adjacent.get(id)){
   const expectedGen=gen+next.step;
   if(generations.has(next.id)){if(generations.get(next.id)!==expectedGen)return error('generation_conflict');}
   else{generations.set(next.id,expectedGen);stack.push(next.id);}
  }
 }
 if(generations.size!==12)return error('disconnected');
 const values=[...generations.values()],spread=Math.max(...values)-Math.min(...values)+1;
 if(spread<3||spread>4)return error('too_many_generations');
 for(let i=0;i<horseIds.length;i++)for(let j=i+1;j<horseIds.length;j++){
  const a=named.get(horseIds[i]),b=named.get(horseIds[j]);
  const shared=[a.sire,a.dam].filter(p=>p&&[b.sire,b.dam].includes(p));
  if(shared.length&&!shared.some(p=>selected.has(p)))return error('unresolved_sibling');
 }
 const minimum=Math.min(...values);
 const stage={id:stageId,anchor:horseIds[0],people:horseIds.map(id=>{
  const h=named.get(id);
  return {id,name:h.name,parents:[h.sire,h.dam].filter(Boolean),spouses:[],generation:generations.get(id)-minimum};
 })};
 return {valid:true,stage,spread,parentEdges};
}

export function verifyHorseActions(stage,seed,actions,elapsedMs,claimedMs){
 if(!Array.isArray(actions)||actions.length<11||actions.length>180||
  !Number.isInteger(elapsedMs)||elapsedMs<10_000||elapsedMs>3_600_000*4||
  !Number.isInteger(claimedMs))return error('invalid_duration_or_actions');
 const state=newGame(stage,seededRandom('deck:'+seed));
 let last=0;
 for(const action of actions){
  if(!action||!Number.isInteger(action.at)||action.at<last||action.at>elapsedMs||!stage.people.some(p=>p.id===action.cardId))return error('invalid_action');
  last=action.at;state.elapsed=action.at;
  if(action.type==='hint'){
   if(!state.hand.includes(action.cardId)||state.hints[action.cardId]>=1||state.complete)return error('invalid_hint');
   state.hints[action.cardId]=1;
  }else if(action.type==='place'){
   if(!allowedRelation.has(action.relation)||typeof action.auto!=='boolean'||typeof action.ok!=='boolean')return error('invalid_placement_shape');
   if(action.auto){
    const correct=findCorrectPlacement(state,action.cardId);
    if(!correct||correct.anchorId!==action.anchorId||correct.relation!==action.relation||!action.ok)return error('invalid_auto_place');
   }
   if(!state.hand.includes(action.cardId)||!state.placed.includes(action.anchorId))return error('not_available');
   const result=place(state,action.cardId,action.anchorId,action.relation,{auto:action.auto});
   if(result.ok!==action.ok)return error('move_outcome_mismatch');
  }else return error('unsupported_action');
  if(state.complete&&action!==actions[actions.length-1])return error('after_completion');
 }
 if(!state.complete||state.placed.length!==12)return error('incomplete');
 state.elapsed=elapsedMs;
 const score=horseScore(state);
 if(score.version!==HORSE_SCORE_VERSION||score.totalMs!==claimedMs)return error('score_mismatch');
 return {valid:true,score,placed:state.placed};
}
