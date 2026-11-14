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

export function horsePlacementHint(state,cardId,level){
 const move=findCorrectPlacement(state,cardId);
 if(!move)return 'この馬は今の盤面に直接つながりません。ほかの手札を選んでください。';
 const anchor=state.stage.people.find(person=>person.id===move.anchorId);
 const card=state.stage.people.find(person=>person.id===cardId);
 if(level===1)return `場にある「${anchor.name}」とつながります。`;
 return `「${card.name}」は「${anchor.name}」の${relationNames[move.relation]}です。`;
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
