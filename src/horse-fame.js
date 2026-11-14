/** Source-attributed familiarity scores. Relative buckets, not factual fame labels. */

export const HORSE_FAME_VERSION = 'horse-fame-v1';
export const HORSE_DIFFICULTIES = Object.freeze({
 easy: Object.freeze({label:'初級',highMin:7,highMax:10,highEdgesMin:2}),
 normal: Object.freeze({label:'中級',highMin:4,highMax:6,highEdgesMin:0}),
 hard: Object.freeze({label:'上級',highMin:1,highMax:3,highEdgesMin:0}),
});

export function prepareHorseFame(snapshot, fameSnapshot, graph) {
 if (!fameSnapshot || fameSnapshot.version !== HORSE_FAME_VERSION ||
     fameSnapshot.pedigreeVersion !== snapshot.version || !Array.isArray(fameSnapshot.horses)) {
  throw Error('Invalid or incompatible horse fame snapshot');
 }
 const records = new Map();
 for (const row of fameSnapshot.horses) {
  if (!row || typeof row.id !== 'string' || records.has(row.id) ||
      (row.views12m !== null && (!Number.isInteger(row.views12m) || row.views12m < 0)) ||
      !Number.isInteger(row.sitelinks) || row.sitelinks < 0 || typeof row.jraHall !== 'boolean') {
   throw Error('Invalid horse fame record');
  }
  records.set(row.id, row);
 }
 const named = [...graph.named.keys()];
 if (records.size !== named.length || named.some(id=>!records.has(id))) {
  throw Error('Horse fame snapshot does not cover every named QID');
 }
 const measured = named.filter(id=>records.get(id).views12m !== null);
 if (measured.length < Math.ceil(named.length*.25)) {
  throw Error('Insufficient observed Wikimedia pageviews');
 }
 const views = measured.map(id=>records.get(id).views12m).sort((a,b)=>a-b);
 const quantile = value => {
  // Stable midrank percentile, including large ties at zero.
  let lo=0,hi=views.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(views[mid]<value)lo=mid+1;else hi=mid;}
  const first=lo;hi=views.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(views[mid]<=value)lo=mid+1;else hi=mid;}
  return (first+lo)/(2*views.length);
 };
 const ranked = named.map(id=>{
  const row=records.get(id), viewsObserved=row.views12m!==null;
  const reach=viewsObserved ? 50*quantile(row.views12m) :
   // Unknown is neutral, not zero; confidence remains explicit.
   25 + Math.min(8,Math.log1p(row.sitelinks)*3);
  const knownOffspring=(graph.children.get(id)||[]).filter(child=>graph.named.has(child)).length;
  const bloodline=Math.min(20,20*Math.log1p(knownOffspring)/Math.log1p(20));
  const honor=row.jraHall?30:0;
  return {id,score:Math.round((reach+bloodline+honor)*100)/100,
   views12m:row.views12m,viewsObserved,knownOffspring,jraHall:row.jraHall,
   source:row.articleUrl || null};
 }).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 const byId=new Map();
 ranked.forEach((row,i)=>{
  // Exact 35% / 35% / 30% partitions are relative to THIS frozen population.
  const tier=i<Math.ceil(ranked.length*.35)?'high':i<Math.ceil(ranked.length*.70)?'medium':'low';
  byId.set(row.id,{...row,tier,rank:i+1});
 });
 return {byId,coverage:{named:named.length,measured:measured.length,missing: named.length-measured.length},
  period:fameSnapshot.period,version:fameSnapshot.version};
}

export function assessHorseDifficulty(graph,selected,fame,difficulty) {
 const spec=HORSE_DIFFICULTIES[difficulty];
 if(!spec)throw Error('Unknown horse difficulty');
 const chosen=new Set(selected);
 const high=selected.filter(id=>fame.byId.get(id).tier==='high');
 const medium=selected.filter(id=>fame.byId.get(id).tier==='medium');
 const highSet=new Set(high);
 let highParentEdges=0;
 for(const id of high)for(const parent of graph.parentSets.get(id)||[])if(chosen.has(parent)&&highSet.has(parent))highParentEdges++;
 const below=Math.max(0,spec.highMin-high.length),above=Math.max(0,high.length-spec.highMax);
 const missingHighEdges=Math.max(0,spec.highEdgesMin-highParentEdges);
 const missingPageviews=selected.filter(id=>!fame.byId.get(id).viewsObserved).length;
 // A quota is a *target*, never a reason to violate strong graph/layout rules.
 const difficultyFit=100-17*(below+above)-13*missingHighEdges -
  (difficulty==='easy'?Math.max(0,missingPageviews-4)*1.5:0);
 return {
  difficulty,highCount:high.length,mediumCount:medium.length,
  lowCount:selected.length-high.length-medium.length,highParentEdges,
  missingPageviews,difficultyFit,
  difficultyTargetMet:below===0&&above===0&&missingHighEdges===0,
 };
}

/**
 * Simplified beginner mode (v4). Restrict cards to the top 15% of the
 * *same frozen* familiarity ranking, rather than the former top 35% bucket.
 * Exposes the stricter 7%-tier counts for empirical review; no manual fame claims.
 */
export const EASY_V4_POOL_SHARE=.15;
export const EASY_V4_ICONIC_SHARE=.07;

export function assessEasyV4Selection(graph,selected,fame){
 const maxRank=Math.ceil(fame.byId.size*EASY_V4_POOL_SHARE);
 const iconicRank=Math.ceil(fame.byId.size*EASY_V4_ICONIC_SHARE);
 const chosen=new Set(selected),iconic=new Set(selected.filter(id=>fame.byId.get(id).rank<=iconicRank));
 const recognizable=selected.filter(id=>fame.byId.get(id).rank<=maxRank).length;
 const meanFameRank=selected.reduce((sum,id)=>sum+fame.byId.get(id).rank,0)/selected.length;
 let iconicParentEdges=0,highParentEdges=0;
 for(const id of selected){
  for(const parent of graph.parentSets.get(id)||[]){
   if(chosen.has(parent))highParentEdges++;
   if(iconic.has(id)&&iconic.has(parent))iconicParentEdges++;
  }
 }
 const iconicCount=iconic.size;
 return {
  difficulty:'easy',highCount:recognizable,mediumCount:0,lowCount:selected.length-recognizable,
  highParentEdges,iconicCount,iconicParentEdges,
  recognizableCount:recognizable,meanFameRank:Math.round(meanFameRank*100)/100,
  missingPageviews:selected.filter(id=>!fame.byId.get(id).viewsObserved).length,
  difficultyFit:80+iconicCount*2.5+iconicParentEdges*2-Math.round(meanFameRank)/14,
  difficultyTargetMet:recognizable===selected.length,
 };
}
