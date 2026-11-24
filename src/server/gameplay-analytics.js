import {SOURCES,DIFFICULTIES,OUTCOMES,GAME_HOST,MAX_BODY_BYTES,RETENTION_MS} from '../gameplay-analytics.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const empty=status=>new Response(null,{status});

function hostAllowed(host,mode){
 if(mode==='production')return host===GAME_HOST;
 return mode==='test'&&['127.0.0.1','localhost'].includes(host);
}
export function validPayload(p){
 if(!p||typeof p!=='object'||Array.isArray(p))return false;
 if(Object.keys(p).sort().join(',')!=='difficulty,event,outcome,run,session,source')return false;
 if(typeof p.session!=='string'||!UUID.test(p.session)||!SOURCES.includes(p.source))return false;
 if(p.event==='visit')return p.run===''&&p.difficulty==='none'&&p.outcome==='none';
 if(typeof p.run!=='string'||!UUID.test(p.run)||!DIFFICULTIES.includes(p.difficulty))return false;
 if(p.event==='start')return p.outcome==='none';
 return p.event==='complete'&&OUTCOMES.includes(p.outcome);
}
async function readLimited(request){
 const reader=request.body?.getReader();
 if(!reader)return null;
 const decoder=new TextDecoder();let bytes=0,text='';
 while(true){
  const {value,done}=await reader.read();
  if(done)break;
  bytes+=value.byteLength;
  if(bytes>MAX_BODY_BYTES){await reader.cancel();return false;}
  text+=decoder.decode(value,{stream:true});
 }
 return text+decoder.decode();
}
/** Unauthenticated aggregate counting. Off unless GAMEPLAY_ANALYTICS_MODE is `production` (or local `test`). */
export async function receiveGameplay(request,env){
 const mode=env.GAMEPLAY_ANALYTICS_MODE;
 if(mode!=='production'&&mode!=='test')return empty(204);
 const url=new URL(request.url);
 if(!hostAllowed(url.hostname,mode)||request.headers.get('Origin')!==url.origin)return empty(403);
 if(request.headers.has('Authorization')||request.headers.has('Cookie'))return empty(400);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return empty(415);
 if(!env.DB)return empty(503);
 try{
  const text=await readLimited(request);
  if(text===false)return empty(413);
  if(text===null)return empty(400);
  let p;try{p=JSON.parse(text);}catch{return empty(400);}
  if(!validPayload(p))return empty(400);
  const now=Date.now();
  const insert=(event,run,difficulty,outcome)=>env.DB.prepare(
   'INSERT OR IGNORE INTO gameplay_events (session_id,event,run_id,source,difficulty,outcome,received_at) VALUES (?,?,?,?,?,?,?)')
   .bind(p.session,event,run,p.source,difficulty,outcome,now);
  const statements=[env.DB.prepare('DELETE FROM gameplay_events WHERE received_at < ?').bind(now-RETENTION_MS),
   insert('visit','','none','none')];
  if(p.event!=='visit')statements.push(insert(p.event,p.run,p.difficulty,p.outcome));
  await env.DB.batch(statements);
  return empty(204);
 }catch{return empty(503);} // Never log raw requests or identities.
}
