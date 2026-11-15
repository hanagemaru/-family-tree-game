/** All ranked runs use the same simple time-plus-penalty contract. */
export const HORSE_SCORE_VERSION='horse-score-v2-v6-12x4';
export const HORSE_SCORE_PENALTIES=Object.freeze({hint:10_000,mistake:15_000,auto:45_000});

export function horseScore(state){
 const auto=new Set(state.autoPlacedIds||[]);
 const hints=Object.entries(state.hints||{}).filter(([id,n])=>n>=1&&!auto.has(id)).length;
 const autoCount=auto.size;
 const errors=state.mistakes||0;
 const timeMs=Math.round(state.elapsed||0);
 const hintMs=hints*HORSE_SCORE_PENALTIES.hint;
 const mistakeMs=errors*HORSE_SCORE_PENALTIES.mistake;
 const autoMs=autoCount*HORSE_SCORE_PENALTIES.auto;
 return {version:HORSE_SCORE_VERSION,timeMs,hints,autoCount,errors,hintMs,mistakeMs,autoMs,
  penaltyMs:hintMs+mistakeMs+autoMs,totalMs:timeMs+hintMs+mistakeMs+autoMs};
}
export function useHorseHint(state,cardId){
 if(!state||state.complete||!state.hand.includes(cardId)||(state.hints[cardId]||0)>=1)return false;
 state.hints[cardId]=1;
 (state.actions??=[]).push({type:'hint',cardId,at:Math.round(state.elapsed)});
 return true;
}
export function rankedHorseStage(stage){
 return (stage?.id?.includes(':horse-stage-v5:')||stage?.id?.includes(':horse-stage-v6:'))&&stage.people?.length===12;
}
