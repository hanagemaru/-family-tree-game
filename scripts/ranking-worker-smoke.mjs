/** End-to-end local Cloudflare Worker + D1 ranking flow; no production writes. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import {generateRandomHorseSession} from '../src/random-horse-session.js';
import {CURRENT_HORSE_GENERATOR_VERSION,seededRandom} from '../src/random-horse-stage.js';
import {newGame,place} from '../src/core.js';
import {findPlayablePlacement} from '../src/game-assistance.js';
import {horseScore,useHorseHint} from '../src/horse-score.js';
const pedigree=JSON.parse(readFileSync('data/horse-pedigree.v1.json','utf8'));
const fameSnapshot=JSON.parse(readFileSync('data/horse-fame-2026-10.v1.json','utf8'));
const port=8799,base='http://127.0.0.1:'+port+'/games/horse-pedigree/play/';
const identity={playerId:randomUUID(),credential:randomBytes(32).toString('base64url')};
const auth='Bearer '+identity.playerId+'.'+identity.credential;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(path,{method='GET',body,authorization=auth,origin}={}){
 const headers={...(authorization?{'Authorization':authorization}:{}),...(body?{'Content-Type':'application/json'}:{}),...(origin?{'Origin':origin}:{})};
 const response=await fetch(base+'api/'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
 let data;try{data=await response.json();}catch{data={};}
 return {status:response.status,data};
}
function session(seed='worker-smoke-1',difficulty='normal'){
 const generated=generateRandomHorseSession(pedigree,seed,{version:CURRENT_HORSE_GENERATOR_VERSION,difficulty,fameSnapshot});
 const state=newGame(generated.stage,seededRandom('deck:'+seed));
 let k=0;
 while(!state.complete){
  const move=findPlayablePlacement(state);
  assert.ok(move);
  state.elapsed=500+k*800;
  if(k===0){
   assert.equal(useHorseHint(state,move.cardId),true);
   const wrong=['parent','child','sibling'].find(r=>r!==move.relation);
   assert.equal(place(state,move.cardId,move.anchorId,wrong).ok,false);
  }
  assert.equal(place(state,move.cardId,move.anchorId,move.relation,{auto:k===0}).ok,true);
  k++;
 }
 state.elapsed=12000;
 return {generated,state,score:horseScore(state)};
}
async function waitForServer(){
 let reason='';
 for(let i=0;i<180;i++){
  try{const result=await api('health',{authorization:null});if(result.status===200)return;}
  catch(e){reason=e.message;}
  await sleep(200);
 }
 throw Error('Worker did not start: '+reason);
}
const child=spawn('npx',['--yes','wrangler@4.47.0','dev','--config','wrangler.test.jsonc','--local','--port',String(port),'--ip','127.0.0.1','--persist-to','.wrangler/state'],{stdio:'pipe',detached:true,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
let output='';
child.stdout.on('data',chunk=>output+=chunk.toString());
child.stderr.on('data',chunk=>output+=chunk.toString());
try{
 await waitForServer();
 const html=await fetch(base);
 assert.equal(html.status,200,'horse game HTML should be accessible at exact hub path');
 assert.match(await html.text(),/競走馬血統ならべ/);
 const {generated,state,score}=session();
 const descriptor=generated.descriptor;
 const payload={stageId:descriptor.stageId,seed:descriptor.seed,difficulty:descriptor.difficulty,horseIds:descriptor.cardIds,generatorVersion:descriptor.generatorVersion};
 const start=await api('runs',{method:'POST',body:payload});
 assert.equal(start.status,200,JSON.stringify(start.data));
 assert.ok(start.data.ticket);
 const raw={submissionId:randomUUID(),displayName:'Tester',runTicket:start.data.ticket,
  ...payload,elapsedMs:score.timeMs,scoreMs:score.totalMs,actions:state.actions};
 const fake=await api('records',{method:'POST',body:{...raw,scoreMs:score.totalMs-15_000}});
 assert.equal(fake.status,422,'underreported penalties must fail: '+JSON.stringify(fake.data));
 const foreign=await api('records',{method:'POST',body:raw,origin:'https://invalid.example'});
 assert.equal(foreign.status,403,'cross-origin write rejected');
 const submit=await api('records',{method:'POST',body:raw});
 assert.equal(submit.status,200,JSON.stringify(submit.data));
 assert.equal(submit.data.accepted,true);
 assert.equal(submit.data.newBest,true);
 assert.equal(submit.data.rank,1);
 const duplicate=await api('records',{method:'POST',body:raw});
 assert.equal(duplicate.status,200,JSON.stringify(duplicate.data));
 assert.deepEqual(duplicate.data,submit.data);
 const ranking=await api('rankings?difficulty=normal&limit=10');
 assert.equal(ranking.status,200,JSON.stringify(ranking.data));
 assert.equal(ranking.data.entries.length,1);
 assert.equal(ranking.data.entries[0].scoreMs,score.totalMs);
 assert.equal(ranking.data.entries[0].isYou,true);
 const wrongCredential='Bearer '+identity.playerId+'.'+randomBytes(32).toString('base64url');
 const badAuth=await api('player',{method:'PUT',authorization:wrongCredential,body:{displayName:'Bad'}});
 assert.equal(badAuth.status,403);
 const renamed=await api('player',{method:'PUT',body:{displayName:'Tester2'}});
 assert.equal(renamed.status,200);
 const refreshed=await api('rankings?difficulty=normal');
 assert.equal(refreshed.data.entries[0].name,'Tester2');
 const second=session('worker-smoke-2');
 second.state.elapsed=14_000;
 const secondScore=horseScore(second.state);
 const next=second.generated.descriptor;
 const started=await api('runs',{method:'POST',body:{stageId:next.stageId,seed:next.seed,difficulty:next.difficulty,horseIds:next.cardIds,generatorVersion:next.generatorVersion}});
 assert.equal(started.status,200);
 const slower=await api('records',{method:'POST',body:{
  submissionId:randomUUID(),displayName:'Tester2',runTicket:started.data.ticket,
  stageId:next.stageId,seed:next.seed,difficulty:next.difficulty,horseIds:next.cardIds,generatorVersion:next.generatorVersion,
  elapsedMs:secondScore.timeMs,scoreMs:secondScore.totalMs,actions:second.state.actions
 }});
 assert.equal(slower.status,200,JSON.stringify(slower.data));
 assert.equal(slower.data.newBest,false,'slower records must not replace own best');
 const still=await api('rankings?difficulty=normal');
 assert.equal(still.data.entries.length,1);
 assert.equal(still.data.entries[0].scoreMs,score.totalMs);
 const deletion=await api('player',{method:'DELETE'});
 assert.equal(deletion.status,200);
 const gone=await api('rankings?difficulty=normal');
 assert.equal(gone.data.entries.length,0);
 console.log('HORSE_RANKING_WORKER_SMOKE_SUCCESS: signed start, replay, score reject, origin/auth, unique best, rename, delete, static hub path');
}catch(e){console.error(output.slice(-9000));throw e;}
finally{try{process.kill(-child.pid,'SIGTERM');}catch{}child.stdout.destroy();child.stderr.destroy();child.unref();}
