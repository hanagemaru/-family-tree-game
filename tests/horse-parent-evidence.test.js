import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifiedParentNames,verifiedDamName} from '../src/horse-parent-evidence.js';
import {verifiedOfficialDamName} from '../src/horse-official-dam-spellings.js';
const snapshot=JSON.parse(readFileSync(new URL('../data/horse-pedigree.v1.json',import.meta.url),'utf8'));

test('Wikimedia mother-name facts match a unique QID, horse name, year and cited revision',()=>{
 const records=Object.entries(verifiedParentNames);
 assert.equal(records.length,632);
 const byId=new Map(snapshot.horses.map(h=>[h.id,h]));
 for(const [id,record] of records){
  assert.match(id,/^Q[1-9]\d+$/);
  const horse=byId.get(id);
  assert.ok(horse,'source QID '+id);
  assert.equal(record.name,horse.name);
  assert.equal(record.year,horse.birthYear);
  if(horse.dam)assert.equal(byId.get(horse.dam)?.named,false,'supplement only unresolved mother QID labels');
  assert.ok(record.dam?.length>1);
  assert.ok(record.url.startsWith('https://ja.wikipedia.org/wiki/'));
  assert.ok(Number.isInteger(record.revision)&&record.revision>0);
  assert.equal(record.wiki,'ja');
  assert.deepEqual(verifiedDamName(horse),{name:record.dam,source:record.url});
 }
});

test('do not infer a parent for a mismatched year, QID or name',()=>{
 assert.equal(verifiedDamName({id:'Q11321082',name:'トウカイテイオー',birthYear:1990}),null);
 assert.equal(verifiedDamName({id:'Q11321082',name:'別馬',birthYear:1988}),null);
 assert.equal(verifiedDamName({id:'Q99999999999',name:'トウカイテイオー',birthYear:1988}),null);
});

test('all Wikipedia infobox facts agree with the frozen audit file and have author revision references',()=>{
 const audit=JSON.parse(readFileSync(new URL('../data/source/wikipedia-dam-evidence.v1.json',import.meta.url),'utf8'));
 assert.equal(audit.counts.sourceMissing,688);
 assert.equal(audit.counts.withoutMotherQid,601);
 assert.equal(audit.counts.withUnnamedMotherQid,87);
 assert.equal(audit.counts.addedNamesForExistingQids,82);
 assert.equal(audit.counts.found,632);
 assert.equal(audit.counts.unresolved,56);
 assert.equal(Object.keys(audit.records).length,632);
 for(const [id,claim] of Object.entries(audit.records)){
  const runtime=verifiedParentNames[id];
  assert.ok(runtime,'missing generated JS entry '+id);
  assert.equal(runtime.dam,claim.dam);
  assert.equal(runtime.name,claim.name);
  assert.equal(runtime.year,claim.year);
  assert.equal(runtime.url,claim.url);
  assert.equal(runtime.revision,claim.revision);
 }
});

test('JRA registered dam spelling takes precedence where Wikipedia uses a simplified spelling',()=>{
 const snapHorse=snapshot.horses.find(h=>h.id==='Q11321082');
 assert.ok(snapHorse);
 assert.equal(verifiedDamName(snapHorse).name,'トウカイナチュラル');
 const source=verifiedOfficialDamName(snapHorse);
 assert.equal(source.name,'トウカイナチユラル');
 assert.ok(source.source.startsWith('https://www.jra.go.jp/'));
 assert.equal(verifiedOfficialDamName({...snapHorse,birthYear:1990}),null);
});
