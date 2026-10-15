import test from 'node:test';import assert from 'node:assert/strict';
import {stages} from '../src/data.js';import {newGame,relations,place,exchange,CARD_W,CARD_H} from '../src/core.js';
import {layoutFamily,buildDiagram,renderGeometry,intersection,splitSegment,pointOnSegment,diagramSvg} from '../src/diagram.js';
const full=stage=>{const state=newGame(stage);state.placed=stage.people.map(p=>p.id);state.positions=layoutFamily(state);return state;};
const net=(id,a,b,junctions=[])=>({id,kind:'parent',members:[id],segments:[{a,b}],junctions,label:null});
const near=(a,b)=>Math.abs(a-b)<1e-4;
function assertGeometry(state){
 const diagram=buildDiagram(state),geometry=renderGeometry(diagram),verticals=[];
 for(const n of diagram.networks){for(const s of n.segments){assert.ok(Number.isFinite(s.a.x+s.a.y+s.b.x+s.b.y));assert.ok(near(s.a.x,s.b.x)||near(s.a.y,s.b.y),'orthogonal line');if(near(s.a.x,s.b.x))verticals.push({...s,net:n.id});
 for(const p of Object.values(state.positions)){const x=(s.a.x+s.b.x)/2,y=(s.a.y+s.b.y)/2;assert.ok(!(x>p.x-CARD_W/2+1&&x<p.x+CARD_W/2-1&&y>p.y-CARD_H/2+1&&y<p.y+CARD_H/2-1),'line must not run through card interior');}}
 for(const dot of n.junctions){const rays=new Set();for(const s of n.segments)if(pointOnSegment(dot,s)){if(s.a.x<dot.x||s.b.x<dot.x)rays.add('l');if(s.a.x>dot.x||s.b.x>dot.x)rays.add('r');if(s.a.y<dot.y||s.b.y<dot.y)rays.add('u');if(s.a.y>dot.y||s.b.y>dot.y)rays.add('d');}assert.ok(rays.size>=3,'dots mark true junctions, not bends');}
 }
 for(let i=0;i<verticals.length;i++)for(let j=i+1;j<verticals.length;j++){const a=verticals[i],b=verticals[j];if(a.net!==b.net&&near(a.a.x,b.a.x)){const overlap=Math.min(Math.max(a.a.y,a.b.y),Math.max(b.a.y,b.b.y))-Math.max(Math.min(a.a.y,a.b.y),Math.min(b.a.y,b.b.y));assert.ok(overlap<.001,'unrelated vertical lines must not merge');}}
 for(const crossing of geometry.crossings){const under=geometry.networks.find(n=>n.id===crossing.under);assert.ok(!under.pieces.some(p=>pointOnSegment(crossing.point,p)),'crossing has a real gap in the lower wire');}
 return diagram;
}
test('both parents create one couple junction, not two independent child lines',()=>{
 const state=full(stages[0]),d=assertGeometry(state),family=d.networks.find(n=>n.id==='family:go|hidetada');assert.ok(family);assert.deepEqual(new Set(family.members),new Set(['go','hidetada','iemitsu','tadanaga','sen']));assert.ok(family.junctions.length);assert.ok(!d.networks.some(n=>n.id==='family:go'||n.id==='family:hidetada'));
});
test('one visible parent works; the other parent automatically joins that family',()=>{
 const stage=stages[0],state=newGame(stage);state.placed=['hidetada','iemitsu'];state.positions=layoutFamily(state);let d=assertGeometry(state);assert.equal(d.networks[0].kind,'parent');state.placed.push('go');state.positions=layoutFamily(state);d=assertGeometry(state);assert.equal(d.networks.length,1);assert.equal(d.networks[0].kind,'couple');
});
test('horse parent pair is not labeled as a marriage',()=>{const d=assertGeometry(full(stages[1]));assert.equal(d.networks.find(n=>n.id==='family:sunday|wind').label.text,'父母の組');assert.ok(!diagramSvg(d).includes('夫婦'));});
test('perpendicular crossing has a gap and no new connection dot',()=>{
 const d={networks:[net('h',{x:-30,y:0},{x:30,y:0}),net('v',{x:0,y:-30},{x:0,y:30})]},g=renderGeometry(d);assert.equal(g.crossings.length,1);assert.ok(g.networks.every(n=>n.junctions.length===0));assert.equal(g.networks[0].pieces.length,2);assert.equal(g.networks[1].pieces.length,1);
});
test('true junction takes precedence over a crossing line',()=>{
 const fork=net('fork',{x:-30,y:0},{x:30,y:0},[{x:0,y:0}]);fork.segments.push({a:{x:0,y:0},b:{x:0,y:30}});const d={networks:[fork,net('other',{x:0,y:-30},{x:0,y:0})]},g=renderGeometry(d);assert.ok(g.crossings.every(c=>c.under==='other'));assert.ok(g.networks[0].pieces.some(p=>pointOnSegment({x:0,y:0},p)));assert.ok(!g.networks[1].pieces.some(p=>pointOnSegment({x:0,y:0},p)));
});
test('crossing gap stays 12 screen pixels at different zoom levels',()=>{
 const d={networks:[net('h',{x:-100,y:0},{x:100,y:0}),net('v',{x:0,y:-100},{x:0,y:100})]};for(const scale of [.2,.5,1,1.8]){const g=renderGeometry(d,{scale}),[a,b]=g.networks[0].pieces;assert.ok(near((b.a.x-a.b.x)*scale,12));}
});
test('focus highlights only directly related family networks',()=>{
 const d=buildDiagram(full(stages[0])),g=renderGeometry(d,{focus:'iemitsu'});assert.ok(g.networks.find(n=>n.id==='family:go|hidetada').focused);assert.ok(g.networks.find(n=>n.id==='family:ieyasu').dimmed);
});
test('segment cutting handles reversed direction, adjacent cuts and endpoints',()=>{assert.deepEqual(splitSegment({a:{x:20,y:0},b:{x:0,y:0}},[[3,7],[6,12],[18,30]]),[{a:{x:0,y:0},b:{x:3,y:0}},{a:{x:12,y:0},b:{x:18,y:0}}]);assert.equal(intersection({a:{x:0,y:0},b:{x:20,y:0}},{a:{x:30,y:-10},b:{x:30,y:10}}),null);});
test('multiple partners stay separate and their children belong to the correct pair',()=>{
 const p=(id,generation,parents=[],spouses=[])=>({id,generation,parents,spouses}),stage={id:'multi',anchor:'father',people:[p('father',0,[],['a','b']),p('a',0,[],['father']),p('b',0,[],['father']),p('childA',1,['father','a']),p('childB',1,['father','b'])]},state=full(stage),d=assertGeometry(state);assert.equal(d.networks.length,2);assert.ok(d.networks.find(n=>n.members.includes('childA')).members.includes('a'));assert.ok(!d.networks.find(n=>n.members.includes('childA')).members.includes('b'));
});
test('random play orders keep every partial diagram legible and topologically separate',()=>{
 let seed=9;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(const stage of stages)for(let run=0;run<25;run++){const state=newGame(stage,random);let turns=0;while(!state.complete&&turns++<100){state.positions=layoutFamily(state);assertGeometry(state);const moves=state.hand.flatMap(id=>state.placed.flatMap(anchor=>relations(stage.people.find(p=>p.id===id),stage.people.find(p=>p.id===anchor)).map(relation=>({id,anchor,relation}))));if(!moves.length){exchange(state);continue;}const move=moves[Math.floor(random()*moves.length)];assert.ok(place(state,move.id,move.anchor,move.relation).ok);}state.positions=layoutFamily(state);assertGeometry(state);assert.ok(state.complete);}
});
test('crossing cuts never erase a nearby genuine branch point',()=>{
 const a=net('horizontal',{x:-40,y:0},{x:40,y:0},[{x:3,y:0}]);a.segments.push({a:{x:3,y:0},b:{x:3,y:25}});const d={networks:[a,net('vertical',{x:0,y:-30},{x:0,y:30})]};const g=renderGeometry(d);assert.ok(!g.networks[0].pieces.some(s=>pointOnSegment({x:0,y:0},s)));assert.ok(g.networks[0].pieces.some(s=>pointOnSegment({x:3,y:0},s)));
});
test('one child is directly below its sole visible parent instead of centered on the canvas',()=>{
 const stage=stages[1],state=newGame(stage);state.placed=['sunday','black','stay','kitasan','equinox'];state.positions=layoutFamily(state);
 assert.equal(state.positions.kitasan.x,state.positions.black.x);
 assert.equal(state.positions.equinox.x,state.positions.kitasan.x);
 const diagram=assertGeometry(state);
 for(const id of ['family:black','family:kitasan']){
  const family=diagram.networks.find(n=>n.id===id);
  assert.ok(family.segments.every(s=>near(s.a.x,s.b.x)),'aligned parent-child chain needs no horizontal detour');
 }
});
test('a single sibling row centers under its parent pair',()=>{
 const state=newGame(stages[0]);state.placed=['hidetada','go','iemitsu','tadanaga','sen'];state.positions=layoutFamily(state);
 const middle=(state.positions.hidetada.x+state.positions.go.x)/2;
 const children=['iemitsu','tadanaga','sen'].map(id=>state.positions[id].x);
 assert.ok(near(children.reduce((a,b)=>a+b,0)/3,middle));assertGeometry(state);
});
