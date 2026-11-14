/**
 * Small, audited supplemental parent-name facts from JBIS-Search.
 *
 * These are DISPLAY METADATA, NOT NEW GRAPH EDGES: a mother without a verified
 * matching Wikidata ID cannot be connected to another QID by name alone.
 * All entries must match the immutable snapshot's QID, name and birth year.
 * Never infer a missing dam from a shared sire or matching horse name.
 */
export const verifiedParentNames=Object.freeze({
 Q11321082:{name:'トウカイテイオー',year:1988,dam:'トウカイナチユラル',url:'https://www.jbis.or.jp/horse/0000207623/'},
 Q7661156:{name:'シンボリクリスエス',year:1999,dam:'Tee Kay',url:'https://www.jbis.or.jp/horse/0000700008/'},
 Q7939315:{name:'ウオッカ',year:2004,dam:'タニノシスター',url:'https://www.jbis.or.jp/horse/0000801136/'},
 Q111132529:{name:'パンサラッサ',year:2017,dam:'ミスペンバリー',url:'https://www.jbis.or.jp/horse/0001237701/'},
 Q102170294:{name:'レッドベルオーブ',year:2018,dam:'レッドファンタジア',url:'https://www.jbis.or.jp/horse/0001268970/'},
 Q17225135:{name:'ミッキーアイル',year:2011,dam:'スターアイル',url:'https://www.jbis.or.jp/horse/0001141719/'},
 Q24259003:{name:'マカヒキ',year:2013,dam:'ウィキウィキ',url:'https://www.jbis.or.jp/horse/0001171707/'},
 Q18337069:{name:'ショウナンパンドラ',year:2011,dam:'キューティゴールド',url:'https://www.jbis.or.jp/horse/0001140190/'},
 Q100450928:{name:'センテリュオ',year:2015,dam:'アドマイヤキラメキ',url:'https://www.jbis.or.jp/horse/0001202812/'},
 Q109260604:{name:'レッドジェネシス',year:2018,dam:'リュズキナ',url:'https://www.jbis.or.jp/horse/0001269926/'},
 Q10932646:{name:'デュランダル',year:1999,dam:'サワヤカプリンセス',url:'https://www.jbis.or.jp/horse/0000619835/'},
 Q109260579:{name:'サトノレイナス',year:2018,dam:'バラダセール',url:'https://www.jbis.or.jp/horse/0001269505/'},
 Q100450961:{name:'クルーガー',year:2012,dam:'アディクティド',url:'https://www.jbis.or.jp/horse/0001157765/'},
 Q109599095:{name:'サトノラーゼン',year:2012,dam:'トゥーピー',url:'https://www.jbis.or.jp/horse/0001157744/'},
 Q109260614:{name:'レッドルゼル',year:2016,dam:'フレンチノワール',url:'https://www.jbis.or.jp/horse/0001217307/'},
 Q111132564:{name:'アスクビクターモア',year:2019,dam:'カルティカ',url:'https://www.jbis.or.jp/horse/0001308957/'},
 Q111797326:{name:'プラダリア',year:2019,dam:'シャッセロール',url:'https://www.jbis.or.jp/horse/0001312416/'},
 Q101192716:{name:'キングオブコージ',year:2016,dam:'ファイノメナ',url:'https://www.jbis.or.jp/horse/0001223164/'},
 Q109260638:{name:'ファストフォース',year:2016,dam:'ラッシュライフ',url:'https://www.jbis.or.jp/horse/0001216121/'},
 Q104528327:{name:'ジョーカナチャン',year:2015,dam:'ラッキーダイス',url:'https://www.jbis.or.jp/horse/0001206679/'},
 Q101192043:{name:'ミュゼスルタン',year:2012,dam:'アスクデピュティ',url:'https://www.jbis.or.jp/horse/0001140460/pedigree/broodmare/'},
 Q109260761:{name:'アルバートドック',year:2012,dam:'ゴールデンドックエー',url:'https://www.jbis.or.jp/horse/0001157747/'}
});

export function verifiedDamName(horse){
 const evidence=verifiedParentNames[horse?.id];
 return evidence&&horse.name===evidence.name&&horse.birthYear===evidence.year?
   {name:evidence.dam,source:evidence.url}:null;
}
