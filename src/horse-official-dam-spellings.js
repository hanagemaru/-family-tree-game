/**
 * Official registered spellings that differ from common Wikipedia notation.
 *
 * Do not use this list as a large-scale racing data feed: these are individual
 * JRA primary-source checks for ambiguous orthography only. Horse QID/name/year
 * must all agree before overriding the Wikimedia supplementary display name.
 */
export const officialDamSpellings=Object.freeze({
 Q11321082:{
  name:'トウカイテイオー',
  year:1988,
  dam:'トウカイナチユラル',
  url:'https://www.jra.go.jp/gallery/dendo/horse23/index.html',
  provider:'JRA'
 }
});
export function verifiedOfficialDamName(horse){
 const record=officialDamSpellings[horse?.id];
 return record&&record.name===horse.name&&record.year===horse.birthYear?
  {name:record.dam,source:record.url,provider:record.provider}:null;
}
