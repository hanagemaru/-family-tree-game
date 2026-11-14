/** Seeded 18-card horse stage factory. No changes to the two fixed stages/saves. */
import {relations,newGame,place,fitCamera} from './core.js';
import {layoutFamily,buildDiagram,renderGeometry} from './diagram.js';
import {horseSex} from './horse-sex.js';
import {verifiedDamName} from './horse-parent-evidence.js';
import {verifiedOfficialDamName} from './horse-official-dam-spellings.js';

export const HORSE_GENERATOR_VERSION='horse-stage-v2';
export const LEGACY_HORSE_GENERATOR_VERSION='horse-stage-v1';
const graphCache=new WeakMap();
const byId=stage=>new Map(stage.people.map(p=>[p.id,p]));

export function seededRandom(seed){
 let h=2166136261;for(const ch of String(seed)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
 return ()=>{h=(h+0x6D2B79F5)|0;let t=Math.imul(h^(h>>>15),1|h);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};
}

export function prepareHorseGraph(snapshot){
 if(graphCache.has(snapshot))return graphCache.get(snapshot);
 if(!snapshot||typeof snapshot.version!=='string'||!Array.isArray(snapshot.horses))throw Error('Invalid horse snapshot');
 const all=new Map(),named=new Map(),links=new Map(),directLinks=new Map(),children=new Map(),parentSets=new Map();
 for(const h of snapshot.horses){
  if(!/^Q[1-9]\d*$/.test(h.id)||all.has(h.id))throw Error('Duplicate or invalid horse ID: '+h.id);
  all.set(h.id,h);if(h.named&&typeof h.name==='string'&&h.name!==h.id)named.set(h.id,h);
 }
 for(const h of named.values()){
  links.set(h.id,new Set());directLinks.set(h.id,new Set());
  const ids=[h.sire,h.dam].filter(Boolean);
  if(new Set(ids).size!==ids.length||ids.some(id=>!all.has(id)||id===h.id))throw Error('Invalid parent ID: '+h.id);
  parentSets.set(h.id,new Set(ids));
  for(const parent of ids){if(!children.has(parent))children.set(parent,[]);children.get(parent).push(h.id);}
 }
 const connect=(a,b)=>{if(a!==b&&links.has(a)&&links.has(b)){links.get(a).add(b);links.get(b).add(a);}};
 for(const h of named.values()){
  for(const parent of parentSets.get(h.id)){connect(h.id,parent);if(directLinks.has(parent)){directLinks.get(h.id).add(parent);directLinks.get(parent).add(h.id);}}
 }
 for(const siblings of children.values())for(let i=0;i<siblings.length;i++)for(let j=i+1;j<siblings.length;j++)connect(siblings[i],siblings[j]);
 const components=new Map();let groupIndex=0;
 for(const id of named.keys()){
  if(components.has(id))continue;const group=groupIndex++,stack=[id];components.set(id,group);
  while(stack.length){const node=stack.pop();for(const neighbor of links.get(node))if(!components.has(neighbor)){components.set(neighbor,group);stack.push(neighbor);}}
 }
 const sizes=new Map();for(const group of components.values())sizes.set(group,(sizes.get(group)||0)+1);
 const roots=Object.entries(snapshot.roots||{}).map(([name,root])=>({name,id:root.qid,component:components.get(root.qid)}));
 const graph={all,named,links,directLinks,children,parentSets,components,sizes,roots};graphCache.set(snapshot,graph);return graph;
}

function relativeGeneration(candidate,anchor){
 const a=[anchor.sire,anchor.dam].filter(Boolean),c=[candidate.sire,candidate.dam].filter(Boolean);
 if(a.includes(candidate.id))return -1;
 if(c.includes(anchor.id))return 1;
 if(c.some(id=>a.includes(id)))return 0;
 return null;
}
function attemptGraph(graph,anchorId,random,count,{strongOnly=false}={}){
 const selected=[anchorId],selectedSet=new Set(selected),gens=new Map([[anchorId,0]]),names=new Set([graph.named.get(anchorId).name]);
 for(let step=1;step<count;step++){
  const frontier=new Set();for(const id of selected)for(const candidate of (strongOnly?graph.directLinks:graph.links).get(id))if(!selectedSet.has(candidate))frontier.add(candidate);
  const scored=[];
  for(const id of frontier){
   const horse=graph.named.get(id);if(!horse||names.has(horse.name))continue;
   // A sibling bond without its common named parent would remain dotted in
   // the completed board. In v2, never introduce such a pair.
   if(strongOnly&&selected.some(chosen=>{
    const known=graph.parentSets.get(chosen);
    return [horse.sire,horse.dam].some(parent=>parent&&!selectedSet.has(parent)&&known?.has(parent));
   }))continue;
   let generation=null,valid=true,degree=0;
   for(const chosen of selected){
    const other=graph.named.get(chosen),difference=relativeGeneration(horse,other);
    if(difference===null)continue;
    const proposed=gens.get(chosen)+difference;
    if(generation!==null&&generation!==proposed){valid=false;break;}
    generation=proposed;degree++;
   }
   if(!valid||generation===null||generation< -6||generation>6)continue;
   const generations=[...gens.values(),generation],spread=Math.max(...generations)-Math.min(...generations)+1;
   const parentSiblings=Math.max(0,...[horse.sire,horse.dam].filter(Boolean).map(parent=>selected.filter(x=>graph.parentSets.get(x)?.has(parent)).length));
   const parentConnection=[horse.sire,horse.dam].filter(x=>selectedSet.has(x)).length;
   const hasChildren=(graph.children.get(id)||[]).some(x=>selectedSet.has(x));
   const newLevel=![...gens.values()].includes(generation);
   // Soft weights: favor new depth, explicit parent-child edges, and forks without fixed ratios.
   const weight=Math.max(.08,1+(newLevel?2.4:0)+(parentConnection?2.6:0)+(hasChildren?2.4:0)+Math.min(degree,3)*.6+(spread>=3&&spread<=5?.9:0)-Math.max(0,parentSiblings-2)*1.8-(spread>5?3:0));
   scored.push({id,generation,weight});
  }
  if(!scored.length)return {reason:'frontier_exhausted',cards:selected.length};
  const total=scored.reduce((sum,c)=>sum+c.weight,0);let roll=random()*total;
  const picked=scored.find(c=>(roll-=c.weight)<=0)||scored[scored.length-1];
  selected.push(picked.id);selectedSet.add(picked.id);gens.set(picked.id,picked.generation);names.add(graph.named.get(picked.id).name);
 }
 return {selected,gens};
}

function analyzeSelection(graph,selected,gens){
 const selectedSet=new Set(selected),generationValues=[...gens.values()],generations=Math.max(...generationValues)-Math.min(...generationValues)+1;
 const byParent=new Map();let parentEdges=0,maternalEdges=0;
 for(const id of selected){const h=graph.named.get(id);
  for(const [prop,p] of [['sire',h.sire],['dam',h.dam]])if(p){
   if(!byParent.has(p))byParent.set(p,[]);byParent.get(p).push(id);
   if(selectedSet.has(p)){parentEdges++;if(prop==='dam')maternalEdges++;}
  }
 }
 const branches=[...byParent.entries()].filter(([,offspring])=>offspring.length>=2&&selectedSet.has(offspring[0])&&selectedSet.has(offspring[1]));
 const visibleBranches=branches.filter(([id])=>selectedSet.has(id)).length;
 const widestSire=Math.max(0,...[...byParent.entries()].filter(([p])=>[...selectedSet].some(id=>graph.named.get(id).sire===p)).map(([p,ids])=>ids.filter(id=>graph.named.get(id).sire===p).length));
 const distinctParents=[...byParent.values()].filter(ids=>ids.length>=1).length;
 const descendants=[...selectedSet].filter(id=>(graph.children.get(id)||[]).some(x=>selectedSet.has(x))).length;
 const visibleGrandparents=[...selectedSet].filter(id=>(graph.children.get(id)||[]).some(child=>selectedSet.has(child)&&(graph.children.get(child)||[]).some(grand=>selectedSet.has(grand)))).length;
 const levelCounts=new Map();for(const gen of generationValues)levelCounts.set(gen,(levelCounts.get(gen)||0)+1);
 const maxRowCards=Math.max(...levelCounts.values());
 const quality=(generations>=3&&generations<=5?24:Math.max(0,18-Math.abs(generations-4)*12))
  +Math.min(visibleBranches,4)*9+Math.min(parentEdges,14)*1.5+Math.min(maternalEdges,4)*4
  +Math.min(visibleGrandparents,4)*8+Math.min(descendants,8)*1.6
  +Math.min(distinctParents,12)*.8-Math.max(0,widestSire-5)*7
  -Math.max(0,maxRowCards-7)*3;
 return {quality,generations,branches:visibleBranches,sharedParentGroups:branches.length,parentEdges,maternalEdges,grandparentPaths:visibleGrandparents,distinctParents,largestSireGroup:widestSire,maxRowCards,
  softCriteriaMet:generations>=3&&generations<=5&&visibleBranches>=2&&visibleGrandparents>=1&&widestSire<=8};
}

function toStage(snapshot,graph,selection,seed,version){
 const {selected,gens}=selection,minimum=Math.min(...gens.values());
 const people=selected.map(id=>{
  const h=graph.named.get(id),parents=[h.sire,h.dam].filter(Boolean);
  const readableName=parentId=>{
   const parent=graph.all.get(parentId);
   return parent?.named&&typeof parent.name==='string'&&!/^Q[1-9]\d*$/.test(parent.name)?parent.name:null;
  };
  const sireName=h.sire?readableName(h.sire):null;
  const extra=version===LEGACY_HORSE_GENERATOR_VERSION?null:(verifiedOfficialDamName(h)||verifiedDamName(h));
  const damName=(h.dam?readableName(h.dam):null)||extra?.name||null;
  const summary=sireName?`父は${sireName}。`:damName?`母は${damName}。`:'父母の馬名は未取得です。';
  const detail=`父：${h.sire?sireName||'馬名未取得':'未収録'}／母：${damName||'未収録'}`;
  const source=extra?{label:`${extra.provider==='JRA'?'JRA（公式馬名表記）':'Wikipedia（母馬名）'}: ${h.name}`,url:extra.source}:{label:`Wikidata: ${h.name}`,url:h.source};
  return {id,name:h.name,short:h.name,sex:horseSex(id,snapshot),generation:gens.get(id)-minimum,parents,spouses:[],
   clues:[summary,detail],
   source};
 });
 const stage={id:`horse-generated:${snapshot.version}:${version}:${String(seed)}`,title:'競走馬の血統（自動生成）',category:'競走馬',tag:'父母・産駒・きょうだい',symbol:'馬',anchor:selected[0],people,
  summary:'父・母と産駒の関係をたどる18枚。',description:'登録済みの親子関係からシード固定で抽出。',
  scope:'Wikidataの親子IDを元に生成。日本語Wikipediaの記事と馬IDを照合して母馬名を補完しました。未収録は血統不明を意味しません。',sources:[{label:'Wikidata（CC0）',url:'https://www.wikidata.org/'},{label:'日本語Wikipedia（CC BY-SA 4.0・著者履歴は記事リンク先）',url:'https://ja.wikipedia.org/wiki/Wikipedia:%E8%91%97%E4%BD%9C%E6%A8%A9'},{label:'JRA（登録馬名の表記照合のみ）',url:'https://www.jra.go.jp/gallery/dendo/horse23/index.html'}]};
 return stage;
}

/** Real core hand/deck/placement, plus the exact UI family layout and SVG crossings. */
export function replayHorseStage(stage,seed){
 const state=newGame(stage,seededRandom(`deck:${seed}`));const persons=byId(stage);let steps=0;
 while(!state.complete&&steps++<stage.people.length+2){
  let move;
  for(const id of state.hand){for(const anchor of state.placed){const options=relations(persons.get(id),persons.get(anchor));if(options.length){move={id,anchor,relation:options[0]};break;}}if(move)break;}
  if(!move)return {ok:false,reason:'unplayable_hand',steps};
  const result=place(state,move.id,move.anchor,move.relation);
  if(!result.ok)return {ok:false,reason:'core_place_'+result.reason,steps};
  try{state.positions=layoutFamily(state);}catch(e){return {ok:false,reason:'layout_error',steps,message:String(e)};}
 }
 if(!state.complete)return {ok:false,reason:'incomplete',steps};
 try{
  const diagram=buildDiagram(state),geometry=renderGeometry(diagram);
  const points=Object.values(state.positions),rows=new Map(),xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  for(const p of points){if(!rows.has(p.y))rows.set(p.y,[]);rows.get(p.y).push(p.x);}
  const rowOverlap=[...rows.values()].some(row=>{row.sort((a,b)=>a-b);return row.some((x,i)=>i>0&&x-row[i-1]<108);});
  const camera=fitCamera(state.positions,360,320);
  return {ok:true,steps,crossings:geometry.crossings.length,dottedSiblingLinks:diagram.networks.filter(n=>n.kind==='sibling').length,scale360x320:camera.scale,
   width:Math.max(...xs)-Math.min(...xs)+108,height:Math.max(...ys)-Math.min(...ys)+154,rowOverlap};
 }catch(e){return {ok:false,reason:'diagram_error',steps,message:String(e)};}
}

/** Return {stage,metrics,diagnostics}, or throw with stable reason after bounded retries. */
export function generateRandomHorseStage(snapshot,{seed=1,count=18,attempts=48,version=HORSE_GENERATOR_VERSION}={}){
 if(![HORSE_GENERATOR_VERSION,LEGACY_HORSE_GENERATOR_VERSION].includes(version))throw Error('Unsupported generator version');
 const strongOnly=version!==LEGACY_HORSE_GENERATOR_VERSION;
 if(!Number.isInteger(count)||count<2||count>64)throw Error('Invalid card count');
 if(!Number.isInteger(attempts)||attempts<1||attempts>200)throw Error('Invalid candidate count');
 const graph=prepareHorseGraph(snapshot),random=seededRandom(`${version}:${snapshot.version}:${seed}`);
 const eligible=[...graph.named.keys()].filter(id=>graph.sizes.get(graph.components.get(id))>=count&&graph.links.get(id).size>0);
 if(!eligible.length)throw Error('insufficient_connected_named_records');
 const rootChoices=graph.roots.filter(x=>graph.named.has(x.id)&&graph.sizes.get(x.component)>=count);
 const candidates=[],rejections={};
 const reject=reason=>{rejections[reason]=(rejections[reason]||0)+1;};
 for(let i=0;i<attempts;i++){
  // Balanced root sampling when enough named connected records exist; others are sampled too.
  const useRoot=rootChoices.length>0&&i%4!==3;
  const root=useRoot?rootChoices[Math.floor(random()*rootChoices.length)]:null;
  const pool=root?eligible.filter(id=>graph.components.get(id)===root.component):eligible;
  const anchor=pool[Math.floor(random()*pool.length)],candidate=attemptGraph(graph,anchor,random,count,{strongOnly});
  if(!candidate.selected){reject(candidate.reason);continue;}
  const metrics=analyzeSelection(graph,candidate.selected,candidate.gens);
  if(strongOnly){
   const chosen=new Set(candidate.selected);
   const orphanPairs=candidate.selected.some((id,i)=>candidate.selected.slice(i+1).some(other=>{
    const shared=[...graph.parentSets.get(id)].some(parent=>graph.parentSets.get(other)?.has(parent));
    return shared&&![...graph.parentSets.get(id)].some(parent=>chosen.has(parent)&&graph.parentSets.get(other)?.has(parent));
   }));
   if(orphanPairs){reject('unresolved_sibling_links');continue;}
   if(metrics.parentEdges<count-1){reject('not_fully_connected_by_parent_child');continue;}
  }
  candidates.push({candidate,metrics});
 }
 candidates.sort((a,b)=>b.metrics.quality-a.metrics.quality);
 // Evaluate the real game layout for several structurally promising candidates.
 // Comparing only structural quality would ignore line crossings and phone fit.
 let best=null;
 for(const {candidate,metrics} of candidates.slice(0,Math.min(strongOnly?6:2,candidates.length))){
  const stage=toStage(snapshot,graph,candidate,seed,version),replay=replayHorseStage(stage,seed);
  if(!replay.ok){reject(replay.reason);continue;}
  if(replay.rowOverlap){reject('overlapping_cards');continue;}
  if(strongOnly&&replay.dottedSiblingLinks>0){reject('dotted_sibling_links');continue;}
  const score=metrics.quality-Math.min(80,replay.crossings*3)+replay.scale360x320*18
   -Math.max(0,metrics.maxRowCards-8)*4;
  if(!best||score>best.metrics.score){
   best={stage,metrics:{...metrics,...replay,score}};
  }
 }
 if(best)return {...best,diagnostics:{candidateAttempts:attempts,validCandidates:candidates.length,rejections}};
 const error=new Error('generation_failed');error.diagnostics={candidateAttempts:attempts,rejections};throw error;
}
