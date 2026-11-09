// Deliberately selected subsets, not complete historical family trees.
const archives={label:'国立公文書館「御実紀（台徳院殿御実紀）」',url:'https://www.archives.go.jp/exhibition/digital/rekishitomonogatari/contents/44.html'};
const edo={label:'江戸東京博物館「江〜姫たちの戦国〜」',url:'https://edo-tokyo-museum.or.jp/s-exhibition/go2011/'};
const museum={label:'徳川美術館「徳川美術館について」',url:'https://www.tokugawa-art-museum.jp/about-us/'};
const deep={label:'JRA「ディープインパクト＆ジェンティルドンナ」',url:'https://jra.jp/special/jra70th/tsunagu/story/deep_gentil/'};
const horsePage=(name,path)=>({label:`JRA「${name}」`,url:`https://www.jra.go.jp/${path}`});
const cabinet={label:'内閣府「元禄期の政治と徳川将軍家」',url:'https://www.bousai.go.jp/kyoiku/kyokun/pdf/genroku_light.pdf'};
const branches={label:'名古屋市図書館「徳川御三家系図」',url:'https://www.library.city.nagoya.jp/img/kensaku/osusume/adult2010/yamada_201010.pdf'};
const owari={label:'徳川林政史研究所「尾張藩・尾張徳川家の基礎知識」',url:'https://rinseishi.tokugawa.or.jp/kenkyukatsudo/owari/'};
const jbis=(name,id)=>({label:`JBISサーチ「${name}」`,url:`https://www.jbis.or.jp/horse/${id}/`});
const p=(id,name,short,generation,parents,clues,source,spouses=[])=>({id,name,short,generation,parents,spouses,clues,source});
export const stages=[{
 id:'tokugawa',title:'徳川家のはじまり',category:'日本の歴史',tag:'親子・夫婦・きょうだい',symbol:'結',anchor:'hidetada',summary:'家康、秀忠、家光。そして御三家へ。',description:'秀忠を起点に、将軍家と御三家のつながりをたどります。',scope:'登場人物は一部抜粋。実親子と、登場人物間の婚姻を扱います。養子・将軍の継承順は親子関係に含めません。兄弟姉妹には異母・異父の関係も含みます。',sources:[archives,museum,edo],
 people:[
 p('ieyasu','徳川家康','家康',0,[],['江戸幕府を開いた初代将軍。','秀忠と、御三家の祖となる3人の父。'],museum),
 p('hidetada','徳川秀忠','秀忠',1,['ieyasu'],['江戸幕府の第2代将軍。','家康の子。江の夫で、家光・忠長・千姫の父。'],archives,['go']),
 p('go','江（崇源院）','江',1,[],['浅井長政とお市の娘。','秀忠の正室。家光・忠長・千姫の母。'],archives,['hidetada']),
 p('iemitsu','徳川家光','家光',2,['hidetada','go'],['江戸幕府の第3代将軍。','秀忠と江の子。千姫・忠長のきょうだい。'],archives),
 p('tadanaga','徳川忠長','忠長',2,['hidetada','go'],['駿府城主となった人物。','秀忠と江の子。家光の弟。'],edo),
 p('sen','千姫','千姫',2,['hidetada','go'],['豊臣秀頼に嫁いだ姫。','秀忠と江の娘。家光・忠長の姉。'],archives),
 p('yoshinao','徳川義直','義直',1,['ieyasu'],['尾張徳川家の初代。','家康の九男。秀忠・頼宣・頼房とは兄弟。'],museum),
 p('yorinobu','徳川頼宣','頼宣',1,['ieyasu'],['紀伊徳川家の祖。','家康の十男。秀忠・義直・頼房とは兄弟。'],museum),
 p('yorifusa','徳川頼房','頼房',1,['ieyasu'],['水戸徳川家の祖。','家康の十一男。秀忠・義直・頼宣とは兄弟。'],museum),
 p('ietsuna','徳川家綱','家綱',3,['iemitsu'],['江戸幕府の第4代将軍。','家光の子。綱重・綱吉の兄。'],cabinet),
 p('tsunayoshi','徳川綱吉','綱吉',3,['iemitsu'],['江戸幕府の第5代将軍。','家光の子。家綱・綱重の弟。'],cabinet),
 p('tsunashige','徳川綱重','綱重',3,['iemitsu'],['甲斐甲府藩主を務めた。','家光の子で、家宣の父。'],cabinet),
 p('ienobu','徳川家宣','家宣',4,['tsunashige'],['江戸幕府の第6代将軍。','実父は綱重。家継の父。'],cabinet),
 p('ietsugu','徳川家継','家継',5,['ienobu'],['幼くして将軍になった第7代将軍。','家宣の実子。'],cabinet),
 p('mitsukuni','徳川光圀','光圀',2,['yorifusa'],['水戸藩の第2代藩主。','頼房の子。「水戸黄門」としても知られる。'],branches),
 p('mitsusada','徳川光貞','光貞',2,['yorinobu'],['紀州藩の第2代藩主。','頼宣の子。吉宗の父。'],branches),
 p('yoshimune','徳川吉宗','吉宗',3,['mitsusada'],['享保の改革を進めた第8代将軍。','紀州徳川家の光貞の子。'],cabinet),
 p('mitsutomo','徳川光友','光友',2,['yoshinao'],['尾張藩の第2代藩主。','義直の子で、尾張徳川家を継いだ。'],owari)
 ]
},{
 id:'thoroughbred',title:'サンデーからつながる名馬',category:'競走馬の血統',tag:'父母・産駒・きょうだい',symbol:'駿',anchor:'deep',summary:'三冠馬から、次の世代の名馬たちへ。',description:'ディープインパクトを起点に、父母と産駒の系譜をたどります。',scope:'登場馬は一部抜粋。登録上の実父・実母を扱います。きょうだいには父または母が共通する半きょうだいも含みます。馬に「配偶者」の関係は設定していません。',sources:[deep,horsePage('キタサンブラック','gallery/dendo/horse34/'),horsePage('イクイノックス','gallery/dendo/horse38/'),horsePage('キズナ','gallery/3minmeiba/horse15/index.html'),horsePage('コントレイル','gallery/3minmeiba/horse48/index.html'),horsePage('オルフェーヴル','gallery/dendo/horse31/'),{label:'社台スタリオンステーション「オルフェーヴル」',url:'https://shadai-ss.com/stallion/orfevre/'}],
 people:[
 p('sunday','サンデーサイレンス','サンデーサイレンス',0,[],['日本競馬の血統に大きな影響を与えた種牡馬。','ディープインパクト、ブラックタイド、ステイゴールドの父。'],deep),
 p('wind','ウインドインハーヘア','ウインドインハーヘア',0,[],['ドイツのG1を制した牝馬。','ブラックタイドとディープインパクトの母。'],deep),
 p('deep','ディープインパクト','ディープインパクト',1,['sunday','wind'],['無敗でクラシック三冠を達成。','父はサンデーサイレンス、母はウインドインハーヘア。'],deep),
 p('black','ブラックタイド','ブラックタイド',1,['sunday','wind'],['キタサンブラックを送り出した種牡馬。','ディープインパクトの全兄。父と母が同じ。'],deep),
 p('stay','ステイゴールド','ステイゴールド',1,['sunday'],['香港ヴァーズを制した種牡馬。','サンデーサイレンスの子。オルフェーヴル、ゴールドシップの父。'],{label:'JRA-VAN World「ステイゴールド」',url:'https://world.jra-van.jp/db/horse/H0986/'}),
 p('kizuna','キズナ','キズナ',2,['deep'],['2013年の日本ダービーを制覇。','父はディープインパクト。'],horsePage('キズナ','gallery/3minmeiba/horse15/index.html')),
 p('contrail','コントレイル','コントレイル',2,['deep'],['2020年、無敗でクラシック三冠を達成。','父ディープインパクトとの父子無敗三冠。'],horsePage('コントレイル','gallery/3minmeiba/horse48/index.html')),
 p('gentil','ジェンティルドンナ','ジェンティルドンナ',2,['deep'],['牝馬三冠とジャパンカップ連覇を達成。','父はディープインパクト、母はドナブリーニ。'],horsePage('ジェンティルドンナ','gallery/3minmeiba/horse38/index.html')),
 p('orfevre','オルフェーヴル','オルフェーヴル',2,['stay'],['2011年のクラシック三冠馬。','父はステイゴールド。ゴールドシップとは父が同じ。'],horsePage('オルフェーヴル','gallery/dendo/horse31/')),
 p('gold','ゴールドシップ','ゴールドシップ',2,['stay'],['皐月賞・菊花賞・有馬記念などを制覇。','父はステイゴールド。オルフェーヴルとは父が同じ。'],{label:'社台スタリオンステーション「オルフェーヴル」',url:'https://shadai-ss.com/stallion/orfevre/'}),
 p('kitasan','キタサンブラック','キタサンブラック',2,['black'],['菊花賞、天皇賞、有馬記念などを制覇。','父はブラックタイド。イクイノックスの父。'],horsePage('キタサンブラック','gallery/dendo/horse34/')),
 p('equinox','イクイノックス','イクイノックス',3,['kitasan'],['2023年にジャパンカップを制覇。','父はキタサンブラック、父の父はブラックタイド。'],horsePage('イクイノックス','gallery/dendo/horse38/')),
 p('hearts','ハーツクライ','ハーツクライ',1,['sunday'],['2005年の有馬記念でディープインパクトに勝利。','父はサンデーサイレンス。ディープとは父が同じ。'],horsePage('ハーツクライ','gallery/3minmeiba/horse36/')),
 p('daiwa','ダイワメジャー','ダイワメジャー',1,['sunday'],['マイルチャンピオンシップを連覇。','父はサンデーサイレンス。'],horsePage('ダイワメジャー','gallery/update/race_horse/jrasho/2007.html')),
 p('special','スペシャルウィーク','スペシャルウィーク',1,['sunday'],['1998年の日本ダービーを制覇。','父はサンデーサイレンス。ブエナビスタの父。'],horsePage('スペシャルウィーク','gallery/3minmeiba/horse9/')),
 p('buena','ブエナビスタ','ブエナビスタ',2,['special'],['牝馬二冠、ジャパンカップなどを制覇。','父はスペシャルウィーク。'],horsePage('ブエナビスタ','gallery/3minmeiba/horse20/')),
 p('satono','サトノダイヤモンド','サトノダイヤモンド',2,['deep'],['2016年の菊花賞と有馬記念を制覇。','父はディープインパクト。'],jbis('サトノダイヤモンド','0001175221')),
 p('loves','ラヴズオンリーユー','ラヴズオンリーユー',2,['deep'],['海外G1のBCフィリー＆メアターフを制覇。','父はディープインパクト。'],jbis('ラヴズオンリーユー','0001221351')),
 p('gran','グランアレグリア','グランアレグリア',2,['deep'],['マイル路線などでG1を6勝。','父はディープインパクト。'],jbis('グランアレグリア','0001220947')),
 p('fierement','フィエールマン','フィエールマン',2,['deep'],['天皇賞（春）を連覇。','父はディープインパクト。'],jbis('フィエールマン','0001204307')),
 p('lilac','ラッキーライラック','ラッキーライラック',3,['orfevre'],['大阪杯とエリザベス女王杯などを制覇。','父はオルフェーヴル。'],{label:'JRA「ラッキーライラック」',url:'https://www.jra.go.jp/JRADB/accessU.html?CNAME=pw01dud002015105046%2FAC'}),
 p('oju','オジュウチョウサン','オジュウチョウサン',2,['stay'],['中山グランドジャンプを6回制覇。','父はステイゴールド。'],horsePage('オジュウチョウサン','gallery/dendo/horse39/')),
 p('sol','ソールオリエンス','ソールオリエンス',3,['kitasan'],['2023年の皐月賞馬。','父はキタサンブラック。'],{label:'JRA「ソールオリエンス」',url:'https://www.jra.go.jp/JRADB/accessU.html?CNAME=pw01dud102020102899%2FA6'}),
 p('geraldina','ジェラルディーナ','ジェラルディーナ',3,['gentil'],['2022年のエリザベス女王杯を制覇。','母はジェンティルドンナ。母の父はディープインパクト。'],{label:'JRA「ジェラルディーナ」',url:'https://www.jra.go.jp/JRADB/accessU.html?CNAME=pw01dud102018105081%2F38'})
 ]
}];
export const stageById=id=>stages.find(s=>s.id===id);
