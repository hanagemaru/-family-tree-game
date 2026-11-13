import {stages,stageById} from './data.js';
import {relationLabels,newGame,place,pack,restore,formatTime,fitCamera,revealCamera} from './core.js';
import {horseSex,horseSexLabel} from './horse-sex.js';
import {placementLabels,directionalTarget,dragFrameScreen,insideDragFrame,dragDropReady} from './placement-preview.js';
import {layoutFamily,buildDiagram,diagramSvg} from './diagram.js';
import {dragHotspot,screenNodes,pickDropCard,dropDecision} from './interaction.js';
import {createRandomSeed,generateRandomHorseSession,restoreRandomHorseSession} from './random-horse-session.js';
import {seededRandom} from './random-horse-stage.js';
import {findCorrectPlacement,findPlayablePlacement,horsePlacementHint,completedAnswer} from './game-assistance.js';
const $=id=>document.getElementById(id),storageKey='family-tree-game:v1';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let records={sessions:{},best:{}};
try{const parsed=JSON.parse(localStorage.getItem(storageKey));if(parsed&&typeof parsed==='object')records={sessions:parsed.sessions||{},best:parsed.best||{},randomHorse:parsed.randomHorse||null};}catch{}
let horseSnapshot=null,randomHorse=null,randomHorseError='';
let state=null,selected=null,camera={x:0,y:0,scale:1},targetAnchor=null,hoverAnchor=null,drag=null,pan=null,frame=null,lastTick=performance.now(),lastSaved=0,diagram=null,lineFocus=null,lastLineDiagram=null,lastLineScale=null,lastLineFocus=null,dialogKind='info',dragPlacement=null;
const board=$('board'),modal=$('modal'),pointers=new Map();
const person=id=>state.stage.people.find(p=>p.id===id);
const isHorseStage=stage=>stage?.id==='thoroughbred'||stage?.category==='競走馬'||stage?.category==='競走馬の血統';
const isRandomHorseStage=stage=>stage?.id?.startsWith('horse-generated:');
const hintCount=()=>Object.values(state.hints).reduce((sum,n)=>sum+n,0);
const newStageGame=stage=>isRandomHorseStage(stage)?newGame(stage,seededRandom(`deck:${records.randomHorse?.seed||''}`)):newGame(stage);
function persist(){try{if(state)records.sessions[state.stage.id]=pack(state);localStorage.setItem(storageKey,JSON.stringify(records));}catch{}}
function say(message,error=false){const box=$('status');box.textContent=message;box.classList.toggle('error',error);box.classList.remove('flash');void box.offsetWidth;if(message)box.classList.add('flash');}
function savedGame(stage){try{return restore(records.sessions[stage.id],stage);}catch{return null;}}
function fixedStageCard(stage,index){const saved=savedGame(stage),resume=saved&&!saved.complete,best=records.best[stage.id],history=stage.id==='tokugawa';return `<article class="stage-card ${history?'history-theme':'horse-theme'}"><div class="stage-art" aria-hidden="true"><span class="art-index">COLLECTION 0${index+1}</span><div class="theme-emblem">${history?'<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="51"/><path d="M60 59C27 52 28 18 49 23C65 26 68 43 60 59ZM62 61C75 29 104 39 98 59C92 75 77 75 62 61ZM58 63C78 90 53 111 39 95C27 80 36 66 58 63Z"/><circle cx="60" cy="61" r="6"/></svg>':'<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="51"/><path d="M35 93C36 73 45 62 53 55L45 48L52 28L60 35L70 26L73 41C85 46 91 59 85 68L75 63L65 73L72 94Z"/></svg>'}</div><span class="art-caption">${history?'TOKUGAWA FAMILY':'THOROUGHBRED'}</span></div><div class="stage-content"><div class="stage-meta"><span>${stage.category}</span><span>${stage.people.length}${history?'人':'頭'}のカード</span></div><h3>${stage.title}</h3><p>${stage.summary}</p><span class="tag">${stage.tag}</span><div class="stage-bottom"><span class="best">${resume?`<span class="resume-dot"></span>${saved.placed.length} / ${stage.people.length} 配置済み`:best?`✓ クリア済み · ${formatTime(best.elapsed)}`:'いつでも、あなたのペースで'}</span><button class="button" data-start="${stage.id}">${resume?'つづきから':'はじめる'} <span aria-hidden="true">→</span></button></div></div></article>`;}
function randomStageCard(){
 const saved=randomHorse&&savedGame(randomHorse.stage),resume=saved&&!saved.complete,best=randomHorse&&records.best[randomHorse.stage.id];
 const status=randomHorseError||(!horseSnapshot?'問題データを準備中…':resume?`${saved.placed.length} / 18 配置済み`:best?`✓ クリア済み · ${formatTime(best.elapsed)}`:'毎回ちがう18頭に挑戦');
 return `<article class="stage-card horse-theme random-theme"><div class="stage-art" aria-hidden="true"><span class="art-index">COLLECTION 03 · RANDOM</span><div class="random-emblem">↻</div><span class="art-caption">SEEDED PEDIGREE CHALLENGE</span></div><div class="stage-content"><div class="stage-meta"><span>競走馬</span><span>18頭のカード</span></div><h3>ランダム血統チャレンジ</h3><p>大規模な血統データから、つながる18頭を自動で選びます。</p><span class="tag">父母・産駒・きょうだい</span><div class="stage-bottom"><span class="best">${resume?'<span class="resume-dot"></span>':''}${status}</span><button class="button" data-random-start ${horseSnapshot?'':'disabled'}>${resume?'つづきから':'新しい問題'} <span aria-hidden="true">→</span></button></div></div></article>`;
}
function renderHome(){
 $('stage-list').innerHTML=stages.map(fixedStageCard).join('')+randomStageCard();
}
function openDialog(html,closeLabel='閉じる',kind='info'){dialogKind=kind;modal.classList.toggle('placement-dialog',kind==='relation'||kind==='anchor');$('modal-content').innerHTML=html;const heading=$('modal-content').querySelector('h2');if(heading)heading.id='dialog-title';$('modal-close').textContent=closeLabel;if(!modal.open)modal.showModal();const first=$('modal-content').querySelector('button');if(first)first.focus({preventScroll:true});lastTick=performance.now();}
function closeDialog(){modal.close();lastTick=performance.now();}
modal.addEventListener('close',()=>{lastTick=performance.now();if(state){renderCaption();if(selected)say(`${person(selected).name}を選択中。場の相手をタップするか、一覧から選べます。`);}});
$('modal-close').addEventListener('click',closeDialog);
function help(){openDialog(`<p class="eyebrow">HOW TO PLAY</p><h2>相手に置いて、関係を選ぶ。</h2><ol><li>手札をドラッグすると、相手の上に「親」、左右に「きょうだい」、下に「子」の点線枠が出ます。点線枠に位置マーカーを重ね、少し止めてから離すと配置できます。枠の外で離した場合は関係を選びます。</li><li>場のカード上で離した場合や、名前一覧から相手を選んだ場合は、関係ボタンを1回タップして配置できます。</li><li>手札をタップ → 相手をタップ、でも同じ操作ができます。押しにくい相手は「相手を一覧から」で選べます。</li><li>置ける札がない状態は自動で防ぎます。困ったらヒントを確認できます。メニューから答えを見ることもできます。時間制限はありません。</li><li>●は実際の接続点、線の切れ目は非接続の交差。手札未選択で場のカードをタップすると関係線を強調します。</li><li>盤面をスワイプして移動。ピンチ、＋ / −で拡縮し、「全体」で見渡せます。</li></ol><p class="scope">${state?escape(state.stage.scope):'進行はこのブラウザへ自動保存されます。'}</p>`);}
$('help-button').addEventListener('click',help);
function showSources(){const list=state?[state.stage]:stages;openDialog(`<p class="eyebrow">ABOUT THE FAMILY TREES</p><h2>題材・出典</h2>${list.map(stage=>`<h3>${stage.title}</h3><p>${stage.description}</p><p class="scope">${stage.scope}</p><ul>${[...new Map([...stage.sources,...stage.people.map(p=>p.source)].map(s=>[s.url,s])).values()].map(s=>`<li><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.label)}</a></li>`).join('')}</ul>`).join('')}<p class="scope">関係情報をもとに作成した選抜ステージです。人物・馬の肖像や写真は転載していません。</p>`);}
$('sources-button').addEventListener('click',showSources);
$('stage-list').addEventListener('click',e=>{const button=e.target.closest('[data-start]');if(button)start(stageById(button.dataset.start));if(e.target.closest('[data-random-start]'))startRandomHorse(false);});
function startRandomHorse(fresh){
 if(!horseSnapshot)return;
 try{
  const saved=!fresh&&randomHorse&&savedGame(randomHorse.stage);
  if(saved&&!saved.complete){start(randomHorse.stage);return;}
  randomHorse=generateRandomHorseSession(horseSnapshot,createRandomSeed());randomHorseError='';records.randomHorse=randomHorse.descriptor;persist();start(randomHorse.stage,true);
 }catch{randomHorseError='問題の生成に失敗しました。';renderHome();}
}
function start(stage,fresh=false){
 persist();state=(!fresh&&savedGame(stage))||newStageGame(stage);if(state.complete&&!fresh)state=newStageGame(stage);selected=null;targetAnchor=null;lineFocus=null;state.positions=layoutFamily(state);
 $('game-screen').classList.remove('inspect-mode');board.classList.remove('expanded');$('board-expand').textContent='広く';$('board-expand').setAttribute('aria-pressed','false');$('home-screen').hidden=true;$('game-screen').hidden=false;document.body.classList.add('playing');$('stage-category').textContent=stage.category;$('stage-title').textContent=stage.title;hoverAnchor=null;
 document.body.dataset.stage=stage.id;render();fit(false);previousWidth=board.clientWidth;previousHeight=board.clientHeight;lastTick=performance.now();say('');persist();window.scrollTo({top:0,behavior:'instant'});
}
function goHome(){persist();cancelDrag();pointers.clear();pan=null;state=null;selected=null;clearTargets();$('game-screen').hidden=true;$('home-screen').hidden=false;document.body.classList.remove('playing');renderHome();closeDialog();}
function confirmAnswer(){openDialog('<h2>答えを見て終了しますか？</h2><p>残りのカードを正しい関係で配置し、完成図を表示します。通常のクリア記録には含まれません。</p><button class="button" data-action="give-up">答えを表示する</button>','プレイを続ける');}
function menu(){if(!state){goHome();return;}const random=isRandomHorseStage(state.stage);openDialog(`<p class="eyebrow">${state.stage.category}</p><h2>${state.stage.title}</h2>${random?`<p class="random-seed">問題ID <code>${escape(records.randomHorse?.seed||'')}</code></p>`:''}<p>進行は自動保存されています。</p><button class="button secondary" data-action="help">遊び方</button><button class="button secondary" data-action="sources">題材・出典</button><button class="button" data-action="home">ステージ選択へ</button><button class="button secondary" data-action="restart-confirm">${random?'同じ問題を最初から':'最初からやり直す'}</button>${random?'<button class="button secondary" data-action="random-retry-confirm">別の問題に挑戦</button>':''}${!state.complete?'<button class="button secondary" data-action="give-up-confirm">諦めて答えを見る</button>':''}${state.complete?`<button class="button secondary" data-action="result">${state.gaveUp?'答えの系譜を見る':'完成記録を見る'}</button>`:''}`);}
$('menu-button').addEventListener('click',menu);$('home-button').addEventListener('click',()=>state?menu():goHome());
modal.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action==='home')goHome();if(action==='restart-confirm')openDialog('<h2>この系譜をやり直しますか？</h2><p>今の配置と記録をリセットして、同じカードで最初から始めます。</p><button class="button" data-action="restart">やり直す</button>','続ける');if(action==='random-retry-confirm')openDialog('<h2>別の問題に挑戦しますか？</h2><p>新しい問題IDで18頭を選び直します。今の問題の進行は終了します。</p><button class="button" data-action="random-retry">新しい問題を始める</button>','続ける');if(action==='restart'){const stage=state.stage;closeDialog();start(stage,true);}if(action==='random-retry'){closeDialog();startRandomHorse(true);}if(action==='give-up-confirm')confirmAnswer();if(action==='give-up')showAnswer();if(action==='result')results();if(action==='help')help();if(action==='sources')showSources();});
function render(){renderBoard();renderHand();renderStats();renderHint();}
function renderStats(){
 $('placed-count').textContent=state.placed.length;$('total-count').textContent=` / ${state.stage.people.length}`;$('timer').textContent=formatTime(state.elapsed);$('mistake-count').textContent=state.mistakes;$('hint-count').textContent=hintCount();$('progress-fill').style.width=`${state.placed.length/state.stage.people.length*100}%`;$('hand-count').textContent=`${state.hand.length}枚`;$('stock-count').textContent=`残り ${state.deck.length}`;$('stock-pile').classList.toggle('empty',!state.deck.length);$('hint-button').disabled=!selected||state.complete;
 renderCaption();
 renderSelection();
}
function renderSelection(){
 $('selection-summary').textContent=selected?`${person(selected).name} を選択中`:'';
 $('choose-anchor-button').disabled=!selected||state.complete;$('clear-selection-button').disabled=!selected;
}
function renderBoard(newId){
 $('nodes').innerHTML=state.placed.map(id=>{const p=person(id),position=state.positions[id];return `<button class="person-node table-card ${isHorseStage(state.stage)?'horse':''} ${id===state.stage.anchor?'anchor':''} ${id===newId?'new-card':''}" data-node="${id}" aria-pressed="false" style="left:${position.x}px;top:${position.y}px" aria-label="${escape(p.name)}${id===state.stage.anchor?'、起点のカード':''}">${cardFace(id)}</button>`;}).join('');
 diagram=buildDiagram(state);renderLines();
 updateTransform();
}
function renderLines(){if(!diagram||(diagram===lastLineDiagram&&camera.scale===lastLineScale&&lineFocus===lastLineFocus))return;$('edges').innerHTML=diagramSvg(diagram,{scale:camera.scale,focus:lineFocus});lastLineDiagram=diagram;lastLineScale=camera.scale;lastLineFocus=lineFocus;}
function focusLines(id){lineFocus=lineFocus===id?null:id;renderLines();for(const node of $('nodes').querySelectorAll('[data-node]')){node.classList.toggle('line-focused',node.dataset.node===lineFocus);node.setAttribute('aria-pressed',String(node.dataset.node===lineFocus));}say(lineFocus?`${person(lineFocus).name}に直接つながる関係を強調しています。もう一度タップで解除。`:'関係線の強調を解除しました。');}
function cardFace(id){
 const p=person(id),horse=isHorseStage(state.stage),number=state.stage.people.findIndex(p=>p.id===id)+1;
 const sex=horse?horseSexLabel(p.sex||horseSex(id)):null;
 const sexMarkup=horse?`<span class="card-sex" aria-label="性別：${sex}">${sex}</span>`:'';
 const art=horse?'<path d="M34 115C34 91 45 70 61 57L47 50L55 21L67 32L83 19L85 43C103 50 115 68 103 81L86 71L72 85L82 115Z"/><path d="M39 109C22 86 31 62 43 51L48 65L43 90Z" opacity=".5"/>':'<path d="M38 65L22 45L37 49L42 31L54 38L65 22L76 38L88 31L93 49L108 45L92 65Z"/><path d="M47 66H84L79 91L66 102L52 91Z"/><path d="M26 121L35 100L50 94L65 108L81 94L99 101L108 121Z"/><path d="M59 42L65 34L71 42L65 53Z" fill="#f0d69a"/>';
 return `<span class="card-corner" aria-hidden="true">${String(number).padStart(2,'0')}<i>${horse?'血統':'歴史'}</i></span>${sexMarkup}<span class="card-art" aria-hidden="true"><span class="card-orbit"></span><svg viewBox="0 0 130 135">${art}</svg><span class="card-seal">${horse?'名馬':'徳川'}</span></span><span class="card-name">${escape(p.name)}</span><small>${horse?'THOROUGHBRED COLLECTION':'TOKUGAWA COLLECTION'}</small>`;
}
function renderHand(){
 $('hand').innerHTML=state.hand.map((id,index)=>`<button class="hand-card ${isHorseStage(state.stage)?'horse':''} ${id===selected?'selected':''}" style="--slot:${index};--tint:${(state.stage.people.findIndex(p=>p.id===id)*19)%70}deg" data-card="${id}" aria-pressed="${id===selected}" aria-label="${escape(person(id).name)}。ドラッグするか、選択して場のカードをタップ">${cardFace(id)}</button>`).join('');
 if(state.complete)$('hand').innerHTML='<p class="complete-note">すべてのカードがつながりました。</p>';
}
function animateDraw(beforeHand){
 const dealt=state.hand.find(id=>!beforeHand.includes(id));if(!dealt)return;
 const card=$('hand').querySelector(`[data-card="${dealt}"]`),pile=$('stock-pile');
 if(!card||typeof card.animate!=='function'||!pile?.getBoundingClientRect)return;
 const start=pile.getBoundingClientRect(),end=card.getBoundingClientRect();
 const dx=start.left+start.width/2-end.left-end.width/2,dy=start.top+start.height/2-end.top-end.height/2;
 const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 if(!reduce)card.animate([{transform:`translate(${dx}px,${dy}px) scale(.6) rotate(-12deg)`,opacity:.15},{transform:'translate(0,0) scale(1) rotate(0deg)',opacity:1}],{duration:420,easing:'cubic-bezier(.16,.8,.22,1)'});
}
function selectCard(id){clearDragPreview();selected=id;lineFocus=null;renderLines();for(const node of $('nodes').querySelectorAll('[data-node]')){node.classList.remove('line-focused');node.setAttribute('aria-pressed','false');}clearTargets();for(const button of $('hand').querySelectorAll('[data-card]')){const active=button.dataset.card===id;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));}renderHint();renderStats();say(`${person(id).name}を選択中。場の相手を選んでください。`);}
function renderHint(){
 const box=$('hint-box');box.hidden=true;if(!selected)return;
 const level=state.hints[selected]||0;if(!level)return;
 const generated=isRandomHorseStage(state.stage),move=generated?findCorrectPlacement(state,selected):null;
 const clue=generated?horsePlacementHint(state,selected,level):person(selected).clues[level-1];
 const action=level<2?'<button class="text-button" id="next-hint">関係まで教えてもらう</button>':`${generated&&move?'<button class="text-button" id="hint-go-to-relation">この相手を選ぶ</button>':''}<button class="text-button" id="hint-give-up">答えを見て終了</button>`;
 box.hidden=false;
 box.innerHTML=`<strong>${escape(person(selected).name)}</strong> <small>ヒント ${level} / 2</small><br>${escape(clue)}${action}`;
 if(level<2)$('next-hint').addEventListener('click',revealHint);
 if(generated&&move&&level===2)$('hint-go-to-relation').addEventListener('click',()=>chooseRelations(move.anchorId));
 if(level===2)$('hint-give-up').addEventListener('click',confirmAnswer);
}
function revealHint(){
 if(!selected){say('ヒントを見るカードを、手札から選んでください。');return;}
 if(isRandomHorseStage(state.stage)&&!findCorrectPlacement(state,selected)){
  const next=findPlayablePlacement(state);
  if(next){selectCard(next.cardId);say(`今置ける「${person(next.cardId).name}」を選びました。ヒントを押すとつながる相手が分かります。`);}
  else say('今置けるカードが見つかりません。メニューから答えを見るか、やり直してください。',true);
  return;
 }
 state.hints[selected]=Math.min(2,(state.hints[selected]||0)+1);
 renderHint();renderStats();persist();
}
$('hint-button').addEventListener('click',revealHint);
// No voluntary hand exchange: playable cards are guaranteed by core.deal/ensurePlayable.
function updateTransform(animate=false){board.classList.toggle('overview',camera.scale<.68);$('world').classList.toggle('following',animate);$('world').style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;renderLines();}
function fit(animate=true){if(!state||board.clientWidth<=0||board.clientHeight<=0)return;camera=fitCamera(state.positions,board.clientWidth,board.clientHeight);updateTransform(animate);}
$('fit-button').addEventListener('click',fit);
$('board-expand').addEventListener('click',()=>{const expanded=board.classList.toggle('expanded');$('game-screen').classList.toggle('inspect-mode',expanded);$('board-expand').textContent=expanded?'戻す':'広く';$('board-expand').setAttribute('aria-pressed',String(expanded));previousWidth=board.clientWidth;previousHeight=board.clientHeight;fit();});
function zoomAt(factor,x=board.clientWidth/2,y=board.clientHeight/2){const next=Math.max(.18,Math.min(1.8,camera.scale*factor)),ratio=next/camera.scale;camera={x:x-(x-camera.x)*ratio,y:y-(y-camera.y)*ratio,scale:next};updateTransform();}
$('zoom-in').addEventListener('click',()=>zoomAt(1.2));$('zoom-out').addEventListener('click',()=>zoomAt(1/1.2));
board.addEventListener('wheel',e=>{e.preventDefault();const rect=board.getBoundingClientRect();zoomAt(Math.exp(-e.deltaY*.002),e.clientX-rect.left,e.clientY-rect.top);},{passive:false});
board.addEventListener('keydown',e=>{if(e.target!==board)return;const delta={ArrowLeft:[50,0],ArrowRight:[-50,0],ArrowUp:[0,50],ArrowDown:[0,-50]}[e.key];if(delta){e.preventDefault();camera.x+=delta[0];camera.y+=delta[1];updateTransform();}if(e.key==='+'||e.key==='=')zoomAt(1.2);if(e.key==='-')zoomAt(1/1.2);if(e.key==='0')fit();});
function paintTarget(){for(const node of $('nodes').querySelectorAll('[data-node]'))node.classList.toggle('targeted',node.dataset.node===(hoverAnchor||targetAnchor));$('drag-ghost').classList.toggle('over-card',!!hoverAnchor);}
function clearTargets(){targetAnchor=null;hoverAnchor=null;paintTarget();if(state)renderCaption();}
function renderCaption(){
 $('board-caption').textContent=dragPlacement?`${person(dragPlacement.anchorId).name}の${relationName(dragPlacement.relation)} · ${camera.scale<.55?'離すと名前一覧':dragDropReady(dragPlacement,performance.now())?'離して配置':'点線枠に重ね、少し止めて離す'}`:hoverAnchor?`${person(hoverAnchor).name}へドロップ → 関係を選ぶ`:state.complete?(state.gaveUp?'答えの系譜 · スワイプと拡縮で見渡せます':'完成した系譜 · スワイプと拡縮で見渡せます'):selected?`${person(selected).name}の相手をタップ、またはカードへドロップ`:'手札を相手のカードへドロップ';
}
function availableRelations(){return isHorseStage(state.stage)?['parent','child','sibling']:['parent','child','spouse','sibling'];}
function relationName(type){return isHorseStage(state.stage)?({parent:'父・母',child:'産駒',sibling:'きょうだい'}[type]):relationLabels[type];}
function clearDragPreview(){
 dragPlacement=null;
 const frame=$('drag-preview');
 if(frame){
  frame.hidden=true;frame.textContent='';
  frame.classList.remove('over-slot','armed','disabled');
 }
}
function updateDragPreview(point){
 const overlay=$('drag-preview');
 const nodes=screenNodes(state.positions,camera),prior=dragPlacement;
 // Once the pointer reaches a previously displayed frame, retain the same
 // target; otherwise the quadrant algorithm can flip at the slot boundary.
 const hoveringPrior=prior?.frame&&insideDragFrame(point,prior.frame);
 const hit=hoveringPrior?prior:directionalTarget(point,nodes,prior);
 const node=nodes.find(n=>n.id===hit?.anchorId);
 const frame=hit&&node?dragFrameScreen(node,hit.relation,hit.side,
  {width:board.clientWidth,height:board.clientHeight},nodes):null;
 if(!overlay)return;
 if(!hit||!frame){clearDragPreview();return;}
 const overSlot=insideDragFrame(point,frame),now=performance.now();
 const same=prior&&prior.anchorId===hit.anchorId&&
  prior.relation===hit.relation&&prior.side===hit.side&&prior.overSlot&&overSlot&&
  Math.abs(prior.frame.x-frame.x)<2&&Math.abs(prior.frame.y-frame.y)<2;
 dragPlacement={anchorId:hit.anchorId,relation:hit.relation,side:hit.side,
  frame,overSlot,enteredAt:same?prior.enteredAt:now};
 const ready=dragDropReady(dragPlacement,now)&&camera.scale>=.55;
 overlay.hidden=false;
 overlay.style.left=`${frame.x}px`;
 overlay.style.top=`${frame.y}px`;
 overlay.dataset.relation=hit.relation;
 overlay.classList.toggle('over-slot',overSlot);
 overlay.classList.toggle('armed',ready);
 overlay.classList.toggle('disabled',camera.scale<.55);
 overlay.innerHTML=`<span>${placementLabels[hit.relation].arrow}</span><small>${placementLabels[hit.relation].label}</small>`;
}
function chooseRelations(id){
 if(!selected||!state.hand.includes(selected)||!state.placed.includes(id))return;
 clearDragPreview();targetAnchor=id;hoverAnchor=null;paintTarget();
 const choices=availableRelations().map(type=>{
  const spec=placementLabels[type];
  return `<button class="relation-choice" data-place-relation="${type}"><span class="relation-arrow" aria-hidden="true">${spec.arrow}</span><span class="relation-text">${spec.label}</span><small>${escape(spec.detail)}</small></button>`;
 }).join('');
 openDialog(`<p class="eyebrow">関係を選択</p><h2 class="compact-relation-title">${escape(person(selected).name)}<span> は </span>${escape(person(id).name)}<span> の…</span></h2><div class="relation-choices ${isHorseStage(state.stage)?'three-choice':''}">${choices}</div><p id="placement-error" class="placement-error" role="alert"></p><button class="text-button" data-action="change-anchor">相手を変える</button>`,'キャンセル','relation');
}
function chooseAnchor(){
 if(!selected)return;clearDragPreview();say(`${person(selected).name}の相手を選んでください。`);
 openDialog(`<p class="eyebrow">場のカードを選ぶ</p><h2>${escape(person(selected).name)}の相手</h2><p>${camera.scale<.55?'盤面が縮小されているため、名前の一覧から選びます。':'このあと、相手との関係を選びます。'}</p><div class="anchor-choices">${state.placed.map(id=>`<button class="anchor-choice" data-pick-anchor="${id}">${escape(person(id).name)}</button>`).join('')}</div>`,'戻る（選択札は保持）','anchor');
}
$('choose-anchor-button').addEventListener('click',chooseAnchor);
$('clear-selection-button').addEventListener('click',()=>{selected=null;clearTargets();renderHand();renderHint();renderStats();say('選択を解除しました。');});
modal.addEventListener('click',e=>{
 const choice=e.target.closest('[data-place-relation]');if(choice&&!choice.disabled){attempt(choice.dataset.placeRelation);return;}
 const anchor=e.target.closest('[data-pick-anchor]');if(anchor){chooseRelations(anchor.dataset.pickAnchor);return;}
 if(e.target.closest('[data-action="change-anchor"]'))chooseAnchor();
});
function pointOnBoard(clientX,clientY){const r=board.getBoundingClientRect();return {x:clientX-r.left,y:clientY-r.top,inside:clientX>=r.left&&clientX<=r.right&&clientY>=r.top&&clientY<=r.bottom};}
function hoverAt(clientX,clientY){
 const point=pointOnBoard(clientX,clientY);
 updateDragPreview(point);hoverAnchor=dragPlacement?.anchorId||pickDropCard(point,screenNodes(state.positions,camera),hoverAnchor);$('drag-ghost').classList.toggle('in-board',point.inside);paintTarget();renderCaption();
}
function attempt(relation){
 if(!selected||!targetAnchor)return;const id=selected,anchor=targetAnchor,p=person(id),a=person(anchor),beforeHand=[...state.hand],outcome=place(state,id,anchor,relation);
 if(!outcome.ok){if(outcome.reason==='relation'){if(!modal.open)chooseRelations(anchor);const message=`${p.name}は${a.name}の「${relationName(relation)}」ではなさそうです。`;say(message,true);if($('placement-error'))$('placement-error').textContent=message;const button=$('modal-content').querySelector(`[data-place-relation="${relation}"]`);if(button)button.disabled=true;}renderStats();persist();return;}
 clearDragPreview();const oldAnchor=state.positions[anchor];state.positions=layoutFamily(state);camera.x+=(oldAnchor.x-state.positions[anchor].x)*camera.scale;camera.y+=(oldAnchor.y-state.positions[anchor].y)*camera.scale;lineFocus=null;
 selected=null;closeDialog();clearTargets();renderBoard(id);renderHand();animateDraw(beforeHand);renderStats();renderHint();camera=revealCamera(camera,state.positions[id],board.clientWidth,board.clientHeight);updateTransform(true);say(`${p.name}が、${a.name}の${relationName(relation)}としてつながりました。`);persist();
 if(state.complete){records.best[state.stage.id]={elapsed:state.elapsed,mistakes:state.mistakes,hints:hintCount()};persist();results();}
}
function showAnswer(){
 const answer=completedAnswer(state);
 if(!answer){say('答えを表示できませんでした。進行は変更されていません。',true);closeDialog();return;}
 try{answer.positions=layoutFamily(answer);}catch{say('完成図を作成できませんでした。進行は変更されていません。',true);closeDialog();return;}
 state=answer;selected=null;lineFocus=null;closeDialog();clearTargets();render();fit(false);persist();results();
}
function results(){fit();const random=isRandomHorseStage(state.stage);openDialog(`<p class="eyebrow">${state.gaveUp?'ANSWER REVEALED':'FAMILY TREE COMPLETED'}</p><h2>${state.gaveUp?'答えの系譜':'ひとつの系譜が、つながった。'}</h2>${state.gaveUp?'<p>降参して残りの答えを表示しました。クリア記録には含まれません。</p>':''}<p>${state.stage.title} · ${state.stage.people.length}${state.stage.id==='tokugawa'?'人':'頭'}のカードを配置しました。</p>${random?`<p class="random-seed">問題ID <code>${escape(records.randomHorse?.seed||'')}</code></p>`:''}<div class="result-stats"><div>プレイ時間<b>${formatTime(state.elapsed)}</b></div><div>ミス<b>${state.mistakes}</b></div><div>ヒント<b>${hintCount()}</b></div></div><details><summary>つながりを振り返る</summary><ul>${state.stage.people.filter(p=>p.id!==state.stage.anchor).map(p=>`<li><strong>${escape(p.name)}</strong><br>${escape(p.clues[1])}</li>`).join('')}</ul></details><button class="button" data-action="home">ほかの系譜をたどる</button><button class="button secondary" data-action="restart-confirm">同じ問題でもう一度</button>${random?'<button class="button secondary" data-action="random-retry-confirm">別の問題に挑戦</button>':''}`,state.gaveUp?'答えの系譜を見る':'完成した系譜を見る');}
// Pointer events unify mouse, pen and touch. No HTML Drag and Drop dependency on iOS.
$('hand').addEventListener('pointerdown',e=>{
 const button=e.target.closest('[data-card]');if(!button||e.button!==0||drag)return;e.preventDefault();updateTransform();selectCard(button.dataset.card);drag={pointerId:e.pointerId,id:selected,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,active:false};$('app').setPointerCapture(e.pointerId);
});
$('hand').addEventListener('click',e=>{if(e.detail!==0)return;const button=e.target.closest('[data-card]');if(button)selectCard(button.dataset.card);});
board.addEventListener('pointerdown',e=>{
 if(drag||modal.open||e.button!==0||e.target.closest('.board-tools'))return;e.preventDefault();board.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size===1)pan={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,node:e.target.closest('[data-node]')?.dataset.node,moved:false};else if(pan)pan.moved=true;
});
window.addEventListener('pointermove',e=>{
 if(drag&&e.pointerId===drag.pointerId){drag.x=e.clientX;drag.y=e.clientY;if(!drag.active&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>6){drag.active=true;$('drag-ghost').innerHTML=cardFace(drag.id);$('drag-ghost').classList.toggle('horse',isHorseStage(state.stage));$('drag-ghost').hidden=false;document.body.classList.add('drag-active');$('hand').querySelector(`[data-card="${drag.id}"]`)?.classList.add('dragging');frame=requestAnimationFrame(autoPan);}
 if(drag.active){const point=dragHotspot(e.clientX,e.clientY);$('drag-ghost').style.left=`${point.x}px`;$('drag-ghost').style.top=`${point.y}px`;hoverAt(point.x,point.y);}return;}
 if(!pointers.has(e.pointerId))return;const old=[...pointers.values()];pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const next=[...pointers.values()];
 if(pointers.size===2){const oldMid={x:(old[0].x+old[1].x)/2,y:(old[0].y+old[1].y)/2},mid={x:(next[0].x+next[1].x)/2,y:(next[0].y+next[1].y)/2},d1=Math.hypot(old[0].x-old[1].x,old[0].y-old[1].y),d2=Math.hypot(next[0].x-next[1].x,next[0].y-next[1].y),r=board.getBoundingClientRect();if(d1>2)zoomAt(d2/d1,oldMid.x-r.left,oldMid.y-r.top);camera.x+=mid.x-oldMid.x;camera.y+=mid.y-oldMid.y;updateTransform();if(pan)pan.moved=true;
 }else if(pan&&pan.id===e.pointerId){if(Math.hypot(e.clientX-pan.startX,e.clientY-pan.startY)>5)pan.moved=true;if(pan.moved){camera.x+=e.clientX-pan.x;camera.y+=e.clientY-pan.y;clearTargets();updateTransform();}pan.x=e.clientX;pan.y=e.clientY;}
});
function autoPan(){if(!drag?.active)return;const hotspot=dragHotspot(drag.x,drag.y),p=pointOnBoard(hotspot.x,hotspot.y);if(p.inside){if(!dragPlacement?.overSlot){const dx=p.x<28?3:p.x>board.clientWidth-28?-3:0,dy=p.y<34?3:p.y>board.clientHeight-34?-3:0;if(dx||dy){camera.x+=dx;camera.y+=dy;updateTransform();}}hoverAt(hotspot.x,hotspot.y);}frame=requestAnimationFrame(autoPan);}
function cancelDrag(){if(frame)cancelAnimationFrame(frame);frame=null;if(drag){try{if($('app').hasPointerCapture(drag.pointerId))$('app').releasePointerCapture(drag.pointerId);}catch{}}drag=null;hoverAnchor=null;clearDragPreview();$('drag-ghost').hidden=true;$('drag-ghost').classList.remove('in-board');document.body.classList.remove('drag-active');$('hand').querySelectorAll('.dragging').forEach(b=>b.classList.remove('dragging'));paintTarget();if(state)renderCaption();}
window.addEventListener('pointerup',e=>{
 if(drag&&e.pointerId===drag.pointerId){const active=drag.active,hotspot=dragHotspot(e.clientX,e.clientY),point=pointOnBoard(hotspot.x,hotspot.y);if(active)hoverAt(hotspot.x,hotspot.y);const directed=active&&camera.scale>=.55&&dragDropReady(dragPlacement,performance.now())?dragPlacement:null;const decision=dropDecision({active,inside:point.inside,anchor:camera.scale<.55?null:hoverAnchor,card:selected});cancelDrag();if(directed&&decision.type==='relation'){targetAnchor=directed.anchorId;attempt(directed.relation);}else if(decision.type==='relation')chooseRelations(decision.anchor);else if(decision.type==='choose-anchor')chooseAnchor();else if(selected)say(`${person(selected).name}を選択中。場の相手をタップしてください。`);return;}
 if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);if(pan&&pan.id===e.pointerId&&!pan.moved){if(selected){const point=pointOnBoard(e.clientX,e.clientY),id=pan.node||pickDropCard(point,screenNodes(state.positions,camera));if(id)chooseRelations(id);else say('場のカードをタップするか「相手を一覧から」で選んでください。');}else if(pan.node)focusLines(pan.node);}
 if(pointers.size===1){const [id,p]=[...pointers.entries()][0];pan={id,x:p.x,y:p.y,startX:p.x,startY:p.y,moved:true};}else pan=null;
});
window.addEventListener('pointercancel',e=>{if(drag?.pointerId===e.pointerId){cancelDrag();clearTargets();}pointers.delete(e.pointerId);pan=null;});
window.addEventListener('blur',()=>{cancelDrag();pointers.clear();pan=null;if(!(modal.open&&dialogKind==='relation'))clearTargets();persist();lastTick=performance.now();});
$('nodes').addEventListener('click',e=>{if(e.detail!==0)return;const node=e.target.closest('[data-node]');if(node){if(selected)chooseRelations(node.dataset.node);else focusLines(node.dataset.node);}});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.open){cancelDrag();clearTargets();selected=null;lineFocus=null;renderLines();for(const node of $('nodes').querySelectorAll('[data-node]')){node.classList.remove('line-focused');node.setAttribute('aria-pressed','false');}if(state){renderHand();renderHint();renderStats();}}});
let previousWidth=0,previousHeight=0;
new ResizeObserver(()=>{if(!state||!board.clientWidth||!board.clientHeight)return;if(!previousWidth||!previousHeight||camera.scale<=0){previousWidth=board.clientWidth;previousHeight=board.clientHeight;fit(false);return;}camera.x+=(board.clientWidth-previousWidth)/2;camera.y+=(board.clientHeight-previousHeight)/2;previousWidth=board.clientWidth;previousHeight=board.clientHeight;updateTransform();}).observe(board);
setInterval(()=>{const now=performance.now(),playingSheet=dialogKind==='relation'||dialogKind==='anchor';if(state&&!state.complete&&!document.hidden&&(!modal.open||playingSheet)){state.elapsed+=Math.max(0,Math.min(now-lastTick,1500));$('timer').textContent=formatTime(state.elapsed);if(now-lastSaved>10000){persist();lastSaved=now;}}lastTick=now;},500);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelDrag();pointers.clear();pan=null;persist();}lastTick=performance.now();});window.addEventListener('pagehide',persist);
renderHome();
void fetch('./data/horse-pedigree.v1.json').then(response=>{if(!response.ok)throw Error('horse snapshot');return response.json();}).then(snapshot=>{
 horseSnapshot=snapshot;
 if(records.randomHorse){try{randomHorse=restoreRandomHorseSession(snapshot,records.randomHorse);if(!randomHorse)randomHorseError='保存した問題はデータ版が異なるため、新しい問題を始めてください。';}catch{randomHorseError='保存した問題を再現できませんでした。新しい問題を始めてください。';}}
 renderHome();
}).catch(()=>{randomHorseError='競走馬データを読み込めませんでした。通信環境を確認してください。';renderHome();});
