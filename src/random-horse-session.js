import {HORSE_GENERATOR_VERSION,generateRandomHorseStage} from './random-horse-stage.js';

export const RANDOM_HORSE_MODE_ID='horse-random';

export function randomHorseDescriptor(snapshot,stage,seed){
 return {mode:RANDOM_HORSE_MODE_ID,seed:String(seed),snapshotVersion:snapshot.version,generatorVersion:HORSE_GENERATOR_VERSION,stageId:stage.id,cardIds:stage.people.map(person=>person.id)};
}

export function generateRandomHorseSession(snapshot,seed){
 const generated=generateRandomHorseStage(snapshot,{seed:String(seed)});
 return {...generated,descriptor:randomHorseDescriptor(snapshot,generated.stage,seed)};
}

export function restoreRandomHorseSession(snapshot,descriptor){
 if(!descriptor||descriptor.mode!==RANDOM_HORSE_MODE_ID||typeof descriptor.seed!=='string'||
  descriptor.snapshotVersion!==snapshot.version||descriptor.generatorVersion!==HORSE_GENERATOR_VERSION||
  typeof descriptor.stageId!=='string'||!Array.isArray(descriptor.cardIds)||descriptor.cardIds.length!==18)return null;
 const generated=generateRandomHorseSession(snapshot,descriptor.seed);
 if(generated.stage.id!==descriptor.stageId||generated.descriptor.cardIds.some((id,index)=>id!==descriptor.cardIds[index]))return null;
 return generated;
}

export function createRandomSeed(cryptoSource=globalThis.crypto){
 if(cryptoSource?.getRandomValues){const values=new Uint32Array(2);cryptoSource.getRandomValues(values);return `${values[0].toString(36)}-${values[1].toString(36)}`;}
 return `${Date.now().toString(36)}-${Math.floor(Math.random()*0x100000000).toString(36)}`;
}
