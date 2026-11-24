/**
 * Minimal play counting. Stores nothing permanent: a random ID per browser-tab visit
 * (sessionStorage, renewed after 30 idle minutes), a fixed acquisition category,
 * and one `start` / `complete` event per play. Never sends URLs, referrers, UTM text,
 * ranking identities or moves.
 */
export const SOURCES=['x_ads','x_share','x_other','share','hub','search','other','direct'];
export const DIFFICULTIES=['easy','normal','hard'];
export const OUTCOMES=['clear','gaveup'];
export const SESSION_IDLE_MS=30*60*1000;
export const RETENTION_MS=30*86400000;
export const MAX_BODY_BYTES=1024;
export const GAME_HOST='hanage.app';
export const GAME_PATHS=['/games/horse-pedigree/play/','/games/horse-pedigree/play/index.html'];
const SESSION_KEY='horse-pedigree:gameplay-session-v1';

export function acquisitionSource(search,referrer){
 const params=new URLSearchParams(search);
 const source=params.get('utm_source')?.toLowerCase(),medium=params.get('utm_medium')?.toLowerCase();
 if(source==='share'&&medium==='share')return 'share';
 if(source==='x'||source==='twitter'){
  if(medium==='cpc'||medium==='paid_social')return 'x_ads';
  return medium==='share'?'x_share':'x_other';
 }
 let host='';try{host=new URL(referrer).hostname;}catch{}
 if(['t.co','x.com','twitter.com'].includes(host))return 'x_other';
 if(['hanage.app','www.hanage.app'].includes(host))return 'hub';
 if(/^(www\.)?(google\.(com|co\.jp)|bing\.com|search\.yahoo\.co\.jp)$/.test(host))return 'search';
 return host?'other':'direct';
}
export function gameplayAnalyticsEnabled(location){
 if(!location||location.hostname!==GAME_HOST||!GAME_PATHS.includes(location.pathname))return false;
 return !new URLSearchParams(location.search).has('debug');
}
function defaultStorage(){try{return globalThis.sessionStorage;}catch{return null;}}

export function createTracker({location=globalThis.location,referrer=globalThis.document?.referrer||'',
 storage=defaultStorage(),fetchImpl=globalThis.fetch?.bind(globalThis),cryptoSource=globalThis.crypto,
 now=()=>Date.now(),endpoint='./api/gameplay-events'}={}){
 let memory=null,run=null;
 const sent=new Set();
 const session=()=>{
  const time=now();
  try{
   const saved=JSON.parse(storage?.getItem(SESSION_KEY)||'null');
   if(saved&&/^[0-9a-f-]{36}$/.test(saved.id)&&SOURCES.includes(saved.source)&&time>=saved.touched&&time-saved.touched<SESSION_IDLE_MS)memory=saved;
  }catch{}
  if(!memory||time-memory.touched>=SESSION_IDLE_MS)memory={id:cryptoSource.randomUUID(),source:acquisitionSource(location.search,referrer),touched:time};
  memory.touched=time;
  try{storage?.setItem(SESSION_KEY,JSON.stringify(memory));}catch{}
  return memory;
 };
 const post=(payload)=>{
  const key=payload.session+':'+payload.event+':'+payload.run;
  if(sent.has(key))return;
  sent.add(key);
  Promise.resolve(fetchImpl(endpoint,{method:'POST',credentials:'omit',keepalive:true,
   headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}))
   .then(response=>{if(!response?.ok)sent.delete(key);}).catch(()=>sent.delete(key));
 };
 const emit=(event,runId,difficulty,outcome)=>{
  try{
   if(!gameplayAnalyticsEnabled(location))return;
   const current=session(),base={session:current.id,source:current.source};
   post({...base,event:'visit',run:'',difficulty:'none',outcome:'none'});
   if(event!=='visit')post({...base,event,run:runId,difficulty,outcome});
  }catch{/* Analytics must never affect play. */}
 };
 return {
  visit(){emit('visit','','none','none');},
  /** A new play. A resumed saved game gets a run ID for its completion but is not counted as a new start. */
  play(difficulty,{resumed=false}={}){
   try{
    if(!DIFFICULTIES.includes(difficulty)){run=null;return;}
    run={id:cryptoSource.randomUUID(),difficulty};
    if(!resumed)emit('start',run.id,difficulty,'none');
   }catch{run=null;}
  },
  complete(outcome){
   if(!run||!OUTCOMES.includes(outcome))return;
   emit('complete',run.id,run.difficulty,outcome);
  },
 };
}
