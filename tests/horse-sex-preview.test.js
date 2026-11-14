import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {horseSex,horseSexLabel,horseSexTone,pedigreeSex} from '../src/horse-sex.js';
import {placementLabels,directionalTarget,dragFramePosition,dragFrameScreen,insideDragFrame,dragDropReady,DROP_SLOT_HOLD_MS} from '../src/placement-preview.js';
import {STEP_X,STEP_Y,fitCamera,CARD_W,CARD_H} from '../src/core.js';

const snapshot=JSON.parse(readFileSync(new URL('../data/horse-pedigree.v1.json',import.meta.url),'utf8'));

test('male and female labels are based on explicit parent roles, never name guessing',()=>{
 const known=pedigreeSex(snapshot),sires=new Set(snapshot.horses.map(h=>h.sire).filter(Boolean)),dams=new Set(snapshot.horses.map(h=>h.dam).filter(Boolean));
 assert.ok(known.size>=300);
 for(const id of sires)assert.equal(horseSex(id,snapshot),'male');
 for(const id of dams)assert.equal(horseSex(id,snapshot),'female');
 assert.equal(horseSexLabel('male'),'牡');
 assert.equal(horseSexLabel('female'),'牝');
 assert.equal(horseSexLabel('gelding'),'セ');
 assert.equal(horseSexLabel(null),'不明');
 assert.equal(horseSex('wind'),'female');
 assert.equal(horseSex('deep'),'male');
 assert.equal(horseSex('Q999999999999999',snapshot),null);
});

test('drag preview chooses parent, sibling and child by marker location around a card',()=>{
 const nodes=[{id:'anchor',x:180,y:150,width:108,height:154}];
 const p=(x,y)=>({x,y,inside:true});
 assert.equal(directionalTarget(p(180,90),nodes)?.relation,'parent');
 assert.equal(directionalTarget(p(240,150),nodes)?.relation,'sibling');
 assert.equal(directionalTarget(p(120,150),nodes)?.side,'left');
 assert.equal(directionalTarget(p(180,210),nodes)?.relation,'child');
 assert.equal(directionalTarget(p(180,150),nodes),null);
 assert.equal(directionalTarget({x:180,y:90,inside:false},nodes),null);
 assert.equal(dragFramePosition({anchor:{x:0,y:0}},'anchor','parent').y,-STEP_Y);
 assert.equal(dragFramePosition({anchor:{x:0,y:0}},'anchor','child').y,STEP_Y);
 assert.equal(dragFramePosition({anchor:{x:0,y:0}},'anchor','sibling','left').x,-STEP_X);
 assert.equal(dragFramePosition({anchor:{x:0,y:0}},'anchor','sibling','right').x,STEP_X);
 assert.equal(placementLabels.parent.arrow,'↑');
 assert.equal(placementLabels.child.arrow,'↓');
 assert.equal(placementLabels.sibling.arrow,'↔');
 assert.equal(dragFramePosition({anchor:{x:0,y:0}},'missing','parent'),null);
});

test('preview avoids an already occupied slot without mutating game positions',()=>{
 const positions={anchor:{x:0,y:0},occupied:{x:0,y:STEP_Y}};
 const original=structuredClone(positions);
 const preview=dragFramePosition(positions,'anchor','child');
 assert.equal(preview.y,STEP_Y);
 assert.notEqual(preview.x,0);
 assert.deepEqual(positions,original);
});

test('corrected animal-sex Wikidata claims plus JRA/JBIS eliminate unknown sex for all 991 source records',()=>{
 const unknown=snapshot.horses.filter(h=>!horseSex(h.id,snapshot));
 assert.deepEqual(unknown.map(h=>h.name),[]);
 assert.equal(horseSex('Q11321082',snapshot),'male'); // Tokai Teio: JRA
 assert.equal(horseSex('Q140512508',snapshot),'gelding'); // Bold Brian: JRA
 assert.equal(horseSex('Q140512523',snapshot),'gelding'); // Erimo Maxim: JBIS
 assert.equal(horseSexLabel(horseSex('Q140512523',snapshot)),'セ');
});

test('only an exact clear dotted slot, not a broad direction, can arm a drop',()=>{
 const node={id:'a',x:180,y:150,width:108,height:154};
 const viewport={width:360,height:300};
 const up=dragFrameScreen(node,'parent',null,viewport,[node]);
 const down=dragFrameScreen(node,'child',null,viewport,[node]);
 const left=dragFrameScreen(node,'sibling','left',viewport,[node]);
 const right=dragFrameScreen(node,'sibling','right',viewport,[node]);
 assert.ok(up&&down&&left&&right);
 assert.ok(up.y<node.y&&down.y>node.y);
 assert.ok(left.x<node.x&&right.x>node.x);
 assert.equal(insideDragFrame({x:180,y:110,inside:true},up),false,'the broad upper quadrant is not the slot');
 assert.equal(insideDragFrame({x:up.x,y:up.y,inside:true},up),true);
 assert.equal(insideDragFrame({x:up.x,y:up.y,inside:false},up),false);
 assert.equal(dragDropReady({overSlot:false,enteredAt:0},1000),false);
 assert.equal(dragDropReady({overSlot:true,enteredAt:100},100+DROP_SLOT_HOLD_MS-1),false);
 assert.equal(dragDropReady({overSlot:true,enteredAt:100},100+DROP_SLOT_HOLD_MS),true);
});

test('near edges or overlapping another card, direct placement is disabled',()=>{
 const viewport={width:360,height:300};
 const edge={id:'edge',x:180,y:49,width:108,height:154};
 assert.equal(dragFrameScreen(edge,'parent',null,viewport,[edge]),null);
 const anchor={id:'a',x:180,y:150,width:108,height:154};
 const obstruction={id:'b',x:180,y:38,width:108,height:154};
 assert.equal(dragFrameScreen(anchor,'parent',null,viewport,[anchor,obstruction]),null);
 assert.ok(dragFrameScreen(anchor,'child',null,viewport,[anchor,obstruction]));
 assert.equal(dragFrameScreen(anchor,'spouse',null,viewport,[anchor]),null);
});

test('initial mobile viewport 235-300px tall keeps top and bottom drop frames visible',()=>{
 for(const height of [235,245,260,278,300]){
  const positions={anchor:{x:0,y:0}};
  const camera=fitCamera(positions,360,height);
  const anchor={id:'anchor',x:camera.x,y:camera.y,
   width:CARD_W*camera.scale,height:CARD_H*camera.scale};
  for(const relation of ['parent','child']){
   const slot=dragFrameScreen(anchor,relation,null,{width:360,height},[anchor]);
   assert.ok(slot,`height ${height}, relation ${relation}, zoom ${camera.scale}`);
   assert.ok(slot.y-slot.height/2>=4);
   assert.ok(slot.y+slot.height/2<=height-4);
  }
 }
});

test('horse sex tone has stable accessible classes for all known sex categories',()=>{
 assert.equal(horseSexTone('male'),'sex-male');
 assert.equal(horseSexTone('female'),'sex-female');
 assert.equal(horseSexTone('gelding'),'sex-gelding');
 assert.equal(horseSexTone(null),'sex-unknown');
});
