/** Reproducible actual-stage benchmark against the frozen 2026 horse/fame dataset. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {generateRandomHorseStage,prepareHorseGraph,CURRENT_HORSE_GENERATOR_VERSION,PREVIOUS_HORSE_GENERATOR_VERSION} from '../src/random-horse-stage.js';
import {prepareHorseFame,HORSE_V6_DIFFICULTIES,EASY_V6_POOL_SHARE} from '../src/horse-fame.js';
const pedigree=JSON.parse(readFileSync('data/horse-pedigree.v1.json','utf8'));
const fameSnapshot=JSON.parse(readFileSync('data/horse-fame-2026-10.v1.json','utf8'));
const fame=prepareHorseFame(pedigree,fameSnapshot,prepareHorseGraph(pedigree));
const top10=Math.ceil(fame.byId.size*EASY_V6_POOL_SHARE);
const samples=Number(process.argv[2]||100);
if(!Number.isInteger(samples)||samples<1||samples>200)throw Error('bad sample count');
const results={snapshot:pedigree.version,famePeriod:fame.period.through,samplesPerDifficulty:samples,top10Limit:top10,methods:{v6:CURRENT_HORSE_GENERATOR_VERSION,v5:PREVIOUS_HORSE_GENERATOR_VERSION},difficulties:{}};
let totalFailures=0;
for(const difficulty of ['easy','normal','hard']){
 const readings=[],errors=[],samplesOld=[];
 for(let seed=1;seed<=samples;seed++){
  const input={seed:'v6-benchmark-'+seed,difficulty,version:CURRENT_HORSE_GENERATOR_VERSION,fameSnapshot,attempts:96};
  try{
   const a=generateRandomHorseStage(pedigree,input);
   const ids=a.stage.people.map(x=>x.id);
   const ranks=ids.map(id=>fame.byId.get(id).rank);
   readings.push({seed:input.seed,high:a.metrics.highCount,meanRank:ranks.reduce((a,b)=>a+b,0)/12,generations:a.metrics.generations,uniqueSet:ids.slice().sort().join(','),iconic:ranks.filter(r=>r<=Math.ceil(fame.byId.size*.07)).length,targetMet:a.metrics.difficultyTargetMet,valid:a.metrics.ok&&!a.metrics.rowOverlap&&!a.metrics.dottedSiblingLinks&&a.metrics.parentEdges>=11,top10:Math.max(...ranks)<=top10});
  }catch(e){errors.push({seed:input.seed,error:String(e),diagnostics:e.diagnostics});}
 }
 for(let seed=1;seed<=Math.min(samples,25);seed++){
  const input={seed:'v6-benchmark-'+seed,difficulty,version:PREVIOUS_HORSE_GENERATOR_VERSION,fameSnapshot,attempts:96};
  try{
   const a=generateRandomHorseStage(pedigree,input);
   samplesOld.push(a.stage.people.filter(x=>fame.byId.get(x.id).tier==='high').length);
  }catch(e){samplesOld.push(null);}
 }
 const avg=values=>values.length?Math.round(values.reduce((a,b)=>a+b,0)*100/values.length)/100:null;
 const hist=Object.fromEntries([...new Set(readings.map(x=>x.high))].sort((a,b)=>a-b).map(n=>[n,readings.filter(x=>x.high===n).length]));
 const spec=HORSE_V6_DIFFICULTIES[difficulty];
 const within=readings.filter(x=>difficulty==='easy'?x.top10:x.high>=spec.highMin&&x.high<=spec.highMax).length;
 const report={count:readings.length,failures:errors.length,errors:errors.slice(0,6),targetMatches:within,targetRate:readings.length?Math.round(100*within/readings.length):0,valid:readings.filter(x=>x.valid).length,top10:readings.filter(x=>x.top10).length,unique: new Set(readings.map(x=>x.uniqueSet)).size,meanRank:avg(readings.map(x=>x.meanRank)),meanHigh:avg(readings.map(x=>x.high)),meanIconic:avg(readings.map(x=>x.iconic)),v5MeanHigh:avg(samplesOld.filter(Number.isInteger)),highHistogram:hist,generationHistogram:Object.fromEntries([3,4].map(n=>[n,readings.filter(x=>x.generations===n).length]))};
 results.difficulties[difficulty]=report;totalFailures+=errors.length;
 console.log('DIFFICULTY_BENCHMARK '+difficulty+' '+JSON.stringify(report));
}
mkdirSync('artifacts/benchmarks',{recursive:true});
writeFileSync('artifacts/benchmarks/horse-v6-100-seeds.json',JSON.stringify(results,null,2)+'\n');
console.log('HORSE_V6_BENCHMARK_RESULT='+JSON.stringify(results));
if(totalFailures>0||Object.values(results.difficulties).some(d=>d.valid!==samples||d.unique<Math.round(samples*.7)||d.count!==samples||d.top10!==samples&&d===results.difficulties.easy)){
 throw Error('one or more v6 problems failed generation, integrity or diversity');
}
