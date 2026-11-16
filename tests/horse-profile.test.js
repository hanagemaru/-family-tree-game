import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {horseProfileHtml,horseProfileSources} from '../src/horse-profile.js';
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
 assert.ok(manifest.coverage.withProfileFacts>=500,'at least 500 horses need confirmed profile facts');
 assert.equal(manifest.coverage.named,872);
 assert.ok(manifest.coverage.withRaceRecord>=500,'explicit lifetime records should be broadly present');
 assert.ok(manifest.coverage.withWins>=500,'sourced winning achievements need broad coverage');
 assert.ok(manifest.coverage.editoriallyCorroborated>=45);
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
 const derby=Object.values(manifest.horses).filter(p=>p.majorWins.some(w=>w.race==='日本ダービー')&&p.majorWins.some(w=>w.race==='東京優駿'));
 assert.equal(derby.length,0,'synonymous Japan Derby race names must not double-count');
 // Partial-season 8 starts / 6 wins is not Gold Ship's all-time record.
 const teio=Object.values(manifest.horses).find(x=>x.name==='トウカイテイオー');
 assert.equal(teio.majorWins.filter(w=>w.race==='ジャパンカップ').length,1,'Japan Cup aliases should not double-count');
 const deep=Object.values(manifest.horses).find(x=>x.name==='ディープインパクト');
 assert.ok(deep.raceRecord?.starts>=14,'well-known horses gain their explicit lifetime record');
 const gold=Object.values(manifest.horses).find(x=>x.name==='ゴールドシップ');
 if(gold){
  assert.notDeepEqual(gold.raceRecord,{starts:8,wins:6});
  assert.deepEqual(gold.majorWins.filter(w=>w.race==='宝塚記念').map(w=>w.year).sort(),[2013,2014]);
 }
});
test('single placed horse shows achievements without per-card sources or photo credits',()=>{
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
 assert.doesNotMatch(output,/出典：|horse-profile-sources|horse-profile-photo-credit/);
 assert.ok(horseProfileSources(data).length,'source data is still retained for centralized credits');
 assert.ok(!output.includes('parent')&&!output.includes('父：')&&!output.includes('母：'));
 assert.ok(output.includes('commons.wikimedia.org')&&output.includes('horse-profile-photo'));
 assert.ok(!output.includes('関係を見る'),'remove redundant relationship-highlighting button');
});
test('new JBIS-reviewed horses include correctly scoped race records and non-spoiler facts',()=>{
 const checks=[
  ['キングヘイロー',27,6,'高松宮記念'],
  ['ヴィルシーナ',21,5,'ヴィクトリアマイル'],
  ['カレンブーケドール',17,2,null],
  ['フジキセキ',4,4,'朝日杯3歳ステークス'],
  ['デアリングバード',1,0,null],
  ['センテリュオ',18,5,'オールカマー'],
  ['ホッコータルマエ',39,17,'東京大賞典'],
  ['ダンツフレーム',26,6,'宝塚記念'],
  ['ブチコ',16,4,null],
  ['ビワハイジ',10,4,'阪神3歳牝馬ステークス'],
  ['デアリングハート',26,4,'府中牝馬ステークス'],
  ['ポイントフラッグ',15,1,null],
  ['マツリダゴッホ',27,10,'有馬記念'],
  ['サクラユタカオー',12,6,'天皇賞（秋）'],
 ];
 for(const [name,starts,wins,race] of checks){
  const p=Object.values(manifest.horses).find(h=>h.name===name);
  assert.ok(p,name+' should be indexed');
  assert.deepEqual(p.raceRecord,{starts,wins},name);
  assert.ok(p.description.length,name);
  assert.ok(p.sources.some(s=>s.url.startsWith('https://www.jbis.or.jp/horse/')),name);
  if(race)assert.ok(p.majorWins.some(w=>w.race===race),name);
 }
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
 assert.doesNotMatch(html,/https:\/\/www\.wikidata\.org\/wiki\/Q1/);
 assert.deepEqual(horseProfileSources({sources:[{label:'bad',url:'javascript:alert(1)'},{label:'Wikidata',url:'https://www.wikidata.org/wiki/Q1'}]}),[{label:'Wikidata',url:'https://www.wikidata.org/wiki/Q1'}]);
});
test('profile overlay hides close button and backdrop tap dismisses without affecting state',async t=>{
 const app=await loadApp();t.after(()=>app.restore());
 app.$('stage-list').querySelector('[data-random-start]').click();
 const node=app.$('nodes').querySelector('[data-node]');
 node.click({detail:0});
 const modal=app.$('modal');
 assert.equal(modal.open,true);
 assert.equal(modal.classList.contains('horse-profile-dialog'),true);
 assert.ok(app.$('modal-close'),'the existing button remains for other dialogs');
 modal.fire('click',{target:modal,clientX:-10,clientY:-10});
 assert.equal(modal.open,false);
 assert.equal(modal.classList.contains('horse-profile-dialog'),false);
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
 assert.equal(sheet.querySelector('.horse-profile-sources'),null);
 app.advance(1000);
 assert.equal(app.$('timer').textContent,'0:01','reading time counts toward ranked score');
 app.$('modal-close').click();
 app.$('menu-button').click();
 const sourceAction=app.$('modal-content').querySelector('[data-action="sources"]');
 assert.ok(sourceAction);
 sourceAction.click();
 assert.match(app.$('modal-content').textContent,/題材・出典/);
 assert.ok(app.$('modal-content').querySelector('.profile-credits'),'placed horse sources are available in the global credits');
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
