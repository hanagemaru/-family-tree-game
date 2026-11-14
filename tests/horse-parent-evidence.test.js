import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifiedParentNames,verifiedDamName} from '../src/horse-parent-evidence.js';
const snapshot=JSON.parse(readFileSync(new URL('../data/horse-pedigree.v1.json',import.meta.url),'utf8'));

test('Wikimedia mother-name facts match a unique QID, horse name, year and cited revision',()=>{
 const records=Object.entries(verifiedParentNames);
 assert.equal(records.length,550);
 const byId=new Map(snapshot.horses.map(h=>[h.id,h]));
 for(const [id,record] of records){
  assert.match(id,/^Q[1-9]\d+$/);
  const horse=byId.get(id);
  assert.ok(horse,'source QID '+id);
  assert.equal(record.name,horse.name);
  assert.equal(record.year,horse.birthYear);
  assert.equal(horse.dam,null,'do not overwrite known dam');
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
