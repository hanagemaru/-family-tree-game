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

/** A card explicitly under the release point always wins over the loose
 * directional hover zones. An overlapping hit is ambiguous, never guessed. */
export function exactDropTarget(point,nodes){
 if(!point.inside)return {kind:'none'};
 const matches=nodes.filter(node=>
  Math.abs(point.x-node.x)<=node.width/2&&
  Math.abs(point.y-node.y)<=node.height/2);
 if(matches.length===1)return {kind:'card',id:matches[0].id};
 return matches.length>1?{kind:'ambiguous'}:{kind:'none'};
}

/** Avoid a selection sheet on blank space. Use it only when a drop falls
 * among several nearby nodes that could not be distinguished. */
export function ambiguousNearbyDrop(point,nodes){
 if(!point.inside)return false;
 const candidates=nodes.filter(node=>
  Math.abs(point.x-node.x)<Math.max(26,node.width/2+8)&&
  Math.abs(point.y-node.y)<Math.max(26,node.height/2+8));
 return candidates.length>1;
}
