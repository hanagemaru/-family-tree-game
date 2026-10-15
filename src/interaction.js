import {CARD_W,CARD_H} from './core.js';

export const DRAG_LIFT=36;
export const dragHotspot=(x,y)=>({x,y:y-DRAG_LIFT});
export function screenNodes(positions,camera){
 return Object.entries(positions).map(([id,p])=>({id,x:p.x*camera.scale+camera.x,y:p.y*camera.scale+camera.y,width:CARD_W*camera.scale,height:CARD_H*camera.scale}));
}
function contains(point,node,padding=0){
 return Math.abs(point.x-node.x)<=Math.max(44,node.width)/2+padding&&Math.abs(point.y-node.y)<=Math.max(44,node.height)/2+padding;
}
// The gesture only identifies a card. Relations are chosen after release.
export function pickDropCard(point,nodes,currentId=null){
 if(!point.inside)return null;
 const owner=nodes.find(n=>n.id===currentId),distance=n=>Math.hypot(point.x-n.x,point.y-n.y);
 const candidates=nodes.filter(n=>contains(point,n,6)).sort((a,b)=>distance(a)-distance(b));
 const best=candidates[0];
 if(owner&&contains(point,owner,12)&&(!best||best.id===owner.id||distance(best)+16>=distance(owner)))return owner.id;
 return best?.id||null;
}
export function dropDecision({active,inside,anchor,card}){
 if(!card)return {type:'cancel'};
 if(!active||!inside)return {type:'selected',card};
 return anchor?{type:'relation',card,anchor}:{type:'choose-anchor',card};
}
