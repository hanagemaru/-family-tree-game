# 「競走馬血統ならべ」初回公開チェックリスト（2026-11-14）

## 確定
- 正式名：**競走馬血統ならべ**（「ならべ」シリーズ第1弾）。
- 第1弾は競走馬のみ公開。徳川家は将来別アプリ。共通エンジンの切り出しは現時点で不要。
- リポジトリ：`hanagemaru/-family-tree-game` を競走馬単独の公開起点として使う。

## 実装済み（feature/horse-pedigree-narabe-launch-20261114）
- [x] タイトル、ページ説明、OG・Twitterのテキスト共有メタデータを競走馬専用へ更新。
- [x] トップから歴史人物の紹介を外す。「ランダム18頭」「固定24頭」の2モードだけ表示。
- [x] シリーズ表記「ならべシリーズ 第1弾」、馬の親子関係のデモに統一。
- [x] スポーツトレカ風の控えめな競走馬ブランドアイコン・faviconを独自SVGで作成。
- [x] Web App Manifestを追加。ホーム画面に追加するための基本メタデータ。
- [x] ビルド対象に`launch.css`、`manifest.webmanifest`を追加。
- [x] 既存の徳川家データ・ゲーム判定・保存データは**削除せず**維持。公開メニューからは非表示。
- [x] 血統の出典画面を競走馬向けに整理。Wikidata/日本語Wikipediaの出典と留保を説明。
- [x] READMEとリリース方針を正式名へ更新。

## コード検証
- [x] Node.js 101件・Python 6件・静的ビルドが成功（[CI #43603705597](https://github.com/hanagemaru/-family-tree-game/actions/runs/43603705597)）。
- [x] Chromium / WebKit の390×844相当の実ブラウザでホーム2モード・ドラッグ・ヒント・完成を確認（同CI、画面画像もartifactに保存）。
- [ ] iPhone実機のSafariで縦表示・手札・スクロール・ヒント・全体ズームを目視確認。
- [ ] Android Chromeなどの別端末があれば追試。

## 本番公開のための未完了
- [ ] Cloudflare Pagesに**独立したプロジェクト**として接続する。既存の`hanage.app`ハブの公開内容を上書きしない。
- [ ] Cloudflare Pages：リポジトリ`hanagemaru/-family-tree-game`、Production branch `main`、Build command `npm run build`、Output directory `dist`。Node.js 22系を推奨。
- [ ] 公開先ドメインを確定。候補：`keito.hanage.app`（**提案段階で未設定**）。CloudflareのCustom DomainsでDNSを接続。
- [ ] 本番URLにアクセスし、ルート表示・CSS/JS/データ読み込み・iOSの実機動作を確認。
- [ ] 本番の正式URLが決まったら、canonical・OG URLを絶対URLで設定し、必要ならOG用画像を準備。
- [ ] `hanage.app`のハブサイトから、新アプリへリンク。既存ゲームのリンクやランキングは変更しない。
- [ ] 広告・アクセス解析を導入する場合は、プライバシー案内と公開要件を追加検証（現状は広告/解析を新設していない）。
- [ ] 使用したデータのライセンス・出典の最終確認。特にWikipediaの版と記事リンクを維持する。
- [ ] 商標・同名サービスとの重複がないか正式公開前に確認。
- [ ] 開始からクリアまで数回のランダム問題を実機試遊し、難易度やレイアウトに破綻がないか確認。

## 運用上の注意
- 今回の改修はゲームのルールや保存形式を変更しない。既存のローカル保存キー `family-tree-game:v1` は維持。
- 公開済みサイトを既に設定したと主張しない。Cloudflareアカウントの接続・DNS・公開URLは別作業。
- Web App Manifestの追加のみでオフライン対応が成立するわけではない。Service Workerは未導入。
- 新しい写真素材は未導入。既存の共通ベクター馬図柄を使用する。
