import {wikidataSex} from './horse-sex-data.js';
import {officialHorseSex} from './horse-sex-official.js';

// Fixed stage identities, checked against the historical racehorse descriptions.
// A separate map avoids confusing the stage's internal short IDs with Wikidata QIDs.
const fixedSex=Object.freeze({
 sunday:'male',wind:'female',deep:'male',black:'male',stay:'male',
 kizuna:'male',contrail:'male',gentil:'female',orfevre:'male',gold:'male',
 kitasan:'male',equinox:'male',hearts:'male',daiwa:'male',special:'male',
 buena:'female',satono:'male',loves:'female',gran:'female',fierement:'male',
 lilac:'female',oju:'male',sol:'male',geraldina:'female'
});
const pedigreeCache=new WeakMap();

export function pedigreeSex(snapshot){
 if(pedigreeCache.has(snapshot))return pedigreeCache.get(snapshot);
 const inferred=new Map();
 for(const horse of snapshot.horses||[]){
  if(horse.sire){
   const prior=inferred.get(horse.sire);
   inferred.set(horse.sire,prior&&prior!=='male'?'unknown':'male');
  }
  if(horse.dam){
   const prior=inferred.get(horse.dam);
   inferred.set(horse.dam,prior&&prior!=='female'?'unknown':'female');
  }
 }
 pedigreeCache.set(snapshot,inferred);
 return inferred;
}

export function horseSex(id,snapshot){
 const fromWikidata=wikidataSex[id];
 const inferred=snapshot?pedigreeSex(snapshot).get(id):null;
 const official=officialHorseSex[id];
 if(official){
  const horse=snapshot?.horses?.find(h=>h.id===id);
  if(horse&&(horse.name!==official.name||horse.birthYear!==official.birthYear))return null;
  // A registered gelding is biologically male; animal-sex P21 may therefore say male.
  const biological=official.sex==='gelding'?'male':official.sex;
  if(fromWikidata&&fromWikidata!==biological)return null;
  if(inferred&&inferred!==biological)return null;
  return official.sex;
 }
 // Contradictory sources must not be silently resolved in favor of either.
 if(fromWikidata&&inferred&&inferred!==fromWikidata)return null;
 if(inferred==='unknown')return null;
 return fromWikidata||inferred||fixedSex[id]||null;
}
export function horseSexLabel(sex){return sex==='male'?'牡':sex==='female'?'牝':sex==='gelding'?'セ':'不明';}

export function horseSexTone(sex){return sex==='male'?'sex-male':sex==='female'?'sex-female':sex==='gelding'?'sex-gelding':'sex-unknown';}
