# Wikidata競走馬データ・画像の実測検証（2026-11-11）

## 概要

**結論：競走馬をランダム出題するための最小限の血統データ基盤をWikidataから作ることは現実的。** ただし本検証は起点付近の部分取得であり、そのまま商用データの正確性、全難易度の実現、24枚のバランス良い出題を保証しない。

検証実行：GitHub Actions [#43021772462](https://github.com/hanagemaru/-family-tree-game/actions/runs/43021772462)（成功）。実行日時：2026-11-11 UTC。実行コード：`scripts/research_wikidata_horses.py`。

## 計測対象と方法

- 現行ステージ **24頭**＋追加候補の有名馬 **16頭**、合計40頭の日本語名から出発。Wikidataのウマ型（`P31/P279*` → `Q726`）に絞って固有のQIDを取得。
- それらの父（`P22`）・母（`P25`）を最大2世代さかのぼって取得。さらにディープインパクト（`Q730381`）の子にあたる項目をSPARQLで列挙（上限350）。
- 取得された**親子辺だけ**を使って無向グラフの連結成分を計測。姻戚・馬の交配相手などを連結判定に使用していない。
- Wikidata `P18` が参照する画像ファイルのうち、現行24頭の個別ファイルについてWikimedia Commons `imageinfo.extmetadata` からライセンス表記を取得。
- 取得は少数回の公開API呼び出しで行い、JRA/JBISの制限付きデータベースを無断収集していない。

## 実測結果

| 指標 | 結果 |
|---|---:|
| 指定した著名馬のQIDを特定 | **40 / 40頭** |
| 現行24頭：父の項目あり | **24 / 24頭** |
| 現行24頭：母の項目あり | **21 / 24頭** |
| 現行24頭：父母両方あり | **21 / 24頭** |
| 現行24頭：ディープ周辺の連結成分内 | **24 / 24頭** |
| 追加候補を含む40頭：同じ連結成分内 | **39 / 40頭** |
| 今回の部分取得で得た馬の項目 | **288頭** |
| ディープと父母辺で連結する項目 | **285頭** |
| ディープの子として直接取得 | **181頭** |
| 現行24頭：Wikidata `P18` 画像参照あり | **24 / 24頭** |
| 現行24頭：Commons画像ライセンス表記取得 | **24 / 24頭** |

この285頭は**今回の探索範囲内の連結グラフ**であり、Wikidataに登録された全競走馬の総数ではない。

### 母（P25）の情報が欠けている3頭

- スペシャルウィーク
- オジュウチョウサン
- ソールオリエンス

Wikidataにないという意味であり、実際の母馬が不明という意味ではない。使う場合は信頼できる公開資料で裏取りして補完する。

### 24枚のカード画像のライセンス内訳

| Wikimedia Commonsの表記 | 件数 | 利用上の注意 |
|---|---:|---|
| CC BY-SA 4.0 | 11 | 著作者表示、改変画像の継承条件 |
| CC BY-SA 3.0 | 10 | 同上 |
| CC BY 3.0 | 2 | 著作者表示 |
| Public domain | 1 | ページごとに権利状態を確認 |
| **計** | **24** | 24頭すべて個別ファイルでメタデータ取得済み |

**重要：P18参照があるだけでは再利用許諾にはならない。** 今回は追加でCommons側のファイル別メタデータを確認した。画像は実際に採用する前に、著作者・ライセンス・帰属表示方法・写真に写り込む他の権利・画像の馬との一致を確認すること。**ゲームへ画像の追加はまだ行っていない。**

具体例：[ディープインパクトのCommons写真](https://commons.wikimedia.org/wiki/File:Deep_Impact(horse)20060430R1.jpg) はGoki撮影、CC BY-SA 3.0等の選択式ライセンス表示あり。JRA公式サイト等の画像は別途許諾が必要であり、Commons写真と混同しない。

## 再実行

GitHub Actions [Wikidata horse coverage audit](https://github.com/hanagemaru/-family-tree-game/actions/workflows/wikidata-horse-audit.yml) から再実行できる構成。あるいは標準Pythonで `python3 scripts/research_wikidata_horses.py`。

実行時の `artifacts/wikidata-horse-audit.md` は24頭のQIDとCommonsの画像リンク・ライセンスを、JSONは288頭の個体・親ID・画像参照の記録を含む。GitHub Actionsの**wikidata-horse-audit**成果物として保存されている。

## 追加課題

1. **父母・生年・馬名の正しさ**を検証。データ項目と実際の馬が一致するかを検査し、同名異馬を除外。
2. 285頭から「1プレイ24頭」の**連結な問題をランダム生成**し、重複度、世代の広がり、兄弟が多すぎないかを100回ほど試す。285頭に連結していることだけでは面白い24頭が得られるとは限らない。
3. アプリ側の `generation` 付きの木図に変換する際、父母双方が登場し複数の産駒がいるときの並べ方・交差を検証。
4. カード写真の表示、権利・作者クレジットの保持、画像の読み込み失敗時の代替イラストを検討。
5. 日本の競馬ファンが「知っている」馬の難易度は、客観的な正答率によって調整する。

## 一次資料

- [Wikidataの馬・父・母のSPARQLクエリ例](https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service/queries/examples/ja)
- [WikidataのCC0](https://www.wikidata.org/wiki/Wikidata:Licensing)
- [Commonsの再利用要件](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/licenses/en)
- [Commons画像のAPI仕様](https://www.mediawiki.org/wiki/API:Imageinfo)
