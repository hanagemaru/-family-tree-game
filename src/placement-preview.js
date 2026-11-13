import {CARD_W,CARD_H,STEP_X,STEP_Y} from './core.js';

export const placementLabels=Object.freeze({
 parent:{arrow:'↑',label:'親',detail:'相手の父・母'},
 child:{arrow:'↓',label:'子',detail:'相手の子・産駒'},
 sibling:{arrow:'↔',label:'きょうだい',detail:'相手と親が共通'},
 spouse:{arrow:'⇄',label:'配偶者',detail:'相手の配偶者'}
});

export function previewPosition(positions,anchorId,relation){
 const anchor=positions[anchorId];
 if(!anchor||!placementLabels[relation])return null;
 const y=anchor.y+(relation==='parent'?-STEP_Y:relation==='child'?STEP_Y:0);
 const x=anchor.x+(relation==='sibling'?-STEP_X:relation==='spouse'?STEP_X:0);
 const slotFree=x=>Object.values(positions).every(p=>
  Math.abs(p.y-y)>=CARD_H+30||Math.abs(p.x-x)>=CARD_W+24);
 for(let offset=0;offset<40;offset++){
  const candidates=offset===0?[x]:[x+offset*STEP_X,x-offset*STEP_X];
  const free=candidates.find(slotFree);
  if(free!==undefined)return {x:free,y};
 }
 return {x,y};
}
