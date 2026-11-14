import {HORSE_GENERATOR_VERSION,LEGACY_HORSE_GENERATOR_VERSION,FAME_HORSE_GENERATOR_VERSION,EASIER_HORSE_GENERATOR_VERSION,generateRandomHorseStage} from './random-horse-stage.js';

export const RANDOM_HORSE_MODE_ID='horse-random';

export function randomHorseDescriptor(snapshot,stage,seed,version=HORSE_GENERATOR_VERSION,options={}){
 return {mode:RANDOM_HORSE_MODE_ID,seed:String(seed),snapshotVersion:snapshot.version,generatorVersion:version,
  ...([FAME_HORSE_GENERATOR_VERSION,EASIER_HORSE_GENERATOR_VERSION].includes(version)?{difficulty:options.difficulty,
   famePeriodThrough:options.fameSnapshot?.period?.through}:{}),
  stageId:stage.id,cardIds:stage.people.map(person=>person.id)};
}

export function generateRandomHorseSession(snapshot,seed,{version=HORSE_GENERATOR_VERSION,difficulty='normal',fameSnapshot=null}={}){
 const generated=generateRandomHorseStage(snapshot,{seed:String(seed),version,difficulty,fameSnapshot,
  attempts:version===LEGACY_HORSE_GENERATOR_VERSION?24:[FAME_HORSE_GENERATOR_VERSION,EASIER_HORSE_GENERATOR_VERSION].includes(version)?96:48});
 return {...generated,descriptor:randomHorseDescriptor(snapshot,generated.stage,seed,version,{difficulty,fameSnapshot})};
}

export function restoreRandomHorseSession(snapshot,descriptor,{fameSnapshot=null}={}){
 if(!descriptor||descriptor.mode!==RANDOM_HORSE_MODE_ID||typeof descriptor.seed!=='string'||
  descriptor.snapshotVersion!==snapshot.version||![HORSE_GENERATOR_VERSION,LEGACY_HORSE_GENERATOR_VERSION,FAME_HORSE_GENERATOR_VERSION,EASIER_HORSE_GENERATOR_VERSION].includes(descriptor.generatorVersion)||
  typeof descriptor.stageId!=='string'||!Array.isArray(descriptor.cardIds)||descriptor.cardIds.length!==18)return null;
 if([FAME_HORSE_GENERATOR_VERSION,EASIER_HORSE_GENERATOR_VERSION].includes(descriptor.generatorVersion)){
  if(!fameSnapshot||descriptor.famePeriodThrough!==fameSnapshot.period?.through||
   !['easy','normal','hard'].includes(descriptor.difficulty))return null;
 }
 const generated=generateRandomHorseSession(snapshot,descriptor.seed,{version:descriptor.generatorVersion,
  ...([FAME_HORSE_GENERATOR_VERSION,EASIER_HORSE_GENERATOR_VERSION].includes(descriptor.generatorVersion)?{difficulty:descriptor.difficulty,fameSnapshot}:{})});
 if(generated.stage.id!==descriptor.stageId||generated.descriptor.cardIds.some((id,index)=>id!==descriptor.cardIds[index]))return null;
 return generated;
}

export function createRandomSeed(cryptoSource=globalThis.crypto){
 if(cryptoSource?.getRandomValues){const values=new Uint32Array(2);cryptoSource.getRandomValues(values);return `${values[0].toString(36)}-${values[1].toString(36)}`;}
 return `${Date.now().toString(36)}-${Math.floor(Math.random()*0x100000000).toString(36)}`;
}
