/** Deterministic, review-only SVGs. Does not alter the playable UI. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {generateRandomHorseStage,seededRandom} from '../src/random-horse-stage.js';
import {newGame,place,relations,CARD_W,CARD_H} from '../src/core.js';
import {layoutFamily,buildDiagram,diagramSvg} from '../src/diagram.js';
const snapshot=JSON.parse(readFileSync('data/horse-pedigree.v1.json','utf8'));
const output='docs/samples';mkdirSync(output,{recursive:true});
const escape=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
for(const seed of [1,2,3]){
 const result=generateRandomHorseStage(snapshot,{seed,attempts:24}),stage=result.stage,byId=new Map(stage.people.map(p=>[p.id,p]));
 const state=newGame(stage,seededRandom(`deck:${seed}`));
 while(!state.complete){
  let move;
  for(const id of state.hand){for(const anchor of state.placed){const rel=relations(byId.get(id),byId.get(anchor))[0];if(rel){move={id,anchor,rel};break;}}if(move)break;}
  if(!move||!place(state,move.id,move.anchor,move.rel).ok)throw Error('Cannot replay seed '+seed);
  state.positions=layoutFamily(state);
 }
 const positions=Object.values(state.positions),minX=Math.min(...positions.map(p=>p.x))-120,maxX=Math.max(...positions.map(p=>p.x))+120;
 const minY=Math.min(...positions.map(p=>p.y))-160,maxY=Math.max(...positions.map(p=>p.y))+130;
 const nodes=state.placed.map(id=>{const p=byId.get(id),at=state.positions[id],name=p.name.length>12?p.name.slice(0,11)+'…':p.name;
   return `<g><rect x="${at.x-CARD_W/2}" y="${at.y-CARD_H/2}" width="${CARD_W}" height="${CARD_H}" rx="9" fill="#f6f1e8" stroke="#665e55" stroke-width="2"/><text x="${at.x}" y="${at.y-6}" text-anchor="middle" font-size="12" font-weight="bold">${escape(name)}</text><text x="${at.x}" y="${at.y+15}" text-anchor="middle" font-size="10" fill="#5c5360">${escape(id)}</text></g>`;}).join('');
 const diag=buildDiagram(state);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${maxX-minX}" height="${maxY-minY}" viewBox="${minX} ${minY} ${maxX-minX} ${maxY-minY}"><style>svg{background:#f4eee4;font-family:system-ui,'Noto Sans JP',sans-serif}.family-wire{fill:none;stroke:#806e55;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}.connection-dot{fill:#a14a31}.family-network text{font-size:10px;fill:#776b60}</style><rect x="${minX}" y="${minY}" width="${maxX-minX}" height="${maxY-minY}" fill="#f4eee4"/><text x="${minX+24}" y="${minY+45}" font-size="23" fill="#4a3f34">Seed ${seed} · ${result.metrics.generations} generations · ${result.metrics.branches} forks · ${result.metrics.crossings} crossings</text>${diagramSvg(diag,{scale:1})}${nodes}</svg>\n`;
 writeFileSync(`${output}/horse-seed-${seed}.svg`,svg);
 console.log(JSON.stringify({seed,crossings:result.metrics.crossings,generations:result.metrics.generations,branches:result.metrics.branches,scale:result.metrics.scale360x320,width:maxX-minX,height:maxY-minY}));
}
