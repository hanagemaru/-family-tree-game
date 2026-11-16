/** Absolute pinch transform: anchor the initial midpoint to the same world position. */
export function pinchCamera(start,initialA,initialB,currentA,currentB,{minScale=.18,maxScale=1.8}={}){
 const initialDistance=Math.hypot(initialA.x-initialB.x,initialA.y-initialB.y);
 const currentDistance=Math.hypot(currentA.x-currentB.x,currentA.y-currentB.y);
 if(!Number.isFinite(initialDistance)||initialDistance<8||!Number.isFinite(currentDistance))
  return {...start};
 const previousMid={x:(initialA.x+initialB.x)/2,y:(initialA.y+initialB.y)/2};
 const currentMid={x:(currentA.x+currentB.x)/2,y:(currentA.y+currentB.y)/2};
 const scale=Math.max(minScale,Math.min(maxScale,start.scale*currentDistance/initialDistance));
 const ratio=scale/start.scale;
 return {
  scale,
  x:currentMid.x-(previousMid.x-start.x)*ratio,
  y:currentMid.y-(previousMid.y-start.y)*ratio
 };
}
