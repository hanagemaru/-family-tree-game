/** Racehorse sex corroborated against primary JRA/JBIS profile pages.
 * Each QID was matched to a Japanese horse name and birth year, not merely a name string.
 * "gelding" is a racehorse registration category, not a denial of biological male sex.
 */
export const officialHorseSex=Object.freeze({
 Q11321082:{
  sex:'male',name:'トウカイテイオー',birthYear:1988,
  source:'https://www.jra.go.jp/gallery/dendo/horse23/',provider:'JRA'
 },
 Q140512508:{
  sex:'gelding',name:'ボールドブライアン',birthYear:1999,
  source:'https://sp.jra.jp/JRADB/accessU.html?CNAME=sj01ude101999100620%2FAA',provider:'JRA'
 },
 Q140512523:{
  sex:'gelding',name:'エリモマキシム',birthYear:1999,
  source:'https://www.jbis.or.jp/horse/0000618990/',provider:'JBIS'
 }
});
