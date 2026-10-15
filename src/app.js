import {stages,stageById} from './data.js';
import {relationLabels,newGame,exchange,place,pack,restore,formatTime,fitCamera,revealCamera} from './core.js';
import {layoutFamily,buildDiagram,diagramSvg} from './diagram.js';
const $=id=>document.getElementById(id),storageKey='family-tree-game:v1';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let records={sessions:{},best:{}};
try{const parsed=JSON.parse(localStorage.getItem(storageKey));if(parsed&&typeof parsed==='object')records={sessions:parsed.sessions||{},best:parsed.best||{}};}catch{}
let state=null,selected=null,camera={x:0,y:0,scale:1},targetAnchor=null,hotRelation=null,drag=null,pan=null,frame=null,lastTick=performance.now(),lastSaved=0,diagram=null,lineFocus=null,lastLineDiagram=null,lastLineScale=null,lastLineFocus=null;
const board=$('board'),modal=$('modal'),pointers=new Map();
const person=id=>state.stage.people.find(p=>p.id===id);
const hintCount=()=>Object.values(state.hints).reduce((sum,n)=>sum+n,0);
function persist(){try{if(state)records.sessions[state.stage.id]=pack(state);localStorage.setItem(storageKey,JSON.stringify(records));}catch{}}
function say(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function savedGame(stage){try{return restore(records.sessions[stage.id],stage);}catch{return null;}}
function renderHome(){
 $('stage-list').innerHTML=stages.map(stage=>{const saved=savedGame(stage),resume=saved&&!saved.complete,best=records.best[stage.id];return `<article class="stage-card"><span class="stage-symbol" aria-hidden="true">${stage.symbol}</span><p class="eyebrow">${stage.category} / ${stage.people.length}${stage.id==='tokugawa'?'人':'頭'}</p><h3>${stage.title}</h3><p>${stage.summary}</p><span class="tag">${stage.tag}</span><div class="stage-bottom"><span class="best">${resume?`${saved.placed.length} / ${stage.people.length} 配置済み`:best?`クリア済み · ${formatTime(best.elapsed)}`:'まだたどっていない系譜'}</span><button class="button" data-start="${stage.id}">${resume?'つづきから':'はじめる'} →</button></div></article>`;}).join('');
}
function openDialog(html,closeLabel='閉じる'){$('modal-content').innerHTML=html;$('modal-close').textContent=closeLabel;if(!modal.open)modal.showModal();lastTick=performance.now();}
function closeDialog(){modal.close();lastTick=performance.now();}
modal.addEventListener('close',()=>{lastTick=performance.now();});
$('modal-close').addEventListener('click',closeDialog);
function help(){openDialog(`<p class="eyebrow">HOW TO PLAY</p><h2>つかんで、つないで。</h2><ol><li>手札は最大5枚。カードをドラッグして、場のカードに近づけます。</li><li>「親・子・配偶者・きょうだい」の置きたい関係で指を離すと配置できます。正解の位置だけを教える表示はありません。</li><li>カードをタップ → 場のカードをタップ → 関係を選ぶ操作でも遊べます。</li><li>置ける札がなければ「手札を入れ替え」。無料で使えます。</li><li>困ったら札を選んでヒント。2段階で関係が分かります。</li><li>関係線の●は実際の接続点。交差するだけの線は片方に切れ目があります。場のカードをタップすると、そのカードに直接つながる線を強調します。</li><li>盤面は背景や配置済みカードをスワイプして移動。ピンチ、＋ / −で拡縮し、「全体」で見渡せます。</li></ol><p>全カードを置いたら完成。時間制限はありません。時間・ミス・ヒント回数を記録します。</p><p class="scope">${state?escape(state.stage.scope):'手札と進行は、このブラウザに自動保存されます。'}</p>`);}
$('help-button').addEventListener('click',help);
function showSources(){const list=state?[state.stage]:stages;openDialog(`<p class="eyebrow">ABOUT THE FAMILY TREES</p><h2>題材・出典</h2>${list.map(stage=>`<h3>${stage.title}</h3><p>${stage.description}</p><p class="scope">${stage.scope}</p><ul>${[...new Map([...stage.sources,...stage.people.map(p=>p.source)].map(s=>[s.url,s])).values()].map(s=>`<li><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.label)}</a></li>`).join('')}</ul>`).join('')}<p class="scope">関係情報をもとに作成した選抜ステージです。人物・馬の肖像や写真は転載していません。</p>`);}
$('sources-button').addEventListener('click',showSources);
$('stage-list').addEventListener('click',e=>{const button=e.target.closest('[data-start]');if(button)start(stageById(button.dataset.start));});
function start(stage,fresh=false){
 persist();state=(!fresh&&savedGame(stage))||newGame(stage);if(state.complete&&!fresh)state=newGame(stage);selected=null;targetAnchor=null;lineFocus=null;state.positions=layoutFamily(state);
 $('home-screen').hidden=true;$('game-screen').hidden=false;$('stage-category').textContent=stage.category;$('stage-title').textContent=stage.title;
 document.body.dataset.stage=stage.id;render();fit();lastTick=performance.now();say('手札を場のカードに近づけて、関係を選ぼう。');persist();window.scrollTo({top:0,behavior:'instant'});
}
function goHome(){persist();cancelDrag();pointers.clear();pan=null;state=null;selected=null;clearTargets();$('game-screen').hidden=true;$('home-screen').hidden=false;renderHome();closeDialog();}
function menu(){if(!state){goHome();return;}openDialog(`<p class="eyebrow">${state.stage.category}</p><h2>${state.stage.title}</h2><p>進行は自動保存されています。</p><button class="button" data-action="home">ステージ選択へ</button><button class="button secondary" data-action="restart-confirm">最初からやり直す</button>${state.complete?'<button class="button secondary" data-action="result">完成記録を見る</button>':''}`);}
$('menu-button').addEventListener('click',menu);$('home-button').addEventListener('click',()=>state?menu():goHome());
modal.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action==='home')goHome();if(action==='restart-confirm')openDialog('<h2>この系譜をやり直しますか？</h2><p>今の配置と記録をリセットして、新しい手札で始めます。</p><button class="button" data-action="restart">やり直す</button>','続ける');if(action==='restart'){const stage=state.stage;closeDialog();start(stage,true);}if(action==='result')results();});
function render(){renderBoard();renderHand();renderStats();renderHint();}
function renderStats(){
 $('placed-count').textContent=state.placed.length;$('total-count').textContent=` / ${state.stage.people.length}`;$('timer').textContent=formatTime(state.elapsed);$('mistake-count').textContent=state.mistakes;$('hint-count').textContent=hintCount();$('progress-fill').style.width=`${state.placed.length/state.stage.people.length*100}%`;$('hand-count').textContent=`${state.hand.length}枚`;$('stock-count').textContent=`山札 ${state.deck.length}枚`;$('exchange-button').disabled=!state.deck.length||state.complete;$('hint-button').disabled=state.complete;
 $('board-caption').textContent=state.complete?'完成した系譜 · スワイプと拡縮で見渡せます':selected?'場のカードに近づけて、つなぐ関係を選ぶ':'カードをドラッグして、場の人物に近づけてみよう';
}
function renderBoard(newId){
 $('nodes').innerHTML=state.placed.map(id=>{const p=person(id),position=state.positions[id];return `<button class="person-node ${state.stage.id==='thoroughbred'?'horse':''} ${id===state.stage.anchor?'anchor':''} ${id===newId?'new-card':''}" data-node="${id}" aria-pressed="false" style="left:${position.x}px;top:${position.y}px" aria-label="${escape(p.name)}${id===state.stage.anchor?'、起点のカード':''}"><span class="node-name">${escape(p.name)}</span><small>${id===state.stage.anchor?'START · 起点':state.stage.category}</small></button>`;}).join('');
 diagram=buildDiagram(state);renderLines();
 updateTransform();
}
function renderLines(){if(!diagram||(diagram===lastLineDiagram&&camera.scale===lastLineScale&&lineFocus===lastLineFocus))return;$('edges').innerHTML=diagramSvg(diagram,{scale:camera.scale,focus:lineFocus});lastLineDiagram=diagram;lastLineScale=camera.scale;lastLineFocus=lineFocus;}
function focusLines(id){lineFocus=lineFocus===id?null:id;renderLines();for(const node of $('nodes').querySelectorAll('[data-node]')){node.classList.toggle('line-focused',node.dataset.node===lineFocus);node.setAttribute('aria-pressed',String(node.dataset.node===lineFocus));}say(lineFocus?`${person(lineFocus).name}に直接つながる関係を強調しています。もう一度タップで解除。`:'関係線の強調を解除しました。');}
function renderHand(){
 $('hand').innerHTML=state.hand.map(id=>`<button class="hand-card ${state.stage.id==='thoroughbred'?'horse':''} ${id===selected?'selected':''}" data-card="${id}" aria-pressed="${id===selected}" aria-label="${escape(person(id).name)}。ドラッグするか、選択して場のカードをタップ"><span class="card-name">${escape(person(id).name)}</span><small>${state.stage.id==='thoroughbred'?'PEDIGREE':'FAMILY TREE'}</small></button>`).join('');
 if(state.complete)$('hand').innerHTML='<p class="complete-note">すべてのカードがつながりました。</p>';
}
function selectCard(id){selected=id;lineFocus=null;renderLines();for(const node of $('nodes').querySelectorAll('[data-node]')){node.classList.remove('line-focused');node.setAttribute('aria-pressed','false');}clearTargets();for(const button of $('hand').querySelectorAll('[data-card]')){const active=button.dataset.card===id;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));}renderHint();renderStats();}
function renderHint(){const box=$('hint-box');box.hidden=true;if(!selected)return;const level=state.hints[selected]||0;if(level){box.hidden=false;box.innerHTML=`<strong>${escape(person(selected).name)}</strong> <small>ヒント ${level} / 2</small><br>${escape(person(selected).clues[level-1])}${level<2?'<button class="text-button" id="next-hint">関係のヒントを見る</button>':''}`;if(level<2)$('next-hint').addEventListener('click',revealHint);}}
function revealHint(){if(!selected){say('ヒントを見るカードを、手札から選んでください。');return;}state.hints[selected]=Math.min(2,(state.hints[selected]||0)+1);renderHint();renderStats();persist();}
$('hint-button').addEventListener('click',revealHint);
$('exchange-button').addEventListener('click',()=>{if(exchange(state)){selected=null;clearTargets();renderHand();renderHint();renderStats();persist();say('手札を入れ替えました。つながる札を探してみよう。');}});
function updateTransform(animate=false){$('world').classList.toggle('following',animate);$('world').style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;if(targetAnchor)drawTargets();renderLines();}
function fit(){if(!state)return;camera=fitCamera(state.positions,board.clientWidth,board.clientHeight);updateTransform(true);}
$('fit-button').addEventListener('click',fit);
function zoomAt(factor,x=board.clientWidth/2,y=board.clientHeight/2){const next=Math.max(.18,Math.min(1.8,camera.scale*factor)),ratio=next/camera.scale;camera={x:x-(x-camera.x)*ratio,y:y-(y-camera.y)*ratio,scale:next};updateTransform();}
$('zoom-in').addEventListener('click',()=>zoomAt(1.2));$('zoom-out').addEventListener('click',()=>zoomAt(1/1.2));
board.addEventListener('wheel',e=>{e.preventDefault();const rect=board.getBoundingClientRect();zoomAt(Math.exp(-e.deltaY*.002),e.clientX-rect.left,e.clientY-rect.top);},{passive:false});
board.addEventListener('keydown',e=>{if(e.target!==board)return;const delta={ArrowLeft:[50,0],ArrowRight:[-50,0],ArrowUp:[0,50],ArrowDown:[0,-50]}[e.key];if(delta){e.preventDefault();camera.x+=delta[0];camera.y+=delta[1];updateTransform();}if(e.key==='+'||e.key==='=')zoomAt(1.2);if(e.key==='-')zoomAt(1/1.2);if(e.key==='0')fit();});
function clearTargets(){targetAnchor=null;hotRelation=null;$('targets').innerHTML='';$('nodes').querySelectorAll('.targeted').forEach(n=>n.classList.remove('targeted'));}
function availableRelations(){return state.stage.id==='thoroughbred'?['parent','child','sibling']:['parent','child','spouse','sibling'];}
function relationName(type){return state.stage.id==='thoroughbred'?({parent:'父・母',child:'産駒',sibling:'きょうだい'}[type]):relationLabels[type];}
function drawTargets(){
 if(!targetAnchor||!selected)return;
 const p=state.positions[targetAnchor],cx=p.x*camera.scale+camera.x,cy=p.y*camera.scale+camera.y;
 const offsets={parent:[0,-90],child:[0,90],spouse:[108,0],sibling:[-108,0]},width=board.clientWidth,height=board.clientHeight;
 const items=availableRelations().map(type=>{const [dx,dy]=offsets[type];const x=Math.max(39,Math.min(width-39,cx+dx)),y=Math.max(60,Math.min(height-60,cy+dy));return {type,x,y};});
 if($('targets').dataset.anchor!==targetAnchor||!$('targets').children.length){$('targets').dataset.anchor=targetAnchor;$('targets').innerHTML=items.map(t=>`<button class="relation-target" data-relation="${t.type}" aria-label="${escape(person(targetAnchor).name)}の${relationName(t.type)}として、${escape(person(selected).name)}を置く">${relationName(t.type)}</button>`).join('');}
 items.forEach(t=>{const b=$('targets').querySelector(`[data-relation="${t.type}"]`);b.style.left=`${t.x}px`;b.style.top=`${t.y}px`;b.classList.toggle('active',hotRelation===t.type);});
 for(const node of $('nodes').querySelectorAll('[data-node]'))node.classList.toggle('targeted',node.dataset.node===targetAnchor);
}
function pointOnBoard(clientX,clientY){const r=board.getBoundingClientRect();return {x:clientX-r.left,y:clientY-r.top,inside:clientX>=r.left&&clientX<=r.right&&clientY>=r.top&&clientY<=r.bottom};}
function hoverAt(clientX,clientY){
 const point=pointOnBoard(clientX,clientY);if(!point.inside){clearTargets();return;}
 // Keep the anchor while crossing from its card into one of its relation targets.
 if(targetAnchor){const hit=[...$('targets').children].find(button=>{const r=button.getBoundingClientRect();return clientX>=r.left-7&&clientX<=r.right+7&&clientY>=r.top-7&&clientY<=r.bottom+7;});if(hit){hotRelation=hit.dataset.relation;drawTargets();return;}}
 hotRelation=null;let nearest=null,distance=Infinity;
 for(const id of state.placed){const p=state.positions[id],d=Math.hypot(point.x-(p.x*camera.scale+camera.x),point.y-(p.y*camera.scale+camera.y));if(d<distance){nearest=id;distance=d;}}
 if(distance<Math.max(75,80*camera.scale)){targetAnchor=nearest;drawTargets();}else if(targetAnchor){const p=state.positions[targetAnchor];if(Math.hypot(point.x-(p.x*camera.scale+camera.x),point.y-(p.y*camera.scale+camera.y))>175)clearTargets();else drawTargets();}
}
$('targets').addEventListener('click',e=>{const target=e.target.closest('[data-relation]');if(target&&selected&&targetAnchor)attempt(target.dataset.relation);});
function attempt(relation){
 if(!selected||!targetAnchor)return;const id=selected,anchor=targetAnchor,p=person(id),a=person(anchor),outcome=place(state,id,anchor,relation);
 if(!outcome.ok){if(outcome.reason==='relation')say(`${a.name}の「${relationName(relation)}」ではなさそうです。`,true);clearTargets();renderStats();persist();return;}
 const oldAnchor=state.positions[anchor];state.positions=layoutFamily(state);camera.x+=(oldAnchor.x-state.positions[anchor].x)*camera.scale;camera.y+=(oldAnchor.y-state.positions[anchor].y)*camera.scale;lineFocus=null;
 selected=null;clearTargets();renderBoard(id);renderHand();renderStats();renderHint();camera=revealCamera(camera,state.positions[id],board.clientWidth,board.clientHeight);updateTransform(true);say(`${p.name}が、${a.name}の${relationName(relation)}としてつながりました。`);persist();
 if(state.complete){records.best[state.stage.id]={elapsed:state.elapsed,mistakes:state.mistakes,hints:hintCount()};persist();results();}
}
function results(){fit();openDialog(`<p class="eyebrow">FAMILY TREE COMPLETED</p><h2>ひとつの系譜が、つながった。</h2><p>${state.stage.title} · ${state.stage.people.length}${state.stage.id==='tokugawa'?'人':'頭'}のカードを配置しました。</p><div class="result-stats"><div>プレイ時間<b>${formatTime(state.elapsed)}</b></div><div>ミス<b>${state.mistakes}</b></div><div>ヒント<b>${hintCount()}</b></div><div>手札の入れ替え<b>${state.exchanges}</b></div></div><details><summary>つながりを振り返る</summary><ul>${state.stage.people.filter(p=>p.id!==state.stage.anchor).map(p=>`<li><strong>${p.name}</strong><br>${p.clues[1]}</li>`).join('')}</ul></details><button class="button" data-action="home">ほかの系譜をたどる</button><button class="button secondary" data-action="restart-confirm">もう一度遊ぶ</button>`,'完成した系譜を見る');}
// Pointer events unify mouse, pen and touch. No HTML Drag and Drop dependency on iOS.
$('hand').addEventListener('pointerdown',e=>{
 const button=e.target.closest('[data-card]');if(!button||e.button!==0||drag)return;e.preventDefault();updateTransform();selectCard(button.dataset.card);drag={pointerId:e.pointerId,id:selected,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,active:false};$('app').setPointerCapture(e.pointerId);
});
$('hand').addEventListener('click',e=>{if(e.detail!==0)return;const button=e.target.closest('[data-card]');if(button)selectCard(button.dataset.card);});
board.addEventListener('pointerdown',e=>{
 if(drag||e.button!==0||e.target.closest('.board-tools,.relation-target'))return;e.preventDefault();board.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size===1)pan={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,node:e.target.closest('[data-node]')?.dataset.node,moved:false};else if(pan)pan.moved=true;
});
window.addEventListener('pointermove',e=>{
 if(drag&&e.pointerId===drag.pointerId){drag.x=e.clientX;drag.y=e.clientY;if(!drag.active&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>6){drag.active=true;$('drag-ghost').textContent=person(drag.id).name;$('drag-ghost').hidden=false;document.body.classList.add('drag-active');$('hand').querySelector(`[data-card="${drag.id}"]`)?.classList.add('dragging');frame=requestAnimationFrame(autoPan);}
 if(drag.active){$('drag-ghost').style.left=`${e.clientX}px`;$('drag-ghost').style.top=`${e.clientY-28}px`;hoverAt(e.clientX,e.clientY);}return;}
 if(!pointers.has(e.pointerId))return;const old=[...pointers.values()];pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const next=[...pointers.values()];
 if(pointers.size===2){const oldMid={x:(old[0].x+old[1].x)/2,y:(old[0].y+old[1].y)/2},mid={x:(next[0].x+next[1].x)/2,y:(next[0].y+next[1].y)/2},d1=Math.hypot(old[0].x-old[1].x,old[0].y-old[1].y),d2=Math.hypot(next[0].x-next[1].x,next[0].y-next[1].y),r=board.getBoundingClientRect();if(d1>2)zoomAt(d2/d1,oldMid.x-r.left,oldMid.y-r.top);camera.x+=mid.x-oldMid.x;camera.y+=mid.y-oldMid.y;updateTransform();if(pan)pan.moved=true;
 }else if(pan&&pan.id===e.pointerId){if(Math.hypot(e.clientX-pan.startX,e.clientY-pan.startY)>5)pan.moved=true;if(pan.moved){camera.x+=e.clientX-pan.x;camera.y+=e.clientY-pan.y;clearTargets();updateTransform();}pan.x=e.clientX;pan.y=e.clientY;}
});
function autoPan(){if(!drag?.active)return;const p=pointOnBoard(drag.x,drag.y);if(p.inside){const dx=p.x<28?3:p.x>board.clientWidth-28?-3:0,dy=p.y<34?3:p.y>board.clientHeight-34?-3:0;if(dx||dy){camera.x+=dx;camera.y+=dy;updateTransform();hoverAt(drag.x,drag.y);}}frame=requestAnimationFrame(autoPan);}
function cancelDrag(){if(frame)cancelAnimationFrame(frame);frame=null;drag=null;$('drag-ghost').hidden=true;document.body.classList.remove('drag-active');$('hand').querySelectorAll('.dragging').forEach(b=>b.classList.remove('dragging'));}
window.addEventListener('pointerup',e=>{
 if(drag&&e.pointerId===drag.pointerId){const active=drag.active;if(active)hoverAt(e.clientX,e.clientY);const relation=hotRelation,anchor=targetAnchor;cancelDrag();if(active&&relation&&anchor)attempt(relation);else if(active&&anchor)say('つなぐ関係を選んでください。');return;}
 if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);if(pan&&pan.id===e.pointerId&&!pan.moved&&pan.node){if(selected){targetAnchor=pan.node;drawTargets();say(`${person(selected).name}を、${person(pan.node).name}のどの関係へ置きますか？`);}else focusLines(pan.node);}
 if(pointers.size===1){const [id,p]=[...pointers.entries()][0];pan={id,x:p.x,y:p.y,startX:p.x,startY:p.y,moved:true};}else pan=null;
});
window.addEventListener('pointercancel',e=>{if(drag?.pointerId===e.pointerId){cancelDrag();clearTargets();}pointers.delete(e.pointerId);pan=null;});
window.addEventListener('blur',()=>{cancelDrag();pointers.clear();pan=null;clearTargets();persist();});
$('nodes').addEventListener('click',e=>{if(e.detail!==0)return;const node=e.target.closest('[data-node]');if(node){if(selected){targetAnchor=node.dataset.node;drawTargets();}else focusLines(node.dataset.node);}});
window.addEventListener('keydown',e=>{if(e.key==='Escape'){cancelDrag();clearTargets();selected=null;lineFocus=null;renderLines();for(const node of $('nodes').querySelectorAll('[data-node]')){node.classList.remove('line-focused');node.setAttribute('aria-pressed','false');}if(state){renderHand();renderHint();renderStats();}}});
let previousWidth=0,previousHeight=0;
new ResizeObserver(()=>{if(!state||!board.clientWidth)return;if(!previousWidth){previousWidth=board.clientWidth;previousHeight=board.clientHeight;return;}camera.x+=(board.clientWidth-previousWidth)/2;camera.y+=(board.clientHeight-previousHeight)/2;previousWidth=board.clientWidth;previousHeight=board.clientHeight;updateTransform();}).observe(board);
setInterval(()=>{const now=performance.now();if(state&&!state.complete&&!document.hidden&&!modal.open){state.elapsed+=Math.max(0,Math.min(now-lastTick,1500));$('timer').textContent=formatTime(state.elapsed);if(now-lastSaved>10000){persist();lastSaved=now;}}lastTick=now;},500);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelDrag();pointers.clear();pan=null;persist();}lastTick=performance.now();});window.addEventListener('pagehide',persist);
renderHome();
