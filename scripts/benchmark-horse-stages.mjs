/** Reproducible 100/1000-seed benchmark; no requests or wall-clock metrics. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {generateRandomHorseStage,HORSE_GENERATOR_VERSION} from '../src/random-horse-stage.js';
const arg=(name,defaultValue)=>process.argv.find(x=>x.startsWith(`--${name}=`))?.split('=').slice(1).join('=')??defaultValue;
const runs=Number(arg('runs','1000')),attempts=Number(arg('attempts','24'));
const path=arg('data','data/horse-pedigree.v1.json');
const output=arg('output','docs/random-horse-benchmark-2026-11-12.json');
if(!Number.isInteger(runs)||runs<1||runs>100000)throw Error('Invalid runs');
const snapshot=JSON.parse(readFileSync(path,'utf8'));
const byId=new Map(snapshot.horses.map(h=>[h.id,h]));
const failures={},seeds=[],examples=[],shown=new Map(),perRoot={},origins={},metricKeys=['generations','branches','sharedParentGroups','parentEdges','maternalEdges','grandparentPaths','largestSireGroup','maxRowCards','crossings','scale360x320','width','height','score'];
const metrics=Object.fromEntries(metricKeys.map(k=>[k,[]]));
let good=0,soft=0,duplicateStage=0;const fingerprints=new Set(),cards=new Set(),namedOrigins=new Set(),sum=new Map();
function rootOf(stage){
 const counts=new Map();for(const horse of stage.people){const h=byId.get(horse.id);for(const name of h.lineages||[])counts.set(name,(counts.get(name)||0)+1);}
 const root=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];return root?.[0]||'未分類';
}
for(let seed=1;seed<=runs;seed++){
 try{
  const result=generateRandomHorseStage(snapshot,{seed,attempts});const {stage,metrics:m,diagnostics}=result;
  if(stage.people.length!==18)throw Error('invalid_card_count');
  if(new Set(stage.people.map(p=>p.id)).size!==18)throw Error('duplicate_qid');
  if(!m.ok||m.rowOverlap)throw Error('unplayable_or_overlapping');
  const signature=[...stage.people.map(p=>p.id)].sort().join('|');
  if(fingerprints.has(signature))duplicateStage++;fingerprints.add(signature);
  for(const p of stage.people){cards.add(p.id);sum.set(p.id,(sum.get(p.id)||0)+1);}
  const root=rootOf(stage);perRoot[root]=(perRoot[root]||0)+1;
  origins[stage.people[0].id]=(origins[stage.people[0].id]||0)+1;
  for(const key of metricKeys)metrics[key].push(m[key]);
  if(m.softCriteriaMet)soft++;
  good++;
  if(examples.length<3)examples.push({seed,anchor:stage.people[0].name,root,ids:stage.people.map(p=>p.id),horses:stage.people.map(p=>p.name),metrics:m});
 }catch(e){const code=e.message||String(e);failures[code]=(failures[code]||0)+1;if(seeds.length<20)seeds.push({seed,reason:code,details:e.diagnostics||null});}
}
const stat=values=>({min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null,mean:values.length?Math.round(values.reduce((s,v)=>s+v,0)/values.length*1000)/1000:null});
const result={
  dataVersion:snapshot.version,generatorVersion:HORSE_GENERATOR_VERSION,runCount:runs,attemptsPerSeed:attempts,
  successCount:good,successRate:good/runs,failureCount:runs-good,failures,failureSamples:seeds,
  uniqueProblems:fingerprints.size,duplicateCardSets:duplicateStage,uniqueHorseCards:cards.size,
  qualifiedQualityCount:soft,qualifiedQualityRate:good?soft/good:0,
  perRoot:Object.fromEntries(Object.entries(perRoot).sort((a,b)=>b[1]-a[1])),
  originDistinct:Object.keys(origins).length,topAnchors:Object.entries(origins).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([id,n])=>({id,name:byId.get(id)?.name,count:n})),
  topCards:[...sum].sort((a,b)=>b[1]-a[1]).slice(0,15).map(([id,n])=>({id,name:byId.get(id)?.name,count:n})),
  metrics:Object.fromEntries(Object.entries(metrics).map(([k,v])=>[k,stat(v)])),
  sourceStats:{total:snapshot.horses.length,named:snapshot.horses.filter(h=>h.named).length,
   knownSires:snapshot.horses.filter(h=>h.sire).length,knownDams:snapshot.horses.filter(h=>h.dam).length},
  examples,
  caveats:['All 18 cards were replayed through core.newGame/place and diagram.layoutFamily/buildDiagram.',
   'A connected and finishable problem does not imply manually verified real-world pedigree.',
   'Crossings and 360x320 camera scale are deterministic geometric proxies, not visual screenshot review.',
   'Some lineage categories overlap; perRoot uses the largest recorded direct-offspring membership.'],
};
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n');
const md=output.replace(/\.json$/,'.md');
const rows=Object.entries(result.metrics).map(([key,value])=>`| ${key} | ${value.mean??'—'} | ${value.min??'—'} | ${value.max??'—'} |`).join('\n');
writeFileSync(md,[
 '# 18-card random horse-stage benchmark',
 '',`- Data: \`${snapshot.version}\` (${result.sourceStats.total} records, ${result.sourceStats.named} named)`,
 `- Generator: \`${HORSE_GENERATOR_VERSION}\`; candidate attempts: ${attempts} per seed`,
 `- Generated: **${good}/${runs}** (${(100*good/runs).toFixed(1)}%); errors: ${JSON.stringify(failures)}`,
 `- Unique 18-card sets: **${fingerprints.size}**; duplicated sets: **${duplicateStage}**; unique horses used: **${cards.size}**`,
 `- Soft-quality target (3–5 generations, ≥2 visible forks, ≥1 grandparent path, ≤8 same-sire offspring): **${soft}/${good}**`,
 `- Largest group by recorded lineage: ${JSON.stringify(result.perRoot)}`,
 `- Distinct starting horses: ${result.originDistinct}`,
 '', '| Metric | Mean | Min | Max |','|---|---:|---:|---:|',rows,
 '', '## Examples',...examples.map(x=>`- Seed ${x.seed} (${x.root}, ${x.metrics.generations} generations, ${x.metrics.branches} visible forks): ${x.horses.join('、')}`),
 '', '## Limitations',...result.caveats.map(x=>'- '+x), '',
 ].join('\n'));
console.log('BENCHMARK_RESULT='+JSON.stringify({runs,success:good,failures,uniqueSets:fingerprints.size,softQualified:soft,perRoot:result.perRoot,metrics:result.metrics,report:output}));
