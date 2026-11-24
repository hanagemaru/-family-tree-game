import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {acquisitionSource,gameplayAnalyticsEnabled,createTracker,SESSION_IDLE_MS} from '../src/gameplay-analytics.js';
import {receiveGameplay,validPayload} from '../src/server/gameplay-analytics.js';

const GOOD={hostname:'hanage.app',pathname:'/games/horse-pedigree/play/',search:''};
const uuid=(n)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function harness(over={}){
 let t=1_000_000,n=0;const calls=[],store=new Map();
 const tracker=createTracker({location:{...GOOD,...over},referrer:'',
  storage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},
  fetchImpl:async(url,init)=>{calls.push(JSON.parse(init.body));return {ok:true};},
  cryptoSource:{randomUUID:()=>uuid(++n)},now:()=>t});
 return {tracker,calls,advance:ms=>{t+=ms;}};
}
const flush=()=>new Promise(r=>setTimeout(r,0));

test('source classification uses fixed categories only',()=>{
 assert.equal(acquisitionSource('?utm_source=x&utm_medium=cpc',''),'x_ads');
 assert.equal(acquisitionSource('?utm_source=x&utm_medium=share',''),'x_share');
 assert.equal(acquisitionSource('?utm_source=share&utm_medium=share',''),'share');
 assert.equal(acquisitionSource('','https://t.co/abc'),'x_other');
 assert.equal(acquisitionSource('','https://hanage.app/games/'),'hub');
 assert.equal(acquisitionSource('','https://www.google.com/search?q=x'),'search');
 assert.equal(acquisitionSource('','https://example.com/secret'),'other');
 assert.equal(acquisitionSource('?utm_source=anything',''),'direct');
});
test('only the production hub game path is measured',()=>{
 assert.equal(gameplayAnalyticsEnabled(GOOD),true);
 assert.equal(gameplayAnalyticsEnabled({...GOOD,hostname:'localhost'}),false);
 assert.equal(gameplayAnalyticsEnabled({...GOOD,pathname:'/games/horse-pedigree/'}),false);
 assert.equal(gameplayAnalyticsEnabled({...GOOD,search:'?debug=1'}),false);
});
test('tracker sends visit once, then one start and one complete per play',async()=>{
 const {tracker,calls}=harness();
 tracker.visit();tracker.visit();
 tracker.play('normal');tracker.play('normal');tracker.complete('clear');tracker.complete('clear');
 await flush();
 assert.deepEqual(calls.map(c=>c.event),['visit','start','start','complete']);
 assert.notEqual(calls[1].run,calls[2].run,'each play has its own run ID');
 assert.equal(calls[3].run,calls[2].run);
 assert.equal(calls[3].difficulty,'normal');assert.equal(calls[3].outcome,'clear');
 assert.equal(new Set(calls.map(c=>c.session)).size,1);
 for(const c of calls)assert.ok(validPayload(c),JSON.stringify(c));
});
test('resumed saves are not counted as new starts; non-ranked stages are ignored',async()=>{
 const {tracker,calls}=harness();
 tracker.play('hard',{resumed:true});tracker.complete('gaveup');
 tracker.play(null);tracker.complete('clear');
 await flush();
 assert.deepEqual(calls.map(c=>c.event),['visit','complete']);
 assert.equal(calls[1].outcome,'gaveup');
});
test('session renews after 30 idle minutes and nothing is sent off-path',async()=>{
 const a=harness();a.tracker.visit();a.advance(SESSION_IDLE_MS-1);a.tracker.play('easy');a.advance(SESSION_IDLE_MS);a.tracker.play('easy');
 await flush();
 const sessions=[...new Set(a.calls.map(c=>c.session))];
 assert.equal(sessions.length,2);
 const off=harness({hostname:'example.com'});off.tracker.visit();off.tracker.play('easy');await flush();
 assert.equal(off.calls.length,0);
});
test('failed sends never throw into the game',()=>{
 const tracker=createTracker({location:GOOD,storage:null,fetchImpl:()=>{throw new Error('offline');},cryptoSource:{randomUUID:()=>uuid(1)}});
 assert.doesNotThrow(()=>{tracker.visit();tracker.play('easy');tracker.complete('clear');});
});

// ---- server, against a real SQLite database built from the migration ----
function database(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(readFileSync(new URL('../migrations/0002_gameplay_events.sql',import.meta.url),'utf8'));
 const wrap=(sql,args=[])=>({bind:(...a)=>wrap(sql,a),run:()=>sqlite.prepare(sql).run(...args)});
 return {sqlite,DB:{prepare:sql=>wrap(sql),batch:async list=>{for(const s of list)s.run();}}};
}
const post=(body,{origin='https://hanage.app',headers={}}={})=>new Request('https://hanage.app/games/horse-pedigree/play/api/gameplay-events',
 {method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{}),...headers},body:typeof body==='string'?body:JSON.stringify(body)});
const visit={session:uuid(1),source:'direct',event:'visit',run:'',difficulty:'none',outcome:'none'};
const start={...visit,event:'start',run:uuid(2),difficulty:'normal'};
const done={...start,event:'complete',outcome:'clear'};

test('server is inert unless the mode is enabled',async()=>{
 const {sqlite,DB}=database();
 for(const mode of [undefined,'off','preview']){
  assert.equal((await receiveGameplay(post(visit),{DB,GAMEPLAY_ANALYTICS_MODE:mode})).status,204);
 }
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM gameplay_events').get().n,0);
});
test('server stores visit/start/complete once each and counts plays',async()=>{
 const {sqlite,DB}=database(),env={DB,GAMEPLAY_ANALYTICS_MODE:'production'};
 for(const body of [visit,start,start,done,done,{...start,run:uuid(3)}])assert.equal((await receiveGameplay(post(body),env)).status,204);
 const count=e=>sqlite.prepare('SELECT COUNT(*) AS n FROM gameplay_events WHERE event=?').get(e).n;
 assert.equal(count('visit'),1);assert.equal(count('start'),2);assert.equal(count('complete'),1);
});
test('server rejects bad origin, extras, credentials, malformed and oversized input',async()=>{
 const {sqlite,DB}=database(),env={DB,GAMEPLAY_ANALYTICS_MODE:'production'};
 const status=async(req)=>(await receiveGameplay(req,env)).status;
 assert.equal(await status(post(visit,{origin:'https://evil.example'})),403);
 assert.equal(await status(post(visit,{origin:null})),403);
 assert.equal(await status(post(visit,{headers:{Authorization:'Bearer x'}})),400);
 assert.equal(await status(post({...visit,url:'https://x'})),400);
 assert.equal(await status(post({...start,difficulty:'none'})),400);
 assert.equal(await status(post({...done,outcome:'none'})),400);
 assert.equal(await status(post({...visit,source:'https://t.co/x'})),400);
 assert.equal(await status(post('{nope')),400);
 assert.equal(await status(post({...visit,pad:'x'.repeat(2000)})),413);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM gameplay_events').get().n,0);
});
test('server deletes rows older than 30 days on receive',async()=>{
 const {sqlite,DB}=database();
 sqlite.prepare("INSERT INTO gameplay_events VALUES (?,?,?,?,?,?,?)").run(uuid(9),'visit','','direct','none','none',Date.now()-31*86400000);
 await receiveGameplay(post(visit),{DB,GAMEPLAY_ANALYTICS_MODE:'production'});
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM gameplay_events WHERE session_id=?').get(uuid(9)).n,0);
});
