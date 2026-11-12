import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateRandomHorseSession,restoreRandomHorseSession} from '../src/random-horse-session.js';

const snapshot=JSON.parse(readFileSync(new URL('../data/horse-pedigree.v1.json',import.meta.url),'utf8'));

test('random session descriptor reproduces the exact seed, data version and 18-card order',()=>{
 const created=generateRandomHorseSession(snapshot,'ui-save-17');
 const restored=restoreRandomHorseSession(snapshot,JSON.parse(JSON.stringify(created.descriptor)));
 assert.ok(restored);
 assert.deepEqual(restored.descriptor,created.descriptor);
 assert.deepEqual(restored.stage,created.stage);
 assert.equal(restored.descriptor.cardIds.length,18);
});

test('random session refuses incompatible data versions or a changed question set',()=>{
 const {descriptor}=generateRandomHorseSession(snapshot,'ui-save-18');
 assert.equal(restoreRandomHorseSession(snapshot,{...descriptor,snapshotVersion:'future-data'}),null);
 const changed={...descriptor,cardIds:[...descriptor.cardIds]};changed.cardIds[0]='Q1';
 assert.equal(restoreRandomHorseSession(snapshot,changed),null);
});
