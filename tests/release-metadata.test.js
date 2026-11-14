import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const text=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('official brand, metadata and icon all use the selected horse-only title',()=>{
 const html=text('index.html'),favicon=text('favicon.svg');
 assert.match(html,/<title>競走馬血統ならべ/);
 assert.match(html,/name="description" content="競走馬/);
 assert.match(html,/property="og:title" content="競走馬血統ならべ"/);
 assert.match(html,/NARABE SERIES/);
 assert.doesNotMatch(html,/徳川|徳川家康|徳川秀忠|歴史と名馬|家系図ならべ/);
 assert.match(favicon,/<svg/);
 assert.match(favicon,/競走馬血統ならべ/);
 const manifest=JSON.parse(text('manifest.webmanifest'));
 assert.equal(manifest.name,'競走馬血統ならべ');
 assert.equal(manifest.start_url,'./');
 assert.equal(manifest.display,'standalone');
 assert.ok(manifest.icons.length);
});

test('static production build includes every launch stylesheet and manifest',()=>{
 const build=text('scripts/build.mjs');
 for(const name of ['launch.css','sports-card.css','favicon.svg','manifest.webmanifest'])assert.ok(build.includes(name),name);
});
