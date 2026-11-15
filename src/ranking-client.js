/** Anonymous credentials, per difficulty personal best, and same-origin ranking API. */
export const RANKING_STORAGE_KEY='horse-pedigree:ranking-identity:v1';
const endpoint=path=>'./api/'+path;
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export function playerIdentity(storage=localStorage,cryptoSource=globalThis.crypto){
 try{
  const item=JSON.parse(storage.getItem(RANKING_STORAGE_KEY)||'null');
  if(item&&/^[0-9a-f-]{36}$/.test(item.playerId)&&/^[A-Za-z0-9_-]{43}$/.test(item.credential))return item;
 }catch{}
 const identity={playerId:cryptoSource.randomUUID(),credential:b64(cryptoSource.getRandomValues(new Uint8Array(32)))};
 storage.setItem(RANKING_STORAGE_KEY,JSON.stringify(identity));return identity;
}
export function rankingName(storage=localStorage){return storage.getItem('horse-pedigree:ranking-name')||'';}
export function saveRankingName(name,storage=localStorage){storage.setItem('horse-pedigree:ranking-name',name);}
function auth(identity){return {'Authorization':'Bearer '+identity.playerId+'.'+identity.credential};}
async function api(path,{method='GET',identity=null,body=null}={}){
 const headers={'Accept':'application/json',...(body?{'Content-Type':'application/json'}:{}),...(identity?auth(identity):{})};
 const response=await fetch(endpoint(path),{method,headers,...(body?{body:JSON.stringify(body)}:{})});
 let json;try{json=await response.json();}catch{throw Error('ランキングサーバーを利用できません');}
 if(!response.ok)throw Error(json.error||'ランキングサーバーとの通信に失敗しました');
 return json;
}
export function createRankedRun(identity,descriptor){return api('runs',{method:'POST',identity,body:{
 stageId:descriptor.stageId,seed:descriptor.seed,difficulty:descriptor.difficulty,
 horseIds:descriptor.cardIds,generatorVersion:descriptor.generatorVersion
}});}
export function loadRankings(difficulty,identity){return api('rankings?difficulty='+encodeURIComponent(difficulty)+'&limit=10',{identity});}
export function submitRankedScore(identity,run,descriptor,state,score,displayName,submissionId=crypto.randomUUID()){
 return api('records',{method:'POST',identity,body:{
  submissionId,displayName,runTicket:run.ticket,
  stageId:descriptor.stageId,difficulty:descriptor.difficulty,
  generatorVersion:descriptor.generatorVersion,seed:descriptor.seed,horseIds:descriptor.cardIds,
  elapsedMs:score.timeMs,scoreMs:score.totalMs,actions:state.actions||[],
 }});
}
export function updateRankingName(identity,displayName){return api('player',{method:'PUT',identity,body:{displayName}});}
export function deleteRankingAccount(identity){return api('player',{method:'DELETE',identity});}
