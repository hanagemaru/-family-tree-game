import {verifyHorseStage,verifyHorseActions} from './ranking-verification.js';
import {HORSE_SCORE_VERSION} from '../horse-score.js';

const PREFIX='/games/horse-pedigree/play';
const DIFFICULTIES=new Set(['easy','normal','hard']);
const corsHeaders={'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'};
const json=(payload,status=200)=>new Response(JSON.stringify(payload),{status,headers:corsHeaders});
const fail=(message,status=400)=>json({error:message},status);
const authPattern=/^Bearer ([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/;
const idPattern=/^[0-9a-f-]{36}$/;
const namePattern=/^[^<>]{1,16}$/u;

function binaryTo64(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function from64(value){const normalized=value.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(normalized+'='.repeat((4-normalized.length%4)%4)),c=>c.charCodeAt(0));}
const textBytes=s=>new TextEncoder().encode(s);
async function hash(value){const bytes=await crypto.subtle.digest('SHA-256',textBytes(value));return binaryTo64(new Uint8Array(bytes));}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let bits=0;for(let i=0;i<a.length;i++)bits|=a.charCodeAt(i)^b.charCodeAt(i);return bits===0;}
async function signingKey(secret){return crypto.subtle.importKey('raw',textBytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function signRun(payload,secret){
 const data=binaryTo64(textBytes(JSON.stringify(payload)));
 const signature=await crypto.subtle.sign('HMAC',await signingKey(secret),textBytes(data));
 return data+'.'+binaryTo64(new Uint8Array(signature));
}
async function readRun(token,secret){
 try{
  if(typeof token!=='string'||token.length>3000)return null;
  const parts=token.split('.');if(parts.length!==2)return null;
  const key=await signingKey(secret);
  const valid=await crypto.subtle.verify('HMAC',key,from64(parts[1]),textBytes(parts[0]));
  if(!valid)return null;
  const value=JSON.parse(new TextDecoder().decode(from64(parts[0])));
  if(!value||value.version!==1||typeof value.issuedAt!=='number'||Date.now()<value.issuedAt-15_000||
    Date.now()-value.issuedAt>8*60*60*1000||typeof value.runId!=='string')return null;
  return value;
 }catch{return null;}
}
function parseAuth(request){
 const match=authPattern.exec(request.headers.get('Authorization')||'');
 return match?{playerId:match[1],credential:match[2]}:null;
}
async function existingPlayer(db,identity){
 return db.prepare('SELECT player_id, credential_hash, display_name FROM players WHERE player_id = ?')
  .bind(identity.playerId).first();
}
async function authenticated(db,identity){
 const player=await existingPlayer(db,identity);if(!player)return null;
 return equal(player.credential_hash,await hash(identity.credential))?player:false;
}
function validName(name){return typeof name==='string'&&name.trim()===name&&namePattern.test(name)&&name.trim().length>=1;}
function sameOriginWrite(request){
 const origin=request.headers.get('Origin');
 return !origin||origin===new URL(request.url).origin;
}
async function readBody(request){
 if(Number(request.headers.get('content-length')||0)>32_768)return null;
 try{return await request.json();}catch{return null;}
}
async function allowRate(db,key,limit){
 const minute=Math.floor(Date.now()/60_000);
 await db.prepare("INSERT INTO rate_limits (key,window_start,hits) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN rate_limits.window_start=? THEN rate_limits.hits+1 ELSE 1 END, window_start=?")
 .bind(key,minute,minute,minute).run();
 const row=await db.prepare('SELECT hits FROM rate_limits WHERE key=?').bind(key).first();
 return row?.hits<=limit;
}
async function requireIdentity(request,env){
 const identity=parseAuth(request);
 if(!identity)return fail('ログイン情報がありません',401);
 const record=await authenticated(env.DB,identity);
 if(record===false)return fail('認証情報が一致しません',403);
 return {identity,record};
}
function rankingRow(row,yourId){
 return {rank:row.rank,name:row.display_name,scoreMs:row.score_ms,
  elapsedMs:row.elapsed_ms,penaltyMs:row.penalty_ms,isYou:row.player_id===yourId};
}
async function handleRankings(request,env,url){
 const difficulty=url.searchParams.get('difficulty');
 if(!DIFFICULTIES.has(difficulty))return fail('難易度が不正です');
 const limit=Math.max(1,Math.min(50,Number(url.searchParams.get('limit')||10)||10));
 const id=parseAuth(request);
 const credentials=id?await authenticated(env.DB,id):null;
 const player=credentials===false?null:credentials;
 const allSql='SELECT r.player_id,p.display_name,r.score_ms,r.elapsed_ms,r.penalty_ms,r.updated_at, ROW_NUMBER() OVER (ORDER BY r.score_ms,r.updated_at,r.player_id) AS rank FROM records r JOIN players p ON p.player_id=r.player_id WHERE r.difficulty=? AND r.score_version=?';
 const rows=await env.DB.prepare('SELECT * FROM ('+allSql+') ORDER BY rank LIMIT ?').bind(difficulty,HORSE_SCORE_VERSION,limit).all();
 const entries=(rows.results||[]).map(r=>rankingRow(r,player?.player_id));
 let yourRank=null,yourBest=null;
 if(player){
  const own=await env.DB.prepare('SELECT * FROM ('+allSql+') WHERE player_id=?').bind(difficulty,HORSE_SCORE_VERSION,player.player_id).first();
  if(own){
   yourRank=own.rank;yourBest=rankingRow(own,player.player_id);
   if(own.rank>limit){
    const nearby=await env.DB.prepare('SELECT * FROM ('+allSql+') WHERE rank BETWEEN ? AND ? ORDER BY rank')
     .bind(difficulty,HORSE_SCORE_VERSION,Math.max(1,own.rank-3),own.rank+3).all();
    const seen=new Set(entries.map(e=>e.rank));
    for(const row of nearby.results||[])if(!seen.has(row.rank)){entries.push(rankingRow(row,player.player_id));seen.add(row.rank);}
    entries.sort((a,b)=>a.rank-b.rank);
   }
  }
 }
 return json({entries,yourRank,yourBest,scoreVersion:HORSE_SCORE_VERSION});
}
async function handleStart(request,env,identity){
 if(!env.RANKING_SECRET||env.RANKING_SECRET.length<32)return fail('ランキング準備中',503);
 const body=await readBody(request);
 const verified=verifyHorseStage(body);
 if(!verified.valid)return fail('出題の検証に失敗: '+verified.reason,422);
 if(!await allowRate(env.DB,'start:'+identity.playerId,20))return fail('開始回数の上限です',429);
 const issuedAt=Date.now();
 const payload={version:1,runId:crypto.randomUUID(),playerId:identity.playerId,issuedAt,
  stageId:body.stageId,seed:body.seed,difficulty:body.difficulty,
  horseIds:body.horseIds,generatorVersion:body.generatorVersion};
 const ticket=await signRun(payload,env.RANKING_SECRET);
 return json({ticket,issuedAt,expiresAt:issuedAt+8*60*60*1000});
}
async function handlePlayer(request,env,identity,record){
 if(request.method==='DELETE'){
  if(!record)return json({ok:true});
  await env.DB.batch([
   env.DB.prepare('DELETE FROM submissions WHERE player_id=?').bind(identity.playerId),
   env.DB.prepare('DELETE FROM records WHERE player_id=?').bind(identity.playerId),
   env.DB.prepare('DELETE FROM players WHERE player_id=?').bind(identity.playerId)]);
  return json({ok:true});
 }
 const body=await readBody(request);
 if(!validName(body?.displayName))return fail('表示名は1〜16文字で入力してください');
 const hashed=await hash(identity.credential);
 await env.DB.prepare("INSERT INTO players(player_id,credential_hash,display_name) VALUES(?,?,?) ON CONFLICT(player_id) DO UPDATE SET display_name=excluded.display_name,updated_at=CURRENT_TIMESTAMP")
  .bind(identity.playerId,hashed,body.displayName).run();
 return json({ok:true});
}
async function handleRecord(request,env,identity,record){
 if(!env.RANKING_SECRET||env.RANKING_SECRET.length<32)return fail('ランキング準備中',503);
 if(!await allowRate(env.DB,'record:'+identity.playerId,12))return fail('送信回数の上限です',429);
 const body=await readBody(request);
 if(!body||!validName(body.displayName)||!idPattern.test(body.submissionId||'')||
  !Number.isInteger(body.elapsedMs)||!Number.isInteger(body.scoreMs))return fail('送信形式が不正です');
 const ticket=await readRun(body.runTicket,env.RANKING_SECRET);
 if(!ticket||ticket.playerId!==identity.playerId||
   ticket.stageId!==body.stageId||ticket.difficulty!==body.difficulty||ticket.seed!==body.seed||
   ticket.generatorVersion!==body.generatorVersion||
   JSON.stringify(ticket.horseIds)!==JSON.stringify(body.horseIds))return fail('開始証明が無効・期限切れです',422);
 if(body.elapsedMs>Date.now()-ticket.issuedAt+15_000)return fail('経過時間が一致しません',422);
 const old=await env.DB.prepare('SELECT player_id,response_json FROM submissions WHERE run_id=?').bind(ticket.runId).first();
 if(old)return old.player_id===identity.playerId?json(JSON.parse(old.response_json)):fail('登録済みの問題です',409);
 const description=verifyHorseStage(ticket);
 if(!description.valid)return fail('問題の検証に失敗しました',422);
 const proof=verifyHorseActions(description.stage,ticket.seed,body.actions,body.elapsedMs,body.scoreMs);
 if(!proof.valid)return fail('操作履歴の検証に失敗: '+proof.reason,422);
 const score=proof.score;
 const hashed=await hash(identity.credential);
 if(record===false)return fail('認証情報が一致しません',403);
 if(!record){
  await env.DB.prepare('INSERT INTO players(player_id,credential_hash,display_name) VALUES(?,?,?)')
   .bind(identity.playerId,hashed,body.displayName).run();
 }else{
  await env.DB.prepare('UPDATE players SET display_name=?,updated_at=CURRENT_TIMESTAMP WHERE player_id=?')
   .bind(body.displayName,identity.playerId).run();
 }
 const previous=await env.DB.prepare('SELECT score_ms FROM records WHERE player_id=? AND difficulty=? AND score_version=?')
 .bind(identity.playerId,body.difficulty,HORSE_SCORE_VERSION).first();
 const newBest=!previous||score.totalMs<previous.score_ms;
 if(newBest){
  await env.DB.prepare("INSERT INTO records(player_id,difficulty,score_version,score_ms,elapsed_ms,penalty_ms,stage_id,seed,horse_ids_json,actions_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(player_id,difficulty,score_version) DO UPDATE SET score_ms=excluded.score_ms,elapsed_ms=excluded.elapsed_ms,penalty_ms=excluded.penalty_ms,stage_id=excluded.stage_id,seed=excluded.seed,horse_ids_json=excluded.horse_ids_json,actions_json=excluded.actions_json,updated_at=CURRENT_TIMESTAMP WHERE excluded.score_ms < records.score_ms")
  .bind(identity.playerId,body.difficulty,HORSE_SCORE_VERSION,score.totalMs,score.timeMs,score.penaltyMs,
    body.stageId,body.seed,JSON.stringify(body.horseIds),JSON.stringify(body.actions)).run();
 }
 const ranking=await handleRankings(request,env,new URL(request.url+'?difficulty='+body.difficulty+'&limit=1'));
 const payload=await ranking.json();
 const response={accepted:true,newBest,rank:payload.yourRank,scoreMs:score.totalMs,status:'verified'};
 await env.DB.prepare("INSERT INTO submissions(run_id,player_id,submission_id,response_json) VALUES(?,?,?,?)")
  .bind(ticket.runId,identity.playerId,body.submissionId,JSON.stringify(response)).run();
 return json(response);
}
export async function handleRequest(request,env){
 const url=new URL(request.url);
 let pathname=url.pathname;
 if(pathname===PREFIX)pathname='/';
 else if(pathname.startsWith(PREFIX+'/'))pathname=pathname.slice(PREFIX.length);
 if(pathname.startsWith('/api/')){
  if(!env.DB)return fail('ランキング準備中',503);
  if(request.method==='GET'&&pathname==='/api/health')return json({ok:true});
  if(request.method==='GET'&&pathname==='/api/rankings')return handleRankings(request,env,url);
  if(!sameOriginWrite(request))return fail('Origin not allowed',403);
  const authorization=await requireIdentity(request,env);
  if(authorization instanceof Response)return authorization;
  const {identity,record}=authorization;
  if(request.method==='POST'&&pathname==='/api/runs')return handleStart(request,env,identity);
  if(pathname==='/api/player'&&['PUT','DELETE'].includes(request.method))return handlePlayer(request,env,identity,record);
  if(request.method==='POST'&&pathname==='/api/records')return handleRecord(request,env,identity,record);
  return fail('Not found',404);
 }
 if(request.method!=='GET'&&request.method!=='HEAD')return fail('Not found',404);
 if(!env.ASSETS)return new Response('Not Found',{status:404});
 const assetUrl=new URL(request.url);
 assetUrl.pathname=pathname;
 const response=await env.ASSETS.fetch(new Request(assetUrl,request));
 return response;
}
export default {fetch:handleRequest};
