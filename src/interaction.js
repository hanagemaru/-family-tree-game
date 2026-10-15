import {CARD_W,CARD_H} from './core.js';

export const DRAG_LIFT=28;
export const dragHotspot=(x,y)=>({x,y:y-DRAG_LIFT});
const contains=(p,r,padding=0)=>p.x>=r.left-padding&&p.x<=r.right+padding&&p.y>=r.top-padding&&p.y<=r.bottom+padding;
function distanceToGuide(point,node,guide){
 const dx=guide.x-node.x,dy=guide.y-node.y,length=dx*dx+dy*dy;
 const t=length?Math.max(0,Math.min(1,((point.x-node.x)*dx+(point.y-node.y)*dy)/length)):0;
 return Math.hypot(point.x-node.x-t*dx,point.y-node.y-t*dy);
}
export function screenNodes(positions,camera){
 return Object.entries(positions).map(([id,p])=>({id,x:p.x*camera.scale+camera.x,y:p.y*camera.scale+camera.y,width:CARD_W*camera.scale,height:CARD_H*camera.scale}));
}
export function targetItems(node,width,height,relations){
 const offsets={parent:[0,-90],child:[0,90],spouse:[108,0],sibling:[-108,0]};
 return relations.map(type=>{const [dx,dy]=offsets[type],x=Math.max(39,Math.min(width-39,node.x+dx)),y=Math.max(60,Math.min(height-60,node.y+dy));return {type,x,y,left:x-36,right:x+36,top:y-22,bottom:y+22};});
}
// Acquiring a card and selecting its relation are separate steps. Once acquired,
// keep the owner fixed throughout the guide area, even when a neighbor is closer.
export function resolveDragTarget(point,nodes,currentId,items=[]){
 if(!point.inside)return {anchor:null,relation:null};
 const owner=nodes.find(n=>n.id===currentId);
 if(owner){
  const hit=items.filter(item=>contains(point,item,5)).sort((a,b)=>Math.hypot(point.x-a.x,point.y-a.y)-Math.hypot(point.x-b.x,point.y-b.y))[0];
  if(hit)return {anchor:owner.id,relation:hit.type};
  const card={left:owner.x-owner.width/2,right:owner.x+owner.width/2,top:owner.y-owner.height/2,bottom:owner.y+owner.height/2};
  // Protect the paths to the guides, not one huge rectangle covering the board.
  const protectedArea=contains(point,card,12)||items.some(t=>contains(point,t,14)||distanceToGuide(point,owner,t)<=28);
  if(protectedArea)return {anchor:owner.id,relation:null};
 }
 const hit=nodes.filter(n=>contains(point,{left:n.x-n.width/2,right:n.x+n.width/2,top:n.y-n.height/2,bottom:n.y+n.height/2},6)).sort((a,b)=>Math.hypot(point.x-a.x,point.y-a.y)-Math.hypot(point.x-b.x,point.y-b.y))[0];
 // Never activate a newly-created guide in the same event that acquired its card.
 return {anchor:hit?.id||null,relation:null};
}
