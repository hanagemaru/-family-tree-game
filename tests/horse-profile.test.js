import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {horseProfileHtml} from '../src/horse-profile.js';
import {loadApp} from './dom-harness.js';
const load=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const pedigree=load('../data/horse-pedigree.v1.json');
const manifest=load('../data/horse-profiles.v1.json');
const media=load('../data/horse-media.v1.json');
const named=pedigree.horses.filter(h=>h.named);

test('all 872 named horses were audited with stable QID and traceable facts',()=>{
 assert.equal(named.length,872);
 assert.equal(manifest.version,'horse-profiles-v1');
 assert.deepEqual(Object.keys(manifest.horses).sort(),named.map(h=>h.id).sort());
 assert.ok(manifest.coverage.articleLeads>=750,'all possible article leads should be audited');
 assert.ok(manifest.coverage.withProfileFacts>=250,'source-backed facts must be present, not an empty placeholder');
 assert.equal(manifest.coverage.named,872);
 for(const h of named){
  const row=manifest.horses[h.id];
  assert.equal(row.name,h.name);
  assert.ok(Array.isArray(row.majorWins));
  assert.ok(row.majorWins.length<=8);
  assert.ok(row.majorWins.every(w=>typeof w.race==='string'&&w.race.length>=2));
  const facts=row.majorWins.length||row.raceRecord||row.description;
  if(facts)assert.ok(row.sources.length,'every factual profile must have a named source: '+h.name);
  if(row.raceRecord)assert.ok(row.raceRecord.wins<=row.raceRecord.starts);
  for(const s of row.sources)assert.ok(s.url.startsWith('https://'),h.name);
 }
 // A regional "Hyogo Kikuka Sho" is NOT the national Japanese St Leger.
 const jingi=Object.values(manifest.horses).find(x=>x.name==='ジンギ');
 if(jingi)assert.equal(jingi.majorWins.some(x=>x.race==='菊花賞'),false);
 // Partial-season 8 starts / 6 wins is not Gold Ship's all-time record.
 const gold=Object.values(manifest.horses).find(x=>x.name==='ゴールドシップ');
 if(gold)assert.notDeepEqual(gold.raceRecord,{starts:8,wins:6});
});
test('single placed horse shows only achievements, race record, photo credit and sources',()=>{
 const horse=named.find(h=>h.name==='ディープインパクト');
 assert.ok(horse);
 const data=manifest.horses[horse.id],photo=media.horses[horse.id];
 assert.ok(data.majorWins.length,'famous horse must have verified race facts');
 const output=horseProfileHtml(horse,{profile:data,photo,sexLabel:'牡'});
 assert.match(output,/ディープインパクト/);
 assert.match(output,/2002年生/);
 assert.match(output,/主な勝ち鞍/);
 assert.match(output,/東京優駿/);
 assert.match(output,/JRA顕彰馬/);
 assert.match(output,/出典：/);
 assert.ok(!output.includes('parent')&&!output.includes('父：')&&!output.includes('母：'));
 assert.ok(output.includes('commons.wikimedia.org')&&output.includes('horse-profile-photo'));
 assert.ok(!output.includes('関係を見る'),'remove redundant relationship-highlighting button');
});
test('source-free horses do not receive invented race records or wins',()=>{
 const horse={id:'Q9999',name:'確認中の馬',birthYear:2001,parents:['Q1111']};
 const html=horseProfileHtml(horse,{sexLabel:'牝',profile:{majorWins:[],raceRecord:null,sources:[]},articleUrl:'https://ja.wikipedia.org/wiki/テスト'});
 assert.match(html,/確認中の馬/);
 assert.match(html,/競走成績などの情報はまだありません。/);
 assert.doesNotMatch(html,/主な勝ち鞍|Q1111|親子|父：|母：/);
 assert.doesNotMatch(html,/<img/);
});
test('HTML labels, descriptions and remote URLs are escaped or rejected',()=>{
 const html=horseProfileHtml({id:'Q1',name:'<img src=x onerror=alert(1)>',birthYear:2020},{
  profile:{majorWins:[{race:'<script>alert(2)</script>',year:2020}],
   description:'<b>テスト</b>',sources:[{label:'bad',url:'javascript:alert(1)'},{label:'Wikidata',url:'https://www.wikidata.org/wiki/Q1'}]},
  photo:{photoUrl:'javascript:alert(1)',filePage:'javascript:alert(2)'}
 });
 assert.doesNotMatch(html,/<(?:script|img)\b|(?:href|src)="javascript:/, "escaped text may contain an inert onerror= string");
 assert.match(html,/&lt;script&gt;/);
 assert.match(html,/https:\/\/www\.wikidata\.org\/wiki\/Q1/);
});
test('tapping a placed card opens profile, no penalty; selecting a hand card keeps the existing relation picker',async t=>{
 const app=await loadApp();t.after(()=>app.restore());
 app.$('stage-list').querySelector('[data-random-start]').click();
 const node=app.$('nodes').querySelector('[data-node]');
 assert.ok(node);
 const before=structuredClone(app.storage());
 node.click({detail:0});
 assert.equal(app.$('modal').open,true);
 const sheet=app.$('modal-content');
 assert.ok(sheet.querySelector('.horse-profile'));
 assert.equal(sheet.querySelector('[data-place-relation]'),null);
 assert.ok(sheet.textContent.includes('年生')||sheet.textContent.includes('競走成績'));
 assert.equal(sheet.querySelector('.horse-profile-sources')!==null||sheet.querySelector('.horse-profile-empty')!==null,true);
 app.advance(1000);
 assert.equal(app.$('timer').textContent,'0:01','reading time counts toward ranked score');
 app.$('modal-close').click();
 // Opening/closing does not mutate actions, placed cards or mistakes.
 assert.deepEqual(app.storage().sessions, before.sessions);
 const card=app.$('hand').querySelector('[data-card]');
 card.click({detail:0});
 node.click({detail:0});
 assert.equal(app.$('modal').open,true);
 assert.ok(app.$('modal-content').querySelector('[data-place-relation]'));
 assert.equal(app.$('modal-content').querySelector('.horse-profile'),null);
});
