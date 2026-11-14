/** Offline reproducible benchmark of 1000 seeds PER difficulty.
 * Requires immutable Wikimedia/JRA fame snapshot generated separately.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {generateRandomHorseStage,FAME_HORSE_GENERATOR_VERSION} from '../src/random-horse-stage.js';
import {HORSE_DIFFICULTIES,prepareHorseFame} from '../src/horse-fame.js';
import {prepareHorseGraph} from '../src/random-horse-stage.js';
const arg=(name,def)=>process.argv.find(x=>x.startsWith('--'+name+'='))?.split('=').slice(1).join('=')??def;
const runs=Number(arg('runs','1000')),attempts=Number(arg('attempts','96'));
if(!Number.isInteger(runs)||runs<1||runs>100000||!Number.isInteger(attempts)||attempts<1||attempts>200)throw Error('Invalid benchmark parameters');
const pedigree=JSON.parse(readFileSync(arg('data','data/horse-pedigree.v1.json'),'utf8'));
const popularity=JSON.parse(readFileSync(arg('fame','data/horse-fame-2026-10.v1.json'),'utf8'));
const fame=prepareHorseFame(pedigree,popularity,prepareHorseGraph(pedigree));
const output=arg('output','docs/horse-difficulty-benchmark.json');
const report={generatorVersion:FAME_HORSE_GENERATOR_VERSION,pedigreeVersion:pedigree.version,
 fameVersion:popularity.version,period:popularity.period,coverage:fame.coverage,runsPerDifficulty:runs,
 attemptsPerSeed:attempts,difficulties:{}};
for(const difficulty of Object.keys(HORSE_DIFFICULTIES)){
 const fail={},examples=[],highCounts=[],highEdges=[],qualities=[],sireGroups=[];
 let success=0,quotaMet=0,overlap=0,dotted=0,duplicates=0;
 const seen=new Set(),horseUse=new Set(),anchors=new Set();
 for(let seed=1;seed<=runs;seed++){
  try{
   const {stage,metrics}=generateRandomHorseStage(pedigree,{version:FAME_HORSE_GENERATOR_VERSION,
    fameSnapshot:popularity,difficulty,seed,attempts});
   if(stage.people.length!==18||!metrics.ok||metrics.rowOverlap||metrics.dottedSiblingLinks||
      metrics.parentEdges<17)throw Error('quality_gate_failure');
   success++;
   if(metrics.difficultyTargetMet)quotaMet++;
   highCounts.push(metrics.highCount);
   highEdges.push(metrics.highParentEdges);
   qualities.push(metrics.score);
   sireGroups.push(metrics.largestSireGroup);
   overlap+=Number(metrics.rowOverlap);dotted+=metrics.dottedSiblingLinks;
   const signature=stage.people.map(p=>p.id).sort().join(',');
   if(seen.has(signature))duplicates++;
   seen.add(signature);anchors.add(stage.anchor);
   for(const person of stage.people)horseUse.add(person.id);
   if(examples.length<5)examples.push({seed,anchor:stage.people[0].name,high:metrics.highCount,
    highParentEdges:metrics.highParentEdges,horses:stage.people.map(p=>p.name),score:metrics.score});
  }catch(e){const key=e.message||String(e);fail[key]=(fail[key]||0)+1;}
 }
 const stat=values=>values.length?{min:Math.min(...values),max:Math.max(...values),
  mean:Math.round(values.reduce((a,b)=>a+b,0)*100/values.length)/100}:null;
 report.difficulties[difficulty]={label:HORSE_DIFFICULTIES[difficulty].label,success,failed:runs-success,
  successRate:success/runs,quotaMet,quotaMetRate:success?quotaMet/success:0,
  highCounts:stat(highCounts),highParentEdges:stat(highEdges),score:stat(qualities),
  largestSireGroup:stat(sireGroups),overlap,dotted,uniqueCardSets:seen.size,duplicates,
  uniqueHorses:horseUse.size,uniqueAnchors:anchors.size,failures:fail,examples};
 console.log(JSON.stringify({difficulty,success,quotaMet,meanHigh:stat(highCounts)?.mean,uniqueSets:seen.size,fail}));
}
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
if(Object.values(report.difficulties).some(row=>row.success<runs))
 process.exitCode=1;
