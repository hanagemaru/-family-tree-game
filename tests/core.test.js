import test from 'node:test';
import assert from 'node:assert/strict';
import {stages} from '../src/data.js';
import {relations,newGame,place,exchange,connectable,visibleEdges,pack,restore,fitCamera,revealCamera,CARD_W,CARD_H,formatTime} from '../src/core.js';
const history=stages[0],horses=stages[1];
const lookup=(stage,id)=>stage.people.find(p=>p.id===id);
function randomSeed(seed){let x=seed;return ()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296;};}
function assertInventory(state){const all=[...state.placed,...state.hand,...state.deck];assert.equal(all.length,state.stage.people.length);assert.equal(new Set(all).size,all.length);assert.ok(state.hand.length<=5);assert.ok(all.every(id=>lookup(state.stage,id)));}
function assertNoOverlap(state){const points=Object.values(state.positions);for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)assert.ok(Math.abs(points[i].x-points[j].x)>=CARD_W+10||Math.abs(points[i].y-points[j].y)>=CARD_H+10);}
for(const stage of stages){
 test(`${stage.id}: data IDs, generation consistency and source coverage`,()=>{
 const ids=stage.people.map(p=>p.id);assert.equal(new Set(ids).size,ids.length);assert.ok(ids.includes(stage.anchor));
 for(const person of stage.people){assert.equal(person.clues.length,2);assert.ok(person.source.url.startsWith('https://'));for(const id of person.parents){const parent=lookup(stage,id);assert.ok(parent);assert.equal(parent.generation+1,person.generation);}for(const id of person.spouses){const partner=lookup(stage,id);assert.ok(partner);assert.ok(partner.spouses.includes(person.id));assert.equal(person.generation,partner.generation);}}
 });
 test(`${stage.id}: 200 seeded games can finish through every deal and exchange`,()=>{
 for(let seed=1;seed<=200;seed++){
 const state=newGame(stage,randomSeed(seed));assertInventory(state);assert.ok(state.hand.some(id=>connectable(state,id)));let turns=0;
 while(!state.complete&&turns++<100){
 const moves=state.hand.flatMap(id=>state.placed.flatMap(anchor=>relations(lookup(stage,id),lookup(stage,anchor)).map(relation=>({id,anchor,relation}))));
 if(!moves.length){assert.ok(state.deck.length);assert.ok(exchange(state));assert.ok(state.hand.some(id=>connectable(state,id)));continue;}
 const move=moves[(seed+turns)%moves.length];const before=JSON.stringify(state.positions);assert.ok(place(state,move.id,move.anchor,move.relation).ok);assertInventory(state);assertNoOverlap(state);for(const [id,position] of Object.entries(JSON.parse(before)))assert.deepEqual(state.positions[id],position);
 }
 assert.ok(state.complete,`seed ${seed} stalled`);assert.equal(state.hand.length,0);assert.equal(state.deck.length,0);assert.equal(state.mistakes,0);assert.ok(visibleEdges(state).length>=stage.people.length-1);
 }
 });
 test(`${stage.id}: save/restore retains game and rejects damaged inventories`,()=>{
 const state=newGame(stage,randomSeed(3));state.elapsed=12345;state.hints[state.hand[0]]=2;
 const saved=JSON.parse(JSON.stringify(pack(state)));assert.deepEqual(pack(restore(saved,stage)),saved);
 const duplicates=structuredClone(saved);duplicates.hand[0]=duplicates.placed[0];assert.equal(restore(duplicates,stage),null);
 const missing=structuredClone(saved);missing.deck.pop();assert.equal(restore(missing,stage),null);
 const position=structuredClone(saved);position.positions[stage.anchor].x=null;assert.equal(restore(position,stage),null);
 const hints=structuredClone(saved);hints.hints[state.hand[0]]='2';assert.equal(restore(hints,stage),null);
 assert.equal(restore({},stage),null);assert.equal(restore({...saved,hand:null},stage),null);
 });
 test(`${stage.id}: exchange never loses cards`,()=>{const state=newGame(stage,randomSeed(1));for(let i=0;i<100;i++){exchange(state);assertInventory(state);assert.ok(state.hand.some(id=>connectable(state,id)));}});
}
test('multiple legitimate attachment paths, including half siblings and mothers',()=>{
 assert.deepEqual(relations(lookup(history,'go'),lookup(history,'hidetada')),['spouse']);
 assert.deepEqual(relations(lookup(history,'go'),lookup(history,'iemitsu')),['parent']);
 assert.deepEqual(relations(lookup(history,'iemitsu'),lookup(history,'go')),['child']);
 assert.deepEqual(relations(lookup(history,'yorifusa'),lookup(history,'hidetada')),['sibling']);
 assert.deepEqual(relations(lookup(horses,'black'),lookup(horses,'deep')),['sibling']);
 assert.deepEqual(relations(lookup(horses,'stay'),lookup(horses,'deep')),['sibling']);
 assert.deepEqual(relations(lookup(horses,'wind'),lookup(horses,'black')),['parent']);
 assert.deepEqual(relations(lookup(horses,'sunday'),lookup(horses,'sunday')),[]);
 assert.deepEqual(relations(lookup(horses,'equinox'),lookup(horses,'deep')),[]);
});
test('wrong relation keeps hand, deck and positions unchanged and records one mistake',()=>{
 const state=newGame(history,randomSeed(5)),id=state.hand[0];const inventory=[...state.hand,...state.deck];const positions=structuredClone(state.positions);const valid=relations(lookup(history,id),lookup(history,state.stage.anchor));const wrong=['parent','child','spouse','sibling'].find(r=>!valid.includes(r));
 assert.equal(place(state,id,state.stage.anchor,wrong).ok,false);assert.equal(state.mistakes,1);assert.deepEqual([...state.hand,...state.deck],inventory);assert.deepEqual(state.positions,positions);
});
test('invalid or already placed IDs are rejected without counting a mistake',()=>{const state=newGame(history);assert.equal(place(state,history.anchor,history.anchor,'child').reason,'invalid');assert.equal(place(state,state.hand[0],'unknown','parent').reason,'invalid');assert.equal(state.mistakes,0);});
test('sibling placeholder becomes proper parent edges when the parent arrives',()=>{
 const state=newGame(history);state.placed=['hidetada','yorifusa'];state.positions={hidetada:{x:0,y:0},yorifusa:{x:180,y:0}};assert.ok(visibleEdges(state).some(e=>e.kind==='sibling'));state.placed.push('ieyasu');state.positions.ieyasu={x:0,y:-190};const edges=visibleEdges(state);assert.equal(edges.filter(e=>e.kind==='sibling').length,0);assert.equal(edges.filter(e=>e.kind==='parent').length,2);
});
test('spouse and sibling links are unique even with two shared parents',()=>{
 const state=newGame(history);state.placed=['hidetada','go','iemitsu','tadanaga'];assert.equal(visibleEdges(state).filter(e=>e.kind==='spouse').length,1);
 state.placed=['iemitsu','tadanaga'];assert.equal(visibleEdges(state).filter(e=>e.kind==='sibling').length,1);
});
test('fit camera contains cards on small phone and desktop canvases',()=>{
 const positions={a:{x:-900,y:-190},b:{x:600,y:570}};
 for(const [width,height] of [[288,245],[360,320],[820,510]]){const c=fitCamera(positions,width,height);for(const p of Object.values(positions)){assert.ok((p.x-CARD_W/2)*c.scale+c.x>=0);assert.ok((p.x+CARD_W/2)*c.scale+c.x<=width);assert.ok((p.y-CARD_H/2)*c.scale+c.y>=0);assert.ok((p.y+CARD_H/2)*c.scale+c.y<=height);}}
});
test('reveal camera keeps visible cards stationary and reveals new offscreen cards',()=>{
 const initial={x:180,y:160,scale:1};assert.deepEqual(revealCamera(initial,{x:0,y:0},360,320),initial);
 const next=revealCamera(initial,{x:500,y:500},360,320);assert.equal(next.scale,1);assert.ok(500+next.x<360);assert.ok(500+next.y<320);
});
test('format time handles long sessions',()=>{assert.equal(formatTime(0),'0:00');assert.equal(formatTime(61500),'1:01');assert.equal(formatTime(3600000),'60:00');});
