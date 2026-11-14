import {relations,place} from './core.js';

const relationNames={
  parent:'父または母',
  child:'産駒',
  sibling:'きょうだい',
  spouse:'配偶者'
};

export function findCorrectPlacement(state,cardId){
 const byId=new Map(state.stage.people.map(person=>[person.id,person]));
 const candidate=byId.get(cardId);
 if(!candidate||!state.hand.includes(cardId))return null;
 const options=state.placed.flatMap(anchorId=>{
  const anchor=byId.get(anchorId);
  return relations(candidate,anchor).map(relation=>({cardId,anchorId,relation}));
 });
 // 親子を優先し、親が盤面にいない場合はきょうだいを使う。
 return options.find(option=>option.relation==='parent'||option.relation==='child')||options[0]||null;
}

export function findPlayablePlacement(state){
 for(const cardId of state.hand){
  const move=findCorrectPlacement(state,cardId);
  if(move)return move;
 }
 return null;
}

/**
 * When a horse cannot be placed NOW, offer a real future connection instead
 * of refusing the hint or automatically swapping to another card.
 * BFS finds a shortest path to the field using only stage relationships.
 */
export function futureHorseConnection(state,cardId){
 const people=new Map(state.stage.people.map(person=>[person.id,person]));
 if(!people.has(cardId)||!state.hand.includes(cardId))return null;
 const visited=new Set([cardId]),queue=[{id:cardId,first:null,distance:0}];
 for(let i=0;i<queue.length;i++){
  const item=queue[i];
  if(state.placed.includes(item.id)&&item.distance>0)return item;
  const current=people.get(item.id);
  const options=[...people.values()].filter(p=>p.id!==item.id)
   .flatMap(p=>relations(current,p).map(relation=>({id:p.id,relation})))
   .sort((a,b)=>{
    const weight=r=>r==='parent'||r==='child'?0:1;
    return weight(a.relation)-weight(b.relation)||a.id.localeCompare(b.id);
   });
  for(const neighbor of options){
   if(visited.has(neighbor.id))continue;
   visited.add(neighbor.id);
   queue.push({id:neighbor.id,first:item.first||neighbor,distance:item.distance+1});
  }
 }
 return null;
}

export function horsePlacementHint(state,cardId,level){
 const card=state.stage.people.find(person=>person.id===cardId);
 if(!card)return '';
 const move=findCorrectPlacement(state,cardId);
 if(move){
  const anchor=state.stage.people.find(person=>person.id===move.anchorId);
  if(level===1)return `場にある「${anchor.name}」とつながります。`;
  return `「${card.name}」は「${anchor.name}」の${relationNames[move.relation]}です。`;
 }
 const path=futureHorseConnection(state,cardId);
 if(!path){
  // Even an incomplete legacy stage can display meaningful sourced metadata.
  return card.clues[Math.min(1,Math.max(0,level-1))]||'血統情報は未収録です。';
 }
 const bridge=state.stage.people.find(person=>person.id===path.first.id);
 if(level===1)return `今はまだ場に直接つながりません。「${bridge.name}」との血統関係が手がかりです（未配置）。`;
 return `「${card.name}」は「${bridge.name}」の${relationNames[path.first.relation]}です。「${bridge.name}」が盤面に加わると置けます。`;
}

/** 未配置の全カードを実際のルールで配置した、別のゲーム状態を返す。
 * 元の state は変更しない。完走できない場合は null。
 */
export function completedAnswer(state){
 if(state.complete)return null;
 const draft={...state,placed:[...state.placed],hand:[...state.hand],deck:[...state.deck],positions:{...state.positions},hints:{...state.hints}};
 const max=state.stage.people.length;
 for(let turn=0;turn<max&&!draft.complete;turn++){
  const move=findPlayablePlacement(draft);
  if(!move)return null;
  const result=place(draft,move.cardId,move.anchorId,move.relation);
  if(!result.ok)return null;
 }
 if(!draft.complete||draft.placed.length!==max)return null;
 draft.gaveUp=true;
 return draft;
}
