import test from 'node:test';
import assert from 'node:assert/strict';
import {dragHotspot,screenNodes,targetItems,resolveDragTarget} from '../src/interaction.js';
const relations=['parent','child','spouse','sibling'];
const point=(x,y)=>({x,y,inside:true});
const nodes=[{id:'owner',x:170,y:190,width:72,height:45},{id:'neighbor',x:170,y:95,width:72,height:45}];
const items=targetItems(nodes[0],360,380,relations);

test('the visible held-card center is the drop hotspot, not the finger below it',()=>{
 assert.deepEqual(dragHotspot(170,128),{x:170,y:100});
});
test('acquire only a card body, not the nearest card across an empty gap',()=>{
 assert.deepEqual(resolveDragTarget(point(170,143),nodes,null),{anchor:null,relation:null});
 assert.deepEqual(resolveDragTarget(point(170,190),nodes,null),{anchor:'owner',relation:null});
});
test('owner does not switch while moving through the gap toward its parent guide',()=>{
 // At y=135 the neighbor is closer. The old nearest-card logic switched here.
 for(const y of [180,160,145,135,125])assert.equal(resolveDragTarget(point(170,y),nodes,'owner',items).anchor,'owner');
});
test('guide ownership wins even when its target overlaps another card',()=>{
 const result=resolveDragTarget(point(170,100),nodes,'owner',items);
 assert.deepEqual(result,{anchor:'owner',relation:'parent'});
});
test('leaving the whole guide region releases the owner; a later card can be acquired',()=>{
 assert.deepEqual(resolveDragTarget(point(350,370),nodes,'owner',items),{anchor:null,relation:null});
 assert.deepEqual(resolveDragTarget(point(170,95),nodes,null),{anchor:'neighbor',relation:null});
});
test('leaving the board clears both owner and hot relation',()=>{
 assert.deepEqual(resolveDragTarget({x:170,y:100,inside:false},nodes,'owner',items),{anchor:null,relation:null});
});
test('diagonal free space can release a lock without leaving a narrow mobile board',()=>{
 assert.equal(resolveDragTarget(point(300,310),nodes,'owner',items).anchor,null);
});
test('a newly acquired card never auto-activates one of its guides',()=>{
 assert.equal(resolveDragTarget(point(170,95),nodes,null,items).relation,null);
});
test('pan and zoom transform the acquisition boxes consistently',()=>{
 for(const scale of [.3,.5,1,1.8]){
  const list=screenNodes({a:{x:100,y:190},b:{x:100,y:0}},{x:90,y:70,scale});
  const p=list[0];assert.equal(resolveDragTarget(point(p.x,p.y),list,null).anchor,'a');
  const guide=targetItems(p,600,600,relations).find(t=>t.type==='parent');
  assert.deepEqual(resolveDragTarget(point(guide.x,guide.y),list,'a',targetItems(p,600,600,relations)),{anchor:'a',relation:'parent'});
 }
});
