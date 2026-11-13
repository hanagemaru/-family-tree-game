import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {horseSex,horseSexLabel,pedigreeSex} from '../src/horse-sex.js';
import {placementLabels,previewPosition} from '../src/placement-preview.js';
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

test('parent, sibling and child previews use consistent above, sideways, below directions',()=>{
 const positions={anchor:{x:0,y:0}};
 assert.equal(previewPosition(positions,'anchor','parent').y,-STEP_Y);
 assert.equal(previewPosition(positions,'anchor','child').y,STEP_Y);
 assert.equal(previewPosition(positions,'anchor','sibling').x,-STEP_X);
 assert.equal(previewPosition(positions,'anchor','spouse').x,STEP_X);
 assert.equal(placementLabels.parent.arrow,'↑');
 assert.equal(placementLabels.child.arrow,'↓');
 assert.equal(placementLabels.sibling.arrow,'↔');
 assert.equal(previewPosition(positions,'missing','parent'),null);
});

test('preview avoids an already occupied slot without mutating game positions',()=>{
 const positions={anchor:{x:0,y:0},occupied:{x:0,y:STEP_Y}};
 const original=structuredClone(positions);
 const preview=previewPosition(positions,'anchor','child');
 assert.equal(preview.y,STEP_Y);
 assert.notEqual(preview.x,0);
 assert.deepEqual(positions,original);
});
