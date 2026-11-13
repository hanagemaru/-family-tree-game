import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {horseSex,horseSexLabel,pedigreeSex} from '../src/horse-sex.js';
import {placementLabels,directionalTarget,dragFramePosition} from '../src/placement-preview.js';
import {STEP_X,STEP_Y} from '../src/core.js';

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
