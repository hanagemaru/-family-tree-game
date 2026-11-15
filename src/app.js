import {stages,stageById} from './data.js';
import {relationLabels,newGame,place,pack,restore,formatTime,fitCamera,revealCamera} from './core.js';
import {horseSex,horseSexLabel,horseSexTone} from './horse-sex.js';
import {placementLabels,directionalTarget,dragFrameScreen,insideDragFrame,dragDropReady} from './placement-preview.js';
import {layoutFamily,buildDiagram,diagramSvg} from './diagram.js';
import {dragHotspot,screenNodes,pickDropCard,exactDropTarget,ambiguousNearbyDrop} from './interaction.js';
import {createRandomSeed,generateRandomHorseSession,restoreRandomHorseSession} from './random-horse-session.js';
import {seededRandom,prepareHorseGraph,FAME_HORSE_GENERATOR_VERSION,EASIER_HORSE_GENERATOR_VERSION,PREVIOUS_HORSE_GENERATOR_VERSION,CURRENT_HORSE_GENERATOR_VERSION} from './random-horse-stage.js';
import {HORSE_DIFFICULTIES,prepareHorseFame} from './horse-fame.js';
import {findCorrectPlacement,horsePlacementHint,completedAnswer} from './game-assistance.js';
import {horseScore,useHorseHint,rankedHorseStage} from './horse-score.js';
import {playerIdentity,rankingName,saveRankingName,createRankedRun,loadRankings,submitRankedScore,updateRankingName,deleteRankingAccount} from './ranking-client.js';
const $=id=>document.getElementById(id),storageKey='family-tree-game:v1';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let records={sessions:{},best:{}};
try{const parsed=JSON.parse(localStorage.getItem(storageKey));if(parsed&&typeof parsed==='object')records={sessions:parsed.sessions||{},best:parsed.best||{},randomHorse:parsed.randomHorse||null,randomHorseByDifficulty:parsed.randomHorseByDifficulty||{},randomDifficulty:parsed.randomDifficulty||'normal',randomHorseLegacyEasy:parsed.randomHorseLegacyEasy||null,randomHorseLegacyByDifficulty:parsed.randomHorseLegacyByDifficulty||{},randomHorseLegacyV5ByDifficulty:parsed.randomHorseLegacyV5ByDifficulty||{},rankedRunTickets:parsed.rankedRunTickets||{}};}catch{}
if(!records.randomHorseLegacyEasy&&records.randomHorseByDifficulty?.easy?.generatorVersion===FAME_HORSE_GENERATOR_VERSION)
 records.randomHorseLegacyEasy=records.randomHorseByDifficulty.easy;
let horseSnapshot=null,fameSnapshot=null,randomHorse=null,randomHorseError='',randomHorseByDifficulty={},randomHorseLegacyEasy=null,randomHorseLegacyByDifficulty={},randomHorseLegacyV5ByDifficulty={},horsePhotos={};
let selectedDifficulty=HORSE_DIFFICULTIES[records.randomDifficulty]?records.randomDifficulty:'normal';
const onlineRankingEnabled=globalThis.location?.pathname?.startsWith('/games/horse-pedigree/play/')||false;
if(onlineRankingEnabled){const link=document.querySelector('.hub-back');if(link){link.href='https://hanage.app/games/horse-pedigree/';link.textContent='ゲーム紹介へ戻る';}}
let pendingRun=null,rankingError='';
let state=null,selected=null,camera={x:0,y:0,scale:1},targetAnchor=null,hoverAnchor=null,drag=null,pan=null,frame=null,lastTick=performance.now(),lastSaved=0,diagram=null,lineFocus=null,lastLineDiagram=null,lastLineScale=null,lastLineFocus=null,dialogKind='info',dragPlacement=null;
const board=$('board'),modal=$('modal'),pointers=new Map();
const person=id=>state.stage.people.find(p=>p.id===id);
const isCurrentRankedStage=stage=>stage?.id?.includes(':'+CURRENT_HORSE_GENERATOR_VERSION+':')&&stage.people?.length===12;
const bestKeyForStage=(stage,difficulty)=>isCurrentRankedStage(stage)?'v6:'+difficulty:stage?.id?.includes(':'+PREVIOUS_HORSE_GENERATOR_VERSION+':')?'v5:'+difficulty:stage?.id;
const sexTone=id=>{if(!isHorseStage(state.stage))return '';const p=person(id);return horseSexTone(p.sex||horseSex(id));};
const isHorseStage=stage=>stage?.id==='thoroughbred'||stage?.category==='競走馬'||stage?.category==='競走馬の血統';
const isRandomHorseStage=stage=>stage?.id?.startsWith('horse-generated:');
const hintCount=()=>Object.values(state.hints).filter(n=>n>=1).length;
const randomDescriptorForStage=stage=>[records.randomHorse,records.randomHorseLegacyEasy,...Object.values(records.randomHorseLegacyByDifficulty||{}),...Object.values(records.randomHorseLegacyV5ByDifficulty||{}),...Object.values(records.randomHorseByDifficulty||{})].find(record=>record?.stageId===stage?.id);
const newStageGame=stage=>isRandomHorseStage(stage)?newGame(stage,seededRandom(`deck:${randomDescriptorForStage(stage)?.seed||''}`)):newGame(stage);
function persist(){try{if(state)records.sessions[state.stage.id]=pack(state);localStorage.setItem(storageKey,JSON.stringify(records));}catch{}}
function say(message,error=false){const box=$('status');box.textContent=message;box.classList.toggle('error',error);box.classList.remove('flash');void box.offsetWidth;if(message)box.classList.add('flash');}
function savedGame(stage){try{return restore(records.sessions[stage.id],stage);}catch{return null;}}
function fixedStageCard(stage,index){const saved=savedGame(stage),resume=saved&&!saved.complete,best=records.best[stage.id],history=stage.id==='tokugawa';return `<article class="stage-card ${history?'history-theme':'horse-theme'}"><div class="stage-art" aria-hidden="true"><span class="art-index">COLLECTION 0${index+1}</span><div class="theme-emblem">${history?'<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="51"/><path d="M60 59C27 52 28 18 49 23C65 26 68 43 60 59ZM62 61C75 29 104 39 98 59C92 75 77 75 62 61ZM58 63C78 90 53 111 39 95C27 80 36 66 58 63Z"/><circle cx="60" cy="61" r="6"/></svg>':'<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="51"/><path d="M35 93C36 73 45 62 53 55L45 48L52 28L60 35L70 26L73 41C85 46 91 59 85 68L75 63L65 73L72 94Z"/></svg>'}</div><span class="art-caption">${history?'TOKUGAWA FAMILY':'THOROUGHBRED'}</span></div><div class="stage-content"><div class="stage-meta"><span>${stage.category}</span><span>${stage.people.length}${history?'人':'頭'}のカード</span></div><h3>${stage.title}</h3><p>${stage.summary}</p><span class="tag">${stage.tag}</span><div class="stage-bottom"><span class="best">${resume?`<span class="resume-dot"></span>${saved.placed.length} / ${stage.people.length} 配置済み`:best?`✓ クリア済み · ${formatTime(best.elapsed)}`:'いつでも、あなたのペースで'}</span><button class="button" data-start="${stage.id}">${resume?'つづきから':'はじめる'} <span aria-hidden="true">→</span></button></div></div></article>`;}
function randomStageCard(){
 const generated=randomHorseByDifficulty[selectedDifficulty];
 const current=generated?.descriptor.generatorVersion===CURRENT_HORSE_GENERATOR_VERSION;
 const saved=current&&generated&&savedGame(generated.stage);
 const resume=!!(saved&&!saved.complete);
 const best=records.best['v6:'+selectedDifficulty];
 const ready=!!horseSnapshot&&!!fameSnapshot;
 const mode=HORSE_DIFFICULTIES[selectedDifficulty];
 const explanations={
  easy:'知名度上位10%の馬が登場',
  normal:'有名馬を中心に、血統馬も登場',
  hard:'血統知識が必要な馬も登場'
 };
 const choices=Object.entries(HORSE_DIFFICULTIES).map(([key,detail])=>
  '<button type="button" class="difficulty-option'+(selectedDifficulty===key?' active':'')+
  '" data-random-level="'+key+'" aria-pressed="'+(selectedDifficulty===key)+'">'+detail.label+'</button>').join('');
 const legacySaved=randomHorse&&savedGame(randomHorse.stage);
 const legacyResume=legacySaved&&!legacySaved.complete?
  '<button type="button" class="text-button legacy-resume" data-legacy-random-start>以前の18頭問題を再開（'+legacySaved.placed.length+' / 18）</button>':'';
 const oldEasySaved=selectedDifficulty==='easy'&&randomHorseLegacyEasy&&savedGame(randomHorseLegacyEasy.stage);
 const oldSaved=randomHorseLegacyByDifficulty[selectedDifficulty]&&savedGame(randomHorseLegacyByDifficulty[selectedDifficulty].stage);
 const oldResume=oldSaved&&!oldSaved.complete?
  '<button type="button" class="text-button legacy-resume" data-old-stage-start>以前の問題を再開（'+oldSaved.placed.length+' / '+randomHorseLegacyByDifficulty[selectedDifficulty].stage.people.length+'）</button>':'';
 const previousV5=randomHorseLegacyV5ByDifficulty[selectedDifficulty];
 const previousSave=previousV5&&savedGame(previousV5.stage);
 const previousResume=previousSave&&!previousSave.complete?
  '<button type="button" class="text-button legacy-resume" data-old-v5-start>変更前の12頭問題を再開（'+previousSave.placed.length+' / 12）</button>':'';
 const oldEasyResume=oldEasySaved&&!oldEasySaved.complete?
  '<button type="button" class="text-button legacy-resume" data-old-easy-start>変更前の初級を再開（'+oldEasySaved.placed.length+' / 18）</button>':'';
 const legacyActions=previousResume+oldResume+legacyResume+oldEasyResume;
 const bestText=best?formatTime(best.totalMs??best.elapsed):'--:--';
 return [
  '<div class="home-start-panel">',
  '<div class="home-picker-label"><h2>難易度を選ぶ</h2><span>12頭・最大4世代</span></div>',
  '<div class="difficulty-picker" role="group" aria-label="難易度を選ぶ">'+choices+'</div>',
  '<p class="difficulty-description" role="status">'+explanations[selectedDifficulty]+'</p>',
  '<div class="home-best-row"><span>自己ベスト <small>'+mode.label+'</small></span><strong>'+bestText+'</strong></div>',
  resume?'<p class="home-resume-note"><span class="resume-dot"></span>前回の続き：'+saved.placed.length+' / 12頭を配置済み</p>':'',
  randomHorseError?'<p class="home-load-error" role="alert">'+escape(randomHorseError)+'</p>':'',
  '<button type="button" class="home-primary-button" data-random-start '+(ready?'':'disabled')+'>'+
    (ready?(resume?'つづきから':mode.label+'を始める'):'問題を準備中…')+'<span aria-hidden="true">→</span></button>',
  resume?'<button type="button" class="home-new-button" data-new-random-start>新しい問題を始める</button>':'',
  '<button type="button" class="home-ranking-button" data-rank-view><span aria-hidden="true">♛</span> ランキングを見る</button>',
  legacyActions?'<details class="home-legacy"><summary>以前の問題</summary>'+legacyActions+'</details>':'',
  '</div>'
 ].join('');
}
function renderHome(){
 $('stage-list').innerHTML=randomStageCard();
}
function openDialog(html,closeLabel='閉じる',kind='info'){dialogKind=kind;modal.classList.toggle('placement-dialog',kind==='relation'||kind==='anchor');$('modal-content').innerHTML=html;const heading=$('modal-content').querySelector('h2');if(heading)heading.id='dialog-title';$('modal-close').textContent=closeLabel;if(!modal.open)modal.showModal();const first=$('modal-content').querySelector('button');if(first)first.focus({preventScroll:true});lastTick=performance.now();}
function closeDialog(){modal.close();lastTick=performance.now();}
modal.addEventListener('close',()=>{lastTick=performance.now();if(state)renderCaption();});
$('modal-close').addEventListener('click',closeDialog);
// Tapping the dimmed area dismisses only the relation picker, exactly like Cancel.
// Clicking the dialog's own padding must not dismiss it. Keep the hand selection
// and do not create a placement action (therefore no mistake penalty).
modal.addEventListener('click',event=>{
 if(!modal.open||dialogKind!=='relation'||event.target!==modal)return;
 const bounds=modal.getBoundingClientRect();
 const outside=event.clientX<bounds.left||event.clientX>bounds.right||
  event.clientY<bounds.top||event.clientY>bounds.bottom;
 if(outside)closeDialog();
});
function help(){openDialog(`<p class="eyebrow">HOW TO PLAY</p><h2>手札を場につなぐ。</h2><ol><li>手札をタップし、場の相手をタップ。親・子・きょうだいなどを選ぶと配置します。</li><li>ドラッグ中は点線枠に位置マーカーを合わせ、少し止めて離すと直接配置できます。それ以外は関係を選ぶだけです。</li><li>同じ手札または盤面の余白をタップすると選択解除。ヒントは選択中の手札について表示されます。</li><li>相手が判別できないときは名前一覧から選べます。降参して答えを見る操作はメニュー内にあります。</li><li>●は実際の接続点、線の切れ目は非接続の交差。手札未選択で場のカードをタップすると関係線を強調します。</li><li>盤面をスワイプして移動。ピンチ、＋ / −で拡縮し、「全体」で見渡せます。</li></ol><p class="scope">${state?escape(state.stage.scope):'進行はこのブラウザへ自動保存されます。'}</p>`);}
$('help-button').addEventListener('click',help);
$('home-menu-button').addEventListener('click',()=>openDialog('<h2>メニュー</h2><div class="home-menu-actions"><a class="button secondary" href="https://hanage.app/games/horse-pedigree/">ゲーム紹介へ戻る</a><button type="button" class="button secondary" data-action="sources">題材・出典</button></div>'));
function showSources(){
 const list=state?[state.stage]:randomHorseByDifficulty[selectedDifficulty]?[randomHorseByDifficulty[selectedDifficulty].stage]:[];
 const stagesHtml=list.map(stage=>{
  const references=[...new Map([...stage.sources,...stage.people.map(p=>p.source)].filter(Boolean).map(s=>[s.url,s])).values()];
  const photos=stage.people.map(p=>({p,photo:horsePhotos[p.id]})).filter(x=>x.photo);
  const photoCredits=photos.length?'<h3>カード写真・著作者・ライセンス</h3><ul class="photo-credits">'+photos.map(({p,photo})=>{
   const filePage=photo.filePage?.startsWith('https://commons.wikimedia.org/')?photo.filePage:'https://commons.wikimedia.org/';
   const licenseUrl=photo.licenseUrl?.startsWith('https://')?photo.licenseUrl:filePage;
   return '<li><strong>'+escape(p.name)+'</strong>：'+escape(photo.artist||'著作者不詳')+
    ' ／ <a href="'+escape(filePage)+'" target="_blank" rel="noopener noreferrer">元画像</a>'+
    ' ／ <a href="'+escape(licenseUrl)+'" target="_blank" rel="noopener noreferrer">'+escape(photo.license)+'</a>'+
    ' （カード表示では画像の一部を切り抜いて表示）</li>';
  }).join('')+'</ul>':'<p>この問題のカードは、撮影写真の代わりにイラストを使用しています。</p>';
  return '<h3>'+escape(stage.title)+'</h3><p>'+escape(stage.description)+'</p><p class="scope">'+escape(stage.scope)+
    '</p><ul>'+references.map(s=>'<li><a href="'+escape(s.url)+'" target="_blank" rel="noopener noreferrer">'+escape(s.label)+'</a></li>').join('')+
    '</ul>'+photoCredits;
 }).join('');
 openDialog('<p class="eyebrow">DATA & IMAGE CREDITS</p><h2>題材・出典</h2>'+stagesHtml+
 '<p class="scope">生年はWikidataとJBIS等で照合。<a href="https://github.com/hanagemaru/-family-tree-game/blob/feature/horse-fame-difficulty-20261115/data/source/horse-birth-enrichment-2026-11-15.json" target="_blank" rel="noopener noreferrer">生年補完の出典</a>。写真のない馬はイラストを表示します。</p>');
}
$('sources-button').addEventListener('click',showSources);
$('stage-list').addEventListener('click',e=>{
 const level=e.target.closest('[data-random-level]');
 if(level&&HORSE_DIFFICULTIES[level.dataset.randomLevel]){
  selectedDifficulty=level.dataset.randomLevel;records.randomDifficulty=selectedDifficulty;persist();renderHome();return;
 }
 const button=e.target.closest('[data-start]');
 if(button){start(stageById(button.dataset.start));return;}
 if(e.target.closest('[data-legacy-random-start]')&&randomHorse){start(randomHorse.stage);return;}
 if(e.target.closest('[data-old-easy-start]')&&randomHorseLegacyEasy){start(randomHorseLegacyEasy.stage);return;}
 if(e.target.closest('[data-old-stage-start]')&&randomHorseLegacyByDifficulty[selectedDifficulty]){start(randomHorseLegacyByDifficulty[selectedDifficulty].stage);return;}
 if(e.target.closest('[data-old-v5-start]')&&randomHorseLegacyV5ByDifficulty[selectedDifficulty]){start(randomHorseLegacyV5ByDifficulty[selectedDifficulty].stage);return;}
 if(e.target.closest('[data-rank-view]')){void showRankings(selectedDifficulty);return;}
 if(e.target.closest('[data-new-random-start]')){
  openDialog('<h2>新しい問題を始めますか？</h2><p>今の問題の続きからは再開できなくなります。自己ベストは残ります。</p><button type="button" class="button" data-action="new-random-home-confirm">新しい問題を始める</button>','戻る');return;
 }
 if(e.target.closest('[data-random-start]'))startRandomHorse(false,selectedDifficulty);
});
function startRandomHorse(fresh,difficulty=selectedDifficulty){
 if(!horseSnapshot||!fameSnapshot||!HORSE_DIFFICULTIES[difficulty])return;
 try{
  const existing=randomHorseByDifficulty[difficulty],useOld=!!existing&&existing.descriptor.generatorVersion!==CURRENT_HORSE_GENERATOR_VERSION;
  const saved=!fresh&&!useOld&&existing&&savedGame(existing.stage);
  if(saved&&!saved.complete){start(existing.stage);return;}
  if(useOld&&existing){
   if(existing.descriptor.generatorVersion===PREVIOUS_HORSE_GENERATOR_VERSION){
    records.randomHorseLegacyV5ByDifficulty??={};
    records.randomHorseLegacyV5ByDifficulty[difficulty]=existing.descriptor;
    randomHorseLegacyV5ByDifficulty[difficulty]=existing;
   }else{
    records.randomHorseLegacyByDifficulty??={};
    records.randomHorseLegacyByDifficulty[difficulty]=existing.descriptor;
    randomHorseLegacyByDifficulty[difficulty]=existing;
   }
  }
  const version=CURRENT_HORSE_GENERATOR_VERSION;
  const generated=generateRandomHorseSession(horseSnapshot,createRandomSeed(),{version,difficulty,fameSnapshot});
  randomHorseByDifficulty[difficulty]=generated;records.randomHorseByDifficulty={...records.randomHorseByDifficulty,[difficulty]:generated.descriptor};
  selectedDifficulty=difficulty;records.randomDifficulty=difficulty;randomHorseError='';persist();start(generated.stage,true);
 }catch(error){console.error('Horse difficulty generation failed',error);randomHorseError='問題の生成に失敗しました。もう一度お試しください。';renderHome();}
}
function start(stage,fresh=false){
 persist();state=(!fresh&&savedGame(stage))||newStageGame(stage);if(state.complete&&!fresh)state=newStageGame(stage);selected=null;targetAnchor=null;lineFocus=null;state.positions=layoutFamily(state);
 if(isCurrentRankedStage(stage)){
  if(fresh)delete records.rankedRunTickets?.[stage.id];
  if(onlineRankingEnabled&&!records.rankedRunTickets?.[stage.id]){
   const descriptor=randomDescriptorForStage(stage),identity=playerIdentity();
   pendingRun=createRankedRun(identity,descriptor).then(run=>{
    if(run?.ticket){records.rankedRunTickets??={};records.rankedRunTickets[stage.id]=run;persist();}
    return run;
   }).catch(error=>{rankingError=error.message;return null;});
  }else pendingRun=Promise.resolve(records.rankedRunTickets?.[stage.id]||null);
 }else pendingRun=null;
 $('game-screen').classList.remove('inspect-mode');board.classList.remove('expanded');$('board-expand').textContent='広く';$('board-expand').setAttribute('aria-pressed','false');$('home-screen').hidden=true;$('game-screen').hidden=false;document.body.classList.add('playing');$('stage-category').textContent=stage.category;$('stage-title').textContent=stage.title;hoverAnchor=null;
 document.body.dataset.stage=stage.id;render();fit(false);previousWidth=board.clientWidth;previousHeight=board.clientHeight;lastTick=performance.now();say('');persist();window.scrollTo({top:0,behavior:'instant'});
}
function goHome(){persist();cancelDrag();pointers.clear();pan=null;state=null;selected=null;clearTargets();$('game-screen').hidden=true;$('home-screen').hidden=false;document.body.classList.remove('playing');renderHome();closeDialog();}
function confirmAnswer(){openDialog('<h2>答えを見て終了しますか？</h2><p>残りのカードを正しい関係で配置し、完成図を表示します。通常のクリア記録には含まれません。</p><button class="button" data-action="give-up">答えを表示する</button>','プレイを続ける');}
function menu(){if(!state){goHome();return;}const random=isRandomHorseStage(state.stage);openDialog(`<p class="eyebrow">${state.stage.category}</p><h2>${state.stage.title}</h2>${random?`<p class="random-seed">問題ID <code>${escape(randomDescriptorForStage(state.stage)?.seed||'')}</code></p>`:''}<p>進行は自動保存されています。</p><button class="button secondary" data-action="help">遊び方</button><button class="button secondary" data-action="sources">題材・出典</button><button class="button" data-action="home">ステージ選択へ</button><button class="button secondary" data-action="restart-confirm">${random?'同じ問題を最初から':'最初からやり直す'}</button>${random?'<button class="button secondary" data-action="random-retry-confirm">別の問題に挑戦</button>':''}${selected&&!state.complete?'<button class="button secondary" data-action="anchor-list">相手を一覧から選ぶ</button>':''}<button class="button secondary" data-action="board-expand">${board.classList.contains('expanded')?'盤面を元に戻す':'盤面を広く表示'}</button>${!state.complete?'<button class="button secondary" data-action="give-up-confirm">諦めて答えを見る</button>':''}${state.complete?`<button class="button secondary" data-action="result">${state.gaveUp?'答えの系譜を見る':'完成記録を見る'}</button>`:''}`);}
$('menu-button').addEventListener('click',menu);$('home-button').addEventListener('click',()=>state?menu():goHome());
modal.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action==='home')goHome();if(action==='new-random-home-confirm'){closeDialog();startRandomHorse(true,selectedDifficulty);} if(action==='auto-place-confirm')confirmAutoPlace();if(action==='ranking-view')void showRankings(randomDescriptorForStage(state?.stage)?.difficulty||selectedDifficulty);if(action==='ranking-submit')showRankingSubmit();if(action==='ranking-submit-confirm')void confirmRankingSubmit();if(action==='ranking-delete-confirm')void confirmRankingDelete();if(action==='restart-confirm')openDialog('<h2>この系譜をやり直しますか？</h2><p>今の配置と記録をリセットして、同じカードで最初から始めます。</p><button class="button" data-action="restart">やり直す</button>','続ける');if(action==='random-retry-confirm')openDialog('<h2>別の問題に挑戦しますか？</h2><p>新しい問題IDで12頭を選び直します。今の問題の進行は終了します。</p><button class="button" data-action="random-retry">新しい問題を始める</button>','続ける');if(action==='restart'){const stage=state.stage;closeDialog();start(stage,true);}if(action==='random-retry'){closeDialog();startRandomHorse(true,randomDescriptorForStage(state.stage)?.difficulty||selectedDifficulty);}if(action==='give-up-confirm')confirmAnswer();if(action==='give-up')showAnswer();if(action==='result')results();if(action==='help')help();if(action==='sources')showSources();if(action==='anchor-list')chooseAnchor();if(action==='board-expand'){closeDialog();toggleBoardExpand();}});
function render(){renderBoard();renderHand();renderStats();renderHint();}
function renderStats(){
 $('placed-count').textContent=state.placed.length;$('total-count').textContent=` / ${state.stage.people.length}`;
 const score=horseScore(state);
 $('timer').textContent=formatTime(state.elapsed);
 $('score-timer').textContent=formatTime(score.totalMs);
 $('penalty-count').textContent=`+${score.penaltyMs/1000}秒`;
 $('mistake-count').textContent=state.mistakes;$('hint-count').textContent=hintCount();$('progress-fill').style.width=`${state.placed.length/state.stage.people.length*100}%`;$('hand-count').textContent=`${state.hand.length}枚`;$('stock-count').textContent=`残り ${state.deck.length}`;$('stock-pile').classList.toggle('empty',!state.deck.length);
 renderCaption();
 renderSelection();
}
function positionHintButton(){
 const button=$('hint-button'),section=$('hand-section');
 if(!selected||button.hidden)return;
 const card=[...$('hand').querySelectorAll('[data-card]')].find(node=>node.dataset.card===selected);
 if(!card)return;
 const surface=section.getBoundingClientRect(),rect=card.getBoundingClientRect();
 // Position it near the selected card, but never clip the 90px touch target
 // against the left or right edge of a narrow viewport.
 if(surface.width&&rect.width){
  const buttonWidth=92;
  const x=Math.max(5,Math.min(surface.width-buttonWidth-5,rect.right-surface.left-buttonWidth*.53));
  const y=rect.top-surface.top-31;
  button.style.left=`${Math.round(x)}px`;
  button.style.top=`${Math.round(y)}px`;
  const clue=$('hint-box'),width=Math.min(surface.width-28,320);
  const center=rect.left+rect.width/2-surface.left;
  clue.style.left=`${Math.round(Math.max(14,Math.min(surface.width-width-14,center-width/2)))}px`;
 }
}
function renderSelection(){
 const summary=$('selection-summary'),hint=$('hint-button');
 summary.textContent=selected?`選択中 · ${person(selected).name}`:'';
 summary.title=selected?'同じ手札か盤面の余白をタップして解除':'';
 const level=selected?(state.hints[selected]||0):0;
 const isRanked=rankedHorseStage(state.stage);
 hint.hidden=!selected||state.complete||level>=(isRanked?1:2)||!!drag?.active;
 hint.querySelector('span').textContent=isRanked?'ヒント +10秒':level===1?'ヒント 2':'ヒント';
 const autoButton=$('auto-place-button');
 autoButton.hidden=!isRanked||!selected||state.complete||!!drag?.active;
 if(!autoButton.hidden)autoButton.disabled=!findCorrectPlacement(state,selected);
 positionHintButton();
}
function renderBoard(newId){
 $('nodes').innerHTML=state.placed.map(id=>{const p=person(id),position=state.positions[id];return `<button class="person-node table-card ${isHorseStage(state.stage)?'horse':''} ${sexTone(id)} ${id===state.stage.anchor?'anchor':''} ${id===newId?'new-card':''}" data-node="${id}" aria-pressed="false" style="left:${position.x}px;top:${position.y}px" aria-label="${escape(p.name)}${id===state.stage.anchor?'、起点のカード':''}">${cardFace(id)}</button>`;}).join('');
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
 const photo=horse&&horsePhotos[id];
 const image=/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(photo?.photoUrl||'')?`<img class="horse-photo" loading="lazy" decoding="async" src="${escape(photo.photoUrl)}" alt="">`:'';
 const birthYear=horse&&Number.isInteger(p.birthYear)?`<span class="card-birth-year" aria-label="${p.birthYear}年生まれ">${p.birthYear}年生</span>`:'';
 return `<span class="card-corner" aria-hidden="true">No.${String(number).padStart(2,'0')}</span>${sexMarkup}<span class="card-art" aria-hidden="true"><span class="card-track-lines"></span><svg viewBox="0 0 130 135">${art}</svg>${image}${birthYear}</span><span class="card-name">${escape(p.name)}</span>`;
}
function renderHand(){
 $('hand').innerHTML=state.hand.map((id,index)=>`<button class="hand-card ${isHorseStage(state.stage)?'horse':''} ${sexTone(id)} ${id===selected?'selected':''}" style="--slot:${index};--tint:${(state.stage.people.findIndex(p=>p.id===id)*19)%70}deg" data-card="${id}" aria-pressed="${id===selected}" aria-label="${escape(person(id).name)}。ドラッグするか、選択して場のカードをタップ">${cardFace(id)}</button>`).join('');
 if(state.complete)$('hand').innerHTML='<p class="complete-note">すべてのカードがつながりました。</p>';
 positionHintButton();
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
function selectCard(id){
 clearDragPreview();selected=id;lineFocus=null;renderLines();
 for(const node of $('nodes').querySelectorAll('[data-node]')){
  node.classList.remove('line-focused');node.setAttribute('aria-pressed','false');
 }
 clearTargets();
 for(const button of $('hand').querySelectorAll('[data-card]')){
  const active=button.dataset.card===id;
  button.classList.toggle('selected',active);
  button.setAttribute('aria-pressed',String(active));
 }
 renderHint();renderStats();say('');
}
function clearSelection(){
 if(!selected)return;
 selected=null;lineFocus=null;clearDragPreview();clearTargets();
 renderLines();
 for(const node of $('nodes').querySelectorAll('[data-node]')){
  node.classList.remove('line-focused');node.setAttribute('aria-pressed','false');
 }
 for(const button of $('hand').querySelectorAll('[data-card]')){
  button.classList.remove('selected');
  button.setAttribute('aria-pressed','false');
 }
 renderHint();renderStats();say('');
}
function renderHint(){
 const box=$('hint-box');box.hidden=true;if(!selected)return;
 const level=state.hints[selected]||0;if(!level)return;
 const generated=isRandomHorseStage(state.stage);
 const clue=generated?horsePlacementHint(state,selected,level):person(selected).clues[level-1];
 box.hidden=!!drag?.active;
 box.innerHTML=`<strong>${escape(person(selected).name)}</strong> <small>ヒント ${level} / ${rankedHorseStage(state.stage)?1:2}</small><br>${escape(clue)}`;
}
function revealHint(){
 if(!selected){say('ヒントを見るカードを、手札から選んでください。');return;}

 if(rankedHorseStage(state.stage)){if(!useHorseHint(state,selected))return;}
 else state.hints[selected]=Math.min(2,(state.hints[selected]||0)+1);
 renderHint();renderStats();persist();
}
$('hint-button').addEventListener('click',revealHint);
$('auto-place-button').addEventListener('click',()=>{
 if(!selected||!rankedHorseStage(state.stage))return;
 const move=findCorrectPlacement(state,selected);
 if(!move){say('この馬はまだ場につながりません。別のカードを先に置いてください。');return;}
 openDialog(`<h2>この馬を自動で配置しますか？</h2><p>${escape(person(selected).name)}を正しく配置します。補正タイムへの加算は合計+45秒です。</p><button class="button" data-action="auto-place-confirm">+45秒で配置</button>`,'戻る');
});
function confirmAutoPlace(){
 if(!selected||!rankedHorseStage(state.stage))return;
 const move=findCorrectPlacement(state,selected);
 if(!move){closeDialog();say('この馬はまだ配置できません。',true);return;}
 const beforeHand=[...state.hand];
 const outcome=place(state,move.cardId,move.anchorId,move.relation,{auto:true});
 if(!outcome.ok){closeDialog();say('自動配置に失敗しました。',true);return;}
 state.positions=layoutFamily(state);selected=null;lineFocus=null;closeDialog();clearTargets();
 renderBoard(move.cardId);renderHand();animateDraw(beforeHand);renderStats();renderHint();fit(true);persist();
 say('正しく配置しました。補正タイム +45秒');
 if(state.complete)completeGame();
}
function completeGame(){
 const score=horseScore(state);
 const difficulty=randomDescriptorForStage(state.stage)?.difficulty;
 const key=bestKeyForStage(state.stage,difficulty);
 const existing=records.best[key];
 if(!existing||(existing.totalMs??existing.elapsed)>score.totalMs)records.best[key]={...score,elapsed:state.elapsed,difficulty};
 persist();results();
}
// No voluntary hand exchange: playable cards are guaranteed by core.deal/ensurePlayable.
function updateTransform(animate=false){board.classList.toggle('overview',camera.scale<.68);$('world').classList.toggle('following',animate);$('world').style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;renderLines();}
function fit(animate=true){if(!state||board.clientWidth<=0||board.clientHeight<=0)return;camera=fitCamera(state.positions,board.clientWidth,board.clientHeight);updateTransform(animate);}
$('fit-button').addEventListener('click',fit);
function toggleBoardExpand(){const expanded=board.classList.toggle('expanded');$('game-screen').classList.toggle('inspect-mode',expanded);$('board-expand').textContent=expanded?'戻す':'広く';$('board-expand').setAttribute('aria-pressed',String(expanded));previousWidth=board.clientWidth;previousHeight=board.clientHeight;fit();}
$('board-expand').addEventListener('click',toggleBoardExpand);
function zoomAt(factor,x=board.clientWidth/2,y=board.clientHeight/2){const next=Math.max(.18,Math.min(1.8,camera.scale*factor)),ratio=next/camera.scale;camera={x:x-(x-camera.x)*ratio,y:y-(y-camera.y)*ratio,scale:next};updateTransform();}
$('zoom-in').addEventListener('click',()=>zoomAt(1.2));$('zoom-out').addEventListener('click',()=>zoomAt(1/1.2));
board.addEventListener('wheel',e=>{e.preventDefault();const rect=board.getBoundingClientRect();zoomAt(Math.exp(-e.deltaY*.002),e.clientX-rect.left,e.clientY-rect.top);},{passive:false});
board.addEventListener('keydown',e=>{if(e.target!==board)return;const delta={ArrowLeft:[50,0],ArrowRight:[-50,0],ArrowUp:[0,50],ArrowDown:[0,-50]}[e.key];if(delta){e.preventDefault();camera.x+=delta[0];camera.y+=delta[1];updateTransform();}if(e.key==='+'||e.key==='=')zoomAt(1.2);if(e.key==='-')zoomAt(1/1.2);if(e.key==='0')fit();});
function paintTarget(){for(const node of $('nodes').querySelectorAll('[data-node]'))node.classList.toggle('targeted',node.dataset.node===(hoverAnchor||targetAnchor));$('drag-ghost').classList.toggle('over-card',!!hoverAnchor);}
function clearTargets(){targetAnchor=null;hoverAnchor=null;paintTarget();if(state)renderCaption();}
function renderCaption(){
 $('board-caption').textContent=dragPlacement?`${person(dragPlacement.anchorId).name}の${relationName(dragPlacement.relation)} · ${camera.scale<.55?'離すと名前一覧':dragDropReady(dragPlacement,performance.now())?'離して配置':'点線枠に重ね、少し止めて離す'}`:hoverAnchor?`${person(hoverAnchor).name}へドロップ → 関係を選ぶ`:state.complete?(state.gaveUp?'答えの系譜 · スワイプと拡縮で見渡せます':'完成した系譜 · スワイプと拡縮で見渡せます'):selected?`${person(selected).name}の相手をタップ、またはカードへドロップ`:'手札を選ぶか、場へドラッグ';
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
 const wasArmed=overlay.classList.contains('armed');
 overlay.hidden=false;
 overlay.style.left=`${frame.x}px`;
 overlay.style.top=`${frame.y}px`;
 overlay.dataset.relation=hit.relation;
 overlay.classList.toggle('over-slot',overSlot);
 overlay.classList.toggle('armed',ready);
 overlay.classList.toggle('disabled',camera.scale<.55);
 overlay.innerHTML=`<span>${placementLabels[hit.relation].arrow}</span><small>${placementLabels[hit.relation].label}</small>`;
 if(ready&&!wasArmed){
  say(`${relationName(hit.relation)}として配置できます。指を離してください。`);
 }
}
function chooseRelations(id){
 if(!selected||!state.hand.includes(selected)||!state.placed.includes(id))return;
 clearDragPreview();targetAnchor=id;hoverAnchor=null;paintTarget();
 const choices=availableRelations().map(type=>{
  const spec=placementLabels[type];
  return `<button class="relation-choice" data-place-relation="${type}"><span class="relation-arrow" aria-hidden="true">${spec.arrow}</span><span class="relation-text">${spec.label}</span><small>${escape(spec.detail)}</small></button>`;
 }).join('');
 openDialog(`<h2 class="compact-relation-title">${escape(person(selected).name)}<span> は </span>${escape(person(id).name)}<span> の…</span></h2><div class="relation-choices ${isHorseStage(state.stage)?'three-choice':''}">${choices}</div><p id="placement-error" class="placement-error" role="alert"></p>`,'キャンセル','relation');
}
function chooseAnchor(){
 if(!selected)return;clearDragPreview();say(`${person(selected).name}の相手を選んでください。`);
 openDialog(`<h2>${escape(person(selected).name)}の相手を選ぶ</h2><div class="anchor-choices">${state.placed.map(id=>`<button class="anchor-choice" data-pick-anchor="${id}">${escape(person(id).name)}</button>`).join('')}</div>`,'戻る（選択札は保持）','anchor');
}
modal.addEventListener('click',e=>{
 const choice=e.target.closest('[data-place-relation]');if(choice&&!choice.disabled){attempt(choice.dataset.placeRelation);return;}
 const anchor=e.target.closest('[data-pick-anchor]');if(anchor){chooseRelations(anchor.dataset.pickAnchor);return;}
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
 selected=null;closeDialog();clearTargets();renderBoard(id);renderHand();animateDraw(beforeHand);renderStats();renderHint();fit(true);say(`${p.name}が、${a.name}の${relationName(relation)}としてつながりました。`);persist();
 if(state.complete)completeGame();
}
function showAnswer(){
 const answer=completedAnswer(state);
 if(!answer){say('答えを表示できませんでした。進行は変更されていません。',true);closeDialog();return;}
 try{answer.positions=layoutFamily(answer);}catch{say('完成図を作成できませんでした。進行は変更されていません。',true);closeDialog();return;}
 state=answer;selected=null;lineFocus=null;closeDialog();clearTargets();render();fit(false);persist();results();
}

function rankingTable(data){
 const entries=data.entries||[];
 if(!entries.length)return '<p class="score-subline">まだ記録がありません。</p>';
 return '<div class="ranking-table">'+entries.map(e=>'<div class="ranking-row'+(e.isYou?' is-you':'')+'"><b>'+e.rank+'位</b><span>'+escape(e.name)+'</span><b>'+formatTime(e.scoreMs)+'</b></div>').join('')+'</div>'+
 (data.yourRank?'<p class="score-subline">あなたの順位：'+data.yourRank+'位</p>':'');
}
async function showRankings(difficulty){
 if(!HORSE_DIFFICULTIES[difficulty])difficulty='normal';
 const label=HORSE_DIFFICULTIES[difficulty].label;
 openDialog('<p class="eyebrow">RANKING</p><h2>'+label+'ランキング</h2><p class="score-subline">補正タイム順 · 各プレイヤーの自己ベスト</p><p class="score-subline">読み込み中…</p>','閉じる');
 if(!onlineRankingEnabled){
  $('modal-content').innerHTML='<p class="eyebrow">RANKING</p><h2>'+label+'ランキング</h2><p>オンラインランキングは本番公開後に利用できます。</p>';return;
 }
 try{
  const data=await loadRankings(difficulty,playerIdentity());
  if(!modal.open)return;
  $('modal-content').innerHTML='<p class="eyebrow">RANKING</p><h2>'+label+'ランキング</h2><p class="score-subline">補正タイム順 · 1人1記録</p>'+
   rankingTable(data)+'<button class="text-button ranking-delete" data-action="ranking-delete-prompt">自分の登録記録を削除</button>';
  $('modal-content').querySelector('[data-action="ranking-delete-prompt"]')?.addEventListener('click',()=>{
   openDialog('<h2>登録情報を削除しますか？</h2><p>ランキングの表示名と記録を削除します。操作は取り消せません。</p><button class="button" data-action="ranking-delete-confirm">削除する</button>','戻る');
  });
 }catch(error){if(modal.open)$('modal-content').innerHTML='<h2>'+label+'ランキング</h2><p>'+escape(error.message)+'</p>';}
}
function showRankingSubmit(){
 if(!state?.complete||state.gaveUp||!isCurrentRankedStage(state.stage))return;
 const score=horseScore(state),name=rankingName();
 openDialog('<p class="eyebrow">SAVE SCORE</p><h2>ランキングに登録</h2><p class="score-subline">補正タイム '+formatTime(score.totalMs)+' · 自己ベストのみ登録</p>'+
 '<label class="ranking-name-label" for="ranking-name">表示名（1〜16文字）</label>'+
 '<input id="ranking-name" type="text" maxlength="16" autocomplete="nickname" placeholder="表示名" value="'+escape(name)+'">'+
 '<p class="score-subline">表示名は公開されます。本名や連絡先は入力しないでください。</p>'+
 '<button class="button" data-action="ranking-submit-confirm">この記録を登録</button>','戻る');
}
async function confirmRankingSubmit(){
 const field=$('ranking-name'),name=(field?.value||'').trim();
 if(!name||name.length>16||/[<>]/.test(name)){say('表示名を1〜16文字で入力してください。',true);return;}
 if(!onlineRankingEnabled){openDialog('<h2>ランキング準備中</h2><p>このプレビューでは記録を端末内に保存しています。公開後にオンライン登録が使えます。</p>');return;}
 const button=$('modal-content').querySelector('[data-action="ranking-submit-confirm"]');
 if(button)button.disabled=true;
 try{
  if(pendingRun)await pendingRun;
  const run=records.rankedRunTickets?.[state.stage.id],descriptor=randomDescriptorForStage(state.stage);
  if(!run?.ticket)throw Error(rankingError||'ランキング開始情報がありません。新しい問題から始めてください。');
  const identity=playerIdentity(),score=horseScore(state);
  const result=await submitRankedScore(identity,run,descriptor,state,score,name);
  saveRankingName(name);
  if(result.accepted){
   openDialog('<h2>記録を登録しました</h2><div class="score-result">'+formatTime(result.scoreMs)+'</div>'+
    '<p class="score-subline">'+(result.newBest?'自己ベストを更新しました。':'自己ベストを維持しました。')+
    (result.rank?' · '+result.rank+'位':'')+'</p><button class="button" data-action="ranking-view">ランキングを見る</button>');
  }
 }catch(error){openDialog('<h2>登録できませんでした</h2><p>'+escape(error.message)+'</p><button class="button secondary" data-action="ranking-submit">戻る</button>');}
}
async function confirmRankingDelete(){
 if(!onlineRankingEnabled)return;
 try{
  await deleteRankingAccount(playerIdentity());
  localStorage.removeItem('horse-pedigree:ranking-identity:v1');
  localStorage.removeItem('horse-pedigree:ranking-name');
  openDialog('<h2>登録情報を削除しました</h2><p>ランキングから削除しました。端末内のゲームの進行状況は残ります。</p>');
 }catch(error){openDialog('<h2>削除できませんでした</h2><p>'+escape(error.message)+'</p>');}
}
function results(){
 fit();
 const random=isRandomHorseStage(state.stage),ranked=rankedHorseStage(state.stage);
 const score=horseScore(state),difficulty=randomDescriptorForStage(state.stage)?.difficulty;
 const best=records.best[bestKeyForStage(state.stage,difficulty)];
 if(ranked&&!state.gaveUp){
  const wasBest=best&&Math.round(best.totalMs)===score.totalMs;
  openDialog(`<p class="eyebrow">PEDIGREE COMPLETED</p><h2>血統図完成</h2>
   <p class="score-subline">${escape(HORSE_DIFFICULTIES[difficulty]?.label||'')} · 12頭 · 最大4世代</p>
   <div class="score-result">${formatTime(score.totalMs)}</div>
   <p class="score-subline">補正タイム${wasBest?' · 自己ベスト':''}</p>
   <div class="score-breakdown">
    <span>実プレイ時間</span><span>${formatTime(score.timeMs)}</span>
    <span>ヒント（${score.hints}頭）</span><span>+${score.hintMs/1000}秒</span>
    <span>誤回答（${score.errors}回）</span><span>+${score.mistakeMs/1000}秒</span>
    <span>自動配置（${score.autoCount}頭）</span><span>+${score.autoMs/1000}秒</span>
   </div>
   <p class="score-subline">自己ベスト ${best?formatTime(best.totalMs):'--:--'}</p>
   <div class="score-result-actions">
    <button class="button" data-action="ranking-submit" ${onlineRankingEnabled&&isCurrentRankedStage(state.stage)?'':'disabled'}>ランキングに登録</button>
    <button class="button secondary" data-action="ranking-view">ランキングを見る</button>
    <button class="button secondary" data-action="random-retry-confirm">別の問題に挑戦</button>
    <button class="text-button" data-action="home">難易度選択に戻る</button>
   </div>`,'完成図を見る');
  return;
 }
 openDialog(`<p class="eyebrow">${state.gaveUp?'ANSWER REVEALED':'FAMILY TREE COMPLETED'}</p><h2>${state.gaveUp?'答えの血統図':'血統図完成'}</h2><p>${state.stage.title} · ${state.stage.people.length}頭</p>${state.gaveUp?'<p>全体の答えを表示したため、ランキングには登録できません。</p>':''}<div class="result-stats"><div>プレイ時間<b>${formatTime(state.elapsed)}</b></div><div>ミス<b>${state.mistakes}</b></div><div>ヒント<b>${hintCount()}</b></div></div><button class="button" data-action="home">難易度選択へ</button><button class="button secondary" data-action="random-retry-confirm">別の問題に挑戦</button>`,'完成図を見る');
}
// Pointer events unify mouse, pen and touch. No HTML Drag and Drop dependency on iOS.
$('hand').addEventListener('pointerdown',e=>{
 const button=e.target.closest('[data-card]');if(!button||e.button!==0||drag)return;
 e.preventDefault();updateTransform();
 const id=button.dataset.card,wasSelected=id===selected;
 if(!wasSelected)selectCard(id);
 drag={pointerId:e.pointerId,id,startX:e.clientX,startY:e.clientY,
  x:e.clientX,y:e.clientY,active:false,wasSelected};
 $('app').setPointerCapture(e.pointerId);
});
$('hand').addEventListener('click',e=>{
 if(e.detail!==0)return;
 const button=e.target.closest('[data-card]');
 if(button){if(selected===button.dataset.card)clearSelection();else selectCard(button.dataset.card);}
});
board.addEventListener('pointerdown',e=>{
 if(drag||modal.open||e.button!==0||e.target.closest('.board-tools'))return;e.preventDefault();board.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size===1)pan={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,node:e.target.closest('[data-node]')?.dataset.node,moved:false};else if(pan)pan.moved=true;
});
window.addEventListener('pointermove',e=>{
 if(drag&&e.pointerId===drag.pointerId){drag.x=e.clientX;drag.y=e.clientY;if(!drag.active&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>6){drag.active=true;$('drag-ghost').innerHTML=cardFace(drag.id);$('drag-ghost').classList.toggle('horse',isHorseStage(state.stage));for(const cls of ['sex-male','sex-female','sex-gelding','sex-unknown'])$('drag-ghost').classList.toggle(cls,sexTone(drag.id)===cls);$('drag-ghost').hidden=false;document.body.classList.add('drag-active');$('hand').querySelector(`[data-card="${drag.id}"]`)?.classList.add('dragging');frame=requestAnimationFrame(autoPan);}
 if(drag.active){$('hint-button').hidden=true;$('hint-box').hidden=true;const point=dragHotspot(e.clientX,e.clientY);$('drag-ghost').style.left=`${point.x}px`;$('drag-ghost').style.top=`${point.y}px`;hoverAt(point.x,point.y);}return;}
 if(!pointers.has(e.pointerId))return;const old=[...pointers.values()];pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const next=[...pointers.values()];
 if(pointers.size===2){const oldMid={x:(old[0].x+old[1].x)/2,y:(old[0].y+old[1].y)/2},mid={x:(next[0].x+next[1].x)/2,y:(next[0].y+next[1].y)/2},d1=Math.hypot(old[0].x-old[1].x,old[0].y-old[1].y),d2=Math.hypot(next[0].x-next[1].x,next[0].y-next[1].y),r=board.getBoundingClientRect();if(d1>2)zoomAt(d2/d1,oldMid.x-r.left,oldMid.y-r.top);camera.x+=mid.x-oldMid.x;camera.y+=mid.y-oldMid.y;updateTransform();if(pan)pan.moved=true;
 }else if(pan&&pan.id===e.pointerId){if(Math.hypot(e.clientX-pan.startX,e.clientY-pan.startY)>5)pan.moved=true;if(pan.moved){camera.x+=e.clientX-pan.x;camera.y+=e.clientY-pan.y;clearTargets();updateTransform();}pan.x=e.clientX;pan.y=e.clientY;}
});
function autoPan(){if(!drag?.active)return;const hotspot=dragHotspot(drag.x,drag.y),p=pointOnBoard(hotspot.x,hotspot.y);if(p.inside){if(!dragPlacement?.overSlot){const dx=p.x<28?3:p.x>board.clientWidth-28?-3:0,dy=p.y<34?3:p.y>board.clientHeight-34?-3:0;if(dx||dy){camera.x+=dx;camera.y+=dy;updateTransform();}}hoverAt(hotspot.x,hotspot.y);}frame=requestAnimationFrame(autoPan);}
function cancelDrag(){if(frame)cancelAnimationFrame(frame);frame=null;if(drag){try{if($('app').hasPointerCapture(drag.pointerId))$('app').releasePointerCapture(drag.pointerId);}catch{}}drag=null;hoverAnchor=null;clearDragPreview();$('drag-ghost').hidden=true;$('drag-ghost').classList.remove('in-board');document.body.classList.remove('drag-active');$('hand').querySelectorAll('.dragging').forEach(b=>b.classList.remove('dragging'));paintTarget();if(state){renderCaption();renderSelection();renderHint();}}
window.addEventListener('pointerup',e=>{
 if(drag&&e.pointerId===drag.pointerId){const active=drag.active,wasSelected=drag.wasSelected,hotspot=dragHotspot(e.clientX,e.clientY),
 point=pointOnBoard(hotspot.x,hotspot.y);
 if(active)hoverAt(hotspot.x,hotspot.y);
 const nodes=active?screenNodes(state.positions,camera):[];
 const exact=exactDropTarget(point,nodes);
 const crowded=ambiguousNearbyDrop(point,nodes);
 const suggested=dragPlacement?.anchorId,near=hoverAnchor;
 const directed=active&&camera.scale>=.55&&dragDropReady(dragPlacement,performance.now())?dragPlacement:null;
 cancelDrag();
 if(!active){if(wasSelected)clearSelection();return;}
 if(!point.inside)return;
 if(directed){targetAnchor=directed.anchorId;attempt(directed.relation);return;}
 if(exact.kind==='card'){chooseRelations(exact.id);return;}
 if(exact.kind==='ambiguous'||crowded){chooseAnchor();return;}
 if(suggested){chooseRelations(suggested);return;}
 if(near&&camera.scale>=.55){chooseRelations(near);return;}
 say('場のカードに重ねると、相手を指定できます。');
 return;}
 if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);if(pan&&pan.id===e.pointerId&&!pan.moved){if(selected){const point=pointOnBoard(e.clientX,e.clientY),id=pan.node||pickDropCard(point,screenNodes(state.positions,camera));if(id)chooseRelations(id);else clearSelection();}else if(pan.node)focusLines(pan.node);}
 if(pointers.size===1){const [id,p]=[...pointers.entries()][0];pan={id,x:p.x,y:p.y,startX:p.x,startY:p.y,moved:true};}else pan=null;
});
window.addEventListener('pointercancel',e=>{if(drag?.pointerId===e.pointerId){cancelDrag();clearTargets();}pointers.delete(e.pointerId);pan=null;});
window.addEventListener('blur',()=>{cancelDrag();pointers.clear();pan=null;if(!(modal.open&&dialogKind==='relation'))clearTargets();persist();lastTick=performance.now();});
$('nodes').addEventListener('click',e=>{if(e.detail!==0)return;const node=e.target.closest('[data-node]');if(node){if(selected)chooseRelations(node.dataset.node);else focusLines(node.dataset.node);}});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.open&&state){cancelDrag();clearSelection();}});
let previousWidth=0,previousHeight=0;
new ResizeObserver(()=>{if(!state||!board.clientWidth||!board.clientHeight)return;if(!previousWidth||!previousHeight||camera.scale<=0){previousWidth=board.clientWidth;previousHeight=board.clientHeight;fit(false);return;}camera.x+=(board.clientWidth-previousWidth)/2;camera.y+=(board.clientHeight-previousHeight)/2;previousWidth=board.clientWidth;previousHeight=board.clientHeight;updateTransform();positionHintButton();}).observe(board);
setInterval(()=>{const now=performance.now(),playingSheet=dialogKind==='relation'||dialogKind==='anchor';if(state&&!state.complete&&!document.hidden&&(!modal.open||playingSheet)){state.elapsed+=Math.max(0,Math.min(now-lastTick,1500));$('timer').textContent=formatTime(state.elapsed);$('score-timer').textContent=formatTime(horseScore(state).totalMs);if(now-lastSaved>10000){persist();lastSaved=now;}}lastTick=now;},500);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelDrag();pointers.clear();pan=null;persist();}lastTick=performance.now();});window.addEventListener('pagehide',persist);
document.addEventListener('error',event=>{
 if(event.target?.matches?.('img.horse-photo'))event.target.hidden=true;
},true);
renderHome();
const readGameJSON=async path=>{const response=await fetch(path);if(!response.ok)throw Error('Failed to load '+path);return response.json();};
void Promise.all([readGameJSON('./data/horse-pedigree.v1.json'),readGameJSON('./data/horse-fame-2026-10.v1.json'),
 readGameJSON('./data/horse-media.v1.json').catch(error=>{console.warn('Horse card photos unavailable, using illustrations',error);return {horses:{}};})
]).then(([snapshot,fame,media])=>{
 horsePhotos=media?.horses||{};
 // Validate that these scores belong to this exact pedigree data version.
 prepareHorseFame(snapshot,fame,prepareHorseGraph(snapshot));
 horseSnapshot=snapshot;fameSnapshot=fame;
 if(records.randomHorse){
  try{randomHorse=restoreRandomHorseSession(snapshot,records.randomHorse,{fameSnapshot:fame});}
  catch(error){console.warn('Could not restore previous random game',error);}
 }
 if(records.randomHorseLegacyEasy){
  try{randomHorseLegacyEasy=restoreRandomHorseSession(snapshot,records.randomHorseLegacyEasy,{fameSnapshot:fame});}
  catch(error){console.warn('Could not restore previous easy game',error);}
 }
 for(const level of Object.keys(HORSE_DIFFICULTIES)){
  const old=records.randomHorseLegacyByDifficulty?.[level];
  if(old)try{randomHorseLegacyByDifficulty[level]=restoreRandomHorseSession(snapshot,old,{fameSnapshot:fame});}catch(error){console.warn('Could not restore old '+level,error);}
  const oldV5=records.randomHorseLegacyV5ByDifficulty?.[level];
  if(oldV5)try{randomHorseLegacyV5ByDifficulty[level]=restoreRandomHorseSession(snapshot,oldV5,{fameSnapshot:fame});}catch(error){console.warn('Could not restore old v5 '+level,error);}
  const descriptor=records.randomHorseByDifficulty?.[level];
  if(!descriptor)continue;
  try{randomHorseByDifficulty[level]=restoreRandomHorseSession(snapshot,descriptor,{fameSnapshot:fame});}
  catch(error){console.warn('Could not restore '+level+' game',error);}
 }
 renderHome();
}).catch(error=>{console.error('Horse difficulty data unavailable',error);randomHorseError='競走馬データを読み込めませんでした。通信環境を確認してください。';renderHome();});
