import {CARD_W,CARD_H,STEP_X,STEP_Y} from './core.js';

// Only describes direction. The actual answer is evaluated when the player releases the drag.
export const placementLabels=Object.freeze({
 parent:{arrow:'↑',label:'親',detail:'相手の父・母'},
 child:{arrow:'↓',label:'子',detail:'相手の子・産駒'},
 sibling:{arrow:'↔',label:'きょうだい',detail:'相手と親が共通'},
 spouse:{arrow:'⇄',label:'配偶者',detail:'相手の配偶者'}
});

export function directionalTarget(point,nodes,previous=null){
 if(!point.inside||!nodes.length)return null;
 let best=null;
 for(const node of nodes){
  const dx=point.x-node.x,dy=point.y-node.y;
  const reachX=Math.max(42,node.width/2+38),reachY=Math.max(45,node.height/2+39);
  if(Math.abs(dx)>reachX||Math.abs(dy)>reachY)continue;
  const score=(dx/reachX)**2+(dy/reachY)**2-(previous?.anchorId===node.id?0.12:0);
  if(!best||score<best.score)best={node,dx,dy,score,reachX,reachY};
 }
 if(!best)return null;
 const {node,dx,dy,reachX,reachY}=best;
 // An unambiguous axis is required. On the center of a card, retain the
 // conventional opponent-picker workflow instead of guessing a relationship.
 const nx=Math.abs(dx)/reachX,ny=Math.abs(dy)/reachY;
 if(Math.max(nx,ny)<.38||Math.abs(nx-ny)<.13)return null;
 const vertical=ny>nx;
 return {
  anchorId:node.id,
  relation:vertical?(dy<0?'parent':'child'):'sibling',
  side:vertical?null:(dx<0?'left':'right'),
 };
}

export function dragFramePosition(positions,anchorId,relation,side='left'){
 const anchor=positions[anchorId];
 if(!anchor||!['parent','child','sibling'].includes(relation))return null;
 const y=anchor.y+(relation==='parent'?-STEP_Y:relation==='child'?STEP_Y:0);
 const x=anchor.x+(relation==='sibling'?(side==='right'?STEP_X:-STEP_X):0);
 const free=x=>Object.values(positions).every(p=>
  Math.abs(p.y-y)>=CARD_H+30||Math.abs(p.x-x)>=CARD_W+24);
 if(free(x))return {x,y};
 for(let offset=1;offset<40;offset++){
  for(const candidate of [x+offset*STEP_X,x-offset*STEP_X]){
   if(free(candidate))return {x:candidate,y};
  }
 }
 return {x,y};
}

// The outlined slot is a deliberate drop target, not the entire directional
// area around a card. Coordinates are in SCREEN pixels, independent of zoom.
export const DROP_SLOT_W=56,DROP_SLOT_H=54,DROP_SLOT_HOLD_MS=250;
export function dragFrameScreen(node,relation,side,viewport,nodes=[]){
 if(!node||!['parent','child','sibling'].includes(relation))return null;
 const gap=8,halfW=DROP_SLOT_W/2,halfH=DROP_SLOT_H/2;
 const x=relation==='sibling'
  ?node.x+(side==='right'?1:-1)*(node.width/2+halfW+gap):node.x;
 const y=relation==='parent'?node.y-(node.height/2+halfH+gap):
   relation==='child'?node.y+(node.height/2+halfH+gap):node.y;
 const margin=8;
 // Never clamp to the opposite side of a parent: that would misrepresent its
 // relationship. If the slot is not visible, use the explicit picker.
 if(x-halfW<margin||y-halfH<margin||x+halfW>viewport.width-margin||
    y+halfH>viewport.height-margin)return null;
 // A slot overlapping a different placed card cannot be chosen reliably.
 for(const other of nodes){
  if(other.id===node.id)continue;
  if(Math.abs(x-other.x)<halfW+other.width/2+4&&
     Math.abs(y-other.y)<halfH+other.height/2+4)return null;
 }
 return {x,y,width:DROP_SLOT_W,height:DROP_SLOT_H};
}

export function insideDragFrame(point,frame){
 return !!frame&&point.inside&&
   Math.abs(point.x-frame.x)<=frame.width*.42&&
   Math.abs(point.y-frame.y)<=frame.height*.42;
}

export function dragDropReady(current,now,minHold=DROP_SLOT_HOLD_MS){
 return !!current?.overSlot&&Number.isFinite(current.enteredAt)&&
  now-current.enteredAt>=minHold;
}
