import {CARD_W,CARD_H,STEP_X,STEP_Y,visibleEdges} from './core.js';
const EPS=0.001;
const same=(a,b)=>Math.abs(a.x-b.x)<EPS&&Math.abs(a.y-b.y)<EPS;
function families(state){
 const placed=new Set(state.placed),byId=new Map(state.stage.people.map(p=>[p.id,p])),groups=new Map();
 function group(parents){const ids=[...parents].sort(),key=ids.join('|');if(!groups.has(key))groups.set(key,{id:`family:${key}`,parents:ids,children:[],spouse:false});return groups.get(key);}
 for(const id of state.placed){const p=byId.get(id),parents=p.parents.filter(id=>placed.has(id));if(parents.length)group(parents).children.push(id);for(const spouse of p.spouses)if(placed.has(spouse))group([id,spouse]).spouse=true;}
 return [...groups.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
// Adjacent-swap minimization of family separation, crossing inversions and wire length.
// Only placed cards participate; unseen cards never affect ordering or reveal a clue.
export function layoutFamily(state){
 const byId=new Map(state.stage.people.map(p=>[p.id,p])),groups=families(state),links=new Map(state.placed.map(id=>[id,id]));
 const root=id=>{while(links.get(id)!==id)id=links.get(id);return id;};
 // Partner cards form one block. Descendant blocks reserve enough horizontal
 // space for their own children instead of being forced onto an even row grid.
 for(const g of groups)if(g.parents.length===2){const [a,b]=g.parents;if(byId.get(a).generation===byId.get(b).generation)links.set(root(b),root(a));}
 const blocks=new Map();
 for(const p of state.stage.people)if(links.has(p.id)){const key=root(p.id);if(!blocks.has(key))blocks.set(key,{ids:[],children:[],parent:null});blocks.get(key).ids.push(p.id);}
 const blockOf=new Map();for(const block of blocks.values())for(const id of block.ids)blockOf.set(id,block);
 for(const block of blocks.values()){
  const incoming=new Map();for(const id of block.ids)for(const parent of byId.get(id).parents)if(blockOf.has(parent)){const source=blockOf.get(parent);if(source!==block)incoming.set(source,(incoming.get(source)||0)+1);}
  block.parent=[...incoming].sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
  if(block.parent)block.parent.children.push(block);
 }
 const roots=[...blocks.values()].filter(b=>!b.parent);
 const orders=[roots,...[...blocks.values()].map(b=>b.children),...[...blocks.values()].map(b=>b.ids)];
 const origin=byId.get(state.stage.anchor).generation;
 const coordinates=()=>{
  const points={},widths=new Map();
  const width=block=>{if(!widths.has(block))widths.set(block,Math.max(block.ids.length*STEP_X,block.children.reduce((sum,c)=>sum+width(c),0)));return widths.get(block);};
  function assign(block,x){block.ids.forEach((id,i)=>{points[id]={x:x+(i-(block.ids.length-1)/2)*STEP_X,y:(byId.get(id).generation-origin)*STEP_Y};});let edge=x-block.children.reduce((sum,c)=>sum+width(c),0)/2;for(const child of block.children){assign(child,edge+width(child)/2);edge+=width(child);}}
  let edge=-roots.reduce((sum,r)=>sum+width(r),0)/2;for(const r of roots){assign(r,edge+width(r)/2);edge+=width(r);}
  return points;
 };
 function cost(){const points=coordinates();let sum=0;const arms=[];
 for(const family of groups){const ps=family.parents.map(id=>points[id]),x=ps.reduce((sum,p)=>sum+p.x,0)/ps.length;
 if(ps.length===2)sum+=Math.max(0,Math.abs(ps[0].x-ps[1].x)/STEP_X-1)*60;
 for(const child of family.children){const to=points[child];sum+=Math.abs(x-to.x)*.015;arms.push({family:family.id,generation:to.y,from:x,to:to.x});}}
 for(let i=0;i<arms.length;i++)for(let j=i+1;j<arms.length;j++){const a=arms[i],b=arms[j];if(a.family!==b.family&&a.generation===b.generation&&(a.from-b.from)*(a.to-b.to)<0)sum+=150;}
 return sum;}
 let current=cost();for(let pass=0;pass<16;pass++){let changed=false;for(const order of orders)for(let i=0;i<order.length-1;i++){[order[i],order[i+1]]=[order[i+1],order[i]];const next=cost();if(next<current-EPS){current=next;changed=true;}else [order[i],order[i+1]]=[order[i+1],order[i]];}if(!changed)break;}
 return coordinates();
}
function segment(network,a,b){if(!same(a,b))network.segments.push({a,b});}
function polyline(network,points){for(let i=1;i<points.length;i++)segment(network,points[i-1],points[i]);}
function uniquePoints(points){return points.filter((p,i)=>!points.slice(0,i).some(q=>same(p,q)));}
export function buildDiagram(state){
 const positions=state.positions,groups=families(state),networks=[],lanes=new Map(),laneCounts=new Map();
 const siblingEdges=visibleEdges(state).filter(e=>e.kind==='sibling');
 for(const g of groups){const y=positions[g.parents[0]].y;laneCounts.set(y,(laneCounts.get(y)||0)+1);}
 for(const e of siblingEdges){const y=positions[e.from].y;laneCounts.set(y,(laneCounts.get(y)||0)+1);}
 const channel=(y,index,upper=false)=>y+CARD_H/2+10+(index*2+(upper?1:2))*(STEP_Y-CARD_H-22)/(2*(laneCounts.get(y)||1)+1);
 function port(id){return positions[id].x;}
 function lane(y){const current=lanes.get(y)||0;lanes.set(y,current+1);return current;}
 for(const g of groups){
 const network={id:g.id,kind:g.parents.length===2?'couple':'parent',members:[...g.parents,...g.children],segments:[],junctions:[],label:null};
 const parents=g.parents.map(id=>({id,...positions[id]})).sort((a,b)=>a.x-b.x),rowY=parents[0].y,index=lane(rowY),busY=channel(rowY,index);let joint;
 if(parents.length===2){
 const [a,b]=parents,between=state.placed.some(id=>!g.parents.includes(id)&&positions[id].y===rowY&&positions[id].x>a.x&&positions[id].x<b.x);
 if(!between){joint={x:(a.x+b.x)/2,y:rowY};segment(network,{x:a.x+CARD_W/2,y:rowY},{x:b.x-CARD_W/2,y:rowY});}
 else{const ax=port(a.id,g),bx=port(b.id,g),y=channel(rowY,index,true);joint={x:(ax+bx)/2,y};polyline(network,[{x:ax,y:rowY+CARD_H/2},{x:ax,y},{x:bx,y},{x:bx,y:rowY+CARD_H/2}]);}
 network.label={x:joint.x,y:joint.y-10,text:g.spouse?'夫婦':'父母の組'};
 if(g.children.length)network.junctions.push(joint);
 }else joint={x:port(parents[0].id,g),y:rowY+CARD_H/2};
 if(g.children.length){const xs=g.children.map(id=>positions[id].x),min=Math.min(joint.x,...xs),max=Math.max(joint.x,...xs);segment(network,joint,{x:joint.x,y:busY});segment(network,{x:min,y:busY},{x:max,y:busY});for(const id of g.children){const p=positions[id];segment(network,{x:p.x,y:busY},{x:p.x,y:p.y-CARD_H/2});}
 // A dot marks actual T/fork points within this one family, never geometric crossings.
 const candidates=uniquePoints([{x:joint.x,y:busY},...xs.map(x=>({x,y:busY}))]);
 for(const point of candidates){const directions=new Set();for(const s of network.segments){if(pointOnSegment(point,s)){if(s.a.x<point.x-EPS||s.b.x<point.x-EPS)directions.add('left');if(s.a.x>point.x+EPS||s.b.x>point.x+EPS)directions.add('right');if(s.a.y<point.y-EPS||s.b.y<point.y-EPS)directions.add('up');if(s.a.y>point.y+EPS||s.b.y>point.y+EPS)directions.add('down');}}if(directions.size>=3)network.junctions.push(point);}
 }
 networks.push(network);
 }
 // Sibling links are temporary and don't imply a marriage or an invented parent.
 for(const edge of siblingEdges){const a=positions[edge.from],b=positions[edge.to],index=lane(a.y),y=channel(a.y,index),network={id:`sibling:${edge.from}|${edge.to}`,kind:'sibling',members:[edge.from,edge.to],segments:[],junctions:[],label:null};polyline(network,[{x:a.x,y:a.y+CARD_H/2},{x:a.x,y},{x:b.x,y},{x:b.x,y:b.y+CARD_H/2}]);networks.push(network);}
 separateOverlappingVerticals(networks,state.positions);
 for(const network of networks){network.segments=normalizeWires(network.segments,state.positions);network.junctions=findJunctions(network.segments);}
 return {networks};
}
function verticalOverlap(a,b){return Math.abs(a.a.x-a.b.x)<EPS&&Math.abs(b.a.x-b.b.x)<EPS&&Math.abs(a.a.x-b.a.x)<EPS&&Math.min(Math.max(a.a.y,a.b.y),Math.max(b.a.y,b.b.y))-Math.max(Math.min(a.a.y,a.b.y),Math.min(b.a.y,b.b.y))>EPS;}
function crossesCardInterior(segment,positions){return Object.values(positions).some(p=>segment.a.x>p.x-CARD_W/2-3&&segment.a.x<p.x+CARD_W/2+3&&Math.min(Math.max(segment.a.y,segment.b.y),p.y+CARD_H/2)-Math.max(Math.min(segment.a.y,segment.b.y),p.y-CARD_H/2)>EPS);}
function separateOverlappingVerticals(networks,positions){
 const accepted=[];
 // Keep a couple's central stem straight; move colliding routes into parallel lanes.
 for(const net of [...networks].sort((a,b)=>(a.kind==='couple'?0:1)-(b.kind==='couple'?0:1))){const routed=[];
 for(const original of net.segments){if(Math.abs(original.a.x-original.b.x)>EPS){routed.push(original);continue;}
 let segment=original;
 if(accepted.some(s=>s.net!==net.id&&verticalOverlap(segment,s))){
 for(let step=1;step<=20;step++){let found=false;for(const sign of [1,-1]){const dx=step*12*sign,candidate={a:{x:original.a.x+dx,y:original.a.y},b:{x:original.b.x+dx,y:original.b.y}};if(!crossesCardInterior(candidate,positions)&&!accepted.some(s=>s.net!==net.id&&verticalOverlap(candidate,s))){segment=candidate;found=true;break;}}if(found)break;}
 }
 const sameCardPort=(a,b)=>Object.values(positions).some(p=>Math.abs(a.y-b.y)<EPS&&Math.abs(Math.abs(a.y-p.y)-CARD_H/2)<EPS&&Math.abs(a.x-p.x)<=CARD_W/2-4&&Math.abs(b.x-p.x)<=CARD_W/2-4);
 // A shifted wire can attach directly to a different point on the card edge.
 // Don't add a tiny sideways return merely to reach the old center port.
 if(!same(segment.a,original.a)&&!sameCardPort(original.a,segment.a))routed.push({a:original.a,b:segment.a});routed.push(segment);if(!same(segment.b,original.b)&&!sameCardPort(original.b,segment.b))routed.push({a:segment.b,b:original.b});accepted.push({...segment,net:net.id});
 }
 net.segments=routed;
 }
}
function normalizeWires(segments,positions){
 const key=p=>`${p.x.toFixed(5)},${p.y.toFixed(5)}`,points=segments.flatMap(s=>[s.a,s.b]),unique=new Map();
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){const p=intersection(segments[i],segments[j]);if(p)points.push(p);}
 for(const s of segments){const on=uniquePoints(points.filter(p=>pointOnSegment(p,s))).sort((a,b)=>a.x-b.x||a.y-b.y);for(let i=1;i<on.length;i++){const a=on[i-1],b=on[i];unique.set([key(a),key(b)].sort().join('|'),{a,b});}}
 let wires=[...unique.values()];const touchesCard=p=>Object.values(positions).some(c=>(Math.abs(Math.abs(p.y-c.y)-CARD_H/2)<EPS&&Math.abs(p.x-c.x)<=CARD_W/2+EPS)||(Math.abs(Math.abs(p.x-c.x)-CARD_W/2)<EPS&&Math.abs(p.y-c.y)<=CARD_H/2+EPS));
 // Moving a vertical run can leave an obsolete tail on its former bus. Trim it.
 for(let pass=0;pass<200;pass++){const degree=new Map();for(const s of wires)for(const p of [s.a,s.b])degree.set(key(p),(degree.get(key(p))||0)+1);const next=wires.filter(s=>![s.a,s.b].some(p=>degree.get(key(p))===1&&!touchesCard(p)));if(next.length===wires.length)break;wires=next;}
 // Join straight degree-two runs. Keep real T junctions and corners intact.
 for(let pass=0;pass<200;pass++){const incident=new Map();for(const s of wires)for(const p of [s.a,s.b]){const k=key(p);if(!incident.has(k))incident.set(k,[]);incident.get(k).push(s);}let merged=false;
 for(const [k,edges] of incident){if(edges.length!==2)continue;const [a,b]=edges,u=key(a.a)===k?a.b:a.a,v=key(b.a)===k?b.b:b.a;
 if(Math.abs(u.x-v.x)<EPS&&Math.abs(a.a.x-a.b.x)<EPS&&Math.abs(b.a.x-b.b.x)<EPS||Math.abs(u.y-v.y)<EPS&&Math.abs(a.a.y-a.b.y)<EPS&&Math.abs(b.a.y-b.b.y)<EPS){wires=wires.filter(s=>s!==a&&s!==b);wires.push({a:u,b:v});merged=true;break;}}
 if(!merged)break;}
 return wires;
}
function findJunctions(segments){
 const points=segments.flatMap(s=>[s.a,s.b]);for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){const point=intersection(segments[i],segments[j]);if(point)points.push(point);}
 return uniquePoints(points).filter(point=>{const directions=new Set();for(const s of segments){if(!pointOnSegment(point,s))continue;if(s.a.x<point.x-EPS||s.b.x<point.x-EPS)directions.add('left');if(s.a.x>point.x+EPS||s.b.x>point.x+EPS)directions.add('right');if(s.a.y<point.y-EPS||s.b.y<point.y-EPS)directions.add('up');if(s.a.y>point.y+EPS||s.b.y>point.y+EPS)directions.add('down');}return directions.size>=3;});
}
export function pointOnSegment(p,s){return p.x>=Math.min(s.a.x,s.b.x)-EPS&&p.x<=Math.max(s.a.x,s.b.x)+EPS&&p.y>=Math.min(s.a.y,s.b.y)-EPS&&p.y<=Math.max(s.a.y,s.b.y)+EPS&&(Math.abs(s.a.x-s.b.x)<EPS?Math.abs(p.x-s.a.x)<EPS:Math.abs(p.y-s.a.y)<EPS);}
export function intersection(a,b){const av=Math.abs(a.a.x-a.b.x)<EPS,bv=Math.abs(b.a.x-b.b.x)<EPS;if(av===bv)return null;const vertical=av?a:b,horizontal=av?b:a,point={x:vertical.a.x,y:horizontal.a.y};return pointOnSegment(point,a)&&pointOnSegment(point,b)?point:null;}
function distanceOn(s,p){return Math.abs(s.b.x-s.a.x)<EPS?p.y-Math.min(s.a.y,s.b.y):p.x-Math.min(s.a.x,s.b.x);}
export function splitSegment(segment,cuts){
 const vertical=Math.abs(segment.a.x-segment.b.x)<EPS,start=vertical?Math.min(segment.a.y,segment.b.y):Math.min(segment.a.x,segment.b.x),end=vertical?Math.max(segment.a.y,segment.b.y):Math.max(segment.a.x,segment.b.x),length=end-start;
 const intervals=cuts.map(([a,b])=>[Math.max(0,a),Math.min(length,b)]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);let cursor=0;const pieces=[];
 const add=(a,b)=>{if(b-a>EPS)pieces.push(vertical?{a:{x:segment.a.x,y:start+a},b:{x:segment.a.x,y:start+b}}:{a:{x:start+a,y:segment.a.y},b:{x:start+b,y:segment.a.y}});};
 for(const [a,b] of intervals){if(a>cursor)add(cursor,a);cursor=Math.max(cursor,b);}if(cursor<length)add(cursor,length);return pieces;
}
export function renderGeometry(diagram,{scale=1,focus=null}={}){
 const nets=diagram.networks,segments=nets.flatMap((net,netIndex)=>net.segments.map(s=>({...s,netIndex,cuts:[]}))),crossings=[];
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
 const a=segments[i],b=segments[j];if(a.netIndex===b.netIndex)continue;const point=intersection(a,b);if(!point)continue;
 const na=nets[a.netIndex],nb=nets[b.netIndex],ja=na.junctions.some(p=>same(p,point)),jb=nb.junctions.some(p=>same(p,point));
 // A real fork always stays continuous. Otherwise the highlighted line passes over.
 let under;if(ja&&!jb)under=b;else if(jb&&!ja)under=a;else if(focus&&na.members.includes(focus)!==nb.members.includes(focus))under=na.members.includes(focus)?b:a;else if(na.kind==='sibling'&&nb.kind!=='sibling')under=a;else if(nb.kind==='sibling'&&na.kind!=='sibling')under=b;else under=a;
 const halfGap=6/Math.max(.18,scale);for(const s of segments)if(s.netIndex===under.netIndex&&pointOnSegment(point,s)){const distance=distanceOn(s,point);let start=distance-halfGap,end=distance+halfGap;for(const dot of nets[s.netIndex].junctions)if(pointOnSegment(dot,s)){const at=distanceOn(s,dot);if(at<distance-EPS)start=Math.max(start,(distance+at)/2);if(at>distance+EPS)end=Math.min(end,(distance+at)/2);}s.cuts.push([start,end]);}crossings.push({point,under:nets[under.netIndex].id});
 }
 return {networks:nets.map((net,netIndex)=>({...net,focused:!!focus&&net.members.includes(focus),dimmed:!!focus&&!net.members.includes(focus),pieces:segments.filter(s=>s.netIndex===netIndex).flatMap(s=>splitSegment(s,s.cuts))})),crossings};
}
export function diagramSvg(diagram,options={}){
 const geometry=renderGeometry(diagram,options),scale=Math.max(.18,options.scale||1),path=p=>`M${p.a.x} ${p.a.y} L${p.b.x} ${p.b.y}`;
 return geometry.networks.map(net=>`<g class="family-network ${net.kind}${net.focused?' focused':''}${net.dimmed?' dimmed':''}"><path class="family-wire" d="${net.pieces.map(path).join(' ')}" vector-effect="non-scaling-stroke"/>${net.junctions.map(p=>`<circle class="connection-dot" cx="${p.x}" cy="${p.y}" r="${3.1/scale}"/>`).join('')}${net.label?`<text x="${net.label.x}" y="${net.label.y}" text-anchor="middle">${net.label.text}</text>`:''}</g>`).join('');
}
