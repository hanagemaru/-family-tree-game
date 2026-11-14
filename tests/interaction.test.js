import test from 'node:test';
import assert from 'node:assert/strict';
import {dragHotspot,screenNodes,pickDropCard,exactDropTarget,ambiguousNearbyDrop} from '../src/interaction.js';
const p=(x,y)=>({x,y,inside:true});
const nodes=[{id:'a',x:120,y:150,width:72,height:45},{id:'b',x:215,y:150,width:72,height:45}];
test('drop hotspot equals the center of the visible held card',()=>assert.deepEqual(dragHotspot(120,186),{x:120,y:150}));
test('empty space never silently chooses the nearest card',()=>assert.equal(pickDropCard(p(20,20),nodes),null));
test('card bodies are acquired with a minimum 44px touch area',()=>{
 assert.equal(pickDropCard(p(120,150),nodes),'a');
 assert.equal(pickDropCard(p(120,168),[{id:'a',x:120,y:150,width:20,height:12}]),'a');
});
test('hover jitter stays stable but moving onto another card selects it',()=>{
 assert.equal(pickDropCard(p(161,150),nodes,'a'),'a');
 assert.equal(pickDropCard(p(215,150),nodes,'a'),'b');
});
test('leaving the board removes the drop preview',()=>assert.equal(pickDropCard({...p(120,150),inside:false},nodes,'a'),null));
test('a clear card body is targeted even when the board is zoomed out',()=>{
 for(const scale of [.18,.4,.55,1,1.5]){
  const list=screenNodes({a:{x:0,y:0},b:{x:270,y:0}},{x:150,y:180,scale});
  assert.deepEqual(exactDropTarget(p(list[0].x,list[0].y),list),{kind:'card',id:'a'});
 }
});

test('overlapping cards are ambiguous and are never guessed from release coordinates',()=>{
 const crowded=[{id:'a',x:100,y:100,width:60,height:70},
  {id:'b',x:115,y:100,width:60,height:70}];
 assert.deepEqual(exactDropTarget(p(100,100),crowded),{kind:'ambiguous'});
 assert.equal(ambiguousNearbyDrop(p(100,100),crowded),true);
});

test('blank board and off-board release never force an opponent',()=>{
 assert.deepEqual(exactDropTarget(p(15,18),nodes),{kind:'none'});
 assert.equal(ambiguousNearbyDrop(p(15,18),nodes),false);
 assert.deepEqual(exactDropTarget({...p(120,150),inside:false},nodes),{kind:'none'});
});
test('pan and zoom consistently transform acquisition areas',()=>{
 for(const scale of [.18,.5,1,1.8]){const list=screenNodes({a:{x:100,y:190},b:{x:100,y:0}},{x:90,y:70,scale});assert.equal(pickDropCard(p(list[0].x,list[0].y),list),'a');}
});
