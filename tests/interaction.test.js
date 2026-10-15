import test from 'node:test';
import assert from 'node:assert/strict';
import {dragHotspot,screenNodes,pickDropCard,dropDecision} from '../src/interaction.js';
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
test('release on a card opens relation selection rather than placing automatically',()=>assert.deepEqual(dropDecision({active:true,inside:true,anchor:'a',card:'held'}),{type:'relation',card:'held',anchor:'a'}));
test('release on empty board offers an explicit card list, not a dead end',()=>assert.deepEqual(dropDecision({active:true,inside:true,anchor:null,card:'held'}),{type:'choose-anchor',card:'held'}));
test('tap and outside release keep the held card selected',()=>{
 for(const active of [false,true])assert.deepEqual(dropDecision({active,inside:false,anchor:null,card:'held'}),{type:'selected',card:'held'});
});
test('cancel without a held card has no placement effect',()=>assert.deepEqual(dropDecision({active:true,inside:true,anchor:'a',card:null}),{type:'cancel'}));
test('pan and zoom consistently transform acquisition areas',()=>{
 for(const scale of [.18,.5,1,1.8]){const list=screenNodes({a:{x:100,y:190},b:{x:100,y:0}},{x:90,y:70,scale});assert.equal(pickDropCard(p(list[0].x,list[0].y),list),'a');}
});
