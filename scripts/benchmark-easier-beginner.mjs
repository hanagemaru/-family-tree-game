import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {prepareHorseGraph,generateRandomHorseStage,EASIER_HORSE_GENERATOR_VERSION,FAME_HORSE_GENERATOR_VERSION} from '../src/random-horse-stage.js';
import {prepareHorseFame,EASY_V4_POOL_SHARE,EASY_V4_ICONIC_SHARE} from '../src/horse-fame.js';

const arg=(key,def)=>process.argv.find(x=>x.startsWith('--'+key+'='))?.slice(key.length+3)??def;
const runs=Number(arg('runs','100')),output=arg('output','artifacts/horse-easy-v4-benchmark.json');
if(!Number.isInteger(runs)||runs<1||runs>1000)throw Error('Invalid runs count');
const pedigree=JSON.parse(readFileSync('data/horse-pedigree.v1.json','utf8'));
const snapshot=JSON.parse(readFileSync('data/horse-fame-2026-10.v1.json','utf8'));
const fame=prepareHorseFame(pedigree,snapshot,prepareHorseGraph(pedigree));
const first=Math.ceil(fame.byId.size*EASY_V4_POOL_SHARE);
const iconicLimit=Math.ceil(fame.byId.size*EASY_V4_ICONIC_SHARE);
const result={version:EASIER_HORSE_GENERATOR_VERSION,previousVersion:FAME_HORSE_GENERATOR_VERSION,
 snapshotPeriod:snapshot.period,poolRankMax:first,iconicRankMax:iconicLimit,runs,
 failures:{},success:0,uniqueCardSets:0,uniqueHorses:0,avgSelectedRank:0,avgTop7Cards:0,oldEasyAvgSelectedRank:0,
 examples:[]};
let totalRank=0,totalIconic=0,oldTotalRank=0;
const sets=new Set,used=new Set;
for(let seed=1;seed<=runs;seed++){
 try{
  const v4=generateRandomHorseStage(pedigree,{version:EASIER_HORSE_GENERATOR_VERSION,difficulty:'easy',seed,fameSnapshot:snapshot,attempts:96});
  const old=generateRandomHorseStage(pedigree,{version:FAME_HORSE_GENERATOR_VERSION,difficulty:'easy',seed,fameSnapshot:snapshot,attempts:96});
  if(!v4.metrics.ok||v4.metrics.rowOverlap||v4.metrics.dottedSiblingLinks!==0||
      v4.metrics.parentEdges<17||v4.stage.people.length!==18)throw Error('quality_gate_failure');
  if(v4.stage.people.some(p=>fame.byId.get(p.id).rank>first))throw Error('not_top15');
  const rankMean=v4.stage.people.reduce((s,p)=>s+fame.byId.get(p.id).rank,0)/18;
  const oldRankMean=old.stage.people.reduce((s,p)=>s+fame.byId.get(p.id).rank,0)/18;
  const icons=v4.stage.people.filter(p=>fame.byId.get(p.id).rank<=iconicLimit).length;
  totalRank+=rankMean;oldTotalRank+=oldRankMean;totalIconic+=icons;
  result.success++;
  const sig=v4.stage.people.map(p=>p.id).sort().join('|');sets.add(sig);
  for(const p of v4.stage.people)used.add(p.id);
  if(result.examples.length<5)result.examples.push({seed,anchor:v4.stage.people[0].name,
   horses:v4.stage.people.map(p=>p.name),meanRank:Math.round(rankMean*100)/100,
   oldMeanRank:Math.round(oldRankMean*100)/100,iconicCount:icons});
 }catch(e){result.failures[e.message]=(result.failures[e.message]||0)+1;}
}
result.uniqueCardSets=sets.size;result.uniqueHorses=used.size;
const round=n=>Math.round(n*100)/100;
result.avgSelectedRank=result.success?round(totalRank/result.success):null;
result.oldEasyAvgSelectedRank=result.success?round(oldTotalRank/result.success):null;
result.avgTop7Cards=result.success?round(totalIconic/result.success):null;
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log('EASIER_BEGINNER_RESULT='+JSON.stringify(result));
if(result.success!==runs)process.exitCode=1;
