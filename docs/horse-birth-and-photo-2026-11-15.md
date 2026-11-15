# 競走馬の生年・写真データ追加（2026-11-15）

## 生年

- 競走馬スナップショット：991頭のQIDのうち、名前がある**出題対象872頭**に生年情報を収録
- 既収録866頭はWikidataの生年月日（P569）ベース。欠損していた6頭は、JBISの個体情報・繁殖牝馬情報・血統表で照合し補完
- **現在：872/872頭、出題対象の生年不明0頭**
- 未命名の119頭（関係を維持するためのQIDノード）は出題せず、未判明の生年を無理に補完しない
- 補完した6頭のQID・出典URLは [data/source/horse-birth-enrichment-2026-11-15.json](../data/source/horse-birth-enrichment-2026-11-15.json)
- カードに「2019年生」の形で表示。手札と場で共通の無料情報（ヒント10秒とは別）。親子関係そのものの答えは表示しない

## 写真

- 対象872頭のWikidata P18と、P18が欠落した場合の日本語・英語Wikipediaのページ画像を取得
- Wikimedia Commonsの **imageinfo.extmetadata** で原本ページ・撮影者・ライセンスを照合
- 利用可能なライセンス：CC BY、CC BY-SA（2.0〜4.0）、CC0、Public domain
- **371/872頭（42.5%）**に、固有のライセンス確認済み写真ファイルを収録
- 初期収集の候補536ファイルに、P18の汎用画像「Requestpicture.JPG」が紛れ込んでいたため除外。複数の馬に使い回された画像も除外。権利の曖昧な「Copyrighted free use」は除外
- 最終的に異なる写真ファイル371件／371頭。**Wikimedia閲覧数で上位40頭中39頭**に写真がある
- 写真はWikimediaの画像配信URLを参照し、GitHubに画像バイナリを丸ごと複製しない
- 各カードの写真は元イラストの上に重ねる。写真未収録・読み込みエラーの場合はイラストが見える
- 写真使用時の著作者、原本Commonsページ、採用ライセンス、カードでの切り抜き表示について、ゲーム内「題材・出典」に列挙

### 手動照合の例

- [ディープインパクト：Goki撮影・CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:Deep_Impact(horse)20060430R1.jpg)
- [キタサンブラック：Ogiyoshisan撮影・CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:Kitasan-Black_IMG_7729r_R_20151025.JPG)
- [イクイノックス：Akinori Morita撮影・CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:%E3%82%A4%E3%82%AF%E3%82%A4%E3%83%8E%E3%83%83%E3%82%AF%E3%82%B9.jpg)
- [テイエムオペラオー：Goki原写真、RandomEditsForWhenIRemember切り抜き・CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:TM_Opera_O_123rd_Tennosho_(crop).jpg)。WikidataのP18は「Copyrighted free use」のため使わず、同一馬であることをCommons構造化データで確認した代替写真に変更。詳細は [手動補完の根拠](../data/source/horse-curated-photo-2026-11-15.json)

### 再取得・注意点

- コレクター：[scripts/collect_horse_media.py](../scripts/collect_horse_media.py)
- 結果JSON：[data/horse-media.v1.json](../data/horse-media.v1.json)
- 集計：[docs/horse-photo-collection-2026-11-15.md](horse-photo-collection-2026-11-15.md)
- ワークフロー：[Collect licensed horse photos (Wikimedia)](https://github.com/hanagemaru/-family-tree-game/actions/workflows/collect-horse-media.yml)
- 馬と写真との紐付けは、**Wikidata P18・Wikipediaの対応記事を機械照合したもので、全371頭の写真を個別に目視確認したわけではない**。最終公開前に主要な馬を順に目視し、疑義がある画像は表示しない
- Commonsの権利情報は変わり得るため、定期的な再取得が必要。商業目的・改変表示で使う場合は、個々のファイルページに記載されたライセンス条件を遵守すること

## 品質保証

- [tests/horse-birth-photo.test.js](../tests/horse-birth-photo.test.js)：872頭全件の生年、親子の生年差、QID付き出典、カードの表示、写真のURL・ライセンス・重複除外
- [tests/dom-harness.js](../tests/dom-harness.js)から実際の画像スナップショットを読み、写真を描画するカードと撮影者クレジットのUIを検査
- [scripts/browser-difficulty-smoke.mjs](../scripts/browser-difficulty-smoke.mjs)：モバイルのChromium・WebKitでカード操作と画面読み込みを検証

本番サイトは変更していません。ゲーム本体はドラフトPR #13で引き続き検証。
