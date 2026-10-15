export const CARD_W=144,CARD_H=90,STEP_X=180,STEP_Y=190;
export const relationLabels={parent:'親',child:'子',spouse:'配偶者',sibling:'兄弟姉妹'};
export function relations(candidate,anchor){
 if(!candidate||!anchor||candidate.id===anchor.id)return [];
 const result=[];
 if(anchor.parents.includes(candidate.id))result.push('parent');
 if(candidate.parents.includes(anchor.id))result.push('child');
 if(candidate.spouses.includes(anchor.id)||anchor.spouses.includes(candidate.id))result.push('spouse');
 if(candidate.parents.some(id=>anchor.parents.includes(id)))result.push('sibling');
 return result;
}
export function shuffled(items,random=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function connectable(state,id){const person=state.stage.people.find(p=>p.id===id);return state.placed.some(p=>relations(person,state.stage.people.find(q=>q.id===p)).length);}
export function deal(state){while(state.hand.length<5&&state.deck.length)state.hand.push(state.deck.shift());}
export function ensurePlayable(state){
 if(state.hand.some(id=>connectable(state,id))||!state.deck.length)return;
 const index=state.deck.findIndex(id=>connectable(state,id));
 if(index>=0){const old=state.hand.pop();state.hand.push(state.deck.splice(index,1)[0]);state.deck.push(old);}
}
export function newGame(stage,random=Math.random){const state={version:1,stage,placed:[stage.anchor],hand:[],deck:shuffled(stage.people.filter(p=>p.id!==stage.anchor).map(p=>p.id),random),positions:{},mistakes:0,hints:{},exchanges:0,elapsed:0,complete:false};state.positions[stage.anchor]={x:0,y:0};deal(state);ensurePlayable(state);return state;}
export function exchange(state){if(!state.deck.length)return false;state.deck.push(...state.hand);state.hand=[];deal(state);ensurePlayable(state);state.exchanges++;return true;}
export function positionFor(state,id,anchorId,relation){
 const person=state.stage.people.find(p=>p.id===id),anchor=state.stage.people.find(p=>p.id===anchorId),point=state.positions[anchorId];
 const y=point.y+(person.generation-anchor.generation)*STEP_Y;
 const x=point.x+(relation==='spouse'?STEP_X:relation==='sibling'?-STEP_X:0);
 const occupied=Object.values(state.positions).filter(p=>Math.abs(p.y-y)<CARD_H+40);
 for(let i=0;i<100;i++){for(const sign of i===0?[1]:[1,-1]){const test=x+i*STEP_X*sign;if(occupied.every(p=>Math.abs(p.x-test)>=STEP_X-1))return {x:test,y};}}
 throw Error('No space for card');
}
export function place(state,id,anchorId,relation){
 if(state.complete||!state.hand.includes(id)||!state.placed.includes(anchorId))return {ok:false,reason:'invalid'};
 const candidate=state.stage.people.find(p=>p.id===id),anchor=state.stage.people.find(p=>p.id===anchorId);
 if(!relations(candidate,anchor).includes(relation)){state.mistakes++;return {ok:false,reason:'relation'};}
 const position=positionFor(state,id,anchorId,relation);state.positions[id]=position;state.placed.push(id);state.hand.splice(state.hand.indexOf(id),1);deal(state);state.complete=state.placed.length===state.stage.people.length;return {ok:true,position};
}
export function visibleEdges(state){
 const edges=[];const byId=new Map(state.stage.people.map(p=>[p.id,p]));
 for(const id of state.placed){const person=byId.get(id);for(const parent of person.parents)if(state.placed.includes(parent))edges.push({from:parent,to:id,kind:'parent'});for(const spouse of person.spouses)if(state.placed.includes(spouse)&&id<spouse)edges.push({from:id,to:spouse,kind:'spouse'});}
 // Sibling links explain placements made before their shared parent arrives.
 for(let i=0;i<state.placed.length;i++)for(let j=i+1;j<state.placed.length;j++){
 const a=byId.get(state.placed[i]),b=byId.get(state.placed[j]);const common=a.parents.filter(p=>b.parents.includes(p));
 if(common.length&&!common.some(id=>state.placed.includes(id)))edges.push({from:a.id,to:b.id,kind:'sibling'});
 }
 return edges;
}
export function pack(state){const {stage,...data}=state;return {...data,stageId:stage.id};}
export function restore(data,stage){
 if(!data||data.version!==1||data.stageId!==stage.id||!Array.isArray(data.placed)||!Array.isArray(data.hand)||!Array.isArray(data.deck))return null;
 const all=[...data.placed,...data.hand,...data.deck],ids=stage.people.map(p=>p.id);
 if(all.length!==ids.length||new Set(all).size!==ids.length||all.some(id=>!ids.includes(id))||!data.placed.includes(stage.anchor)||data.hand.length>5||!data.placed.every(id=>Number.isFinite(data.positions?.[id]?.x)&&Number.isFinite(data.positions?.[id]?.y))||!Number.isFinite(data.elapsed)||data.elapsed<0||!Number.isInteger(data.mistakes)||data.mistakes<0||!Number.isInteger(data.exchanges)||data.exchanges<0||!data.hints||typeof data.hints!=='object'||Array.isArray(data.hints)||Object.entries(data.hints).some(([id,n])=>!ids.includes(id)||!Number.isInteger(n)||n<0||n>2))return null;
 return {...data,stage,complete:data.placed.length===ids.length};
}
export function formatTime(ms){const seconds=Math.floor(ms/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
export function fitCamera(positions,width,height){const pts=Object.values(positions);const minX=Math.min(...pts.map(p=>p.x))-CARD_W/2-55,maxX=Math.max(...pts.map(p=>p.x))+CARD_W/2+55,minY=Math.min(...pts.map(p=>p.y))-CARD_H/2-70,maxY=Math.max(...pts.map(p=>p.y))+CARD_H/2+70;const scale=Math.min(1,width/(maxX-minX),height/(maxY-minY));return {x:width/2-(minX+maxX)/2*scale,y:height/2-(minY+maxY)/2*scale,scale};}
export function revealCamera(camera,point,width,height){const marginX=Math.min(100,width*.28),marginY=Math.min(95,height*.28);const x=point.x*camera.scale+camera.x,y=point.y*camera.scale+camera.y;return {...camera,x:camera.x+(x<marginX?marginX-x:x>width-marginX?width-marginX-x:0),y:camera.y+(y<marginY?marginY-y:y>height-marginY?height-marginY-y:0)};}
